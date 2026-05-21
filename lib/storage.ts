import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

export interface Faculty {
  id: string;
  name: string;
  whatsappNumber: string;
}

export interface ClassItem {
  id: string;
  courseName: string;
  subjectCode: string;
}

export interface Student {
  id: string;
  name: string;
  rollNumber: string;
}

export interface ClassEnrollment {
  classId: string;
  studentId: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string;
  status: "present" | "absent";
  sessionId: string;
  classId: string;
}

export interface AttendanceSession {
  id: string;
  classId: string;
  date: string;
  createdAt: string;
}

const KEYS = {
  FACULTY: "faculty_profile",
  CLASSES: "classes",
  STUDENTS: "students",
  ENROLLMENTS: "class_enrollments",
  ATTENDANCE: "attendance_records",
  SESSIONS: "attendance_sessions",
  INITIALIZED: "app_initialized_v2",
  MIGRATION_V3: "migration_enrollment_v3",
};

function genId(): string {
  return Crypto.randomUUID();
}

// ─── Migration ───────────────────────────────────────────────────────────────

/**
 * One-time migration: create the enrollment join table.
 * For existing users who have students + classes, enroll all students
 * into all classes so nothing breaks. Faculty can then clean up.
 */
export async function migrateToClassEnrollments(): Promise<void> {
  const migrated = await AsyncStorage.getItem(KEYS.MIGRATION_V3);
  if (migrated === "done") return;

  const students = await getStudents();
  const classes = await getClasses();
  const existingEnrollments = await getEnrollments();

  // Only migrate if there's no enrollment data yet but students/classes exist
  if (existingEnrollments.length === 0 && students.length > 0 && classes.length > 0) {
    const enrollments: ClassEnrollment[] = [];
    for (const cls of classes) {
      for (const student of students) {
        enrollments.push({ classId: cls.id, studentId: student.id });
      }
    }
    await AsyncStorage.setItem(KEYS.ENROLLMENTS, JSON.stringify(enrollments));
  }

  await AsyncStorage.setItem(KEYS.MIGRATION_V3, "done");
}

// ─── Initialization ──────────────────────────────────────────────────────────

export async function initializeDefaults(): Promise<void> {
  await migrateToClassEnrollments();
}

export async function resetApp(): Promise<void> {
  await AsyncStorage.multiRemove([
    KEYS.FACULTY,
    KEYS.CLASSES,
    KEYS.STUDENTS,
    KEYS.ENROLLMENTS,
    KEYS.ATTENDANCE,
    KEYS.SESSIONS,
    KEYS.INITIALIZED,
    KEYS.MIGRATION_V3,
  ]);
}

// ─── Enrollment helpers ──────────────────────────────────────────────────────

async function getEnrollments(): Promise<ClassEnrollment[]> {
  const data = await AsyncStorage.getItem(KEYS.ENROLLMENTS);
  return data ? JSON.parse(data) : [];
}

async function saveEnrollments(enrollments: ClassEnrollment[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.ENROLLMENTS, JSON.stringify(enrollments));
}

// ─── Faculty ─────────────────────────────────────────────────────────────────

export async function getFaculty(): Promise<Faculty | null> {
  const data = await AsyncStorage.getItem(KEYS.FACULTY);
  return data ? JSON.parse(data) : null;
}

export async function saveFaculty(faculty: Omit<Faculty, "id">): Promise<Faculty> {
  const existing = await getFaculty();
  const saved: Faculty = { id: existing?.id || genId(), ...faculty };
  await AsyncStorage.setItem(KEYS.FACULTY, JSON.stringify(saved));
  return saved;
}

// ─── Classes ─────────────────────────────────────────────────────────────────

export async function getClasses(): Promise<ClassItem[]> {
  const data = await AsyncStorage.getItem(KEYS.CLASSES);
  return data ? JSON.parse(data) : [];
}

export async function addClass(item: Omit<ClassItem, "id">): Promise<ClassItem> {
  const classes = await getClasses();
  const newClass: ClassItem = { id: genId(), ...item };
  classes.push(newClass);
  await AsyncStorage.setItem(KEYS.CLASSES, JSON.stringify(classes));
  return newClass;
}

export async function updateClass(id: string, updates: Partial<ClassItem>): Promise<void> {
  const classes = await getClasses();
  const idx = classes.findIndex((c) => c.id === id);
  if (idx !== -1) {
    classes[idx] = { ...classes[idx], ...updates };
    await AsyncStorage.setItem(KEYS.CLASSES, JSON.stringify(classes));
  }
}

export async function deleteClass(id: string): Promise<void> {
  let classes = await getClasses();
  classes = classes.filter((c) => c.id !== id);
  await AsyncStorage.setItem(KEYS.CLASSES, JSON.stringify(classes));

  // Remove enrollments for this class
  let enrollments = await getEnrollments();
  enrollments = enrollments.filter((e) => e.classId !== id);
  await saveEnrollments(enrollments);

  // Remove attendance records for this class
  let records = await getAttendanceRecords();
  records = records.filter((r) => r.classId !== id);
  await AsyncStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(records));

  // Remove sessions for this class
  let sessions = await getSessions();
  sessions = sessions.filter((s) => s.classId !== id);
  await AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
}

