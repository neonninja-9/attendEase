import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import {
  getSessions,
  getClasses,
  getAttendanceRecords,
  getStudents,
  deleteSession,
  AttendanceSession,
  ClassItem,
  Student,
  AttendanceRecord,
} from "@/lib/storage";

interface SessionDisplay {
  session: AttendanceSession;
  classItem: ClassItem | null;
  records: AttendanceRecord[];
  students: Student[];
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<SessionDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const allSessions = await getSessions();
    const allClasses = await getClasses();
    const classMap = new Map(allClasses.map((c) => [c.id, c]));

    const displays: SessionDisplay[] = await Promise.all(
      allSessions
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .map(async (session) => {
          const records = await getAttendanceRecords(session.id);
          const students = await getStudents(session.classId);
          return {
            session,
            classItem: classMap.get(session.classId) || null,
            records,
            students,
          };
        })
    );
    setSessions(displays);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleDelete = (item: SessionDisplay) => {
    Alert.alert("Delete Record", "Remove this attendance session?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteSession(item.session.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          loadData();
        },
      },
    ]);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const renderSession = ({ item }: { item: SessionDisplay }) => {
    const presentCount = item.records.filter((r) => r.status === "present").length;
    const absentCount = item.records.filter((r) => r.status === "absent").length;
    const total = item.records.length;
    const percentage = total > 0 ? Math.round((presentCount / total) * 100) : 0;
    const isExpanded = expandedId === item.session.id;

    const studentMap = new Map(item.students.map((s) => [s.id, s]));

    return (
      <Pressable
        style={styles.sessionCard}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setExpandedId(isExpanded ? null : item.session.id);
        }}
        onLongPress={() => handleDelete(item)}
      >
        <View style={styles.sessionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sessionClass}>
              {item.classItem?.courseName || "Unknown Class"}
            </Text>
            <Text style={styles.sessionCode}>
              {item.classItem?.subjectCode || "N/A"}
            </Text>
          </View>
          <View style={styles.sessionRight}>
            <View
              style={[
                styles.percentBadge,
                {
                  backgroundColor:
                    percentage >= 75
                      ? Colors.light.successLight
                      : percentage >= 50
                      ? Colors.light.warningLight
                      : Colors.light.dangerLight,
                },
              ]}
            >
              <Text
                style={[
                  styles.percentText,
                  {
                    color:
                      percentage >= 75
                        ? Colors.light.success
                        : percentage >= 50
                        ? Colors.light.warning
                        : Colors.light.danger,
                  },
                ]}
              >
                {percentage}%
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sessionMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={13} color={Colors.light.textSecondary} />
            <Text style={styles.metaText}>{formatDate(item.session.date)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="checkmark-circle-outline" size={13} color={Colors.light.present} />
            <Text style={styles.metaText}>{presentCount}P</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="close-circle-outline" size={13} color={Colors.light.absent} />
            <Text style={styles.metaText}>{absentCount}A</Text>
          </View>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={Colors.light.tabIconDefault}
          />
        </View>

        {isExpanded && (
          <View style={styles.expandedSection}>
            <View style={styles.divider} />
            {item.records.map((r) => {
              const student = studentMap.get(r.studentId);
              return (
                <View key={r.id} style={styles.recordRow}>
                  <Text style={styles.recordRoll}>
                    {student?.rollNumber || "?"}
                  </Text>
                  <Text style={styles.recordName} numberOfLines={1}>
                    {student?.name || "Unknown"}
                  </Text>
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor:
                          r.status === "present"
                            ? Colors.light.present
                            : Colors.light.absent,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.recordStatus,
                      {
                        color:
                          r.status === "present"
                            ? Colors.light.present
                            : Colors.light.absent,
                      },
                    ]}
                  >
                    {r.status === "present" ? "P" : "A"}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 + webTopInset }]}>
        <Text style={styles.headerTitle}>History</Text>
      </View>
      {loading ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Loading...</Text>
        </View>
      ) : sessions.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="time-outline" size={64} color={Colors.light.border} />
          <Text style={styles.emptyTitle}>No Records Yet</Text>
          <Text style={styles.emptyText}>
            Attendance records will appear here after you take attendance
          </Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.session.id}
          renderItem={renderSession}
          contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
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
  list: { padding: 16, gap: 12 },
  sessionCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: Colors.light.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 4,
  },
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  sessionClass: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  sessionCode: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  sessionRight: { alignItems: "flex-end" },
  percentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  percentText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  sessionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 12,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  expandedSection: { marginTop: 8 },
  divider: {
    height: 1,
    backgroundColor: Colors.light.borderLight,
    marginVertical: 10,
  },
  recordRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    gap: 8,
  },
  recordRoll: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.tint,
    width: 50,
  },
  recordName: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  recordStatus: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    width: 16,
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
