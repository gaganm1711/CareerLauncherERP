const { sqlite, getPostgresClient } = require('./db');
const fs = require('fs');
const path = require('path');

let isSyncing = false;
let syncStatus = 'idle'; // 'idle', 'syncing', 'offline', 'error'
let lastSyncAt = null;

// Helper to write logs to centralized file
function logMessage(msg) {
  const time = new Date().toISOString();
  const logStr = `[${time}] [SYNC] ${msg}\n`;
  console.log(logStr.trim());
  try {
    const appDataDir = process.env.APPDATA || path.join(require('os').homedir(), 'AppData', 'Roaming');
    const logFile = path.join(appDataDir, 'career-launcher-erp', 'logs', 'app.log');
    fs.appendFileSync(logFile, logStr);
  } catch (err) {
    // Ignore log write failures
  }
}

// Order of tables for foreign key integrity
const SYNCABLE_MODELS = [
  { name: 'user', pk: 'id', hasUpdatedAt: true },
  { name: 'teacher', pk: 'id', hasUpdatedAt: true },
  { name: 'batch', pk: 'id', hasUpdatedAt: true },
  { name: 'student', pk: 'id', hasUpdatedAt: true },
  { name: 'attendance', pk: 'id', hasUpdatedAt: true },
  { name: 'feeRecord', pk: 'id', hasUpdatedAt: false },
  { name: 'exam', pk: 'id', hasUpdatedAt: true },
  { name: 'examMark', pk: 'id', hasUpdatedAt: true },
  { name: 'auditLog', pk: 'id', hasUpdatedAt: false },
  { name: 'teacherAttendance', pk: 'id', hasUpdatedAt: true },
  { name: 'studentSelectedClasses', pk: 'id', hasUpdatedAt: true },
  { name: 'studentBatchMapping', pk: 'id', hasUpdatedAt: true },
  { name: 'feePlan', pk: 'id', hasUpdatedAt: true },
  { name: 'eMIInstallment', pk: 'id', hasUpdatedAt: true }
];

// Align SQLite Batch IDs with Postgres Batch IDs if names match
async function alignBatchIds(postgres) {
  try {
    logMessage("Starting Batch ID alignment check...");
    const localBatches = await sqlite.batch.findMany();
    const remoteBatches = await postgres.batch.findMany();

    for (const localBatch of localBatches) {
      const remoteBatch = remoteBatches.find(b => b.name === localBatch.name);
      if (remoteBatch && remoteBatch.id !== localBatch.id) {
        logMessage(`Aligning Batch ID for "${localBatch.name}": local [${localBatch.id}] -> remote [${remoteBatch.id}]`);
        
        // Disable foreign keys temporarily and run update sequence in SQLite
        await sqlite.$executeRawUnsafe('PRAGMA foreign_keys = OFF;');
        
        await sqlite.batch.update({
          where: { id: localBatch.id },
          data: { id: remoteBatch.id }
        });
        
        await sqlite.student.updateMany({
          where: { batchId: localBatch.id },
          data: { batchId: remoteBatch.id }
        });

        await sqlite.studentBatchMapping.updateMany({
          where: { batchId: localBatch.id },
          data: { batchId: remoteBatch.id }
        });

        await sqlite.exam.updateMany({
          where: { batchId: localBatch.id },
          data: { batchId: remoteBatch.id }
        });

        // Update implicit many-to-many join table for Batch & Teacher
        await sqlite.$executeRawUnsafe(
          'UPDATE "_BatchToTeacher" SET "A" = ? WHERE "A" = ?',
          remoteBatch.id,
          localBatch.id
        );

        await sqlite.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
        logMessage(`Batch ID aligned successfully for "${localBatch.name}"`);
      }
    }
  } catch (err) {
    logMessage(`Error during batch ID alignment: ${err.message}`);
  }
}

