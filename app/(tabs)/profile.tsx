import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  Alert,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { getFaculty, saveFaculty, Faculty } from "@/lib/storage";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [faculty, setFaculty] = useState<Faculty | null>(null);
  const [name, setName] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [editing, setEditing] = useState(false);

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

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Required", "Please enter your name.");
      return;
    }
    const saved = await saveFaculty({
      name: name.trim(),
      whatsappNumber: whatsappNumber.trim(),
    });
    setFaculty(saved);
    setEditing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 + webTopInset }]}>
        <Text style={styles.headerTitle}>Profile</Text>
        {faculty && !editing && (
          <Pressable
            onPress={() => {
              setEditing(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Ionicons name="create-outline" size={22} color={Colors.light.tint} />
          </Pressable>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        {!faculty && !editing ? (
          <View style={styles.center}>
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={48} color={Colors.light.tint} />
            </View>
            <Text style={styles.emptyTitle}>Set Up Your Profile</Text>
            <Text style={styles.emptyText}>
              Add your name and WhatsApp number to personalize attendance messages
            </Text>
            <Pressable
              style={({ pressed }) => [styles.setupBtn, pressed && { opacity: 0.85 }]}
              onPress={() => setEditing(true)}
            >
              <Text style={styles.setupBtnText}>Set Up Profile</Text>
            </Pressable>
          </View>
        ) : editing ? (
          <View style={styles.form}>
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={48} color={Colors.light.tint} />
            </View>
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Dr. John Smith"
              value={name}
              onChangeText={setName}
              placeholderTextColor={Colors.light.tabIconDefault}
              autoFocus
            />
            <Text style={styles.inputLabel}>WhatsApp Number (with country code)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 919876543210"
              value={whatsappNumber}
              onChangeText={setWhatsappNumber}
              placeholderTextColor={Colors.light.tabIconDefault}
              keyboardType="phone-pad"
            />
            <Text style={styles.helpText}>
              This number will be used as default recipient for attendance reports via WhatsApp.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
              onPress={handleSave}
            >
              <Text style={styles.saveBtnText}>Save Profile</Text>
            </Pressable>
            {faculty && (
              <Pressable
                onPress={() => {
                  setEditing(false);
                  setName(faculty.name);
                  setWhatsappNumber(faculty.whatsappNumber);
                }}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.profileView}>
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={48} color={Colors.light.tint} />
            </View>
            <Text style={styles.profileName}>{faculty!.name}</Text>
            {faculty!.whatsappNumber ? (
              <View style={styles.infoRow}>
                <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                <Text style={styles.infoText}>+{faculty!.whatsappNumber}</Text>
              </View>
            ) : (
              <View style={styles.infoRow}>
                <Ionicons name="logo-whatsapp" size={18} color={Colors.light.tabIconDefault} />
                <Text style={[styles.infoText, { color: Colors.light.tabIconDefault }]}>
                  Not set
                </Text>
              </View>
            )}

            <View style={styles.infoCard}>
              <Ionicons name="information-circle-outline" size={20} color={Colors.light.tint} />
              <Text style={styles.infoCardText}>
                Your profile is used to personalize attendance messages sent via WhatsApp. All data is stored locally on your device.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
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
  scrollContent: { padding: 20 },
  center: { alignItems: "center", paddingTop: 60 },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.light.accentLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    alignSelf: "center",
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  setupBtn: {
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  setupBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  form: { paddingTop: 20 },
  inputLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
    backgroundColor: Colors.light.surface,
  },
  helpText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.tabIconDefault,
    marginTop: 6,
    marginBottom: 20,
  },
  saveBtn: {
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 4,
  },
  cancelBtnText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },
  profileView: { alignItems: "center", paddingTop: 30 },
  profileName: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 30,
  },
  infoText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
  },
  infoCard: {
    flexDirection: "row",
    backgroundColor: Colors.light.accentLight,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    alignItems: "flex-start",
  },
  infoCardText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.tint,
    lineHeight: 20,
  },
});
