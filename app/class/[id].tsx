import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import {
  getClasses,
  getStudents,
  ClassItem,
  Student,
} from "@/lib/storage";

export default function ClassDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [classItem, setClassItem] = useState<ClassItem | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const classes = await getClasses();
    const cls = classes.find((c) => c.id === id);
    setClassItem(cls || null);

    // Get all students (global list)
    const studs = await getStudents();
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

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const renderStudent = ({ item, index }: { item: Student; index: number }) => (
    <View style={styles.studentRow}>
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
    </View>
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
            Go to "Manage Students" on the dashboard to add students.
          </Text>
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
});