// ─── Students (master pool) ──────────────────────────────────────────────────

export async function getStudents(): Promise<Student[]> {
  const data = await AsyncStorage.getItem(KEYS.STUDENTS);
  return data ? JSON.parse(data) : [];
}

export async function addStudent(item: Omit<Student, "id">): Promise<Student> {
  const students = await getStudents();
  const newStudent: Student = { id: genId(), ...item };
  students.push(newStudent);
  await AsyncStorage.setItem(KEYS.STUDENTS, JSON.stringify(students));
  return newStudent;
}

export async function updateStudent(id: string, updates: Partial<Student>): Promise<void> {
  const students = await getStudents();
  const idx = students.findIndex((s) => s.id === id);
  if (idx !== -1) {
    students[idx] = { ...students[idx], ...updates };
    await AsyncStorage.setItem(KEYS.STUDENTS, JSON.stringify(students));
  }
}

export async function deleteStudent(id: string): Promise<void> {
  // Remove from student pool
  let students = await getStudents();
  students = students.filter((s) => s.id !== id);
  await AsyncStorage.setItem(KEYS.STUDENTS, JSON.stringify(students));

  // Remove all enrollments for this student
  let enrollments = await getEnrollments();
  enrollments = enrollments.filter((e) => e.studentId !== id);
  await saveEnrollments(enrollments);

  // Remove all attendance records for this student
  let records = await getAttendanceRecords();
  records = records.filter((r) => r.studentId !== id);
  await AsyncStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(records));
}

export async function deleteAllStudents(): Promise<void> {
  await AsyncStorage.setItem(KEYS.STUDENTS, JSON.stringify([]));
  await AsyncStorage.setItem(KEYS.ENROLLMENTS, JSON.stringify([]));
  await AsyncStorage.setItem(KEYS.ATTENDANCE, JSON.stringify([]));
}

// ─── Class Enrollment ────────────────────────────────────────────────────────

/**
 * Get all students enrolled in a specific class, sorted by roll number.
 */
export async function getEnrolledStudents(classId: string): Promise<Student[]> {
  const enrollments = await getEnrollments();
  const enrolledIds = new Set(
    enrollments.filter((e) => e.classId === classId).map((e) => e.studentId)
  );
  const allStudents = await getStudents();
  const enrolled = allStudents.filter((s) => enrolledIds.has(s.id));
  enrolled.sort((a, b) => {
    if (!a.rollNumber && !b.rollNumber) return a.name.localeCompare(b.name);
    if (!a.rollNumber) return 1;
    if (!b.rollNumber) return -1;
    return a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true });
  });
  return enrolled;
}

/**
 * Get students from the master pool who are NOT enrolled in a specific class.
 */
export async function getUnenrolledStudents(classId: string): Promise<Student[]> {
  const enrollments = await getEnrollments();
  const enrolledIds = new Set(
    enrollments.filter((e) => e.classId === classId).map((e) => e.studentId)
  );
  const allStudents = await getStudents();
  const unenrolled = allStudents.filter((s) => !enrolledIds.has(s.id));
  unenrolled.sort((a, b) => a.name.localeCompare(b.name));
  return unenrolled;
}

/**
 * Enroll a single student in a class (idempotent).
 */
export async function enrollStudent(classId: string, studentId: string): Promise<void> {
  const enrollments = await getEnrollments();
  const alreadyEnrolled = enrollments.some(
    (e) => e.classId === classId && e.studentId === studentId
  );
  if (!alreadyEnrolled) {
    enrollments.push({ classId, studentId });
    await saveEnrollments(enrollments);
  }
}

/**
 * Enroll multiple students in a class (idempotent).
 */
export async function enrollStudentsBulk(classId: string, studentIds: string[]): Promise<void> {
  const enrollments = await getEnrollments();
  const existingSet = new Set(
    enrollments
      .filter((e) => e.classId === classId)
      .map((e) => e.studentId)
  );
  const newEnrollments = studentIds
    .filter((id) => !existingSet.has(id))
    .map((studentId) => ({ classId, studentId }));

  if (newEnrollments.length > 0) {
    await saveEnrollments([...enrollments, ...newEnrollments]);
  }
}

/**
 * Unenroll a student from a class (keeps student in pool).
 */
export async function unenrollStudent(classId: string, studentId: string): Promise<void> {
  let enrollments = await getEnrollments();
  enrollments = enrollments.filter(
    (e) => !(e.classId === classId && e.studentId === studentId)
  );
  await saveEnrollments(enrollments);
}

/**
 * Get the number of classes a student is enrolled in.
 */
export async function getEnrollmentCountForStudent(studentId: string): Promise<number> {
  const enrollments = await getEnrollments();
  return enrollments.filter((e) => e.studentId === studentId).length;
}

