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
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as XLSX from "xlsx";
import Colors from "@/constants/colors";
import {
    getStudents,
    addStudent,
    addStudentsBulk,
    updateStudent,
    deleteStudent,
    deleteAllStudents,
    checkDuplicateStudentName,
    Student,
} from "@/lib/storage";

export default function ManageStudentsScreen() {
    const insets = useSafeAreaInsets();
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingStudent, setEditingStudent] = useState<Student | null>(null);
    const [studentName, setStudentName] = useState("");
    const [rollNumber, setRollNumber] = useState("");
    const [importing, setImporting] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const loadData = useCallback(async () => {
        setLoading(true);
        const studs = await getStudents();
        studs.sort((a, b) => {
            if (!a.rollNumber && !b.rollNumber) return a.name.localeCompare(b.name);
            if (!a.rollNumber) return 1;
            if (!b.rollNumber) return -1;
            return a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true });
        });
        setStudents(studs);
        setLoading(false);
    }, []);

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
        const isDuplicate = await checkDuplicateStudentName(
            studentName.trim(),
            editingStudent?.id
        );
        if (isDuplicate) {
            Alert.alert(
                "Duplicate Name",
                `A student named "${studentName.trim()}" already exists.`
            );
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
            });
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        resetModal();
        loadData();
    };

    const handleDeleteStudent = (student: Student) => {
        Alert.alert(
            "Delete Student",
            `Remove "${student.name}"? This will delete all their attendance records across all classes.`,
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

            let parsedStudents: { name: string; rollNumber: string }[] = [];

            if (Platform.OS === "web") {
                const response = await globalThis.fetch(uri);
                const arrayBuffer = await response.arrayBuffer();
                const data = new Uint8Array(arrayBuffer);
                const workbook = XLSX.read(data, { type: "array" });
                parsedStudents = parseWorkbook(workbook);
            } else {
                const fileContent = await FileSystem.readAsStringAsync(uri, {
                    encoding: 'base64',
                });
                const workbook = XLSX.read(fileContent, { type: "base64" });
                parsedStudents = parseWorkbook(workbook);
            }

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

            const importResult = await addStudentsBulk(bulkItems);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            let msg = `Successfully imported ${importResult.added} students.`;
            if (importResult.skipped > 0) {
                msg += `\n${importResult.skipped} duplicate name${importResult.skipped > 1 ? "s" : ""} skipped.`;
            }
            Alert.alert("Import Complete", msg);
            loadData();
        } catch (err: any) {
            Alert.alert("Import Error", err?.message || "Failed to import file.");
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

    const filteredStudents = students.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.rollNumber.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                    {item.rollNumber ? (
                        <Text style={styles.studentRoll}>{item.rollNumber}</Text>
                    ) : (
                        <Text style={[styles.studentRoll, { fontStyle: "italic" as const, color: Colors.light.tabIconDefault }]}>
                            No enrollment no.
                        </Text>
                    )}
                </View>
            </Pressable>

            <Pressable
                style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.7 }]}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    handleDeleteStudent(item);
                }}
            >
                <Ionicons name="trash-outline" size={20} color={Colors.light.danger} />
            </Pressable>
        </View>
    );

    const webTopInset = Platform.OS === "web" ? 67 : 0;

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top + 8 + webTopInset }]}>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
                </Pressable>
                <Text style={styles.headerTitle}>Manage Students</Text>
                {students.length > 0 && (
                    <Pressable
                        onPress={handleDeleteAll}
                        style={({ pressed }) => [styles.headerIconBtn, pressed && { opacity: 0.7 }]}
                    >
                        <Ionicons name="trash-bin-outline" size={22} color={Colors.light.danger} />
                    </Pressable>
                )}
                {students.length === 0 && <View style={styles.backBtn} />}
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
                    <Text style={styles.addBtnText}>Add Student</Text>
                </Pressable>

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
            ) : filteredStudents.length === 0 ? (
                <View style={styles.center}>
                    <Ionicons name="people-outline" size={64} color={Colors.light.border} />
                    <Text style={styles.emptyTitle}>{searchQuery ? "No Matches" : "No Students"}</Text>
                    <Text style={styles.emptyText}>
                        {searchQuery ? "Try a different search term" : "Add students manually or import from an Excel file"}
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
                        <Text style={styles.listHeader}>{filteredStudents.length} student{filteredStudents.length !== 1 ? "s" : ""}</Text>
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
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: Colors.light.surface,
        borderBottomWidth: 1,
        borderBottomColor: Colors.light.borderLight,
    },
    headerTitle: {
        fontSize: 20,
        fontFamily: "Inter_700Bold",
        color: Colors.light.text,
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
        gap: 10,
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
        fontSize: 14,
        fontFamily: "Inter_600SemiBold",
    },
    importBtn: {
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
