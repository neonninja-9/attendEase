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
import Colors from "@/constants/colors";
import {
  getClasses,
  getStudents,
  addStudent,
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

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const classes = await getClasses();
    const cls = classes.find((c) => c.id === id);
    setClassItem(cls || null);
    const studs = await getStudents(id);
    studs.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));
    setStudents(studs);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleSave = async () => {
    if (!studentName.trim() || !rollNumber.trim()) {
      Alert.alert("Required", "Please fill in both fields.");
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
        <Text style={styles.studentRoll}>{item.rollNumber}</Text>
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
          style={styles.addBtn}
        >
          <Ionicons name="person-add-outline" size={20} color={Colors.light.tint} />
        </Pressable>
      </View>

      {students.length > 0 && (
        <Pressable
          style={({ pressed }) => [styles.takeAttendanceBtn, pressed && { opacity: 0.9 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push({ pathname: "/attendance/[classId]", params: { classId: id! } });
          }}
        >
          <Ionicons name="checkmark-done" size={20} color="#fff" />
          <Text style={styles.takeAttendanceText}>Take Attendance</Text>
        </Pressable>
      )}

      {loading ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Loading...</Text>
        </View>
      ) : students.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={64} color={Colors.light.border} />
          <Text style={styles.emptyTitle}>No Students</Text>
          <Text style={styles.emptyText}>
            Add students to this class to start taking attendance
          </Text>
          <Pressable
            style={({ pressed }) => [styles.addFirstBtn, pressed && { opacity: 0.85 }]}
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="person-add-outline" size={18} color="#fff" />
            <Text style={styles.addFirstBtnText}>Add Student</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={students}
          keyExtractor={(item) => item.id}
          renderItem={renderStudent}
          contentContainerStyle={[styles.list, { paddingBottom: 40 }]}
          showsVerticalScrollIndicator={false}
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
            <Text style={styles.inputLabel}>Student Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Rahul Kumar"
              value={studentName}
              onChangeText={setStudentName}
              placeholderTextColor={Colors.light.tabIconDefault}
              autoFocus
            />
            <Text style={styles.inputLabel}>Roll Number</Text>
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
  addBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  takeAttendanceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.tint,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  takeAttendanceText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
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
  addFirstBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 8,
    marginTop: 12,
  },
  addFirstBtnText: {
    color: "#fff",
    fontSize: 15,
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
