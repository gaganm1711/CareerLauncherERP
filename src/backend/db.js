const path = require('path');
const fs = require('fs');
const os = require('os');
const { PrismaClient: SQLitePrismaClient } = require('./generated/sqlite-client');
const { PrismaClient: PostgresPrismaClient } = require('./generated/postgres-client');

const appDataDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const dbDir = path.join(appDataDir, 'career-launcher-erp');

// Ensure database and logs folders exist
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const logDir = path.join(dbDir, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const sqliteDbPath = path.join(dbDir, 'dev.db');

// Instantiate SQLite client
const sqlite = new SQLitePrismaClient({
  datasources: {
    db: {
      url: `file:${sqliteDbPath}`
    }
  }
});

let postgresClient = null;

async function getPostgresClient() {
  if (postgresClient) return postgresClient;
  try {
    let setting = await sqlite.systemSetting.findUnique({
      where: { key: 'DATABASE_URL' }
    });

    // Fallback to environment variable if the setting is empty (e.g. fresh SQLite DB in container)
    if ((!setting || !setting.value || setting.value.trim() === '') && process.env.DATABASE_URL) {
      const envUrl = process.env.DATABASE_URL.trim();
      if (envUrl !== '') {
        setting = await sqlite.systemSetting.upsert({
          where: { key: 'DATABASE_URL' },
          create: { key: 'DATABASE_URL', value: envUrl },
          update: { value: envUrl }
        });
        console.log('[DATABASE] Seeded DATABASE_URL setting from environment variable.');
      }
    }

    if (setting && setting.value && setting.value.trim() !== '') {
      postgresClient = new PostgresPrismaClient({
        datasources: {
          db: {
            url: setting.value.trim()
          }
        }
      });
      // Test connection
      await postgresClient.$queryRaw`SELECT 1`;
      return postgresClient;
    }
  } catch (err) {
    console.error("Postgres client init or connection test failed:", err.message);
    postgresClient = null;
  }
  return null;
}

function resetPostgresClient() {
  if (postgresClient) {
    postgresClient.$disconnect().catch(() => {});
    postgresClient = null;
  }
}

module.exports = {
  sqlite,
  getPostgresClient,
  resetPostgresClient,
  dbDir,
  sqliteDbPath
};
