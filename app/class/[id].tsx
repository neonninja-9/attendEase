import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  TextInput,
  Modal,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as XLSX from "xlsx";
import Colors from "@/constants/colors";
import {
  getClasses,
  getStudents,
  addStudent,
  addStudentsBulk,
  updateStudent,
  deleteStudent,
  ClassItem,
  Student,
} from "@/lib/storage";

export default function ClassDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [classItem, setClassItem] = useState<ClassItem | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentName, setStudentName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [importing, setImporting] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const classes = await getClasses();
    const cls = classes.find((c) => c.id === id);
    setClassItem(cls || null);
    const studs = await getStudents(id);
    studs.sort((a, b) => {
      if (!a.rollNumber && !b.rollNumber) return a.name.localeCompare(b.name);
      if (!a.rollNumber) return 1;
      if (!b.rollNumber) return -1;
      return a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true });
    });
    setStudents(studs);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleSave = async () => {
    if (!studentName.trim()) {
      Alert.alert("Required", "Please enter the student name.");
      return;
    }
    if (editingStudent) {
      await updateStudent(editingStudent.id, {
        name: studentName.trim(),
        rollNumber: rollNumber.trim(),
      });
    } else {
      await addStudent({
        name: studentName.trim(),
        rollNumber: rollNumber.trim(),
        classId: id!,
      });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    resetModal();
    loadData();
  };

  const handleDeleteStudent = (student: Student) => {
    Alert.alert("Delete Student", `Remove "${student.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteStudent(student.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          loadData();
        },
      },
    ]);
  };

  const resetModal = () => {
    setModalVisible(false);
    setEditingStudent(null);
    setStudentName("");
    setRollNumber("");
  };

  const openEdit = (student: Student) => {
    setEditingStudent(student);
    setStudentName(student.name);
    setRollNumber(student.rollNumber);
    setModalVisible(true);
  };

  const handleBulkImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "text/csv",
          "text/comma-separated-values",
          "*/*",
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      setImporting(true);
      const file = result.assets[0];
      const uri = file.uri;
      const fileName = file.name || "";

      let parsedStudents: { name: string; rollNumber: string }[] = [];

      if (Platform.OS === "web") {
        const response = await globalThis.fetch(uri);
        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        parsedStudents = parseWorkbook(workbook);
      } else {
        const fileContent = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const workbook = XLSX.read(fileContent, { type: "base64" });
        parsedStudents = parseWorkbook(workbook);
      }

      if (parsedStudents.length === 0) {
        Alert.alert(
          "No Students Found",
          "Could not find student data in the file. Make sure your file has columns like 'Name', 'Student Name', 'Roll Number', 'Roll No', or 'Enrollment No'."
        );
        setImporting(false);
        return;
      }

      const bulkItems = parsedStudents.map((s) => ({
        name: s.name,
        rollNumber: s.rollNumber,
        classId: id!,
      }));

      const count = await addStudentsBulk(bulkItems);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Import Complete", `Successfully imported ${count} students.`);
      loadData();
    } catch (err: any) {
      Alert.alert("Import Error", err?.message || "Failed to import file. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  const parseWorkbook = (workbook: XLSX.WorkBook): { name: string; rollNumber: string }[] => {
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    const sheet = workbook.Sheets[sheetName];
    const jsonData: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (jsonData.length === 0) return [];

    const nameKeys = ["name", "student name", "student_name", "studentname", "full name", "fullname", "full_name"];
    const rollKeys = [
      "roll number", "roll no", "rollno", "roll_number", "rollnumber",
      "enrollment no", "enrollment number", "enrollment_no", "enrollmentno",
      "enroll no", "enroll_no", "reg no", "reg number", "registration number",
      "id", "student id", "studentid", "s.no", "sno", "sr no", "sr. no",
    ];

    const headers = Object.keys(jsonData[0]).map((h) => h.toLowerCase().trim());

    let nameCol = "";
    let rollCol = "";

    for (const h of Object.keys(jsonData[0])) {
      const lower = h.toLowerCase().trim();
      if (!nameCol && nameKeys.includes(lower)) nameCol = h;
      if (!rollCol && rollKeys.includes(lower)) rollCol = h;
    }

    if (!nameCol) {
      for (const h of Object.keys(jsonData[0])) {
        const lower = h.toLowerCase().trim();
        if (lower.includes("name") && !lower.includes("course") && !lower.includes("subject")) {
          nameCol = h;
          break;
        }
      }
    }

    if (!rollCol) {
      for (const h of Object.keys(jsonData[0])) {
        const lower = h.toLowerCase().trim();
        if (lower.includes("roll") || lower.includes("enroll") || lower.includes("reg")) {
          rollCol = h;
          break;
        }
      }
    }

    if (!nameCol) return [];

    const students: { name: string; rollNumber: string }[] = [];
    for (const row of jsonData) {
      const name = String(row[nameCol] || "").trim();
      const roll = rollCol ? String(row[rollCol] || "").trim() : "";
      if (name) {
        students.push({ name, rollNumber: roll });
      }
    }

    return students;
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const renderStudent = ({ item, index }: { item: Student; index: number }) => (
    <Pressable
      style={({ pressed }) => [styles.studentRow, pressed && styles.pressed]}
      onPress={() => openEdit(item)}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        handleDeleteStudent(item);
      }}
    >
      <View style={styles.indexCircle}>
        <Text style={styles.indexText}>{index + 1}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.studentName} numberOfLines={1}>{item.name}</Text>
        {item.rollNumber ? (
          <Text style={styles.studentRoll}>{item.rollNumber}</Text>
        ) : (
          <Text style={[styles.studentRoll, { fontStyle: "italic" as const, color: Colors.light.tabIconDefault }]}>
            No enrollment no.
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.light.tabIconDefault} />
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 + webTopInset }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {classItem?.courseName || "Class"}
          </Text>
          <Text style={styles.headerSub}>{classItem?.subjectCode}</Text>
        </View>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setModalVisible(true);
          }}
          style={styles.headerIconBtn}
        >
          <Ionicons name="person-add-outline" size={20} color={Colors.light.tint} />
        </Pressable>
      </View>

      <View style={styles.actionRow}>
        {students.length > 0 && (
          <Pressable
            style={({ pressed }) => [styles.takeAttendanceBtn, pressed && { opacity: 0.9 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push({ pathname: "/attendance/[classId]", params: { classId: id! } });
            }}
          >
            <Ionicons name="checkmark-done" size={18} color="#fff" />
            <Text style={styles.takeAttendanceText}>Take Attendance</Text>
          </Pressable>
        )}
        <Pressable
          style={({ pressed }) => [
            styles.importBtn,
            pressed && { opacity: 0.9 },
            importing && { opacity: 0.6 },
          ]}
          onPress={handleBulkImport}
          disabled={importing}
        >
          <Ionicons name="cloud-upload-outline" size={18} color={Colors.light.tint} />
          <Text style={styles.importBtnText}>
            {importing ? "Importing..." : "Import Excel"}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Loading...</Text>
        </View>
      ) : students.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={64} color={Colors.light.border} />
          <Text style={styles.emptyTitle}>No Students</Text>
          <Text style={styles.emptyText}>
            Add students manually or import from an Excel/CSV file
          </Text>
          <View style={styles.emptyActions}>
            <Pressable
              style={({ pressed }) => [styles.addFirstBtn, pressed && { opacity: 0.85 }]}
              onPress={() => setModalVisible(true)}
            >
              <Ionicons name="person-add-outline" size={18} color="#fff" />
              <Text style={styles.addFirstBtnText}>Add Manually</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.importFirstBtn, pressed && { opacity: 0.85 }]}
              onPress={handleBulkImport}
            >
              <Ionicons name="cloud-upload-outline" size={18} color={Colors.light.tint} />
              <Text style={styles.importFirstBtnText}>Import Excel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <FlatList
          data={students}
          keyExtractor={(item) => item.id}
          renderItem={renderStudent}
          contentContainerStyle={[styles.list, { paddingBottom: 40 }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={styles.listHeader}>{students.length} student{students.length !== 1 ? "s" : ""}</Text>
          }
        />
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={resetModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>
                {editingStudent ? "Edit Student" : "Add Student"}
              </Text>
              <Pressable onPress={resetModal}>
                <Ionicons name="close" size={24} color={Colors.light.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.inputLabel}>Student Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Rahul Kumar"
              value={studentName}
              onChangeText={setStudentName}
              placeholderTextColor={Colors.light.tabIconDefault}
              autoFocus
            />
            <Text style={styles.inputLabel}>Enrollment / Roll Number (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 2024CS001"
              value={rollNumber}
              onChangeText={setRollNumber}
              placeholderTextColor={Colors.light.tabIconDefault}
              autoCapitalize="characters"
            />
            <Pressable
              style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
              onPress={handleSave}
            >
              <Text style={styles.saveBtnText}>
                {editingStudent ? "Update" : "Add Student"}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
    gap: 12,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  headerSub: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  actionRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 10,
  },
  takeAttendanceBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.tint,
    padding: 13,
    borderRadius: 12,
    gap: 6,
  },
  takeAttendanceText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  importBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: Colors.light.tint,
    padding: 13,
    borderRadius: 12,
    gap: 6,
  },
  importBtnText: {
    color: Colors.light.tint,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  listHeader: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
    marginBottom: 8,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  list: { padding: 16, gap: 2 },
  studentRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.surface,
    padding: 14,
    borderRadius: 12,
    gap: 12,
    marginBottom: 8,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  indexCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  indexText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.tint,
  },
  studentName: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.light.text,
  },
  studentRoll: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
  },
  emptyActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  addFirstBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 6,
  },
  addFirstBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  importFirstBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: Colors.light.tint,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 6,
  },
  importFirstBtnText: {
    color: Colors.light.tint,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalContent: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.border,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
    backgroundColor: Colors.light.background,
    marginBottom: 12,
  },
  saveBtn: {
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
