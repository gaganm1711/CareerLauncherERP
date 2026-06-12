const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sqlite, getPostgresClient, resetPostgresClient, dbDir } = require('./db');
const { authMiddleware, getJwtSecret } = require('./middleware');
const { triggerSyncNow, getSyncState } = require('./syncEngine');
const twilio = require('twilio');
const { notifyClients } = require('./sockets');

// Helper to write administrative audit log
async function logAudit(userId, action, details, ipAddress = '') {
  try {
    await sqlite.auditLog.create({
      data: {
        userId,
        action,
        details,
        ipAddress
      }
    });
  } catch (err) {
    console.error("Audit log error:", err.message);
  }
}

// Helper to send SMS via Twilio
async function sendSms(to, body) {
  try {
    const sid = await sqlite.systemSetting.findUnique({ where: { key: 'TWILIO_ACCOUNT_SID' } });
    const token = await sqlite.systemSetting.findUnique({ where: { key: 'TWILIO_AUTH_TOKEN' } });
    const from = await sqlite.systemSetting.findUnique({ where: { key: 'TWILIO_FROM_NUMBER' } });
    
    if (sid?.value && token?.value && from?.value) {
      let formattedTo = to.trim();
      if (/^\d{10}$/.test(formattedTo)) {
        formattedTo = '+91' + formattedTo;
      } else if (/^\d{12}$/.test(formattedTo)) {
        formattedTo = '+' + formattedTo;
      } else if (!formattedTo.startsWith('+')) {
        formattedTo = '+91' + formattedTo;
      }
      
      const client = twilio(sid.value.trim(), token.value.trim());
      const message = await client.messages.create({
        body,
        from: from.value.trim(),
        to: formattedTo
      });
      return { success: true, messageId: message.sid };
    }
    return { success: false, error: 'Twilio settings are not configured.' };
  } catch (err) {
    console.error('Twilio SMS send error:', err.message);
    return { success: false, error: err.message };
  }
}

// ----------------------------------------------------
// AUTHENTICATION ROUTES
// ----------------------------------------------------

