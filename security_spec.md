# Security Specification & Red-Team Audit (MCET Smart IoT Attendance Portal)

## 1. Data Invariants
1. **Default Deny**: Every Firestore path defaults to `allow read, write: if false;` unless explicitly matched and authorized.
2. **Email Verification Mandate**: All authenticated reads/writes (except public portal branding `settings/portal_config` and connectivity probe `test/connection`) require `request.auth != null && request.auth.token.email_verified == true`.
3. **Trusted Role Resolution**:
   - Admin authority is derived solely from `/admins/{request.auth.uid}` or the bootstrapped verified admin email (`4623hadi@gmail.com`).
   - Users cannot self-assign `role: 'admin'`, `role: 'faculty'`, or `role: 'student'` on `/users/{uid}` without an authoritative record in `/admins`, `/faculty`, or `/students` matching `request.auth.token.email`.
   - Non-admins can never modify `role`, `linkedProfileId`, `assignedClassIds`, `assignedSubjectIds`, or `email` on `/users/{uid}` after creation.
4. **Student Privacy Isolation**:
   - Student Roll No. 6 can ONLY `get` or `list` `/students` documents where `uid == request.auth.uid || email == request.auth.token.email`.
   - Student Roll No. 6 can ONLY `get` or `list` `/attendance` documents where `studentUid == request.auth.uid || studentEmail == request.auth.token.email`.
   - Students can NEVER write, edit, or delete `/attendance`, `/timetable`, `/substitutions`, `/devices`, `/faculty`, or other students' profiles.
5. **Faculty Scope Isolation**:
   - Faculty can ONLY `get` or `list` `/students` belonging to `classId in userDoc.assignedClassIds`.
   - Faculty can ONLY `get`, `list`, `create`, or `update` `/attendance` for `classId in userDoc.assignedClassIds` and authorized subjects.
   - Faculty can ONLY `create` or `update` `/substitutions` for `classId in userDoc.assignedClassIds` when `canSubstitute` is granted.
   - Faculty cannot access unrelated classes, admin settings, device secrets, or other faculty accounts' private records.
6. **Temporal & Structural Integrity**:
   - All `createdAt` / `updatedAt` timestamps on client-writable collections must equal `request.time`.
   - All document IDs are validated via `isValidId(id)` (`^[a-zA-Z0-9_\\-]+$`, length `<= 128`).
   - All strings enforce explicit `.size()` boundaries and `keys().hasAll(...)` / `keys().hasOnly(...)` guards prevent shadow fields.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Self-Promotion to Admin**: Student writes `/users/{studentUid}` with `{ role: "admin", ... }`.
2. **Self-Promotion to Faculty**: Student writes `/users/{studentUid}` with `{ role: "faculty", ... }`.
3. **Admin Table Injection**: Non-admin creates `/admins/{attackerUid}` with `{ uid: attackerUid, email: "attacker@gmail.com" }`.
4. **Cross-Student Profile Read**: Roll No. 6 runs `getDoc(doc(db, "students", "student_roll_7"))`.
5. **Cross-Student Attendance Query**: Roll No. 6 runs `getDocs(query(collection(db, "attendance"), where("rollNumber", "==", "7")))`.
6. **Student Attendance Tampering**: Roll No. 6 attempts `updateDoc` on their own `/attendance/{id}` to change `status: "absent"` -> `"present"`.
7. **Unverified Email Spoof**: User with `email: "4623hadi@gmail.com"` and `email_verified: false` attempts admin read/write.
8. **Shadow Field Injection**: Authenticated faculty creates `/attendance/{id}` including `{ isVerifiedOverride: true }`.
9. **Cross-Class Faculty Snooping**: Faculty assigned only to `class_aiml_a` queries `/students` with `where("classId", "==", "class_cse_b")`.
10. **ID Poisoning**: Client writes `/accessRequests/{2KB_junk_id}` with oversized document ID.
11. **Timestamp Forgery**: Client creates `/substitutions/{id}` with backdated `createdAt` instead of `request.time`.
12. **Activity Log Deletion**: Faculty or student attempts `deleteDoc(doc(db, "activityLogs", logId))`.
