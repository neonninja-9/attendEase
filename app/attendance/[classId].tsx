import React, { useState, useCallback, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  Alert,
  Platform,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import {
  getClasses,
  getStudents,
  getFaculty,
  saveAttendance,
  ClassItem,
  Student,
  Faculty,
} from "@/lib/storage";

export default function AttendanceScreen() {
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const insets = useSafeAreaInsets();
  const [classItem, setClassItem] = useState<ClassItem | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [faculty, setFaculty] = useState<Faculty | null>(null);
  const [statusMap, setStatusMap] = useState<Record<string, "present" | "absent">>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });

  const loadData = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    const classes = await getClasses();
    const cls = classes.find((c) => c.id === classId);
    setClassItem(cls || null);
    const studs = await getStudents();
    studs.sort((a, b) => {
      if (!a.rollNumber && !b.rollNumber) return a.name.localeCompare(b.name);
      if (!a.rollNumber) return 1;
      if (!b.rollNumber) return -1;
      return a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true });
    });
    setStudents(studs);
    const map: Record<string, "present" | "absent"> = {};
    studs.forEach((s) => {
      map[s.id] = "present";
    });
    setStatusMap(map);
    const f = await getFaculty();
    setFaculty(f);
    setLoading(false);
  }, [classId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const toggleStatus = (studentId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStatusMap((prev) => ({
      ...prev,
      [studentId]: prev[studentId] === "present" ? "absent" : "present",
    }));
  };

  const markAll = (status: "present" | "absent") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const map: Record<string, "present" | "absent"> = {};
    students.forEach((s) => {
      map[s.id] = status;
    });
    setStatusMap(map);
  };

  const counts = useMemo(() => {
    const vals = Object.values(statusMap);
    return {
      present: vals.filter((v) => v === "present").length,
      absent: vals.filter((v) => v === "absent").length,
      total: vals.length,
    };
  }, [statusMap]);

  const formatDisplayDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const changeDate = (direction: number) => {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + direction);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const handleSubmitAndSend = async () => {
    setSaving(true);
    try {
      await saveAttendance(classId!, selectedDate, statusMap);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const absentStudents = students.filter((s) => statusMap[s.id] === "absent");


      let message = `*Attendance Report*\n`;
      message += `Class: ${classItem?.courseName || "N/A"} (${classItem?.subjectCode || ""})\n`;
      message += `Date: ${formatDisplayDate(selectedDate)}\n`;
      if (faculty?.name) message += `Faculty: ${faculty.name}\n`;
      message += `\n`;
      message += `Total: ${counts.total} | Present: ${counts.present} | Absent: ${counts.absent}\n`;
      message += `Attendance: ${counts.total > 0 ? Math.round((counts.present / counts.total) * 100) : 0}%\n`;

      if (absentStudents.length > 0) {
        message += `\n*Absentees (${absentStudents.length}):*\n`;
        absentStudents.forEach((s) => {
          message += s.rollNumber ? `- ${s.rollNumber} - ${s.name}\n` : `- ${s.name}\n`;
        });
      } else {
        message += `\nAll students present!\n`;
      }

      const encoded = encodeURIComponent(message);
      let whatsappUrl: string;

      // Sanitize phone number: remove all non-numeric characters
      const rawNumber = faculty?.whatsappNumber || "";
      const sanitizedNumber = rawNumber.replace(/\D/g, "");

      if (sanitizedNumber) {
        // Use whatsapp:// scheme for direct app opening if possible
        whatsappUrl = `whatsapp://send?text=${encoded}&phone=${sanitizedNumber}`;
      } else {
        whatsappUrl = `whatsapp://send?text=${encoded}`;
      }

      // Fallback URL using web interface if app is not installed
      const webUrl = sanitizedNumber
        ? `https://wa.me/${sanitizedNumber}?text=${encoded}`
        : `https://wa.me/?text=${encoded}`;

      try {
        const canOpen = await Linking.canOpenURL(whatsappUrl);

        if (canOpen) {
          await Linking.openURL(whatsappUrl);
        } else {
          // If native app scheme fails, try web fallback
          // This is especially expected on Web platform or if WhatsApp is not installed
          const canOpenWeb = await Linking.canOpenURL(webUrl);
          if (canOpenWeb) {
            await Linking.openURL(webUrl);
          } else {
            throw new Error("Cannot open WhatsApp");
          }
        }
      } catch (err) {
        if (Platform.OS === "web") {
          (globalThis as any).window?.open?.(webUrl, "_blank");
        } else {
          Alert.alert(
            "WhatsApp Not Available",
            "Could not open WhatsApp. It may not be installed on this device.",
            [{ text: "OK", onPress: () => router.back() }]
          );
          return;
        }
      }

      Alert.alert("Success", "Attendance saved and sent!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (_err) {
      Alert.alert("Error", "Failed to save attendance. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOnly = async () => {
    setSaving(true);
    try {
      await saveAttendance(classId!, selectedDate, statusMap);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved", "Attendance has been saved.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Error", "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const renderStudent = ({ item }: { item: Student }) => {
    const status = statusMap[item.id] || "absent";
    const isPresent = status === "present";

    return (
      <Pressable
        style={[
          styles.studentRow,
          {
            borderLeftWidth: 3,
            borderLeftColor: isPresent ? Colors.light.present : Colors.light.absent,
          },
        ]}
        onPress={() => toggleStatus(item.id)}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.studentName} numberOfLines={1}>{item.name}</Text>
          {item.rollNumber ? (
            <Text style={styles.studentRoll}>{item.rollNumber}</Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => toggleStatus(item.id)}
          style={[
            styles.statusToggle,
            {
              backgroundColor: isPresent
                ? Colors.light.successLight
                : Colors.light.dangerLight,
            },
          ]}
        >
          <Ionicons
            name={isPresent ? "checkmark-circle" : "close-circle"}
            size={20}
            color={isPresent ? Colors.light.present : Colors.light.absent}
          />
          <Text
            style={[
              styles.statusText,
              { color: isPresent ? Colors.light.present : Colors.light.absent },
            ]}
          >
            {isPresent ? "Present" : "Absent"}
          </Text>
        </Pressable>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerFull]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 + webTopInset }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>Attendance</Text>
          <Text style={styles.headerSub}>
            {classItem?.courseName} ({classItem?.subjectCode})
          </Text>
        </View>
      </View>

      <View style={styles.datePicker}>
        <Pressable onPress={() => changeDate(-1)} style={styles.dateArrow}>
          <Ionicons name="chevron-back" size={20} color={Colors.light.tint} />
        </Pressable>
        <View style={styles.dateCenter}>
          <Ionicons name="calendar" size={16} color={Colors.light.tint} />
          <Text style={styles.dateText}>{formatDisplayDate(selectedDate)}</Text>
        </View>
        <Pressable onPress={() => changeDate(1)} style={styles.dateArrow}>
          <Ionicons name="chevron-forward" size={20} color={Colors.light.tint} />
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statChip, { backgroundColor: Colors.light.successLight }]}>
          <Ionicons name="checkmark-circle" size={14} color={Colors.light.present} />
          <Text style={[styles.statChipText, { color: Colors.light.present }]}>
            {counts.present} Present
          </Text>
        </View>
        <View style={[styles.statChip, { backgroundColor: Colors.light.dangerLight }]}>
          <Ionicons name="close-circle" size={14} color={Colors.light.absent} />
          <Text style={[styles.statChipText, { color: Colors.light.absent }]}>
            {counts.absent} Absent
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => markAll("present")}
          style={[styles.quickBtn, { borderColor: Colors.light.present }]}
        >
          <Text style={[styles.quickBtnText, { color: Colors.light.present }]}>All P</Text>
        </Pressable>
        <Pressable
          onPress={() => markAll("absent")}
          style={[styles.quickBtn, { borderColor: Colors.light.absent }]}
        >
          <Text style={[styles.quickBtnText, { color: Colors.light.absent }]}>All A</Text>
        </Pressable>
      </View>

      <FlatList
        data={students}
        keyExtractor={(item) => item.id}
        renderItem={renderStudent}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) + (Platform.OS === "web" ? 34 : 0) }]}>
        <Pressable
          style={({ pressed }) => [styles.saveOnlyBtn, pressed && { opacity: 0.85 }]}
          onPress={handleSaveOnly}
          disabled={saving}
        >
          <Ionicons name="save-outline" size={18} color={Colors.light.tint} />
          <Text style={styles.saveOnlyText}>Save</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.submitBtn,
            pressed && { opacity: 0.85 },
            saving && { opacity: 0.6 },
          ]}
          onPress={handleSubmitAndSend}
          disabled={saving}
        >
          <Ionicons name="logo-whatsapp" size={20} color="#fff" />
          <Text style={styles.submitText}>Submit & Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  centerFull: { justifyContent: "center", alignItems: "center" },
  loadingText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
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
  datePicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
  },
  dateArrow: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  dateCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    justifyContent: "center",
  },
  dateText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  statChipText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  quickBtn: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  quickBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  list: { padding: 16, gap: 6, paddingBottom: 140 },
  studentRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.surface,
    padding: 14,
    borderRadius: 12,
    gap: 12,
    marginBottom: 2,
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
  statusToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 5,
  },
  statusText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  footer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
    backgroundColor: Colors.light.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderLight,
  },
  saveOnlyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: Colors.light.tint,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 6,
  },
  saveOnlyText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.tint,
  },
  submitBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#25D366",
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  submitText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});
