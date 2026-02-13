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
    KeyboardAvoidingView,
    Platform,
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
    ClassItem,
} from "@/lib/storage";

export default function ManageClassesScreen() {
    const insets = useSafeAreaInsets();
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [courseName, setCourseName] = useState("");
    const [subjectCode, setSubjectCode] = useState("");

    const loadData = useCallback(async () => {
        const data = await getClasses();
        data.sort((a, b) => a.courseName.localeCompare(b.courseName));
        setClasses(data);
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const handleSave = async () => {
        if (!courseName.trim() || !subjectCode.trim()) {
            Alert.alert("Required", "Please enter both course name and subject code.");
            return;
        }

        await addClass({
            courseName: courseName.trim(),
            subjectCode: subjectCode.trim(),
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setModalVisible(false);
        setCourseName("");
        setSubjectCode("");
        loadData();
    };

    const handleDelete = (item: ClassItem) => {
        Alert.alert(
            "Delete Class",
            `Remove "${item.courseName}"? This will also remove the class from your home screen.`,
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

    const renderItem = ({ item, index }: { item: ClassItem; index: number }) => (
        <View style={styles.row}>
            <View style={styles.rowContent}>
                <View style={styles.codeBadge}>
                    <Text style={styles.codeText}>{item.subjectCode}</Text>
                </View>
                <Text style={styles.courseName}>{item.courseName}</Text>
            </View>
            <Pressable
                onPress={() => handleDelete(item)}
                style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.7 }]}
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
                <Text style={styles.headerTitle}>Manage Classes</Text>
                <View style={styles.backBtn} />
            </View>

            <FlatList
                data={classes}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <View style={styles.center}>
                        <Text style={styles.emptyText}>No classes found. Add one below!</Text>
                    </View>
                }
            />

            <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
                <Pressable
                    style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.9 }]}
                    onPress={() => setModalVisible(true)}
                >
                    <Ionicons name="add" size={24} color="#fff" />
                    <Text style={styles.addBtnText}>Add New Class</Text>
                </Pressable>
            </View>

            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHandle} />
                        <Text style={styles.modalTitle}>Add New Class</Text>

                        <Text style={styles.inputLabel}>Subject Code</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. CSE101"
                            value={subjectCode}
                            onChangeText={setSubjectCode}
                            autoCapitalize="characters"
                            placeholderTextColor={Colors.light.tabIconDefault}
                        />

                        <Text style={styles.inputLabel}>Course Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Introduction to Programming"
                            value={courseName}
                            onChangeText={setCourseName}
                            placeholderTextColor={Colors.light.tabIconDefault}
                        />

                        <View style={styles.modalButtons}>
                            <Pressable
                                style={[styles.modalBtn, styles.cancelBtn]}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.modalBtn, styles.saveBtn]}
                                onPress={handleSave}
                            >
                                <Text style={styles.saveBtnText}>Save Class</Text>
                            </Pressable>
                        </View>
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
    list: { padding: 16, paddingBottom: 100 },
    row: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: Colors.light.surface,
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: Colors.light.border,
    },
    rowContent: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
    codeBadge: {
        backgroundColor: Colors.light.accentLight,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    codeText: {
        fontSize: 12,
        fontFamily: "Inter_600SemiBold",
        color: Colors.light.tint,
    },
    courseName: {
        fontSize: 15,
        fontFamily: "Inter_500Medium",
        color: Colors.light.text,
        flex: 1,
    },
    deleteBtn: {
        padding: 8,
    },
    center: { alignItems: "center", marginTop: 40 },
    emptyText: {
        fontFamily: "Inter_400Regular",
        color: Colors.light.textSecondary,
    },
    footer: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: 16,
        backgroundColor: Colors.light.surface,
        borderTopWidth: 1,
        borderTopColor: Colors.light.borderLight,
    },
    addBtn: {
        backgroundColor: Colors.light.tint,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        borderRadius: 12,
        gap: 8,
    },
    addBtnText: {
        color: "#fff",
        fontSize: 16,
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
        padding: 24,
        paddingBottom: 40,
    },
    modalHandle: {
        width: 40,
        height: 4,
        backgroundColor: Colors.light.border,
        borderRadius: 2,
        alignSelf: "center",
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontFamily: "Inter_600SemiBold",
        color: Colors.light.text,
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 13,
        fontFamily: "Inter_500Medium",
        color: Colors.light.textSecondary,
        marginBottom: 8,
    },
    input: {
        backgroundColor: Colors.light.background,
        borderWidth: 1,
        borderColor: Colors.light.border,
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        fontFamily: "Inter_400Regular",
        color: Colors.light.text,
        marginBottom: 16,
    },
    modalButtons: {
        flexDirection: "row",
        gap: 12,
        marginTop: 8,
    },
    modalBtn: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        alignItems: "center",
    },
    cancelBtn: {
        backgroundColor: Colors.light.background,
        borderWidth: 1,
        borderColor: Colors.light.border,
    },
    saveBtn: {
        backgroundColor: Colors.light.tint,
    },
    cancelBtnText: {
        color: Colors.light.text,
        fontFamily: "Inter_600SemiBold",
    },
    saveBtnText: {
        color: "#fff",
        fontFamily: "Inter_600SemiBold",
    },
});