/**
 * Get enrolled student count for a class (fast, no need to load full student list).
 */
export async function getEnrolledStudentCount(classId: string): Promise<number> {
  const enrollments = await getEnrollments();
  return enrollments.filter((e) => e.classId === classId).length;
}

// ─── Duplicate checking ──────────────────────────────────────────────────────

/**
 * Check if a roll/enrollment number already exists in the master pool.
 * Empty roll numbers are always allowed (returns false).
 */
export async function checkDuplicateRollNumber(
  rollNumber: string,
  excludeId?: string
): Promise<boolean> {
  const trimmed = rollNumber.trim();
  if (!trimmed) return false; // empty roll numbers are always OK
  const students = await getStudents();
  return students.some(
    (s) => s.rollNumber.toLowerCase().trim() === trimmed.toLowerCase() && s.id !== excludeId
  );
}

// ─── Bulk import (class-scoped) ──────────────────────────────────────────────

/**
 * Add students to the master pool and enroll them in the given class.
 * Skips students whose names already exist in the pool (case-insensitive).
 * For students that already exist but aren't enrolled, enrolls them.
 */
export async function addStudentsBulk(
  items: Omit<Student, "id">[],
  classId?: string
): Promise<{ added: number; skipped: number; enrolled: number }> {
  const students = await getStudents();
  const newStudents: Student[] = [];
  const toEnroll: string[] = [];
  let skipped = 0;

  for (const item of items) {
    const rollTrimmed = item.rollNumber.trim();

    // Skip duplicate roll numbers (but allow empty ones)
    if (rollTrimmed) {
      const allCurrent = [...students, ...newStudents];
      const existingByRoll = allCurrent.find(
        (s) => s.rollNumber.toLowerCase().trim() === rollTrimmed.toLowerCase()
      );
      if (existingByRoll) {
        // Student with this roll number exists — just enroll them
        toEnroll.push(existingByRoll.id);
        skipped++;
        continue;
      }
    }

    const newStudent: Student = { id: genId(), ...item };
    newStudents.push(newStudent);
    toEnroll.push(newStudent.id);
  }

  if (newStudents.length > 0) {
    await AsyncStorage.setItem(
      KEYS.STUDENTS,
      JSON.stringify([...students, ...newStudents])
    );
  }

  let enrolled = 0;
  if (classId && toEnroll.length > 0) {
    const enrollments = await getEnrollments();
    const existingEnrolled = new Set(
      enrollments.filter((e) => e.classId === classId).map((e) => e.studentId)
    );
    const newEnrollments = toEnroll
      .filter((id) => !existingEnrolled.has(id))
      .map((studentId) => ({ classId, studentId }));
    enrolled = newEnrollments.length;
    if (newEnrollments.length > 0) {
      await saveEnrollments([...enrollments, ...newEnrollments]);
    }
  }

  return { added: newStudents.length, skipped, enrolled };
}

// ─── Attendance Sessions ─────────────────────────────────────────────────────

export async function getSessions(classId?: string): Promise<AttendanceSession[]> {
  const data = await AsyncStorage.getItem(KEYS.SESSIONS);
  const sessions: AttendanceSession[] = data ? JSON.parse(data) : [];
  if (classId) return sessions.filter((s) => s.classId === classId);
  return sessions;
}

export async function getAttendanceRecords(sessionId?: string): Promise<AttendanceRecord[]> {
  const data = await AsyncStorage.getItem(KEYS.ATTENDANCE);
  const records: AttendanceRecord[] = data ? JSON.parse(data) : [];
  if (sessionId) return records.filter((r) => r.sessionId === sessionId);
  return records;
}

export async function getAttendanceByClassAndDate(
  classId: string,
  date: string
): Promise<AttendanceRecord[]> {
  const records = await getAttendanceRecords();
  return records.filter((r) => r.classId === classId && r.date === date);
}

export async function saveAttendance(
  classId: string,
  date: string,
  attendanceMap: Record<string, "present" | "absent">
): Promise<string> {
  const sessionId = genId();
  const session: AttendanceSession = {
    id: sessionId,
    classId,
    date,
    createdAt: new Date().toISOString(),
  };

  const sessions = await getSessions();
  sessions.push(session);
  await AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));

  const records = await getAttendanceRecords();
  const newRecords: AttendanceRecord[] = Object.entries(attendanceMap).map(
    ([studentId, status]) => ({
      id: genId(),
      studentId,
      date,
      status,
      sessionId,
      classId,
    })
  );

  await AsyncStorage.setItem(
    KEYS.ATTENDANCE,
    JSON.stringify([...records, ...newRecords])
  );

  return sessionId;
}

export async function deleteSession(sessionId: string): Promise<void> {
  let sessions = await getSessions();
  sessions = sessions.filter((s) => s.id !== sessionId);
  await AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
  let records = await getAttendanceRecords();
  records = records.filter((r) => r.sessionId !== sessionId);
  await AsyncStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(records));
}
