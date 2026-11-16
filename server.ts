import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { initializeApp as initializeAdminApp, cert, getApps as getAdminApps } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseConfigPath = path.join(__dirname, 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));

const PORT = Number(process.env.PORT) || 3000;
const ESP32_DEVICE_KEY = process.env.ESP32_DEVICE_KEY || '';

const PERIOD_TIMINGS = [
  { period: 1, startTime: '09:15', endTime: '10:15' },
  { period: 2, startTime: '10:15', endTime: '11:15' },
  { period: 3, startTime: '11:15', endTime: '12:15' },
  { period: 4, startTime: '12:15', endTime: '13:15' },
  { period: 5, startTime: '14:00', endTime: '15:00' },
  { period: 6, startTime: '15:00', endTime: '16:00' },
];

function getISTParts(date: Date) {
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

  const timeStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);

  const dayOfWeek = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
  }).format(date);

  return { dateStr, timeStr, dayOfWeek };
}

function resolvePeriod(timeHHMM: string): number | null {
  const [h, m] = timeHHMM.split(':').map(Number);
  const mins = h * 60 + m;
  for (const p of PERIOD_TIMINGS) {
    const [sh, sm] = p.startTime.split(':').map(Number);
    const [eh, em] = p.endTime.split(':').map(Number);
    if (mins >= sh * 60 + sm && mins < eh * 60 + em) {
      return p.period;
    }
  }
  return null;
}

let adminDb: ReturnType<typeof getAdminFirestore> | null = null;
let adminInitError = '';

try {
  if (getAdminApps().length === 0) {
    const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountRaw && serviceAccountRaw.trim().startsWith('{')) {
      const parsed = JSON.parse(serviceAccountRaw);
      const app = initializeAdminApp({
        credential: cert(parsed),
        projectId: firebaseConfig.projectId,
      });
      adminDb = getAdminFirestore(app, firebaseConfig.firestoreDatabaseId);
    } else {
      adminInitError = 'FIREBASE_SERVICE_ACCOUNT_JSON is not configured on the server.';
    }
  } else {
    adminDb = getAdminFirestore(getAdminApps()[0], firebaseConfig.firestoreDatabaseId);
  }
} catch (err) {
  adminInitError = err instanceof Error ? err.message : 'Failed to initialize Firebase Admin SDK';
}

function verifyDeviceSecret(req: Request): boolean {
  if (!ESP32_DEVICE_KEY) return false;
  const provided = String(req.headers['x-device-secret'] || '');
  if (!provided || provided.length !== ESP32_DEVICE_KEY.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(ESP32_DEVICE_KEY));
}

interface ScanPayload {
  deviceId?: string;
  rfidUid?: string;
  scanTimestamp?: string;
  eventId?: string;
  offlineBuffered?: boolean;
}

