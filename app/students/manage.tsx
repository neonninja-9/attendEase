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
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import readXlsxFile from "read-excel-file/universal";
import Colors from "@/constants/colors";
import {
    getStudents,
    getEnrolledStudents,
    getUnenrolledStudents,
    addStudent,
    addStudentsBulk,
    updateStudent,
    deleteStudent,
    deleteAllStudents,
    enrollStudent,
    enrollStudentsBulk,
    unenrollStudent,
    checkDuplicateRollNumber,
    getClasses,
    getEnrollmentCountForStudent,
    Student,
    ClassItem,
} from "@/lib/storage";

export default function ManageStudentsScreen() {
    const insets = useSafeAreaInsets();
    const { classId } = useLocalSearchParams<{ classId?: string }>();
    const isClassScoped = !!classId;

    const [classItem, setClassItem] = useState<ClassItem | null>(null);
    const [students, setStudents] = useState<Student[]>([]);
    const [enrollmentCounts, setEnrollmentCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [enrollModalVisible, setEnrollModalVisible] = useState(false);
    const [editingStudent, setEditingStudent] = useState<Student | null>(null);
    const [studentName, setStudentName] = useState("");
    const [rollNumber, setRollNumber] = useState("");
    const [importing, setImporting] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // For the "Enroll Existing" modal
    const [unenrolledStudents, setUnenrolledStudents] = useState<Student[]>([]);
    const [selectedForEnroll, setSelectedForEnroll] = useState<Set<string>>(new Set());
    const [enrollSearch, setEnrollSearch] = useState("");

    const loadData = useCallback(async () => {
        setLoading(true);

        if (isClassScoped) {
            // Load class info
            const classes = await getClasses();
            const cls = classes.find((c) => c.id === classId);
            setClassItem(cls || null);

            // Load enrolled students
            const enrolled = await getEnrolledStudents(classId!);
            setStudents(enrolled);
        } else {
            // Global pool mode
            const allStudents = await getStudents();
            allStudents.sort((a, b) => {
                if (!a.rollNumber && !b.rollNumber) return a.name.localeCompare(b.name);
                if (!a.rollNumber) return 1;
                if (!b.rollNumber) return -1;
                return a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true });
            });
            setStudents(allStudents);

            // Load enrollment counts for each student
            const counts: Record<string, number> = {};
            for (const s of allStudents) {
                counts[s.id] = await getEnrollmentCountForStudent(s.id);
            }
            setEnrollmentCounts(counts);
        }

        setLoading(false);
    }, [classId, isClassScoped]);

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
        // Check for duplicate roll number (names are allowed to repeat)
        if (rollNumber.trim()) {
            const isDuplicate = await checkDuplicateRollNumber(
                rollNumber.trim(),
                editingStudent?.id
            );
            if (isDuplicate) {
                Alert.alert(
                    "Duplicate Roll Number",
                    `A student with enrollment number "${rollNumber.trim()}" already exists.`
                );
                return;
            }
        }
        if (editingStudent) {
            await updateStudent(editingStudent.id, {
                name: studentName.trim(),
                rollNumber: rollNumber.trim(),
            });
        } else {
            const newStudent = await addStudent({
                name: studentName.trim(),
                rollNumber: rollNumber.trim(),
            });
            // If class-scoped, also enroll
            if (isClassScoped) {
                await enrollStudent(classId!, newStudent.id);
            }
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        resetModal();
        loadData();
    };

    const handleRemoveFromClass = (student: Student) => {
        Alert.alert(
            "Remove from Class",
            `Remove "${student.name}" from this class? The student will remain in your student pool.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove",
                    style: "destructive",
                    onPress: async () => {
                        await unenrollStudent(classId!, student.id);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                        loadData();
                    },
                },
            ]
        );
    };

    const handleDeleteStudent = (student: Student) => {
        Alert.alert(
            "Delete Student",
            `Permanently delete "${student.name}"? This will remove them from all classes and delete all their attendance records.`,
            [
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
            ]
        );
    };

    const handleDeleteAll = () => {
        Alert.alert(
            "Delete All Students",
            "Are you sure you want to delete ALL students? This action cannot be undone and will remove all attendance records.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete All",
                    style: "destructive",
                    onPress: async () => {
                        await deleteAllStudents();
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                        loadData();
                    },
                },
            ]
        );
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

    // ─── Enroll Existing Students Modal ──────────────────────────────────────

    const openEnrollModal = async () => {
        const unenrolled = await getUnenrolledStudents(classId!);
        setUnenrolledStudents(unenrolled);
        setSelectedForEnroll(new Set());
        setEnrollSearch("");
        setEnrollModalVisible(true);
    };

    const toggleEnrollSelection = (studentId: string) => {
        setSelectedForEnroll((prev) => {
            const next = new Set(prev);
            if (next.has(studentId)) {
                next.delete(studentId);
            } else {
                next.add(studentId);
            }
            return next;
        });
    };

    const handleEnrollSelected = async () => {
        if (selectedForEnroll.size === 0) return;
        await enrollStudentsBulk(classId!, Array.from(selectedForEnroll));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setEnrollModalVisible(false);
        loadData();
    };

    // ─── Excel Import ────────────────────────────────────────────────────────

    const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
        const binaryString = globalThis.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
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

            let arrayBuffer: ArrayBuffer;

            if (Platform.OS === "web") {
                const response = await globalThis.fetch(uri);
                arrayBuffer = await response.arrayBuffer();
            } else {
                const fileContent = await FileSystem.readAsStringAsync(uri, {
                    encoding: "base64",
                });
                arrayBuffer = base64ToArrayBuffer(fileContent);
            }

            const rows = await readXlsxFile(arrayBuffer);
            const parsedStudents = parseRows(rows);

            if (parsedStudents.length === 0) {
                Alert.alert(
                    "No Students Found",
                    "Could not find student data in the file. Make sure your file has columns like 'Name' and 'Roll Number'."
                );
                setImporting(false);
                return;
            }

            const bulkItems = parsedStudents.map((s) => ({
                name: s.name,
                rollNumber: s.rollNumber,
            }));

            const importResult = await addStudentsBulk(bulkItems, isClassScoped ? classId : undefined);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            let msg = `Added ${importResult.added} new students.`;
            if (importResult.skipped > 0) {
                msg += `\n${importResult.skipped} existing student${importResult.skipped > 1 ? "s" : ""} found.`;
            }
            if (isClassScoped && importResult.enrolled > 0) {
                msg += `\n${importResult.enrolled} student${importResult.enrolled > 1 ? "s" : ""} enrolled in this class.`;
            }
            Alert.alert("Import Complete", msg);
            loadData();
        } catch (err: any) {
            Alert.alert("Import Error", err?.message || "Failed to import file.");
        } finally {
            setImporting(false);
        }
    };

    const parseRows = (rows: (string | number | boolean | Date | null)[][]): { name: string; rollNumber: string }[] => {
        if (!rows || rows.length < 2) return [];

        const headers = rows[0].map((h) => String(h || "").toLowerCase().trim());

        const nameKeys = ["name", "student name", "student_name", "studentname", "full name", "fullname", "full_name"];
        const rollKeys = [
            "roll number", "roll no", "rollno", "roll_number", "rollnumber",
            "enrollment no", "enrollment number", "enrollment_no", "enrollmentno",
            "enroll no", "enroll_no", "reg no", "reg number", "registration number",
            "id", "student id", "studentid", "s.no", "sno", "sr no", "sr. no",
        ];

        let nameIdx = -1;
        let rollIdx = -1;

        for (let i = 0; i < headers.length; i++) {
            if (nameIdx === -1 && nameKeys.includes(headers[i])) nameIdx = i;
            if (rollIdx === -1 && rollKeys.includes(headers[i])) rollIdx = i;
        }

        if (nameIdx === -1) {
            for (let i = 0; i < headers.length; i++) {
                if (headers[i].includes("name") && !headers[i].includes("course") && !headers[i].includes("subject")) {
                    nameIdx = i;
                    break;
                }
            }
        }

        if (rollIdx === -1) {
            for (let i = 0; i < headers.length; i++) {
                if (headers[i].includes("roll") || headers[i].includes("enroll") || headers[i].includes("reg")) {
                    rollIdx = i;
                    break;
                }
            }
        }

        if (nameIdx === -1) return [];

        const parsedStudents: { name: string; rollNumber: string }[] = [];
        for (let r = 1; r < rows.length; r++) {
            const row = rows[r];
            const name = String(row[nameIdx] || "").trim();
            const roll = rollIdx >= 0 ? String(row[rollIdx] || "").trim() : "";
            if (name) {
                parsedStudents.push({ name, rollNumber: roll });
            }
        }

        return parsedStudents;
    };

    // ─── Filtering ───────────────────────────────────────────────────────────

    const filteredStudents = students.filter((s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.rollNumber.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredUnenrolled = unenrolledStudents.filter((s) =>
        s.name.toLowerCase().includes(enrollSearch.toLowerCase()) ||
        s.rollNumber.toLowerCase().includes(enrollSearch.toLowerCase())
    );

    // ─── Render ──────────────────────────────────────────────────────────────

    const renderStudent = ({ item, index }: { item: Student; index: number }) => (
        <View style={styles.studentRowContainer}>
            <Pressable
                style={({ pressed }) => [styles.studentRowFn, pressed && styles.pressed]}
                onPress={() => openEdit(item)}
            >
                <View style={styles.indexCircle}>
                    <Text style={styles.indexText}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.studentName} numberOfLines={1}>{item.name}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        {item.rollNumber ? (
                            <Text style={styles.studentRoll}>{item.rollNumber}</Text>
                        ) : (
                            <Text style={[styles.studentRoll, { fontStyle: "italic" as const, color: Colors.light.tabIconDefault }]}>
                                No enrollment no.
                            </Text>
                        )}
                        {!isClassScoped && enrollmentCounts[item.id] !== undefined && (
                            <View style={styles.enrollBadge}>
                                <Text style={styles.enrollBadgeText}>
                                    {enrollmentCounts[item.id]} class{enrollmentCounts[item.id] !== 1 ? "es" : ""}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </Pressable>

            <Pressable
                style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.7 }]}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    if (isClassScoped) {
                        Alert.alert(item.name, "Choose an action", [
                            { text: "Remove from Class", onPress: () => handleRemoveFromClass(item) },
                            { text: "Delete Permanently", style: "destructive", onPress: () => handleDeleteStudent(item) },
                            { text: "Cancel", style: "cancel" },
                        ]);
                    } else {
                        handleDeleteStudent(item);
                    }
                }}
            >
                <Ionicons
                    name={isClassScoped ? "close-circle-outline" : "trash-outline"}
                    size={20}
                    color={Colors.light.danger}
                />
            </Pressable>
        </View>
    );

    const webTopInset = Platform.OS === "web" ? 67 : 0;
    const headerTitle = isClassScoped
        ? `Students — ${classItem?.courseName || "Class"}`
        : "All Students";

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top + 8 + webTopInset }]}>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
                </Pressable>
                <Text style={styles.headerTitle} numberOfLines={1}>{headerTitle}</Text>
                {students.length > 0 && !isClassScoped && (
                    <Pressable
                        onPress={handleDeleteAll}
                        style={({ pressed }) => [styles.headerIconBtn, pressed && { opacity: 0.7 }]}
                    >
                        <Ionicons name="trash-bin-outline" size={22} color={Colors.light.danger} />
                    </Pressable>
                )}
                {(students.length === 0 || isClassScoped) && <View style={styles.backBtn} />}
            </View>

            <View style={styles.actionRow}>
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={18} color={Colors.light.tabIconDefault} style={{ marginRight: 8 }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search students..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor={Colors.light.tabIconDefault}
                    />
                </View>
            </View>

            <View style={styles.buttonsRow}>
                <Pressable
                    style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.9 }]}
                    onPress={() => setModalVisible(true)}
                >
                    <Ionicons name="person-add" size={18} color="#fff" />
                    <Text style={styles.addBtnText}>
                        {isClassScoped ? "New Student" : "Add Student"}
                    </Text>
                </Pressable>

                {isClassScoped && (
                    <Pressable
                        style={({ pressed }) => [styles.enrollExistingBtn, pressed && { opacity: 0.9 }]}
                        onPress={openEnrollModal}
                    >
                        <Ionicons name="people" size={18} color={Colors.light.tint} />
                        <Text style={styles.enrollExistingText}>Add Existing</Text>
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
                        {importing ? "Importing..." : "Import"}
                    </Text>
                </Pressable>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <Text style={styles.emptyText}>Loading...</Text>
                </View>
            ) : filteredStudents.length === 0 ? (
                <View style={styles.center}>
                    <Ionicons name="people-outline" size={64} color={Colors.light.border} />
                    <Text style={styles.emptyTitle}>
                        {searchQuery ? "No Matches" : isClassScoped ? "No Students Enrolled" : "No Students"}
                    </Text>
                    <Text style={styles.emptyText}>
                        {searchQuery
                            ? "Try a different search term"
                            : isClassScoped
                                ? 'Add new students or tap "Add Existing" to enroll students from your pool'
                                : "Add students manually or import from an Excel file"
                        }
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={filteredStudents}
                    keyExtractor={(item) => item.id}
                    renderItem={renderStudent}
                    contentContainerStyle={[styles.list, { paddingBottom: 40 }]}
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={
                        <Text style={styles.listHeader}>
                            {filteredStudents.length} student{filteredStudents.length !== 1 ? "s" : ""}
                            {isClassScoped ? " enrolled" : ""}
                        </Text>
                    }
                />
            )}

            {/* Add / Edit Student Modal */}
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
                        {isClassScoped && !editingStudent && (
                            <View style={styles.enrollHint}>
                                <Ionicons name="information-circle-outline" size={16} color={Colors.light.tint} />
                                <Text style={styles.enrollHintText}>
                                    Student will be added to the pool and enrolled in {classItem?.courseName || "this class"}
                                </Text>
                            </View>
                        )}
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
                                {editingStudent ? "Update" : isClassScoped ? "Add & Enroll" : "Add Student"}
                            </Text>
                        </Pressable>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Enroll Existing Students Modal (class-scoped only) */}
            <Modal
                visible={enrollModalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setEnrollModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxHeight: "80%" }]}>
                        <View style={styles.modalHandle} />
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalTitle}>Enroll Existing Students</Text>
                            <Pressable onPress={() => setEnrollModalVisible(false)}>
                                <Ionicons name="close" size={24} color={Colors.light.textSecondary} />
                            </Pressable>
                        </View>

                        <View style={[styles.searchContainer, { marginBottom: 12 }]}>
                            <Ionicons name="search" size={18} color={Colors.light.tabIconDefault} style={{ marginRight: 8 }} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search students..."
                                value={enrollSearch}
                                onChangeText={setEnrollSearch}
                                placeholderTextColor={Colors.light.tabIconDefault}
                            />
                        </View>

                        {filteredUnenrolled.length === 0 ? (
                            <View style={[styles.center, { paddingVertical: 40 }]}>
                                <Text style={styles.emptyText}>
                                    {enrollSearch
                                        ? "No matches found"
                                        : "All students are already enrolled in this class"
                                    }
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                data={filteredUnenrolled}
                                keyExtractor={(item) => item.id}
                                renderItem={({ item }) => {
                                    const isSelected = selectedForEnroll.has(item.id);
                                    return (
                                        <Pressable
                                            style={[
                                                styles.enrollRow,
                                                isSelected && styles.enrollRowSelected,
                                            ]}
                                            onPress={() => toggleEnrollSelection(item.id)}
                                        >
                                            <Ionicons
                                                name={isSelected ? "checkmark-circle" : "ellipse-outline" as any}
                                                size={24}
                                                color={isSelected ? Colors.light.tint : Colors.light.border}
                                            />
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.studentName}>{item.name}</Text>
                                                {item.rollNumber ? (
                                                    <Text style={styles.studentRoll}>{item.rollNumber}</Text>
                                                ) : null}
                                            </View>
                                        </Pressable>
                                    );
                                }}
                                showsVerticalScrollIndicator={false}
                                style={{ maxHeight: 400 }}
                            />
                        )}

                        {selectedForEnroll.size > 0 && (
                            <Pressable
                                style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }, { marginTop: 12 }]}
                                onPress={handleEnrollSelected}
                            >
                                <Text style={styles.saveBtnText}>
                                    Enroll {selectedForEnroll.size} Student{selectedForEnroll.size > 1 ? "s" : ""}
                                </Text>
                            </Pressable>
                        )}
                    </View>
                </View>
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
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: Colors.light.surface,
        borderBottomWidth: 1,
        borderBottomColor: Colors.light.borderLight,
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: "Inter_700Bold",
        color: Colors.light.text,
        flex: 1,
        textAlign: "center",
    },
    backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    headerIconBtn: {
        width: 40,
        height: 40,
        alignItems: "center",
        justifyContent: "center",
    },
    actionRow: {
        paddingHorizontal: 16,
        paddingTop: 12,
        marginBottom: 8,
    },
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: Colors.light.surface,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
        borderWidth: 1,
        borderColor: Colors.light.border,
    },
    searchInput: {
        flex: 1,
        fontFamily: "Inter_400Regular",
        fontSize: 15,
        color: Colors.light.text,
        height: "100%",
    },
    buttonsRow: {
        flexDirection: "row",
        paddingHorizontal: 16,
        marginBottom: 8,
        gap: 8,
    },
    addBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: Colors.light.tint,
        padding: 12,
        borderRadius: 12,
        gap: 6,
    },
    addBtnText: {
        color: "#fff",
        fontSize: 13,
        fontFamily: "Inter_600SemiBold",
    },
    enrollExistingBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1.5,
        borderColor: Colors.light.tint,
        padding: 12,
        borderRadius: 12,
        gap: 6,
    },
    enrollExistingText: {
        color: Colors.light.tint,
        fontSize: 13,
        fontFamily: "Inter_600SemiBold",
    },
    importBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1.5,
        borderColor: Colors.light.tint,
        padding: 12,
        borderRadius: 12,
        gap: 6,
    },
    importBtnText: {
        color: Colors.light.tint,
        fontSize: 13,
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
    studentRowContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 8,
    },
    studentRowFn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: Colors.light.surface,
        padding: 14,
        borderRadius: 12,
        gap: 12,
    },
    deleteBtn: {
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: Colors.light.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.light.border,
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
    enrollBadge: {
        backgroundColor: Colors.light.accentLight,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    enrollBadgeText: {
        fontSize: 10,
        fontFamily: "Inter_500Medium",
        color: Colors.light.tint,
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
    enrollHint: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: Colors.light.accentLight,
        padding: 10,
        borderRadius: 10,
        marginBottom: 16,
    },
    enrollHintText: {
        fontSize: 12,
        fontFamily: "Inter_400Regular",
        color: Colors.light.tint,
        flex: 1,
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
    enrollRow: {
        flexDirection: "row",
        alignItems: "center",
        padding: 12,
        borderRadius: 12,
        gap: 12,
        marginBottom: 4,
        backgroundColor: Colors.light.background,
    },
    enrollRowSelected: {
        backgroundColor: Colors.light.accentLight,
    },
});
