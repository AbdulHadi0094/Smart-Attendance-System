import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getISTParts, resolvePeriodFromTime } from '../constants/timetable';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  DayOfWeek,
  DeviceScanEvent,
  RfidDevice,
  Student,
  Substitution,
  TimetableEntry,
} from '../types/erp';
import { buildAttendanceDocId } from './attendanceService';
import { logActivity } from './auditNoticeService';

export async function fetchDevices(): Promise<RfidDevice[]> {
  try {
    const snap = await getDocs(query(collection(db, 'devices'), orderBy('name', 'asc')));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RfidDevice, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'devices');
  }
}

export async function saveDevice(
  device: Omit<RfidDevice, 'id' | 'createdAt' | 'updatedAt'> & { isEdit?: boolean },
  actor: { uid: string; name: string; email: string }
): Promise<string> {
  const id = device.deviceId.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    const payload = {
      deviceId: id,
      name: device.name.trim().slice(0, 120),
      classroom: device.classroom.trim().slice(0, 64),
      assignedClassId: device.assignedClassId.trim(),
      assignedClassName: device.assignedClassName.trim().slice(0, 160),
      status: device.status || 'active',
      connectionStatus: device.connectionStatus || 'unconfigured',
      pendingUploads: Number(device.pendingUploads) || 0,
      firmwareVersion: (device.firmwareVersion || '1.0.0-rc522').trim().slice(0, 32),
      updatedAt: serverTimestamp(),
    };
    if (device.isEdit) {
      await updateDoc(doc(db, 'devices', id), payload);
    } else {
      await setDoc(doc(db, 'devices', id), { ...payload, createdAt: serverTimestamp() });
    }
    await logActivity({
      action: device.isEdit ? 'Updated ESP32 Device Configuration' : 'Registered New ESP32 Device',
      category: 'device',
      performedByUid: actor.uid,
      performedByName: actor.name,
      performedByEmail: actor.email,
      performedByRole: 'admin',
      targetType: 'device',
      targetId: id,
      targetLabel: `${id} (${payload.classroom})`,
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `devices/${id}`);
  }
}

export async function toggleDeviceStatus(
  device: RfidDevice,
  nextStatus: 'active' | 'inactive',
  actor: { uid: string; name: string; email: string }
): Promise<void> {
  try {
    await updateDoc(doc(db, 'devices', device.id), {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
    await logActivity({
      action: nextStatus === 'active' ? 'Activated RFID Reader' : 'Deactivated RFID Reader',
      category: 'device',
      performedByUid: actor.uid,
      performedByName: actor.name,
      performedByEmail: actor.email,
      performedByRole: 'admin',
      targetType: 'device',
      targetId: device.id,
      targetLabel: `${device.deviceId} (${device.classroom})`,
      previousValue: device.status,
      updatedValue: nextStatus,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `devices/${device.id}`);
  }
}

export async function deleteDevice(
  device: RfidDevice,
  actor: { uid: string; name: string; email: string }
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'devices', device.id));
    await logActivity({
      action: 'Removed ESP32 Device',
      category: 'device',
      performedByUid: actor.uid,
      performedByName: actor.name,
      performedByEmail: actor.email,
      performedByRole: 'admin',
      targetType: 'device',
      targetId: device.id,
      targetLabel: device.deviceId,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `devices/${device.id}`);
  }
}

export async function fetchDeviceScans(classId?: string): Promise<DeviceScanEvent[]> {
  try {
    const colRef = collection(db, 'deviceScans');
    const q = classId
      ? query(colRef, where('classId', '==', classId), limit(100))
      : query(colRef, orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<DeviceScanEvent, 'id'>) }))
      .sort((a, b) => {
        const ta = a.createdAt && typeof a.createdAt === 'object' && 'toMillis' in a.createdAt ? (a.createdAt as Timestamp).toMillis() : 0;
        const tb = b.createdAt && typeof b.createdAt === 'object' && 'toMillis' in b.createdAt ? (b.createdAt as Timestamp).toMillis() : 0;
        return tb - ta;
      });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'deviceScans');
  }
}

export interface SimulationScanResult {
  status: 'MARKED' | 'DUPLICATE' | 'INVALID_CARD' | 'FLAGGED_NO_TIMETABLE' | 'ALREADY_SYNCED';
  lcdLine1: string;
  lcdLine2: string;
  message: string;
  eventId: string;
}

/**
 * Admin Hardware Verification Console: executes the identical timetable + substitution
 * resolution and idempotency transaction as the ESP32 ingestion endpoint.
 */