async function processEsp32Scan(payload: ScanPayload) {
  if (!adminDb) {
    return {
      httpStatus: 503,
      body: {
        status: 'SERVER_UNCONFIGURED',
        error: adminInitError || 'Firebase Admin SDK not initialized',
        lcdLine1: 'SERVER NOT READY',
        lcdLine2: 'CHECK ADMIN CFG',
      },
    };
  }

  const deviceId = String(payload.deviceId || '').trim();
  const rfidUid = String(payload.rfidUid || '').trim().toUpperCase();
  const eventId = String(payload.eventId || `evt_${deviceId}_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
  const scanDate = payload.scanTimestamp ? new Date(payload.scanTimestamp) : new Date();

  if (!deviceId || !rfidUid || Number.isNaN(scanDate.getTime())) {
    return {
      httpStatus: 400,
      body: {
        status: 'INVALID_PAYLOAD',
        error: 'deviceId, rfidUid, and valid scanTimestamp are required',
        lcdLine1: 'INVALID REQUEST',
        lcdLine2: 'BAD PAYLOAD',
      },
    };
  }

  // Idempotency check for safe offline repeated sync
  const existingScanSnap = await adminDb.collection('deviceScans').doc(eventId).get();
  if (existingScanSnap.exists) {
    const prev = existingScanSnap.data()!;
    return {
      httpStatus: 200,
      body: {
        status: 'DUPLICATE_EVENT',
        alreadyProcessed: true,
        eventId,
        studentName: prev.studentName || '',
        rollNumber: prev.rollNumber || '',
        subjectName: prev.subjectName || '',
        lcdLine1: prev.rollNumber ? `${prev.rollNumber} ALREADY` : 'ALREADY SYNCED',
        lcdLine2: prev.subjectName ? String(prev.subjectName).slice(0, 16) : 'DUPLICATE SCAN',
      },
    };
  }

  const deviceSnap = await adminDb.collection('devices').doc(deviceId).get();
  if (!deviceSnap.exists || deviceSnap.data()?.status !== 'active') {
    return {
      httpStatus: 403,
      body: {
        status: 'UNAUTHORIZED_DEVICE',
        error: 'Device not registered or inactive',
        lcdLine1: 'UNAUTH DEVICE',
        lcdLine2: deviceId.slice(0, 16),
      },
    };
  }

  const device = deviceSnap.data()!;
  const { dateStr, timeStr, dayOfWeek } = getISTParts(scanDate);
  const period = resolvePeriod(timeStr);

  // Look up student by RFID UID
  const studentQuery = await adminDb
    .collection('students')
    .where('rfidUid', '==', rfidUid)
    .where('status', '==', 'active')
    .limit(1)
    .get();

  if (studentQuery.empty) {
    await adminDb.collection('deviceScans').doc(eventId).set({
      eventId,
      deviceId,
      rfidUid,
      classroom: device.classroom,
      classId: device.assignedClassId || '',
      scanTimestamp: Timestamp.fromDate(scanDate),
      date: dateStr,
      period: period || 0,
      status: 'invalid_card',
      message: `Unregistered RFID card UID ${rfidUid}`,
      createdAt: FieldValue.serverTimestamp(),
    });
    await adminDb.collection('devices').doc(deviceId).update({
      connectionStatus: 'online',
      lastSyncAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return {
      httpStatus: 200,
      body: {
        status: 'INVALID_CARD',
        eventId,
        lcdLine1: 'INVALID RFID',
        lcdLine2: rfidUid.slice(0, 16),
      },
    };
  }

  const studentDoc = studentQuery.docs[0];
  const student = studentDoc.data();

  if (!period || dayOfWeek === 'Sunday') {
    await adminDb.collection('deviceScans').doc(eventId).set({
      eventId,
      deviceId,
      rfidUid,
      classroom: device.classroom,
      classId: student.classId,
      scanTimestamp: Timestamp.fromDate(scanDate),
      date: dateStr,
      period: 0,
      status: 'flagged_no_timetable',
      studentDocId: studentDoc.id,
      studentName: student.name,
      rollNumber: student.rollNumber,
      message: `No active class period at ${timeStr} IST (${dayOfWeek})`,
      createdAt: FieldValue.serverTimestamp(),
    });
    return {
      httpStatus: 200,
      body: {
        status: 'FLAGGED_NO_TIMETABLE',
        eventId,
        studentName: student.name,
        rollNumber: student.rollNumber,
        time: timeStr,
        lcdLine1: `${student.rollNumber} FLAGGED`,
        lcdLine2: 'NO ACTIVE PERIOD',
      },
    };
  }

  // Resolve timetable block for classId + dayOfWeek + period
  const ttQuery = await adminDb
    .collection('timetable')
    .where('classId', '==', student.classId)
    .where('dayOfWeek', '==', dayOfWeek)
    .where('status', '==', 'active')
    .get();

  const matchingBlock = ttQuery.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .find((entry: any) => period >= entry.periodNumber && period <= entry.endPeriodNumber) as any;

  if (!matchingBlock || !Array.isArray(matchingBlock.slots) || matchingBlock.slots.length === 0) {
    await adminDb.collection('deviceScans').doc(eventId).set({
      eventId,
      deviceId,
      rfidUid,
      classroom: device.classroom,
      classId: student.classId,
      scanTimestamp: Timestamp.fromDate(scanDate),
      date: dateStr,
      period,
      status: 'flagged_no_timetable',
      studentDocId: studentDoc.id,
      studentName: student.name,
      rollNumber: student.rollNumber,
      message: `No timetable entry found for ${dayOfWeek} Period ${period}`,
      createdAt: FieldValue.serverTimestamp(),
    });
    return {
      httpStatus: 200,
      body: {
        status: 'FLAGGED_NO_TIMETABLE',
        eventId,
        studentName: student.name,
        rollNumber: student.rollNumber,
        time: timeStr,
        lcdLine1: `${student.rollNumber} FLAGGED`,
        lcdLine2: `NO TT P-${period}`,
      },
    };
  }

  // Match student batch or ALL
  const slot =
    matchingBlock.slots.find((s: any) => s.batch === student.batch) ||
    matchingBlock.slots.find((s: any) => s.batch === 'ALL') ||
    matchingBlock.slots[0];

  if (slot.needsConfirmation) {
    await adminDb.collection('deviceScans').doc(eventId).set({
      eventId,
      deviceId,
      rfidUid,
      classroom: device.classroom,
      classId: student.classId,
      scanTimestamp: Timestamp.fromDate(scanDate),
      date: dateStr,
      period,
      status: 'flagged_no_timetable',
      studentDocId: studentDoc.id,
      studentName: student.name,
      rollNumber: student.rollNumber,
      subjectName: slot.subjectName,
      message: `Timetable slot requires Admin confirmation (${dayOfWeek} Period ${period})`,
      createdAt: FieldValue.serverTimestamp(),
    });
    return {
      httpStatus: 200,
      body: {
        status: 'FLAGGED_CONFIRMATION_REQUIRED',
        eventId,
        lcdLine1: `${student.rollNumber} FLAGGED`,
        lcdLine2: 'CONFIRM TIMETABLE',
      },
    };
  }

  // Check active temporary substitution for this date + class + period
  const subQuery = await adminDb
    .collection('substitutions')
    .where('date', '==', dateStr)
    .where('classId', '==', student.classId)
    .where('status', '==', 'active')
    .get();

  const matchingSub = subQuery.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .find(
      (s: any) =>
        period >= s.periodNumber &&
        period <= s.endPeriodNumber &&
        (s.batch === 'ALL' || s.batch === student.batch)
    ) as any;

  const actualSubjectId = matchingSub ? matchingSub.actualSubjectId : slot.subjectId;
  const actualSubjectName = matchingSub ? matchingSub.actualSubjectName : slot.subjectName;
  const actualSubjectShort = matchingSub ? matchingSub.actualSubjectName.slice(0, 12) : slot.subjectShortName;
  const actualFacultyId = matchingSub ? matchingSub.actualFacultyId : slot.facultyId || '';
  const actualFacultyName = matchingSub ? matchingSub.actualFacultyName : slot.facultyName || '';
  const actualClassroom = matchingSub ? matchingSub.classroom : slot.classroom || device.classroom;

  const attendanceDocId = `${dateStr}_${student.classId}_P${period}_${actualSubjectId}_${studentDoc.id}`;
  const attendanceRef = adminDb.collection('attendance').doc(attendanceDocId);
  const scanRef = adminDb.collection('deviceScans').doc(eventId);
  const deviceRef = adminDb.collection('devices').doc(deviceId);

  let wasDuplicate = false;
  await adminDb.runTransaction(async (tx) => {
    const existingAtt = await tx.get(attendanceRef);
    if (existingAtt.exists) {
      wasDuplicate = true;
      tx.set(scanRef, {
        eventId,
        deviceId,
        rfidUid,
        classroom: actualClassroom,
        classId: student.classId,
        scanTimestamp: Timestamp.fromDate(scanDate),
        date: dateStr,
        period,
        status: 'duplicate',
        studentDocId: studentDoc.id,
        studentName: student.name,
        rollNumber: student.rollNumber,
        subjectName: actualSubjectName,
        message: `Duplicate scan ignored for ${student.rollNumber} in ${actualSubjectShort} P${period}`,
        createdAt: FieldValue.serverTimestamp(),
      });
    } else {
      tx.set(attendanceRef, {
        studentUid: student.uid || '',
        studentDocId: studentDoc.id,
        studentId: student.studentId,
        studentName: student.name,
        studentEmail: student.email,
        rollNumber: student.rollNumber,
        classId: student.classId,
        className: student.className,
        section: student.section,
        batch: student.batch,
        subjectId: actualSubjectId,
        subjectShortName: actualSubjectShort,
        subjectName: actualSubjectName,
        date: dateStr,
        period,
        classroom: actualClassroom,
        status: 'present',
        source: 'rfid',
        deviceId,
        eventId,
        facultyId: actualFacultyId,
        facultyName: actualFacultyName,
        isSubstituted: Boolean(matchingSub),
        substitutionId: matchingSub ? matchingSub.id : '',
        scanTimestamp: Timestamp.fromDate(scanDate),
        recordedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        isDemo: Boolean(student.isDemo),
      });
      tx.set(scanRef, {
        eventId,
        deviceId,
        rfidUid,
        classroom: actualClassroom,
        classId: student.classId,
        scanTimestamp: Timestamp.fromDate(scanDate),
        date: dateStr,
        period,
        status: payload.offlineBuffered ? 'offline_synced' : 'processed',
        studentDocId: studentDoc.id,
        studentName: student.name,
        rollNumber: student.rollNumber,
        subjectName: actualSubjectName,
        message: `Attendance marked (${actualSubjectShort}, P${period})`,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    tx.update(deviceRef, {
      connectionStatus: 'online',
      lastSyncAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  if (wasDuplicate) {
    return {
      httpStatus: 200,
      body: {
        status: 'DUPLICATE_ATTENDANCE',
        eventId,
        studentName: student.name,
        rollNumber: student.rollNumber,
        time: timeStr,
        subjectShortName: actualSubjectShort,
        lcdLine1: `${student.rollNumber} DUPLICATE`,
        lcdLine2: `${actualSubjectShort} P-${period}`,
      },
    };
  }

  return {
    httpStatus: 200,
    body: {
      status: 'MARKED',
      eventId,
      studentName: student.name,
      rollNumber: student.rollNumber,
      time: timeStr,
      className: student.className,
      subjectShortName: actualSubjectShort,
      subjectName: actualSubjectName,
      period,
      lcdLine1: `${student.rollNumber} ${student.name.slice(0, 10)}`,
      lcdLine2: `MARKED ${actualSubjectShort} ${timeStr}`,
    },
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/esp32/health', (_req: Request, res: Response) => {
    res.json({
      service: 'MCET Smart IoT ESP32 Ingestion API',
      firebaseAdminReady: Boolean(adminDb),
      deviceSecretConfigured: Boolean(ESP32_DEVICE_KEY),
      timezone: 'Asia/Kolkata',
      note: adminInitError || 'Ready for authenticated ESP32 HTTP POST requests',
    });
  });

  app.post('/api/esp32/scan', async (req: Request, res: Response) => {
    if (!verifyDeviceSecret(req)) {
      res.status(401).json({
        status: 'UNAUTHORIZED',
        error: 'Missing or invalid x-device-secret header',
        lcdLine1: 'AUTH ERROR',
        lcdLine2: 'INVALID KEY',
      });
      return;
    }
    try {
      const result = await processEsp32Scan(req.body || {});
      res.status(result.httpStatus).json(result.body);
    } catch (err) {
      res.status(500).json({
        status: 'INTERNAL_ERROR',
        error: err instanceof Error ? err.message : 'Scan processing failed',
      });
    }
  });

  app.post('/api/esp32/sync-batch', async (req: Request, res: Response) => {
    if (!verifyDeviceSecret(req)) {
      res.status(401).json({ status: 'UNAUTHORIZED', error: 'Missing or invalid x-device-secret header' });
      return;
    }
    const events = Array.isArray(req.body?.events) ? req.body.events : [];
    if (events.length === 0 || events.length > 200) {
      res.status(400).json({ status: 'INVALID_BATCH', error: 'Provide 1 to 200 events' });
      return;
    }
    const results = [];
    for (const evt of events) {
      const r = await processEsp32Scan({ ...evt, offlineBuffered: true });
      results.push(r.body);
    }
    res.json({ syncedCount: results.length, results });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MCET Attendance ERP server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
