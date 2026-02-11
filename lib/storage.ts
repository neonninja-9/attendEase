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
  classId: string;
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
  ATTENDANCE: "attendance_records",
  SESSIONS: "attendance_sessions",
  INITIALIZED: "app_initialized",
};

const DEFAULT_CLASSES: Omit<ClassItem, "id">[] = [
  { subjectCode: "BSU443", courseName: "Behavioural Science- IV (Values & Ethics for Personal & Professional Development)" },
  { subjectCode: "BCU441", courseName: "Communication Skills - IV (Term Paper)" },
  { subjectCode: "CSE402", courseName: "Computer Organization and Architecture" },
  { subjectCode: "CSE405", courseName: "Cryptography & Network Security" },
  { subjectCode: "CSE401", courseName: "Discrete Mathematics" },
  { subjectCode: "CSE403", courseName: "Java Programming" },
  { subjectCode: "CSE423", courseName: "Java Programming Lab" },
  { subjectCode: "CSE404", courseName: "Operating Systems" },
  { subjectCode: "CSE424", courseName: "Operating Systems Lab" },
  { subjectCode: "FLU444", courseName: "French - IV" },
  { subjectCode: "CSA401", courseName: "Neural Networks and Deep Learning" },
  { subjectCode: "CSA421", courseName: "Neural Networks and Deep Learning Lab" },
];

function genId(): string {
  return Crypto.randomUUID();
}

export async function initializeDefaults(): Promise<void> {
  const initialized = await AsyncStorage.getItem(KEYS.INITIALIZED);
  if (initialized) return;

  const existingClasses = await getClasses();
  if (existingClasses.length === 0) {
    const classes: ClassItem[] = DEFAULT_CLASSES.map((c) => ({
      id: genId(),
      ...c,
    }));
    await AsyncStorage.setItem(KEYS.CLASSES, JSON.stringify(classes));
  }
  await AsyncStorage.setItem(KEYS.INITIALIZED, "true");
}

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
  let students = await getStudents();
  students = students.filter((s) => s.classId !== id);
  await AsyncStorage.setItem(KEYS.STUDENTS, JSON.stringify(students));
  let records = await getAttendanceRecords();
  records = records.filter((r) => r.classId !== id);
  await AsyncStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(records));
  let sessions = await getSessions();
  sessions = sessions.filter((s) => s.classId !== id);
  await AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
}

export async function getStudents(classId?: string): Promise<Student[]> {
  const data = await AsyncStorage.getItem(KEYS.STUDENTS);
  const students: Student[] = data ? JSON.parse(data) : [];
  if (classId) return students.filter((s) => s.classId === classId);
  return students;
}

export async function addStudent(item: Omit<Student, "id">): Promise<Student> {
  const students = await getStudents();
  const newStudent: Student = { id: genId(), ...item };
  students.push(newStudent);
  await AsyncStorage.setItem(KEYS.STUDENTS, JSON.stringify(students));
  return newStudent;
}

export async function addStudentsBulk(items: Omit<Student, "id">[]): Promise<number> {
  const students = await getStudents();
  const newStudents: Student[] = items.map((item) => ({
    id: genId(),
    ...item,
  }));
  await AsyncStorage.setItem(
    KEYS.STUDENTS,
    JSON.stringify([...students, ...newStudents])
  );
  return newStudents.length;
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
  let students = await getStudents();
  students = students.filter((s) => s.id !== id);
  await AsyncStorage.setItem(KEYS.STUDENTS, JSON.stringify(students));
}

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
