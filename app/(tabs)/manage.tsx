import React, { useState, useCallback } from "react";
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    Pressable,
    Platform,
    Alert,
    TextInput,
    Modal,
    KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { getFaculty, saveFaculty, resetApp, Faculty } from "@/lib/storage";

export default function ManageScreen() {
    const insets = useSafeAreaInsets();
    const [faculty, setFaculty] = useState<Faculty | null>(null);
    const [profileModalVisible, setProfileModalVisible] = useState(false);
    const [name, setName] = useState("");
    const [whatsappNumber, setWhatsappNumber] = useState("");

    const loadData = useCallback(async () => {
        const f = await getFaculty();
        setFaculty(f);
        if (f) {
            setName(f.name);
            setWhatsappNumber(f.whatsappNumber);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const handleSaveProfile = async () => {
        if (!name.trim()) {
            Alert.alert("Required", "Please enter your name.");
            return;
        }
        const saved = await saveFaculty({
            name: name.trim(),
            whatsappNumber: whatsappNumber.trim(),
        });
        setFaculty(saved);
        setProfileModalVisible(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    const webTopInset = Platform.OS === "web" ? 67 : 0;

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top + 12 + webTopInset }]}>
                <Text style={styles.headerTitle}>Manage</Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Profile Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Profile</Text>
                    <View style={styles.card}>
                        <View style={styles.profileHeader}>
                            <View style={styles.avatar}>
                                <Ionicons name="person" size={24} color={Colors.light.tint} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.profileName}>
                                    {faculty?.name || "Set up your profile"}
                                </Text>
                                <Text style={styles.profileSub}>
                                    {faculty?.whatsappNumber
                                        ? `+${faculty.whatsappNumber}`
                                        : "Add phone number"}
                                </Text>
                            </View>
                            <Pressable
                                onPress={() => {
                                    setProfileModalVisible(true);
                                    if (faculty) {
                                        setName(faculty.name);
                                        setWhatsappNumber(faculty.whatsappNumber);
                                    }
                                }}
                                style={styles.editBtn}
                            >
                                <Text style={styles.editBtnText}>Edit</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>

                {/* Management Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Data Management</Text>
                    <View style={styles.card}>
                        <Pressable
                            style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
                            onPress={() => router.push("/students/manage")}
                        >
                            <View style={[styles.menuIcon, { backgroundColor: "#E0F2FE" }]}>
                                <Ionicons name="people" size={20} color="#0284C7" />
                            </View>
                            <View style={styles.menuContent}>
                                <Text style={styles.menuTitle}>Manage Students</Text>
                                <Text style={styles.menuSub}>Add, edit, or remove students</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={Colors.light.tabIconDefault} />
                        </Pressable>

                        <View style={styles.divider} />

                        <Pressable
                            style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
                            onPress={() => router.push("/classes/manage")}
                        >
                            <View style={[styles.menuIcon, { backgroundColor: "#F0FDF4" }]}>
                                <Ionicons name="book" size={20} color="#16A34A" />
                            </View>
                            <View style={styles.menuContent}>
                                <Text style={styles.menuTitle}>Manage Classes</Text>
                                <Text style={styles.menuSub}>Add or delete subjects</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={Colors.light.tabIconDefault} />
                        </Pressable>
                    </View>
                </View>

                {/* Danger Zone */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Danger Zone</Text>
                    <View style={styles.card}>
                        <Pressable
                            style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
                            onPress={() => {
                                Alert.alert(
                                    "Reset All Data",
                                    "This will permanently delete ALL classes, students, attendance records, and your profile. This cannot be undone.\n\nAre you sure?",
                                    [
                                        { text: "Cancel", style: "cancel" },
                                        {
                                            text: "Reset Everything",
                                            style: "destructive",
                                            onPress: async () => {
                                                await resetApp();
                                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                                                setFaculty(null);
                                                setName("");
                                                setWhatsappNumber("");
                                                Alert.alert("Done", "All data has been cleared. The app is now a clean slate.");
                                            },
                                        },
                                    ]
                                );
                            }}
                        >
                            <View style={[styles.menuIcon, { backgroundColor: "#FEE2E2" }]}>
                                <Ionicons name="warning" size={20} color="#DC2626" />
                            </View>
                            <View style={styles.menuContent}>
                                <Text style={[styles.menuTitle, { color: Colors.light.danger }]}>Reset All Data</Text>
                                <Text style={styles.menuSub}>Delete everything and start fresh</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={Colors.light.tabIconDefault} />
                        </Pressable>
                    </View>
                </View>

                <View style={styles.infoCard}>
                    <Ionicons name="information-circle-outline" size={20} color={Colors.light.textSecondary} />
                    <Text style={styles.infoText}>
                        AttendEase v1.0.0
                    </Text>
                </View>
            </ScrollView>

            {/* Profile Edit Modal */}
            <Modal
                visible={profileModalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setProfileModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHandle} />
                        <Text style={styles.modalTitle}>Edit Profile</Text>

                        <Text style={styles.inputLabel}>Full Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Dr. John Smith"
                            value={name}
                            onChangeText={setName}
                            autoFocus
                        />

                        <Text style={styles.inputLabel}>WhatsApp Number</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g., 919876543210"
                            value={whatsappNumber}
                            onChangeText={setWhatsappNumber}
                            keyboardType="phone-pad"
                        />
                        <Text style={styles.helpText}>
                            Used for sending attendance reports via WhatsApp.
                        </Text>

                        <View style={styles.modalButtons}>
                            <Pressable
                                style={[styles.modalBtn, styles.cancelBtn]}
                                onPress={() => setProfileModalVisible(false)}
                            >
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.modalBtn, styles.saveBtn]}
                                onPress={handleSaveProfile}
                            >
                                <Text style={styles.saveBtnText}>Save</Text>
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
        paddingHorizontal: 20,
        paddingBottom: 16,
        backgroundColor: Colors.light.surface,
        borderBottomWidth: 1,
        borderBottomColor: Colors.light.borderLight,
    },
    headerTitle: {
        fontSize: 28,
        fontFamily: "Inter_700Bold",
        color: Colors.light.text,
    },
    scrollContent: { padding: 20 },
    section: { marginBottom: 24 },
    sectionTitle: {
        fontSize: 13,
        fontFamily: "Inter_600SemiBold",
        color: Colors.light.textSecondary,
        marginBottom: 8,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    card: {
        backgroundColor: Colors.light.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.light.border,
        overflow: "hidden",
    },
    profileHeader: {
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        gap: 12,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.light.accentLight,
        alignItems: "center",
        justifyContent: "center",
    },
    profileName: {
        fontSize: 16,
        fontFamily: "Inter_600SemiBold",
        color: Colors.light.text,
    },
    profileSub: {
        fontSize: 13,
        fontFamily: "Inter_400Regular",
        color: Colors.light.textSecondary,
        marginTop: 2,
    },
    editBtn: {
        backgroundColor: Colors.light.background,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.light.border,
    },
    editBtnText: {
        fontSize: 13,
        fontFamily: "Inter_500Medium",
        color: Colors.light.text,
    },
    menuItem: {
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        gap: 12,
    },
    pressed: {
        backgroundColor: Colors.light.background,
    },
    menuIcon: {
        width: 36,
        height: 36,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    menuContent: { flex: 1 },
    menuTitle: {
        fontSize: 15,
        fontFamily: "Inter_500Medium",
        color: Colors.light.text,
    },
    menuSub: {
        fontSize: 12,
        fontFamily: "Inter_400Regular",
        color: Colors.light.textSecondary,
        marginTop: 1,
    },
    divider: {
        height: 1,
        backgroundColor: Colors.light.border,
        marginLeft: 64,
    },
    infoCard: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        marginTop: 20,
        opacity: 0.6,
    },
    infoText: {
        fontSize: 12,
        fontFamily: "Inter_400Regular",
        color: Colors.light.textSecondary,
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
        marginTop: 4,
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
        marginBottom: 8,
    },
    helpText: {
        fontSize: 12,
        fontFamily: "Inter_400Regular",
        color: Colors.light.tabIconDefault,
        marginBottom: 20,
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