export async function simulateAdminRfidScan(params: {
  device: RfidDevice;
  rfidUid: string;
  scanDate: Date;
  eventId: string;
  offlineBuffered: boolean;
  students: Student[];
  timetable: TimetableEntry[];
  substitutions: Substitution[];
  actor: { uid: string; name: string; email: string };
}): Promise<SimulationScanResult> {
  const cleanRfid = params.rfidUid.trim().toUpperCase();
  const cleanEventId = params.eventId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const { dateStr, timeStr, dayOfWeek } = getISTParts(params.scanDate);
  const periodInfo = resolvePeriodFromTime(timeStr);

  // Idempotency check
  const scanSnap = await getDocs(query(collection(db, 'deviceScans'), where('eventId', '==', cleanEventId), limit(1)));
  if (!scanSnap.empty) {
    const prev = scanSnap.docs[0].data() as DeviceScanEvent;
    return {
      status: 'ALREADY_SYNCED',
      eventId: cleanEventId,
      lcdLine1: prev.rollNumber ? `${prev.rollNumber} SYNCED` : 'ALREADY SYNCED',
      lcdLine2: prev.subjectName ? prev.subjectName.slice(0, 16) : 'IDEMPOTENT OK',
      message: `Event ${cleanEventId} was already processed safely without creating duplicates.`,
    };
  }

  const student = params.students.find(
    (s) => s.rfidUid.toUpperCase() === cleanRfid && s.status === 'active'
  );

  if (!student) {
    await setDoc(doc(db, 'deviceScans', cleanEventId), {
      eventId: cleanEventId,
      deviceId: params.device.deviceId,
      rfidUid: cleanRfid,
      classroom: params.device.classroom,
      classId: params.device.assignedClassId,
      scanTimestamp: Timestamp.fromDate(params.scanDate),
      date: dateStr,
      period: periodInfo?.period || 0,
      status: 'invalid_card',
      message: `[ADMIN TEST] Unregistered RFID UID ${cleanRfid}`,
      createdAt: serverTimestamp(),
    });
    return {
      status: 'INVALID_CARD',
      eventId: cleanEventId,
      lcdLine1: 'INVALID RFID',
      lcdLine2: cleanRfid.slice(0, 16),
      message: `RFID UID ${cleanRfid} is not assigned to any active student.`,
    };
  }

  if (!periodInfo || dayOfWeek === 'Sunday') {
    await setDoc(doc(db, 'deviceScans', cleanEventId), {
      eventId: cleanEventId,
      deviceId: params.device.deviceId,
      rfidUid: cleanRfid,
      classroom: params.device.classroom,
      classId: student.classId,
      scanTimestamp: Timestamp.fromDate(params.scanDate),
      date: dateStr,
      period: 0,
      status: 'flagged_no_timetable',
      studentDocId: student.id,
      studentName: student.name,
      rollNumber: student.rollNumber,
      message: `[ADMIN TEST] No active period at ${timeStr} IST (${dayOfWeek})`,
      createdAt: serverTimestamp(),
    });
    return {
      status: 'FLAGGED_NO_TIMETABLE',
      eventId: cleanEventId,
      lcdLine1: `${student.rollNumber} FLAGGED`,
      lcdLine2: 'NO ACTIVE PERIOD',
      message: `No scheduled period at ${timeStr} IST on ${dayOfWeek}. Scan flagged for review.`,
    };
  }

  const block = params.timetable.find(
    (t) =>
      t.status === 'active' &&
      t.classId === student.classId &&
      t.dayOfWeek === (dayOfWeek as DayOfWeek) &&
      periodInfo.period >= t.periodNumber &&
      periodInfo.period <= t.endPeriodNumber
  );

  if (!block || block.slots.length === 0) {
    await setDoc(doc(db, 'deviceScans', cleanEventId), {
      eventId: cleanEventId,
      deviceId: params.device.deviceId,
      rfidUid: cleanRfid,
      classroom: params.device.classroom,
      classId: student.classId,
      scanTimestamp: Timestamp.fromDate(params.scanDate),
      date: dateStr,
      period: periodInfo.period,
      status: 'flagged_no_timetable',
      studentDocId: student.id,
      studentName: student.name,
      rollNumber: student.rollNumber,
      message: `[ADMIN TEST] No timetable entry for ${dayOfWeek} P${periodInfo.period}`,
      createdAt: serverTimestamp(),
    });
    return {
      status: 'FLAGGED_NO_TIMETABLE',
      eventId: cleanEventId,
      lcdLine1: `${student.rollNumber} FLAGGED`,
      lcdLine2: `NO TT P-${periodInfo.period}`,
      message: `No timetable block found for ${dayOfWeek} Period ${periodInfo.period}.`,
    };
  }

  const slot =
    block.slots.find((s) => s.batch === student.batch) ||
    block.slots.find((s) => s.batch === 'ALL') ||
    block.slots[0];

  if (slot.needsConfirmation) {
    await setDoc(doc(db, 'deviceScans', cleanEventId), {
      eventId: cleanEventId,
      deviceId: params.device.deviceId,
      rfidUid: cleanRfid,
      classroom: params.device.classroom,
      classId: student.classId,
      scanTimestamp: Timestamp.fromDate(params.scanDate),
      date: dateStr,
      period: periodInfo.period,
      status: 'flagged_no_timetable',
      studentDocId: student.id,
      studentName: student.name,
      rollNumber: student.rollNumber,
      subjectName: slot.subjectName,
      message: `Flagged: ${dayOfWeek} Period ${periodInfo.period} awaits Admin batch confirmation.`,
      createdAt: serverTimestamp(),
    });
    return {
      status: 'FLAGGED_NO_TIMETABLE',
      eventId: cleanEventId,
      lcdLine1: `${student.rollNumber} FLAGGED`,
      lcdLine2: 'CONFIRM TT SLOT',
      message: `${dayOfWeek} Period ${periodInfo.period} is flagged for Admin batch confirmation.`,
    };
  }

  const activeSub = params.substitutions.find(
    (s) =>
      s.status === 'active' &&
      s.date === dateStr &&
      s.classId === student.classId &&
      periodInfo.period >= s.periodNumber &&
      periodInfo.period <= s.endPeriodNumber &&
      (s.batch === 'ALL' || s.batch === student.batch)
  );

  const actualSubjectId = activeSub ? activeSub.actualSubjectId : slot.subjectId;
  const actualSubjectName = activeSub ? activeSub.actualSubjectName : slot.subjectName;
  const actualSubjectShort = activeSub
    ? activeSub.actualSubjectName.slice(0, 12)
    : slot.subjectShortName;
  const actualFacultyId = activeSub ? activeSub.actualFacultyId : slot.facultyId || '';
  const actualFacultyName = activeSub ? activeSub.actualFacultyName : slot.facultyName || '';
  const actualClassroom = activeSub ? activeSub.classroom : slot.classroom || params.device.classroom;

  const attDocId = buildAttendanceDocId({
    date: dateStr,
    classId: student.classId,
    period: periodInfo.period,
    subjectId: actualSubjectId,
    studentDocId: student.id,
  });

  const attRef = doc(db, 'attendance', attDocId);
  const scanRef = doc(db, 'deviceScans', cleanEventId);
  let wasDuplicate = false;

  try {
    await runTransaction(db, async (tx) => {
      const existing = await tx.get(attRef);
      if (existing.exists()) {
        wasDuplicate = true;
        tx.set(scanRef, {
          eventId: cleanEventId,
          deviceId: params.device.deviceId,
          rfidUid: cleanRfid,
          classroom: actualClassroom,
          classId: student.classId,
          scanTimestamp: Timestamp.fromDate(params.scanDate),
          date: dateStr,
          period: periodInfo.period,
          status: 'duplicate',
          studentDocId: student.id,
          studentName: student.name,
          rollNumber: student.rollNumber,
          subjectName: actualSubjectName,
          message: `Duplicate scan prevented for ${student.rollNumber} in ${actualSubjectShort} P${periodInfo.period}`,
          createdAt: serverTimestamp(),
        });
      } else {
        tx.set(attRef, {
          studentUid: student.uid || '',
          studentDocId: student.id,
          studentId: student.studentId,
          studentName: student.name,
          studentEmail: student.email.toLowerCase(),
          rollNumber: student.rollNumber,
          classId: student.classId,
          className: student.className,
          section: student.section,
          batch: student.batch,
          subjectId: actualSubjectId,
          subjectShortName: actualSubjectShort,
          subjectName: actualSubjectName,
          date: dateStr,
          period: periodInfo.period,
          classroom: actualClassroom,
          status: 'present',
          source: 'rfid',
          deviceId: params.device.deviceId,
          eventId: cleanEventId,
          facultyId: actualFacultyId,
          facultyName: actualFacultyName,
          isSubstituted: Boolean(activeSub),
          substitutionId: activeSub ? activeSub.id : '',
          scanTimestamp: Timestamp.fromDate(params.scanDate),
          recordedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          isDemo: Boolean(student.isDemo),
        });
        tx.set(scanRef, {
          eventId: cleanEventId,
          deviceId: params.device.deviceId,
          rfidUid: cleanRfid,
          classroom: actualClassroom,
          classId: student.classId,
          scanTimestamp: Timestamp.fromDate(params.scanDate),
          date: dateStr,
          period: periodInfo.period,
          status: params.offlineBuffered ? 'offline_synced' : 'processed',
          studentDocId: student.id,
          studentName: student.name,
          rollNumber: student.rollNumber,
          subjectName: actualSubjectName,
          message: `${params.offlineBuffered ? '[OFFLINE SYNC TEST] ' : '[TEST] '}Marked ${actualSubjectShort} P${periodInfo.period}${activeSub ? ' (Substituted)' : ''}`,
          createdAt: serverTimestamp(),
        });
      }
    });

    if (wasDuplicate) {
      return {
        status: 'DUPLICATE',
        eventId: cleanEventId,
        lcdLine1: `${student.rollNumber} DUPLICATE`,
        lcdLine2: `${actualSubjectShort} P-${periodInfo.period}`,
        message: `${student.name} (${student.rollNumber}) already has attendance marked for ${actualSubjectShort} Period ${periodInfo.period}.`,
      };
    }

    await logActivity({
      action: params.offlineBuffered ? 'Offline Sync Test Event Processed' : 'RFID Hardware Test Scan Marked',
      category: 'device',
      performedByUid: params.actor.uid,
      performedByName: params.actor.name,
      performedByEmail: params.actor.email,
      performedByRole: 'admin',
      targetType: 'attendance',
      targetId: attDocId,
      targetLabel: `${student.rollNumber} · ${actualSubjectShort} · ${dateStr} P${periodInfo.period}`,
      details: `Device: ${params.device.deviceId}`,
    });

    return {
      status: 'MARKED',
      eventId: cleanEventId,
      lcdLine1: `${student.rollNumber} ${student.name.slice(0, 10)}`,
      lcdLine2: `MARKED ${actualSubjectShort} ${timeStr}`,
      message: `Attendance marked for ${student.name} (${student.rollNumber}) in ${actualSubjectName} (Period ${periodInfo.period}).`,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `attendance/${attDocId}`);
  }
}