// Admin or User Registration
router.post('/auth/register', async (req, res) => {
  try {
    const { username, email, name, password, role, permissions } = req.body;
    
    const existing = await sqlite.user.findFirst({
      where: { OR: [{ username }, { email }] }
    });
    if (existing) {
      return res.status(400).json({ error: 'Username or email already exists.' });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    const newUser = await sqlite.user.create({
      data: {
        username,
        email,
        name,
        passwordHash,
        role: role || 'TEACHER',
        permissions: permissions || ''
      }
    });
    
    await logAudit(newUser.id, 'USER_REGISTERED', `User ${username} registered with role ${role}`);
    
    res.status(201).json({ message: 'User registered successfully', userId: newUser.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login Request
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = await sqlite.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }
    
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }
    
    // Check if MFA is enabled
    const mfaEnabledSetting = await sqlite.systemSetting.findUnique({ where: { key: 'MFA_ENABLED' } });
    const isMfaActive = mfaEnabledSetting?.value === 'true' && user.mfaEnabled;
    
    if (isMfaActive) {
      // Return requirements to trigger simulated MFA verification screen
      return res.json({
        mfaRequired: true,
        userId: user.id,
        mfaSecret: user.mfaSecret || 'CL-MOCK-MFA-KEY-2026'
      });
    }
    
    const secret = await getJwtSecret();
    const token = jwt.sign({ userId: user.id, role: user.role }, secret, { expiresIn: '8h' });
    
    await logAudit(user.id, 'USER_LOGIN', `Logged in without MFA`);
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: user.permissions
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify MFA
router.post('/auth/verify-mfa', async (req, res) => {
  try {
    const { userId, code } = req.body;
    
    const user = await sqlite.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }
    
    // Simulated code matching. Accepts standard mock '123456' or dynamic digit length
    if (code !== '123456' && code !== '000000') {
      return res.status(400).json({ error: 'Invalid MFA verification code. (Simulated code is 123456)' });
    }
    
    const secret = await getJwtSecret();
    const token = jwt.sign({ userId: user.id, role: user.role }, secret, { expiresIn: '8h' });
    
    await logAudit(user.id, 'USER_LOGIN_MFA', `Logged in with verified MFA`);
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: user.permissions
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Profile Update Route
router.put('/auth/profile', authMiddleware(), async (req, res) => {
  try {
    const { name, email, username } = req.body;
    const userId = req.user.id;
    
    if (username || email) {
      const existing = await sqlite.user.findFirst({
        where: {
          AND: [
            { id: { not: userId } },
            { OR: [username ? { username } : null, email ? { email } : null].filter(Boolean) }
          ]
        }
      });
      if (existing) {
        return res.status(400).json({ error: 'Username or email already exists.' });
      }
    }
    
    const updated = await sqlite.user.update({
      where: { id: userId },
      data: {
        name,
        email,
        username
      }
    });
    
    await logAudit(userId, 'USER_PROFILE_UPDATED', `Updated account profile details`);
    
    res.json({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      username: updated.username,
      role: updated.role,
      permissions: updated.permissions
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Profile Password Update Route
router.put('/auth/profile/password', authMiddleware(), async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.user.id;
    
    const passwordHash = await bcrypt.hash(password, 10);
    await sqlite.user.update({
      where: { id: userId },
      data: { passwordHash }
    });
    
    await logAudit(userId, 'USER_PASSWORD_UPDATED', `Changed security password`);
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Profile MFA Toggle Route
router.put('/auth/profile/mfa', authMiddleware(), async (req, res) => {
  try {
    const { mfaEnabled } = req.body;
    const userId = req.user.id;
    
    const updated = await sqlite.user.update({
      where: { id: userId },
      data: { mfaEnabled }
    });
    
    await logAudit(userId, 'USER_MFA_TOGGLED', `MFA security status changed to ${mfaEnabled}`);
    res.json({ success: true, mfaEnabled: updated.mfaEnabled });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /users (ADMIN only)
router.get('/users', authMiddleware('settings:manage'), async (req, res) => {
  try {
    const users = await sqlite.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        permissions: true,
        mfaEnabled: true,
        createdAt: true
      },
      orderBy: { name: 'asc' }
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /users/:id (ADMIN only)
router.put('/users/:id', authMiddleware('settings:manage'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, username, role, permissions, password } = req.body;
    
    const existing = await sqlite.user.findFirst({
      where: {
        AND: [
          { id: { not: id } },
          { OR: [{ username }, { email }] }
        ]
      }
    });
    if (existing) {
      return res.status(400).json({ error: 'Username or email already exists.' });
    }
    
    const data = {
      name,
      email,
      username,
      role,
      permissions
    };
    
    if (password) {
      data.passwordHash = await bcrypt.hash(password, 10);
    }
    
    const updated = await sqlite.user.update({
      where: { id },
      data
    });
    
    await logAudit(req.user.id, 'USER_UPDATED', `Updated user account "${username}"`);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /users/:id (ADMIN only)
router.delete('/users/:id', authMiddleware('settings:manage'), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own active administrator account.' });
    }
    
    const user = await sqlite.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }
    
    await sqlite.user.delete({ where: { id } });
    await logAudit(req.user.id, 'USER_DELETED', `Deleted user account "${user.username}"`);
    
    res.json({ success: true, message: 'User account successfully deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// DASHBOARD ENDPOINTS
// ----------------------------------------------------
router.get('/dashboard/stats', authMiddleware(), async (req, res) => {
  try {
    const activeStudentsCount = await sqlite.student.count({ where: { status: 'ACTIVE' } });
    
    // Check if Teacher role -> return masked details
    if (req.user.role === 'TEACHER') {
      // Find EMI due active student count
      const today = new Date().toISOString().split('T')[0];
      const endOfMonthStr = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];
      const emiDueInstallments = await sqlite.eMIInstallment.findMany({
        where: {
          status: 'UNPAID',
          dueDate: { lte: endOfMonthStr },
          student: { status: 'ACTIVE' }
        },
        select: { studentId: true }
      });
      const emiDueCount = new Set(emiDueInstallments.map(i => i.studentId)).size;

      const upcomingPromoCount = await sqlite.studentSelectedClasses.count({
        where: { promotionStatus: 'DUE', student: { status: 'ACTIVE' } }
      });

      return res.json({
        activeStudents: activeStudentsCount,
        monthlyRevenue: null,
        totalOutstanding: null,
        emiDueStudents: emiDueCount,
        upcomingPromotions: upcomingPromoCount
      });
    }

    // Otherwise calculate full financial stats for admin/subadmin
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthlyPayments = await sqlite.feeRecord.findMany({
      where: {
        paymentDate: { gte: startOfMonth }
      }
    });
    const monthlyRevenue = monthlyPayments.reduce((sum, r) => sum + r.amountPaid, 0);

    const activeStudents = await sqlite.student.findMany({
      where: { status: 'ACTIVE' },
      include: { feeRecords: true }
    });
    
    let totalOutstanding = 0;
    activeStudents.forEach(st => {
      const paid = st.feeRecords.reduce((sum, r) => sum + r.amountPaid, 0);
      const outstanding = st.totalCourseFee - paid;
      if (outstanding > 0) {
        totalOutstanding += outstanding;
      }
    });

    const endOfMonthStr = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const emiDueInstallments = await sqlite.eMIInstallment.findMany({
      where: {
        status: 'UNPAID',
        dueDate: { lte: endOfMonthStr },
        student: { status: 'ACTIVE' }
      },
      select: { studentId: true }
    });
    const emiDueStudentsCount = new Set(emiDueInstallments.map(i => i.studentId)).size;

    const upcomingPromotions = await sqlite.studentSelectedClasses.count({
      where: { promotionStatus: 'DUE', student: { status: 'ACTIVE' } }
    });

    res.json({
      activeStudents: activeStudentsCount,
      monthlyRevenue,
      totalOutstanding,
      emiDueStudents: emiDueStudentsCount,
      upcomingPromotions
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Next 4 Examinations
router.get('/dashboard/upcoming-exams', authMiddleware(), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const exams = await sqlite.exam.findMany({
      take: 4,
      orderBy: { date: 'asc' },
      include: { batch: true }
    });
    res.json(exams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Operations Audit Log (last 6 administrative actions)
router.get('/dashboard/audit-logs', authMiddleware(), async (req, res) => {
  try {
    const logs = await sqlite.auditLog.findMany({
      take: 6,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, role: true } } }
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// STUDENT DIRECTORY ENDPOINTS
// ----------------------------------------------------


// Helper to generate sequences of class-based roll numbers with deletion counter safeguards
async function generateRollNumber(batchId) {
  let batchName = 'General';
  if (batchId) {
    const batch = await sqlite.batch.findUnique({ where: { id: batchId } });
    if (batch) batchName = batch.name;
  }
  
  let prefix = 'CL';
  let counterKey = 'lastRoll_fallback';
  let baseVal = 1000;
  let padLength = 0;

  if (batchName.includes('8th')) {
    counterKey = 'lastRoll_8th';
    baseVal = 8000;
  } else if (batchName.includes('9th')) {
    counterKey = 'lastRoll_9th';
    baseVal = 9000;
  } else if (batchName.includes('10th')) {
    counterKey = 'lastRoll_10th';
    baseVal = 10000;
  } else if (batchName.includes('11th')) {
    counterKey = 'lastRoll_11th';
    baseVal = 11000;
  } else if (batchName.includes('12th')) {
    counterKey = 'lastRoll_12th';
    baseVal = 12000;
  } else if (batchName.toLowerCase().includes('mhtcet') || batchName.toLowerCase().includes('mht-cet')) {
    prefix = 'mh';
    counterKey = 'lastRoll_mhtcet';
    baseVal = 0;
    padLength = 3;
  }

  // Fetch persistent counter from settings
  let setting = await sqlite.systemSetting.findUnique({ where: { key: counterKey } });
  if (!setting) {
    setting = await sqlite.systemSetting.create({
      data: { key: counterKey, value: String(baseVal) }
    });
  }
  let counterVal = parseInt(setting.value, 10);

  // Fetch all students starting with this prefix to find the highest number in the active database
  const students = await sqlite.student.findMany({
    where: { rollNumber: { startsWith: prefix } }
  });
  
  let highestInDb = baseVal;
  students.forEach(st => {
    const numPartStr = st.rollNumber.substring(prefix.length);
    const numVal = parseInt(numPartStr, 10);
    if (!isNaN(numVal)) {
      if (prefix === 'CL') {
        if (counterKey === 'lastRoll_8th' && numVal >= 8000 && numVal < 9000) highestInDb = Math.max(highestInDb, numVal);
        else if (counterKey === 'lastRoll_9th' && numVal >= 9000 && numVal < 10000) highestInDb = Math.max(highestInDb, numVal);
        else if (counterKey === 'lastRoll_10th' && numVal >= 10000 && numVal < 11000) highestInDb = Math.max(highestInDb, numVal);
        else if (counterKey === 'lastRoll_11th' && numVal >= 11000 && numVal < 12000) highestInDb = Math.max(highestInDb, numVal);
        else if (counterKey === 'lastRoll_12th' && numVal >= 12000 && numVal < 13000) highestInDb = Math.max(highestInDb, numVal);
        else if (counterKey === 'lastRoll_fallback' && numVal >= 1000 && numVal < 8000) highestInDb = Math.max(highestInDb, numVal);
      } else {
        highestInDb = Math.max(highestInDb, numVal);
      }
    }
  });

  const nextNum = Math.max(highestInDb, counterVal) + 1;

  await sqlite.systemSetting.update({
    where: { key: counterKey },
    data: { value: String(nextNum) }
  });

  if (padLength > 0) {
    return `${prefix}${String(nextNum).padStart(padLength, '0')}`;
  } else {
    return `${prefix}${nextNum}`;
  }
}

router.get('/students', authMiddleware('students:view'), async (req, res) => {
  try {
    const { search, batchId, status } = req.query;
    
    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { lastName: { contains: search } },
        { rollNumber: { contains: search } }
      ];
    }
    if (batchId) {
      where.OR = [
        { batchId: batchId },
        { batchMappings: { some: { batchId: batchId } } }
      ];
    }
    if (status) {
      where.status = status;
    }
    
    const students = await sqlite.student.findMany({
      where,
      include: {
        batch: true,
        feePlan: { include: { emiInstallments: true } },
        selectedClasses: true,
        batchMappings: { include: { batch: true } }
      },
      orderBy: { rollNumber: 'asc' }
    });
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/students', authMiddleware('students:manage'), async (req, res) => {
  try {
    const data = req.body;
    const primaryBatchId = data.batchIds && data.batchIds.length > 0 ? data.batchIds[0] : (data.batchId || null);
    const rollNumber = await generateRollNumber(primaryBatchId);
    
    const courseFee = parseFloat(data.totalCourseFee) || 0;
    const advPay = parseFloat(data.advancePay) || 0;
    const emiMonths = parseInt(data.emiMonths, 10) || 6;
    
    const student = await sqlite.student.create({
      data: {
        rollNumber,
        name: data.name,
        lastName: data.lastName || '',
        email: data.email || '',
        phone: data.phone || '',
        photo: data.photo || null,
        parentName: data.parentName,
        parentPhone: data.parentPhone,
        status: data.status || 'ACTIVE',
        batchId: primaryBatchId,
        fatherOccupation: data.fatherOccupation || '',
        motherName: data.motherName || '',
        motherOccupation: data.motherOccupation || '',
        dob: data.dob || '',
        gender: data.gender || '',
        bloodGroup: data.bloodGroup || '',
        category: data.category || '',
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        pincode: data.pincode || '',
        whatsapp: data.whatsapp || '',
        schoolName: data.schoolName || '',
        totalCourseFee: courseFee,
        advancePay: advPay,
        emiMonths: emiMonths
      }
    });

    // Create Student selected classes entry
    let batchNames = [];
    const targetBatchIds = data.batchIds && data.batchIds.length > 0 ? data.batchIds : (data.batchId ? [data.batchId] : []);
    
    if (targetBatchIds.length > 0) {
      const selectedBatches = await sqlite.batch.findMany({
        where: { id: { in: targetBatchIds } }
      });
      batchNames = selectedBatches.map(b => b.name);
    }
    
    const selectedClassesStr = batchNames.join(', ') || 'General';
    const primaryBatchName = batchNames[0] || 'General';
    
    await sqlite.studentSelectedClasses.create({
      data: {
        studentId: student.id,
        selectedClasses: selectedClassesStr,
        currentActiveClass: primaryBatchName,
        promotionStatus: 'ACTIVE'
      }
    });

    // Create mapping links for all selected batches
    for (const bId of targetBatchIds) {
      await sqlite.studentBatchMapping.create({
        data: {
          studentId: student.id,
          batchId: bId
        }
      });
    }

    // Generate Fee Plan and EMI Installments
    const remainingAmount = courseFee - advPay;
    const feePlan = await sqlite.feePlan.create({
      data: {
        studentId: student.id,
        totalPackageFee: courseFee,
        advancePaid: advPay,
        remainingAmount: remainingAmount,
        emiDuration: emiMonths
      }
    });

    if (remainingAmount > 0 && emiMonths > 0) {
      const emiAmount = remainingAmount / emiMonths;
      const today = new Date();
      for (let i = 1; i <= emiMonths; i++) {
        const dueDate = new Date(today.getFullYear(), today.getMonth() + i, 15);
        await sqlite.eMIInstallment.create({
          data: {
            feePlanId: feePlan.id,
            studentId: student.id,
            installmentNo: i,
            amount: emiAmount,
            dueDate: dueDate.toISOString().split('T')[0],
            status: 'UNPAID',
            paidAmount: 0.0
          }
        });
      }
    }

    // Auto-record deposit transaction as fee receipt if advancePay was submitted
    if (advPay > 0) {
      const receiptNo = `REC-${Date.now()}`;
      await sqlite.feeRecord.create({
        data: {
          receiptNo,
          amountPaid: advPay,
          totalAmount: courseFee,
          balance: remainingAmount,
          status: remainingAmount <= 0 ? 'PAID' : 'PARTIAL',
          paymentMethod: 'CASH',
          remarks: 'Advance admission deposit',
          studentId: student.id
        }
      });
    }

    await logAudit(req.user.id, 'STUDENT_ADMITTED', `Admitted student ${student.name} with roll no ${student.rollNumber}`);
    notifyClients('student_change', { id: student.id });
    res.status(201).json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/students/:id', authMiddleware('students:manage'), async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    
    const original = await sqlite.student.findUnique({ where: { id } });
    if (!original) {
      return res.status(404).json({ error: 'Student not found.' });
    }
    
    const primaryBatchId = data.batchIds && data.batchIds.length > 0 ? data.batchIds[0] : (data.batchId !== undefined ? data.batchId : original.batchId);
    
    const updated = await sqlite.student.update({
      where: { id },
      data: {
        name: data.name,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        photo: data.photo !== undefined ? data.photo : original.photo,
        parentName: data.parentName,
        parentPhone: data.parentPhone,
        status: data.status,
        batchId: primaryBatchId,
        fatherOccupation: data.fatherOccupation,
        motherName: data.motherName,
        motherOccupation: data.motherOccupation,
        dob: data.dob,
        gender: data.gender,
        bloodGroup: data.bloodGroup,
        category: data.category,
        address: data.address,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        whatsapp: data.whatsapp,
        schoolName: data.schoolName,
        totalCourseFee: parseFloat(data.totalCourseFee) || original.totalCourseFee,
        advancePay: parseFloat(data.advancePay) || original.advancePay,
        emiMonths: parseInt(data.emiMonths, 10) || original.emiMonths
      }
    });

    // Update batch mappings
    const targetBatchIds = data.batchIds && data.batchIds.length > 0 ? data.batchIds : (data.batchId ? [data.batchId] : []);
    if (data.batchIds || data.batchId !== undefined) {
      // Delete old mappings
      await sqlite.studentBatchMapping.deleteMany({
        where: { studentId: id }
      });
      // Create new mappings
      for (const bId of targetBatchIds) {
        await sqlite.studentBatchMapping.create({
          data: {
            studentId: id,
            batchId: bId
          }
        });
      }
      
      // Update selected classes entry
      let batchNames = [];
      if (targetBatchIds.length > 0) {
        const selectedBatches = await sqlite.batch.findMany({
          where: { id: { in: targetBatchIds } }
        });
        batchNames = selectedBatches.map(b => b.name);
      }
      
      const selectedClassesStr = batchNames.join(', ') || 'General';
      const primaryBatchName = batchNames[0] || 'General';
      
      await sqlite.studentSelectedClasses.upsert({
        where: { studentId: id },
        create: {
          studentId: id,
          selectedClasses: selectedClassesStr,
          currentActiveClass: primaryBatchName,
          promotionStatus: 'ACTIVE'
        },
        update: {
          selectedClasses: selectedClassesStr,
          currentActiveClass: primaryBatchName
        }
      });
    }

    await logAudit(req.user.id, 'STUDENT_UPDATED', `Updated details of student ${updated.name} (${updated.rollNumber})`);
    notifyClients('student_change', { id: updated.id });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/students/:id', authMiddleware('students:manage'), async (req, res) => {
  try {
    const { id } = req.params;
    const student = await sqlite.student.findUnique({ where: { id } });
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }
    
    await sqlite.student.delete({ where: { id } });
    
    // Log deletion event to SQLite SyncDeleteLog for background offline-cloud deletion sync
    await sqlite.syncDeleteLog.create({
      data: {
        tableName: 'Student',
        recordId: id
      }
    });
    
    await logAudit(req.user.id, 'STUDENT_DELETED', `Deleted student ${student.name} (${student.rollNumber})`);
    notifyClients('student_change', { id });
    res.json({ message: 'Student deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// FACULTY REGISTRY ENDPOINTS
// ----------------------------------------------------
router.get('/teachers', authMiddleware('teachers:view'), async (req, res) => {
  try {
    const teachers = await sqlite.teacher.findMany({
      include: { user: { select: { username: true, role: true } } }
    });
    res.json(teachers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/teachers', authMiddleware('teachers:manage'), async (req, res) => {
  try {
    const { name, email, phone, salary, subject, userId } = req.body;
    
    const teacher = await sqlite.teacher.create({
      data: {
        name,
        email,
        phone,
        salary: parseFloat(salary) || 0.0,
        subject,
        userId: userId || null
      }
    });
    
    await logAudit(req.user.id, 'TEACHER_ADDED', `Added teacher ${name}`);
    res.status(201).json(teacher);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/teachers/:id', authMiddleware('teachers:manage'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, salary, subject, userId } = req.body;
    
    const teacher = await sqlite.teacher.update({
      where: { id },
      data: {
        name,
        email,
        phone,
        salary: parseFloat(salary) || 0.0,
        subject,
        userId: userId || null
      }
    });
    
    await logAudit(req.user.id, 'TEACHER_UPDATED', `Updated teacher ${name}`);
    res.json(teacher);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/teachers/:id', authMiddleware('teachers:manage'), async (req, res) => {
  try {
    const { id } = req.params;
    const teacher = await sqlite.teacher.findUnique({ where: { id } });
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found.' });
    }
    
    await sqlite.teacher.delete({ where: { id } });
    
    await sqlite.syncDeleteLog.create({
      data: {
        tableName: 'Teacher',
        recordId: id
      }
    });
    
    await logAudit(req.user.id, 'TEACHER_DELETED', `Deleted teacher ${teacher.name}`);
    res.json({ message: 'Teacher deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// BATCH / SCHEDULER ENDPOINTS
// ----------------------------------------------------
router.get('/batches', authMiddleware(), async (req, res) => {
  try {
    const batches = await sqlite.batch.findMany({
      include: { teachers: true }
    });
    res.json(batches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/batches', authMiddleware('batches:manage'), async (req, res) => {
  try {
    const { name, timing, timetableJson, fees, subjects, teacherIds } = req.body;
    
    const batch = await sqlite.batch.create({
      data: {
        name,
        timing,
        timetableJson: timetableJson || '{}',
        fees: parseFloat(fees) || 0.0,
        subjects: subjects || '',
        teachers: teacherIds ? { connect: teacherIds.map(id => ({ id })) } : undefined
      }
    });
    
    await logAudit(req.user.id, 'BATCH_CREATED', `Created batch ${name}`);
    res.status(201).json(batch);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/batches/:id', authMiddleware('batches:manage'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, timing, timetableJson, fees, subjects, teacherIds } = req.body;
    
    // Disconnect all previous teachers and set new ones
    const current = await sqlite.batch.findUnique({ where: { id }, include: { teachers: true } });
    
    const batch = await sqlite.batch.update({
      where: { id },
      data: {
        name,
        timing,
        timetableJson: timetableJson || '{}',
        fees: parseFloat(fees) || 0.0,
        subjects: subjects || '',
        teachers: {
          disconnect: current.teachers.map(t => ({ id: t.id })),
          connect: teacherIds ? teacherIds.map(tId => ({ id: tId })) : []
        }
      }
    });
    
    await logAudit(req.user.id, 'BATCH_UPDATED', `Updated batch ${name}`);
    res.json(batch);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/batches/:id', authMiddleware('batches:manage'), async (req, res) => {
  try {
    const { id } = req.params;
    const batch = await sqlite.batch.findUnique({ where: { id } });
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found.' });
    }
    
    await sqlite.batch.delete({ where: { id } });
    
    await sqlite.syncDeleteLog.create({
      data: {
        tableName: 'Batch',
        recordId: id
      }
    });
    
    await logAudit(req.user.id, 'BATCH_DELETED', `Deleted batch ${batch.name}`);
    res.json({ message: 'Batch deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// FEE LEDGER & REMINDERS ENDPOINTS
// ----------------------------------------------------
router.post('/fees/record', authMiddleware('fees:manage'), async (req, res) => {
  try {
    const { studentId, amountPaid, paymentMethod, remarks } = req.body;
    
    const student = await sqlite.student.findUnique({
      where: { id: studentId },
      include: { feeRecords: true, feePlan: true }
    });
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }
    
    const totalPaidBefore = student.feeRecords.reduce((sum, r) => sum + r.amountPaid, 0);
    const amt = parseFloat(amountPaid) || 0;
    const totalPaidNew = totalPaidBefore + amt;
    const remainingBalance = student.totalCourseFee - totalPaidNew;
    
    const receiptNo = `REC-${Date.now()}`;
    
    const feeRecord = await sqlite.feeRecord.create({
      data: {
        receiptNo,
        amountPaid: amt,
        totalAmount: student.totalCourseFee,
        balance: Math.max(0, remainingBalance),
        status: remainingBalance <= 0 ? 'PAID' : 'PARTIAL',
        paymentMethod: paymentMethod || 'CASH',
        remarks: remarks || '',
        studentId: studentId
      }
    });
    
    // Update outstanding in fee plan
    if (student.feePlan) {
      await sqlite.feePlan.update({
        where: { id: student.feePlan.id },
        data: {
          advancePaid: student.advancePay + amt,
          remainingAmount: Math.max(0, remainingBalance)
        }
      });
    }

    // Auto-update EMI Installment statuses!
    // Try to pay off oldest unpaid EMI installments first
    const unpaidInstallments = await sqlite.eMIInstallment.findMany({
      where: { studentId, status: 'UNPAID' },
      orderBy: { installmentNo: 'asc' }
    });
    
    let remainingPaidAmt = amt;
    for (const inst of unpaidInstallments) {
      if (remainingPaidAmt <= 0) break;
      const outstandingEmi = inst.amount - inst.paidAmount;
      
      if (remainingPaidAmt >= outstandingEmi) {
        remainingPaidAmt -= outstandingEmi;
        await sqlite.eMIInstallment.update({
          where: { id: inst.id },
          data: {
            status: 'PAID',
            paidAmount: inst.amount,
            paidDate: new Date()
          }
        });
      } else {
        await sqlite.eMIInstallment.update({
          where: { id: inst.id },
          data: {
            status: 'PARTIAL',
            paidAmount: inst.paidAmount + remainingPaidAmt,
            paidDate: new Date()
          }
        });
        remainingPaidAmt = 0;
      }
    }
    
    await logAudit(req.user.id, 'FEE_PAID', `Recorded payment of ₹${amt} for student ${student.name} (${student.rollNumber})`);
    notifyClients('fee_change', { studentId });
    res.status(201).json(feeRecord);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch full receipts ledger for a student
router.get('/fees/ledger/:studentId', authMiddleware(), async (req, res) => {
  try {
    const { studentId } = req.params;
    const records = await sqlite.feeRecord.findMany({
      where: { studentId },
      orderBy: { paymentDate: 'desc' }
    });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Review pending balances & lists (Overdue EMIs for current/previous months)
router.get('/fees/reminders', authMiddleware('fees:manage'), async (req, res) => {
  try {
    const today = new Date();
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const yyyy = endOfMonth.getFullYear();
    const mm = String(endOfMonth.getMonth() + 1).padStart(2, '0');
    const dd = String(endOfMonth.getDate()).padStart(2, '0');
    const endOfMonthStr = `${yyyy}-${mm}-${dd}`;

    const students = await sqlite.student.findMany({
      where: { status: 'ACTIVE' },
      include: { 
        feeRecords: true, 
        batch: true,
        feePlan: {
          include: {
            emiInstallments: {
              where: {
                dueDate: { lte: endOfMonthStr },
                status: { in: ['UNPAID', 'PARTIAL'] }
              }
            }
          }
        }
      }
    });
    
    const list = [];
    students.forEach(st => {
      if (st.feePlan && st.feePlan.emiInstallments.length > 0) {
        let emiOutstanding = 0;
        st.feePlan.emiInstallments.forEach(inst => {
          const unpaid = inst.amount - (inst.paidAmount || 0);
          if (unpaid > 0) {
            emiOutstanding += unpaid;
          }
        });

        if (emiOutstanding > 0) {
          const paid = st.feeRecords.reduce((sum, r) => sum + r.amountPaid, 0);
          list.push({
            id: st.id,
            rollNumber: st.rollNumber,
            name: `${st.name} ${st.lastName || ''}`.trim(),
            phone: st.phone,
            parentName: st.parentName,
            parentPhone: st.parentPhone,
            batchName: st.batch ? st.batch.name : 'General',
            totalFee: st.totalCourseFee,
            totalPaid: paid,
            outstanding: emiOutstanding
          });
        }
      }
    });
    
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger Twilio SMS Broadcast
router.post('/fees/broadcast-reminder', authMiddleware('fees:manage'), async (req, res) => {
  try {
    const { studentId, messageBody } = req.body;
    const student = await sqlite.student.findUnique({ where: { id: studentId } });
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }
    if (!student.parentPhone) {
      return res.status(400).json({ error: 'Parent phone number is not available.' });
    }
    
    const result = await sendSms(student.parentPhone, messageBody);
    if (result.success) {
      await logAudit(req.user.id, 'SMS_BROADCAST', `Sent fee reminder to parent of ${student.name}`);
      return res.json({ success: true, messageId: result.messageId });
    } else {
      return res.status(500).json({ error: result.error });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// ATTENDANCE ROSTER ENDPOINTS
// ----------------------------------------------------
router.get('/attendance/sheet', authMiddleware('students:view'), async (req, res) => {
  try {
    const { batchId, date } = req.query; // YYYY-MM-DD
    
    const students = await sqlite.student.findMany({
      where: { batchId, status: 'ACTIVE' },
      orderBy: { rollNumber: 'asc' }
    });
    
    const attendanceRecords = await sqlite.attendance.findMany({
      where: {
        date,
        student: { batchId }
      }
    });
    
    const sheet = students.map(st => {
      const rec = attendanceRecords.find(r => r.studentId === st.id);
      return {
        studentId: st.id,
        rollNumber: st.rollNumber,
        name: `${st.name} ${st.lastName || ''}`.trim(),
        status: rec ? rec.status : 'UNMARKED', // PRESENT, ABSENT, LATE, UNMARKED
        attendanceId: rec ? rec.id : null
      };
    });
    
    res.json(sheet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/attendance/mark', authMiddleware('students:manage'), async (req, res) => {
  try {
    const { batchId, date, records } = req.body; // records: [{ studentId, status: 'PRESENT' | 'ABSENT' | 'LATE' }]
    
    for (const rec of records) {
      await sqlite.attendance.upsert({
        where: {
          date_studentId: {
            date,
            studentId: rec.studentId
          }
        },
        create: {
          date,
          status: rec.status,
          studentId: rec.studentId,
          markedById: req.user.id
        },
        update: {
          status: rec.status,
          markedById: req.user.id
        }
      });
      
      // Auto-trigger SMS via Twilio if ABSENT and option enabled
      if (rec.status === 'ABSENT') {
        const student = await sqlite.student.findUnique({ where: { id: rec.studentId } });
        const autoSmsSetting = await sqlite.systemSetting.findUnique({ where: { key: 'AUTO_ABSENT_SMS' } });
        
        if (student && student.parentPhone && autoSmsSetting?.value === 'true') {
          const body = `Dear Parent, your child ${student.name} was marked ABSENT from Career Launcher Tuition classes today (${date}).`;
          await sendSms(student.parentPhone, body);
        }
      }
    }
    
    await logAudit(req.user.id, 'ATTENDANCE_MARKED', `Marked attendance for batch ${batchId} on date ${date}`);
    notifyClients('attendance_change', { batchId, date });
    res.json({ message: 'Attendance records saved successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// GRADE BOOK ENDPOINTS
// ----------------------------------------------------
router.get('/exams', authMiddleware(), async (req, res) => {
  try {
    const { batchId } = req.query;
    const where = batchId ? { batchId } : {};
    const exams = await sqlite.exam.findMany({
      where,
      include: { batch: true },
      orderBy: { date: 'desc' }
    });
    res.json(exams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/exams', authMiddleware('students:manage'), async (req, res) => {
  try {
    const { name, subject, date, totalMarks, batchId } = req.body;
    
    const exam = await sqlite.exam.create({
      data: {
        name,
        subject,
        date,
        totalMarks: parseFloat(totalMarks),
        batchId
      }
    });
    
    await logAudit(req.user.id, 'EXAM_REGISTERED', `Registered test "${name}" for subject ${subject}`);
    notifyClients('exam_change', { examId: exam.id });
    res.status(201).json(exam);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/exams/:examId/marks', authMiddleware(), async (req, res) => {
  try {
    const { examId } = req.params;
    const exam = await sqlite.exam.findUnique({ where: { id: examId } });
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found.' });
    }
    
    const students = await sqlite.student.findMany({
      where: { batchId: exam.batchId, status: 'ACTIVE' },
      orderBy: { rollNumber: 'asc' }
    });
    
    const existingMarks = await sqlite.examMark.findMany({
      where: { examId }
    });
    
    const sheet = students.map(st => {
      const em = existingMarks.find(m => m.studentId === st.id);
      return {
        studentId: st.id,
        rollNumber: st.rollNumber,
        name: `${st.name} ${st.lastName || ''}`.trim(),
        marksObtained: em ? em.marksObtained : '',
        remarks: em ? em.remarks : '',
        markId: em ? em.id : null
      };
    });
    
    res.json({ exam, sheet });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/exams/:examId/marks', authMiddleware('students:manage'), async (req, res) => {
  try {
    const { examId } = req.params;
    const { marks } = req.body; // [{ studentId, marksObtained, remarks }]
    
    for (const mk of marks) {
      if (mk.marksObtained === '') continue;
      await sqlite.examMark.upsert({
        where: {
          studentId_examId: {
            studentId: mk.studentId,
            examId
          }
        },
        create: {
          studentId: mk.studentId,
          examId,
          marksObtained: parseFloat(mk.marksObtained),
          remarks: mk.remarks || ''
        },
        update: {
          marksObtained: parseFloat(mk.marksObtained),
          remarks: mk.remarks || ''
        }
      });
    }
    
    await logAudit(req.user.id, 'EXAM_MARKS_SUBMITTED', `Submitted grades for exam ${examId}`);
    notifyClients('exam_change', { examId });
    res.json({ message: 'Grades saved successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update an examination
router.put('/exams/:examId', authMiddleware('students:manage'), async (req, res) => {
  try {
    const { examId } = req.params;
    const { name, subject, date, totalMarks } = req.body;
    
    // Check if exam exists
    const exam = await sqlite.exam.findUnique({ where: { id: examId } });
    if (!exam) {
      return res.status(404).json({ error: 'Examination not found.' });
    }
    
    const updatedExam = await sqlite.exam.update({
      where: { id: examId },
      data: {
        name,
        subject,
        date,
        totalMarks: parseFloat(totalMarks)
      }
    });
    
    await logAudit(req.user.id, 'EXAM_UPDATED', `Updated test "${name}" for subject ${subject}`);
    notifyClients('exam_change', { examId });
    res.json(updatedExam);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete an examination and its marks (cascade delete)
router.delete('/exams/:examId', authMiddleware('students:manage'), async (req, res) => {
  try {
    const { examId } = req.params;
    
    // Check if exam exists
    const exam = await sqlite.exam.findUnique({ where: { id: examId } });
    if (!exam) {
      return res.status(404).json({ error: 'Examination not found.' });
    }
    
    // Delete exam (onDelete: Cascade in Prisma takes care of related ExamMarks automatically)
    await sqlite.exam.delete({
      where: { id: examId }
    });
    
    await logAudit(req.user.id, 'EXAM_DELETED', `Deleted examination ${exam.name} (${exam.subject})`);
    notifyClients('exam_change', { examId });
    res.json({ success: true, message: 'Examination deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get student academic progress statistics and marks history
router.get('/students/:studentId/performance', authMiddleware(), async (req, res) => {
  try {
    const { studentId } = req.params;
    
    const student = await sqlite.student.findUnique({
      where: { id: studentId },
      include: { batch: true }
    });
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }
    
    const marks = await sqlite.examMark.findMany({
      where: { studentId },
      include: {
        exam: true
      },
      orderBy: {
        exam: {
          date: 'asc'
        }
      }
    });
    
    // Fetch average class scores for comparison
    const performanceData = [];
    for (const m of marks) {
      const allExamMarks = await sqlite.examMark.findMany({
        where: { examId: m.examId }
      });
      const scores = allExamMarks.map(x => x.marksObtained);
      const average = scores.reduce((sum, s) => sum + s, 0) / (scores.length || 1);
      
      performanceData.push({
        examId: m.examId,
        examName: m.exam.name,
        subject: m.exam.subject,
        date: m.exam.date,
        totalMarks: m.exam.totalMarks,
        marksObtained: m.marksObtained,
        classAverage: parseFloat(average.toFixed(1)),
        percentage: parseFloat(((m.marksObtained / m.exam.totalMarks) * 100).toFixed(1))
      });
    }
    
    res.json({
      student: {
        id: student.id,
        name: `${student.name} ${student.lastName || ''}`.trim(),
        rollNumber: student.rollNumber,
        batchName: student.batch ? student.batch.name : 'General'
      },
      performance: performanceData
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// TWILIO SMS BROADCASTER & NOTIFICATIONS
// ----------------------------------------------------

// Get Twilio connection status
router.get('/broadcaster/status', authMiddleware(), async (req, res) => {
  try {
    const sid = await sqlite.systemSetting.findUnique({ where: { key: 'TWILIO_ACCOUNT_SID' } });
    const token = await sqlite.systemSetting.findUnique({ where: { key: 'TWILIO_AUTH_TOKEN' } });
    const from = await sqlite.systemSetting.findUnique({ where: { key: 'TWILIO_FROM_NUMBER' } });
    
    const configured = !!(sid?.value && token?.value && from?.value);
    res.json({
      connected: configured,
      fromNumber: configured ? from.value.trim() : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get SMS metrics and stats
router.get('/broadcaster/stats', authMiddleware(), async (req, res) => {
  try {
    const logs = await sqlite.auditLog.findMany({
      where: { action: 'SMS_SENT' }
    });
    
    let total = logs.length;
    let delivered = 0;
    let failed = 0;
    
    logs.forEach(log => {
      try {
        const details = JSON.parse(log.details);
        if (details.status === 'SENT') {
          delivered++;
        } else if (details.status === 'FAILED') {
          failed++;
        }
      } catch (e) {
        delivered++;
      }
    });
    
    res.json({
      total,
      delivered,
      failed,
      pending: 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch SMS logs list
router.get('/broadcaster/logs', authMiddleware(), async (req, res) => {
  try {
    const auditLogs = await sqlite.auditLog.findMany({
      where: { action: 'SMS_SENT' },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    
    const parsedLogs = auditLogs.map(log => {
      let parsed = {};
      try {
        parsed = JSON.parse(log.details);
      } catch (e) {
        parsed = { body: log.details, status: 'SENT' };
      }
      return {
        id: log.id,
        recipientName: parsed.recipientName || 'System',
        phone: parsed.phone || 'N/A',
        body: parsed.body || '',
        status: parsed.status || 'SENT',
        sid: parsed.sid || 'N/A',
        createdAt: log.createdAt
      };
    });
    
    res.json(parsedLogs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear all SMS logs
router.post('/broadcaster/clear-logs', authMiddleware('settings:manage'), async (req, res) => {
  try {
    await sqlite.auditLog.deleteMany({
      where: { action: 'SMS_SENT' }
    });
    await logAudit(req.user.id, 'SMS_LOGS_CLEARED', 'Cleared all Twilio SMS dispatch logs');
    res.json({ success: true, message: 'SMS dispatch logs cleared successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send single test SMS
router.post('/broadcaster/send-test', authMiddleware('settings:manage'), async (req, res) => {
  try {
    const { phone, messageText } = req.body;
    if (!phone || !messageText) {
      return res.status(400).json({ error: 'Phone number and test message are required.' });
    }
    
    const result = await sendSms(phone, messageText);
    
    await sqlite.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'SMS_SENT',
        details: JSON.stringify({
          recipientName: 'Test SMS Recipient',
          phone,
          body: messageText,
          status: result.success ? 'SENT' : 'FAILED',
          sid: result.messageId || 'N/A',
          error: result.error || null
        })
      }
    });
    
    if (result.success) {
      res.json({ success: true, sid: result.messageId });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send Single or Bulk SMS broadcasts
router.post('/broadcaster/send-broadcast', authMiddleware('settings:manage'), async (req, res) => {
  try {
    const { audienceType, batchId, studentId, messageText } = req.body;
    if (!messageText) {
      return res.status(400).json({ error: 'Message text is required.' });
    }
    
    let recipients = [];
    
    if (audienceType === 'single') {
      if (!studentId) {
        return res.status(400).json({ error: 'Student profile selection is required for single student dispatches.' });
      }
      const student = await sqlite.student.findUnique({ where: { id: studentId } });
      if (!student) return res.status(404).json({ error: 'Student not found.' });
      recipients.push({
        name: `${student.name} ${student.lastName || ''}`.trim(),
        phone: student.parentPhone || student.phone
      });
    } else if (audienceType === 'class') {
      if (!batchId) {
        return res.status(400).json({ error: 'Batch selection is required for class stream dispatches.' });
      }
      const students = await sqlite.student.findMany({
        where: { batchId, status: 'ACTIVE' }
      });
      students.forEach(st => {
        if (st.parentPhone || st.phone) {
          recipients.push({
            name: `${st.name} ${st.lastName || ''}`.trim(),
            phone: st.parentPhone || st.phone
          });
        }
      });
    } else if (audienceType === 'all_parents') {
      const students = await sqlite.student.findMany({
        where: { status: 'ACTIVE' }
      });
      students.forEach(st => {
        if (st.parentPhone || st.phone) {
          recipients.push({
            name: `${st.name} ${st.lastName || ''}`.trim(),
            phone: st.parentPhone || st.phone
          });
        }
      });
    } else if (audienceType === 'all_faculty') {
      const teachers = await sqlite.teacher.findMany();
      teachers.forEach(t => {
        if (t.phone) {
          recipients.push({
            name: t.name,
            phone: t.phone
          });
        }
      });
    } else {
      return res.status(400).json({ error: 'Invalid audience type.' });
    }
    
    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No recipients found for the selected audience.' });
    }
    
    let sentCount = 0;
    let failedCount = 0;
    
    for (const rec of recipients) {
      if (rec.phone) {
        const result = await sendSms(rec.phone, messageText);
        
        await sqlite.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'SMS_SENT',
            details: JSON.stringify({
              recipientName: rec.name,
              phone: rec.phone,
              body: messageText,
              status: result.success ? 'SENT' : 'FAILED',
              sid: result.messageId || 'N/A',
              error: result.error || null
            })
          }
        });
        
        if (result.success) {
          sentCount++;
        } else {
          failedCount++;
        }
      } else {
        failedCount++;
      }
    }
    
    await logAudit(req.user.id, 'SMS_BROADCAST_BULK', `Triggered bulk SMS broadcast to ${audienceType} (${recipients.length} targets)`);
    res.json({ sentCount, failedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// SYSTEM SETTINGS ENDPOINTS
// ----------------------------------------------------
router.get('/settings', authMiddleware(), async (req, res) => {
  try {
    const settingsList = await sqlite.systemSetting.findMany();
    // Return key-value map
    const config = {};
    settingsList.forEach(s => {
      config[s.key] = s.value;
    });
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/settings', authMiddleware('settings:manage'), async (req, res) => {
  try {
    const settings = req.body; // key-value pairs
    
    let dbUrlChanged = false;
    for (const [key, value] of Object.entries(settings)) {
      if (key === 'DATABASE_URL') {
        const existing = await sqlite.systemSetting.findUnique({ where: { key } });
        if (!existing || existing.value !== value) {
          dbUrlChanged = true;
        }
      }
      
      await sqlite.systemSetting.upsert({
        where: { key },
        create: { key, value: String(value) },
        update: { value: String(value) }
      });
    }
    
    if (dbUrlChanged) {
      logMessage("DATABASE_URL changed in settings. Resetting PostgreSQL pool...");
      resetPostgresClient();
    }
    
    await logAudit(req.user.id, 'SETTINGS_UPDATED', `Updated system configuration settings`);
    res.json({ message: 'Settings saved successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// SYNCHRONIZATION STATUS ENDPOINTS
// ----------------------------------------------------
router.get('/sync/status', authMiddleware(), async (req, res) => {
  res.json(getSyncState());
});

router.get('/sync/logs', authMiddleware(), async (req, res) => {
  try {
    const logFile = path.join(dbDir, 'logs', 'app.log');
    if (fs.existsSync(logFile)) {
      const content = fs.readFileSync(logFile, 'utf8');
      res.send(content);
    } else {
      res.status(404).send('Log file not found');
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/sync/trigger', authMiddleware(), async (req, res) => {
  try {
    await triggerSyncNow();
    res.json(getSyncState());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// NEW ERP FEATURES: FACULTY ATTENDANCE, PROMOTIONS, BACKUP/RESTORE
// ----------------------------------------------------
const fs = require('fs');
const path = require('path');
const { dbDir, sqliteDbPath } = require('./db');

// POST: Promote student to target batch
router.post('/students/:id/promote', authMiddleware('students:manage'), async (req, res) => {
  try {
    const { id } = req.params;
    const { targetBatchId, promotionStatus } = req.body; // promotionStatus: 'ACTIVE' | 'PROMOTED' | 'COMPLETED'
    
    const student = await sqlite.student.findUnique({ where: { id } });
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }
    
    const batch = await sqlite.batch.findUnique({ where: { id: targetBatchId } });
    if (!batch) {
      return res.status(404).json({ error: 'Target batch not found.' });
    }

    // Update student batchId
    await sqlite.student.update({
      where: { id },
      data: { batchId: targetBatchId }
    });

    // Update selected classes record
    const selectedClassesRecord = await sqlite.studentSelectedClasses.findUnique({
      where: { studentId: id }
    });
    
    if (selectedClassesRecord) {
      const classes = selectedClassesRecord.selectedClasses.split(',').map(c => c.trim());
      if (!classes.includes(batch.name)) {
        classes.push(batch.name);
      }
      await sqlite.studentSelectedClasses.update({
        where: { studentId: id },
        data: {
          selectedClasses: classes.join(','),
          currentActiveClass: batch.name,
          promotionStatus: promotionStatus || 'ACTIVE'
        }
      });
    }

    // Upsert Student batch mapping link
    await sqlite.studentBatchMapping.upsert({
      where: {
        studentId_batchId: {
          studentId: id,
          batchId: targetBatchId
        }
      },
      create: {
        studentId: id,
        batchId: targetBatchId
      },
      update: {}
    });

    await logAudit(req.user.id, 'STUDENT_PROMOTED', `Promoted student ${student.name} (${student.rollNumber}) to batch ${batch.name}`);
    notifyClients('student_change', { id });
    res.json({ message: 'Student promoted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: Faculty Attendance Sheet
router.get('/attendance/teachers', authMiddleware('teachers:view'), async (req, res) => {
  try {
    const { date } = req.query; // YYYY-MM-DD
    const teachers = await sqlite.teacher.findMany();
    const attendanceRecords = await sqlite.teacherAttendance.findMany({
      where: { date }
    });
    
    const sheet = teachers.map(t => {
      const rec = attendanceRecords.find(r => r.teacherId === t.id);
      return {
        teacherId: t.id,
        name: t.name,
        subject: t.subject,
        status: rec ? rec.status : 'UNMARKED', // PRESENT, ABSENT, LATE, UNMARKED
        attendanceId: rec ? rec.id : null
      };
    });
    
    res.json(sheet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Mark Faculty Attendance
router.post('/attendance/teachers', authMiddleware('teachers:manage'), async (req, res) => {
  try {
    const { date, records } = req.body; // records: [{ teacherId, status }]
    
    for (const rec of records) {
      await sqlite.teacherAttendance.upsert({
        where: {
          date_teacherId: {
            date,
            teacherId: rec.teacherId
          }
        },
        create: {
          date,
          status: rec.status,
          teacherId: rec.teacherId,
          markedById: req.user.id
        },
        update: {
          status: rec.status,
          markedById: req.user.id
        }
      });
    }
    
    await logAudit(req.user.id, 'FACULTY_ATTENDANCE_MARKED', `Marked faculty attendance registry on ${date}`);
    notifyClients('teacher_change', { date });
    res.json({ message: 'Faculty attendance records saved successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Backup Database
router.post('/settings/backup', authMiddleware('settings:manage'), async (req, res) => {
  try {
    const backupDir = path.join(dbDir, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const filename = `dev-backup-${Date.now()}.db`;
    const destPath = path.join(backupDir, filename);
    
    fs.copyFileSync(sqliteDbPath, destPath);
    
    await logAudit(req.user.id, 'DATABASE_BACKED_UP', `Created database backup ${filename}`);
    res.json({ message: 'Database backup created successfully.', filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: Backups list
router.get('/settings/backups', authMiddleware('settings:manage'), async (req, res) => {
  try {
    const backupDir = path.join(dbDir, 'backups');
    if (!fs.existsSync(backupDir)) {
      return res.json([]);
    }
    
    const files = fs.readdirSync(backupDir);
    const backups = files.map(filename => {
      const stats = fs.statSync(path.join(backupDir, filename));
      return {
        filename,
        size: stats.size,
        createdAt: stats.birthtime
      };
    });
    
    backups.sort((a, b) => b.createdAt - a.createdAt);
    res.json(backups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Restore Database
router.post('/settings/restore', authMiddleware('settings:manage'), async (req, res) => {
  try {
    const { filename } = req.body;
    const backupDir = path.join(dbDir, 'backups');
    const backupFilePath = path.join(backupDir, filename);
    
    if (!fs.existsSync(backupFilePath)) {
      return res.status(400).json({ error: 'Backup file not found.' });
    }

    // Disconnect SQLite client
    await sqlite.$disconnect();

    // Copy backup to active database path
    fs.copyFileSync(backupFilePath, sqliteDbPath);

    await logAudit(req.user.id, 'DATABASE_RESTORED', `Restored database from backup ${filename}`);
    res.json({ message: 'Database restored successfully. Please reload/restart the app.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: Table Stats
router.get('/settings/stats', authMiddleware(), async (req, res) => {
  try {
    const studentCount = await sqlite.student.count();
    const teacherCount = await sqlite.teacher.count();
    const batchCount = await sqlite.batch.count();
    const feeRecordCount = await sqlite.feeRecord.count();
    const examCount = await sqlite.exam.count();
    const auditLogCount = await sqlite.auditLog.count();
    const syncDeleteCount = await sqlite.syncDeleteLog.count();

    res.json({
      students: studentCount,
      teachers: teacherCount,
      batches: batchCount,
      feeRecords: feeRecordCount,
      exams: examCount,
      auditLogs: auditLogCount,
      syncDeletes: syncDeleteCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