// Perform full copy from SQLite to Postgres on startup if Postgres is empty
async function initialSeedPostgres(postgres) {
  try {
    logMessage("Running initial database migration check...");
    
    const userCount = await postgres.user.count();
    const studentCount = await postgres.student.count();
    const batchCount = await postgres.batch.count();
    
    // Consider PG empty if no students, no batches, and at most the default seeded admin
    const isPgEmpty = (userCount <= 1 && studentCount === 0 && batchCount === 0);
    
    if (!isPgEmpty) {
      logMessage("PostgreSQL already has records. Skipping initial copy.");
      return;
    }
    
    logMessage("PostgreSQL is empty. Performing complete SQLite -> Postgres copy.");

    // Delete seeded user in postgres if exists to prevent unique key conflict
    await postgres.user.deleteMany();

    // 1. Copy Settings
    const settings = await sqlite.systemSetting.findMany();
    for (const item of settings) {
      await postgres.systemSetting.upsert({
        where: { key: item.key },
        create: item,
        update: item
      });
    }

    // 2. Copy all other syncable tables in order
    for (const model of SYNCABLE_MODELS) {
      const records = await sqlite[model.name].findMany();
      logMessage(`Copying ${records.length} records for model: ${model.name}`);
      for (const record of records) {
        // Handle dates properly by ensuring they are Date objects
        const sanitized = { ...record };
        if (sanitized.createdAt) sanitized.createdAt = new Date(sanitized.createdAt);
        if (sanitized.updatedAt) sanitized.updatedAt = new Date(sanitized.updatedAt);
        if (sanitized.paymentDate) sanitized.paymentDate = new Date(sanitized.paymentDate);
        if (sanitized.paidDate) sanitized.paidDate = new Date(sanitized.paidDate);

        await postgres[model.name].upsert({
          where: { [model.pk]: record[model.pk] },
          create: sanitized,
          update: sanitized
        });
      }
    }

    // 3. Copy implicit BatchToTeacher table
    const batchTeachers = await sqlite.$queryRawUnsafe('SELECT * FROM "_BatchToTeacher"');
    logMessage(`Copying many-to-many _BatchToTeacher rows: ${batchTeachers.length}`);
    for (const row of batchTeachers) {
      await postgres.$executeRawUnsafe(
        'INSERT INTO "_BatchToTeacher" ("A", "B") VALUES ($1, $2) ON CONFLICT DO NOTHING',
        row.A,
        row.B
      );
    }
    
    logMessage("Initial database copy completed successfully.");
  } catch (err) {
    logMessage(`Initial migration failed: ${err.message}`);
  }
}

