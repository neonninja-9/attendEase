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
  // classId removed to make students global
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
  INITIALIZED: "app_initialized_v2",
};

const EXCLUDED_CODES = ["BCU441", "CSA401", "CSA421"];

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

const DEFAULT_STUDENT_NAMES = [
  "ANJALI BHADORIA",
  "VINEET MITTAL",
  "SUNDRAM SINGH",
  "NITYA JAIN",
  "ABHISHEK SHARMA",
  "SAGAR JOSHI",
  "YASH RANA",
  "YASH SHARMA",
  "GOURAV SHARMA",
  "GAURAV SINGH CHAUHAN",
  "PRATIK MISHRA",
  "PIYUSH THAKUR",
  "HARSHIT PAL",
  "KANISHK RAJ",
  "ARYAMA SINGH TOMAR",
  "ANURAG SINGH",
  "ANKIT",
  "DEVANSH GUPTA",
  "BHANU PRATAP SINGH CHAUHAN",
  "AYUSH VYAS",
  "NISHANT KUSHWAH",
  "RAGINI PARIHAR",
  "LOVE SHARMA",
  "ADITYA TIWARI",
  "DEEPAK SINGH GURJAR",
  "R HIM KHAN",
  "LAVLESH",
  "BHAKTI GOYAL",
  "ABHISHEK SHRIVASTAVA",
  "ANSHU KUMAR",
  "NITIN RAJAK",
  "PRIYANKA",
  "AYAAN SIDDIQUI",
  "GANPAT SINGH TOMAR",
  "HARI NANDAN",
  "ADITYA SINGH TOMAR",
  "SAJAL SHARMA",
  "VINEET KAURAV",
  "JAIDEEP KAMTHAN",
  "NIKHIL CHAUHAN",
  "VIKASH VIKRAM SINGH",
  "KRISHNA",
  "TANMAY JAIN",
  "JATIN KUSHWAH",
  "TANU SONI",
  "TAPSHYA MANGAL",
  "KM NEHA",
  "HARSH PARMAR",
  "VISHWAJEET GURJAR",
  "ADITYA AGRAWAL",
  "MANASWI PRAKASH",
  "KSHITIJ SINGH",
  "DHRUV JAIN",
  "MOHIT SHARMA",
  "HIMANSHU SHARMA",
];

function genId(): string {
  return Crypto.randomUUID();
}

export async function initializeDefaults(): Promise<void> {
  const initialized = await AsyncStorage.getItem(KEYS.INITIALIZED);
  if (initialized) return;

  const existingClasses = await getClasses();
  if (existingClasses.length === 0) {
    const classes = DEFAULT_CLASSES.map((c) => ({
      id: genId(),
      ...c,
    }));
    await AsyncStorage.setItem(KEYS.CLASSES, JSON.stringify(classes));
  }

  const existingStudents = await getStudents();
  const newStudents: Student[] = [];
  const existingNames = new Set(existingStudents.map((s) => s.name.toLowerCase().trim()));

  for (const name of DEFAULT_STUDENT_NAMES) {
    if (!existingNames.has(name.toLowerCase().trim())) {
      newStudents.push({
        id: genId(),
        name,
        rollNumber: "",
      });
    }
  }

  if (newStudents.length > 0) {
    await AsyncStorage.setItem(
      KEYS.STUDENTS,
      JSON.stringify([...existingStudents, ...newStudents])
    );
  }

  await AsyncStorage.setItem(KEYS.INITIALIZED, "true");
}

export async function checkDuplicateStudentName(
  name: string,
  excludeId?: string
): Promise<boolean> {
  const students = await getStudents();
  const normalizedName = name.toLowerCase().trim();
  return students.some(
    (s) => s.name.toLowerCase().trim() === normalizedName && s.id !== excludeId
  );
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
  // Students are no longer deleted when a class is deleted as they are global
  let records = await getAttendanceRecords();
  records = records.filter((r) => r.classId !== id);
  await AsyncStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(records));
  let sessions = await getSessions();
  sessions = sessions.filter((s) => s.classId !== id);
  await AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
}

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

export async function addStudentsBulk(items: Omit<Student, "id">[]): Promise<{ added: number; skipped: number }> {
  const students = await getStudents();
  const newStudents: Student[] = [];
  let skipped = 0;

  for (const item of items) {
    const existingNames = new Set([...students, ...newStudents].map(s => s.name.toLowerCase().trim()));
    const normalizedName = item.name.toLowerCase().trim();

    if (existingNames.has(normalizedName)) {
      skipped++;
    } else {
      newStudents.push({ id: genId(), ...item });
    }
  }

  if (newStudents.length > 0) {
    await AsyncStorage.setItem(
      KEYS.STUDENTS,
      JSON.stringify([...students, ...newStudents])
    );
  }

  return { added: newStudents.length, skipped };
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
  // Also clean up attendance records for this student
  let records = await getAttendanceRecords();
  records = records.filter((r) => r.studentId !== id);
  await AsyncStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(records));
}

export async function deleteAllStudents(): Promise<void> {
  await AsyncStorage.setItem(KEYS.STUDENTS, JSON.stringify([]));
  // Remove all attendance records as they depend on students
  await AsyncStorage.setItem(KEYS.ATTENDANCE, JSON.stringify([]));
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