export function generateEsp32FirmwareSnippet(endpointBaseUrl: string, deviceId: string): string {
  return `// MCET Smart IoT Attendance - ESP32 + RC522 + 16x2 I2C LCD Reference Firmware
// Never store Firebase Admin service account private keys inside ESP32 firmware!
// ESP32 authenticates to the trusted backend endpoint using x-device-secret.

#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

#define SS_PIN  5
#define RST_PIN 22

const char* WIFI_SSID     = "MCET_CAMPUS_WIFI";
const char* WIFI_PASS     = "YOUR_WIFI_PASSWORD";
const char* INGEST_URL    = "${endpointBaseUrl}/api/esp32/scan";
const char* DEVICE_ID     = "${deviceId}";
const char* DEVICE_SECRET = "SET_MATCHING_ESP32_DEVICE_KEY_IN_SERVER_ENV";

MFRC522 rfid(SS_PIN, RST_PIN);
LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  Serial.begin(115200);
  SPI.begin();
  rfid.PCD_Init();
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("MCET RFID READY");
  WiFi.begin(WIFI_SSID, WIFI_PASS);
}

void loop() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;

  String uidHex = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uidHex += "0";
    uidHex += String(rfid.uid.uidByte[i], HEX);
  }
  uidHex.toUpperCase();

  String eventId = String(DEVICE_ID) + "_" + uidHex + "_" + String(millis());
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(INGEST_URL);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-device-secret", DEVICE_SECRET);
    String body = "{\\"deviceId\\":\\"" + String(DEVICE_ID) + "\\",\\"rfidUid\\":\\"" + uidHex + "\\",\\"eventId\\":\\"" + eventId + "\\"}";
    int code = http.POST(body);
    Serial.printf("HTTP %d\\n", code);
    http.end();
  } else {
    // Queue eventId + uidHex + RTC ISO timestamp to SPIFFS/LittleFS for /api/esp32/sync-batch
    lcd.clear();
    lcd.setCursor(0, 0); lcd.print("SAVED OFFLINE");
    lcd.setCursor(0, 1); lcd.print(uidHex);
  }

  rfid.PICC_HaltA();
  delay(1500);
}`;
}