// Main background sync loop function
async function syncLoop() {
  if (isSyncing) return;
  isSyncing = true;
  syncStatus = 'syncing';
  
  try {
    const postgres = await getPostgresClient();
    if (!postgres) {
      syncStatus = 'offline';
      isSyncing = false;
      return;
    }

    logMessage("Starting periodic sync cycle...");
    
    // Get last sync timestamp from settings
    const lastSyncSetting = await sqlite.systemSetting.findUnique({
      where: { key: 'LAST_SYNC_AT' }
    });
    const lastSyncTime = lastSyncSetting ? new Date(lastSyncSetting.value) : new Date(0);
    const newSyncTime = new Date();

    // 1. Process local deletions on cloud PostgreSQL
    const deleteLogs = await sqlite.syncDeleteLog.findMany();
    if (deleteLogs.length > 0) {
      logMessage(`Found ${deleteLogs.length} offline deletions to sync...`);
      for (const log of deleteLogs) {
        const modelName = log.tableName.charAt(0).toLowerCase() + log.tableName.slice(1);
        if (postgres[modelName]) {
          try {
            await postgres[modelName].delete({
              where: { id: log.recordId }
            });
            logMessage(`Deleted record ${log.recordId} from cloud table ${log.tableName}`);
          } catch (delErr) {
            // Might already be deleted on remote
            logMessage(`Cloud delete warning for ${log.tableName} [${log.recordId}]: ${delErr.message}`);
          }
        }
      }
      // Clear local delete log
      await sqlite.syncDeleteLog.deleteMany({
        where: { id: { in: deleteLogs.map(l => l.id) } }
      });
    }

    // 2. Sync Settings (two-way, overwrite settings)
    const localSettings = await sqlite.systemSetting.findMany();
    const remoteSettings = await postgres.systemSetting.findMany();
    
    for (const lSet of localSettings) {
      // Don't override local DB credentials or credentials stored locally
      const rSet = remoteSettings.find(s => s.key === lSet.key);
      if (!rSet || rSet.value !== lSet.value) {
        await postgres.systemSetting.upsert({
          where: { key: lSet.key },
          create: lSet,
          update: lSet
        });
      }
    }
    for (const rSet of remoteSettings) {
      if (rSet.key === 'DATABASE_URL') continue; // Don't pull database url
      const lSet = localSettings.find(s => s.key === rSet.key);
      if (!lSet || lSet.value !== rSet.value) {
        await sqlite.systemSetting.upsert({
          where: { key: rSet.key },
          create: rSet,
          update: rSet
        });
      }
    }

    // 3. Bidirectional Sync for all tables
    for (const model of SYNCABLE_MODELS) {
      // A. Pull new SQLite records
      let localChanges = [];
      if (model.hasUpdatedAt) {
        localChanges = await sqlite[model.name].findMany({
          where: {
            OR: [
              { updatedAt: { gt: lastSyncTime } },
              { createdAt: { gt: lastSyncTime } }
            ]
          }
        });
      } else {
        localChanges = await sqlite[model.name].findMany({
          where: { createdAt: { gt: lastSyncTime } }
        });
      }

      // B. Pull new Postgres records
      let remoteChanges = [];
      if (model.hasUpdatedAt) {
        remoteChanges = await postgres[model.name].findMany({
          where: {
            OR: [
              { updatedAt: { gt: lastSyncTime } },
              { createdAt: { gt: lastSyncTime } }
            ]
          }
        });
      } else {
        remoteChanges = await postgres[model.name].findMany({
          where: { createdAt: { gt: lastSyncTime } }
        });
      }

      // C. Push local changes -> remote (last write wins)
      for (const localRec of localChanges) {
        const remoteRec = remoteChanges.find(r => r[model.pk] === localRec[model.pk]) 
          || await postgres[model.name].findUnique({ where: { [model.pk]: localRec[model.pk] } });
        
        const sanitized = { ...localRec };
        if (sanitized.createdAt) sanitized.createdAt = new Date(sanitized.createdAt);
        if (sanitized.updatedAt) sanitized.updatedAt = new Date(sanitized.updatedAt);
        if (sanitized.paymentDate) sanitized.paymentDate = new Date(sanitized.paymentDate);
        if (sanitized.paidDate) sanitized.paidDate = new Date(sanitized.paidDate);

        if (!remoteRec) {
          await postgres[model.name].create({ data: sanitized });
          logMessage(`Pushed new record to cloud: ${model.name} [${localRec[model.pk]}]`);
        } else if (model.hasUpdatedAt && new Date(localRec.updatedAt) > new Date(remoteRec.updatedAt)) {
          await postgres[model.name].update({
            where: { [model.pk]: localRec[model.pk] },
            data: sanitized
          });
          logMessage(`Pushed update to cloud (newer local): ${model.name} [${localRec[model.pk]}]`);
        }
      }

      // D. Pull remote changes -> local (last write wins)
      for (const remoteRec of remoteChanges) {
        const localRec = localChanges.find(l => l[model.pk] === remoteRec[model.pk])
          || await sqlite[model.name].findUnique({ where: { [model.pk]: remoteRec[model.pk] } });

        const sanitized = { ...remoteRec };
        if (sanitized.createdAt) sanitized.createdAt = new Date(sanitized.createdAt);
        if (sanitized.updatedAt) sanitized.updatedAt = new Date(sanitized.updatedAt);
        if (sanitized.paymentDate) sanitized.paymentDate = new Date(sanitized.paymentDate);
        if (sanitized.paidDate) sanitized.paidDate = new Date(sanitized.paidDate);

        if (!localRec) {
          await sqlite[model.name].create({ data: sanitized });
          logMessage(`Pulled new record to local: ${model.name} [${remoteRec[model.pk]}]`);
        } else if (model.hasUpdatedAt && new Date(remoteRec.updatedAt) > new Date(localRec.updatedAt)) {
          await sqlite[model.name].update({
            where: { [model.pk]: remoteRec[model.pk] },
            data: sanitized
          });
          logMessage(`Pulled update to local (newer cloud): ${model.name} [${remoteRec[model.pk]}]`);
        }
      }
    }

    // 4. Sync many-to-many _BatchToTeacher
    const localBT = await sqlite.$queryRawUnsafe('SELECT * FROM "_BatchToTeacher"');
    const remoteBT = await postgres.$queryRawUnsafe('SELECT * FROM "_BatchToTeacher"');
    
    // Add to remote what is local-only
    for (const lRow of localBT) {
      const exists = remoteBT.some(r => r.A === lRow.A && r.B === lRow.B);
      if (!exists) {
        await postgres.$executeRawUnsafe(
          'INSERT INTO "_BatchToTeacher" ("A", "B") VALUES ($1, $2) ON CONFLICT DO NOTHING',
          lRow.A,
          lRow.B
        );
      }
    }
    // Add to local what is remote-only
    for (const rRow of remoteBT) {
      const exists = localBT.some(l => l.A === rRow.A && l.B === rRow.B);
      if (!exists) {
        await sqlite.$queryRawUnsafe(
          'INSERT INTO "_BatchToTeacher" ("A", "B") VALUES (?, ?)',
          rRow.A,
          rRow.B
        );
      }
    }

    // Update LAST_SYNC_AT timestamp
    await sqlite.systemSetting.upsert({
      where: { key: 'LAST_SYNC_AT' },
      create: { key: 'LAST_SYNC_AT', value: newSyncTime.toISOString() },
      update: { value: newSyncTime.toISOString() }
    });

    lastSyncAt = newSyncTime;
    syncStatus = 'idle';
    logMessage("Periodic sync cycle completed successfully.");
  } catch (err) {
    syncStatus = 'error';
    logMessage(`Sync loop error: ${err.message}`);
  } finally {
    isSyncing = false;
  }
}

// Startup execution to run migration and batch alignment
async function startSyncEngine() {
  logMessage("Initializing Sync Engine...");
  
  // Wait a short moment to let DB connections settle, then run startup alignment
  setTimeout(async () => {
    try {
      const postgres = await getPostgresClient();
      if (postgres) {
        await alignBatchIds(postgres);
        await initialSeedPostgres(postgres);
        await syncLoop();
      } else {
        logMessage("PostgreSQL cloud database offline on startup. Skipping initial sync checks.");
      }
    } catch (err) {
      logMessage(`Startup sync initialization error: ${err.message}`);
    }
  }, 2000);

  // Set interval to run sync loop every 2 minutes
  setInterval(syncLoop, 120000);
}

function getSyncState() {
  return {
    status: syncStatus,
    lastSyncAt: lastSyncAt ? lastSyncAt.toISOString() : null
  };
}

module.exports = {
  startSyncEngine,
  triggerSyncNow: syncLoop,
  getSyncState
};
