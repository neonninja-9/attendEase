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
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import {
  getClasses,
  addClass,
  deleteClass,
  updateClass,
  getStudents,
  getSessions,
  ClassItem,
} from "@/lib/storage";

interface ClassWithStats extends ClassItem {
  studentCount: number;
  sessionCount: number;
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const [classes, setClasses] = useState<ClassWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [courseName, setCourseName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    const allClasses = await getClasses();
    const withStats: ClassWithStats[] = await Promise.all(
      allClasses.map(async (c) => {
        const students = await getStudents();
        const sessions = await getSessions(c.id);
        return { ...c, studentCount: students.length, sessionCount: sessions.length };
      })
    );
    setClasses(withStats);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleSave = async () => {
    if (!courseName.trim() || !subjectCode.trim()) {
      Alert.alert("Required", "Please fill in both fields.");
      return;
    }
    if (editingClass) {
      await updateClass(editingClass.id, {
        courseName: courseName.trim(),
        subjectCode: subjectCode.trim(),
      });
    } else {
      await addClass({
        courseName: courseName.trim(),
        subjectCode: subjectCode.trim(),
      });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    resetModal();
    loadData();
  };

  const handleDelete = (item: ClassItem) => {
    Alert.alert(
      "Delete Class",
      `Delete "${item.courseName}"? All students and records will be removed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteClass(item.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            loadData();
          },
        },
      ]
    );
  };

  const resetModal = () => {
    setModalVisible(false);
    setEditingClass(null);
    setCourseName("");
    setSubjectCode("");
  };

  const openEdit = (item: ClassItem) => {
    setEditingClass(item);
    setCourseName(item.courseName);
    setSubjectCode(item.subjectCode);
    setModalVisible(true);
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const renderClass = ({ item }: { item: ClassWithStats }) => (
    <Pressable
      style={({ pressed }) => [styles.classCard, pressed && styles.pressed]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: "/class/[id]", params: { id: item.id } });
      }}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert(item.courseName, "Choose an action", [
          { text: "Edit", onPress: () => openEdit(item) },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => handleDelete(item),
          },
          { text: "Cancel", style: "cancel" },
        ]);
      }}
    >
      <View style={styles.cardHeader}>
        <View style={styles.codeChip}>
          <Text style={styles.codeChipText}>{item.subjectCode}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.light.tabIconDefault} />
      </View>
      <Text style={styles.className} numberOfLines={2}>
        {item.courseName}
      </Text>
      <View style={styles.cardFooter}>
        <View style={styles.stat}>
          <Ionicons name="people-outline" size={14} color={Colors.light.textSecondary} />
          <Text style={styles.statText}>{item.studentCount} students</Text>
        </View>
        <View style={styles.stat}>
          <Ionicons name="calendar-outline" size={14} color={Colors.light.textSecondary} />
          <Text style={styles.statText}>{item.sessionCount} sessions</Text>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 + webTopInset }]}>
        <Text style={styles.headerTitle}>My Classes</Text>
        <View style={styles.headerBtnRow}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              // @ts-ignore
              router.push("/students/manage");
            }}
            style={({ pressed }) => [styles.manageBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="people" size={20} color={Colors.light.tint} />
            <Text style={styles.manageBtnText}>Manage Students</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setModalVisible(true);
            }}
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="add" size={28} color={Colors.light.tint} />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Loading...</Text>
        </View>
      ) : classes.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="school-outline" size={64} color={Colors.light.border} />
          <Text style={styles.emptyTitle}>No Classes Yet</Text>
          <Text style={styles.emptyText}>
            Tap the + button to add your first class
          </Text>
        </View>
      ) : (
        <FlatList
          data={classes}
          keyExtractor={(item) => item.id}
          renderItem={renderClass}
          contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
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
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingClass ? "Edit Class" : "New Class"}
              </Text>
              <Pressable onPress={resetModal}>
                <Ionicons name="close" size={24} color={Colors.light.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.inputLabel}>Course Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Data Structures"
              value={courseName}
              onChangeText={setCourseName}
              placeholderTextColor={Colors.light.tabIconDefault}
              autoFocus
            />
            <Text style={styles.inputLabel}>Subject Code</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., CS201"
              value={subjectCode}
              onChangeText={setSubjectCode}
              placeholderTextColor={Colors.light.tabIconDefault}
              autoCapitalize="characters"
            />
            <Pressable
              style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
              onPress={handleSave}
            >
              <Text style={styles.saveBtnText}>
                {editingClass ? "Update" : "Add Class"}
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
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  addBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.accentLight,
    borderRadius: 20,
  },
  headerBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  manageBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.accentLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  manageBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.tint,
  },
  list: { padding: 16, gap: 12 },
  classCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 18,
    shadowColor: Colors.light.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 4,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  codeChip: {
    backgroundColor: Colors.light.accentLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  codeChipText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.tint,
    letterSpacing: 0.5,
  },
  className: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
    marginBottom: 14,
  },
  cardFooter: { flexDirection: "row", gap: 20 },
  stat: { flexDirection: "row", alignItems: "center", gap: 5 },
  statText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
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
  modalHeader: {
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
