import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Link } from "expo-router";
import { useAuthContext } from "@/context/AuthContext";

// =============================================================================
// Sign-up screen — email/password account creation
// =============================================================================

export default function SignUpScreen() {
  const { signUpWithEmail } = useAuthContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleSignUp() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Password too short", "Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const { error, needsConfirmation } = await signUpWithEmail(trimmedEmail, password);
    setLoading(false);

    if (error) {
      Alert.alert("Sign-up failed", error);
      return;
    }

    if (needsConfirmation) {
      setConfirming(true);
      return;
    }
    // On success with no confirmation, AuthContext navigates to (app)/
  }

  if (confirming) {
    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>✉️</Text>
        <Text style={styles.confirmTitle}>Check your email</Text>
        <Text style={styles.confirmSubtitle}>
          We sent a confirmation link to {email}. Click it to activate your account.
        </Text>
        <Link href="/(auth)/login" style={styles.link}>
          Back to sign in
        </Link>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.brand}>Tingle Tracker</Text>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Track your tingles, discover your triggers</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              placeholderTextColor="#3A3A56"
              placeholder="you@example.com"
              editable={!loading}
            />
          </View>

          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Password</Text>
              <Text style={styles.hint}>At least 8 characters</Text>
            </View>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="newPassword"
              autoComplete="new-password"
              placeholderTextColor="#3A3A56"
              placeholder="••••••••"
              editable={!loading}
              onSubmitEditing={handleSignUp}
              returnKeyType="go"
            />
          </View>

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignUp}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? "Creating account…" : "Create account"}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>
          Already have an account?{" "}
          <Link href="/(auth)/login" style={styles.link}>
            Sign in
          </Link>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: "#0A0A0F",
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A0A0F",
    paddingHorizontal: 24,
    gap: 12,
  },
  emoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  confirmTitle: {
    fontFamily: "monospace",
    fontSize: 14,
    color: "#7FFFD4",
    textAlign: "center",
  },
  confirmSubtitle: {
    fontFamily: "monospace",
    fontSize: 12,
    color: "#3A3A56",
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 300,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  brand: {
    fontFamily: "monospace",
    fontSize: 11,
    letterSpacing: 3,
    textTransform: "uppercase",
    color: "#7FFFD4",
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#E8E8F0",
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: "monospace",
    fontSize: 12,
    color: "#3A3A56",
    textAlign: "center",
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    borderColor: "#1E1E2E",
    borderRadius: 12,
    backgroundColor: "#0F0F1A",
    padding: 20,
    gap: 16,
  },
  field: {
    gap: 6,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  label: {
    fontFamily: "monospace",
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#3A3A56",
  },
  hint: {
    fontFamily: "monospace",
    fontSize: 10,
    color: "#3A3A56",
  },
  input: {
    borderWidth: 1,
    borderColor: "#1E1E2E",
    borderRadius: 8,
    backgroundColor: "#0A0A0F",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: "monospace",
    fontSize: 14,
    color: "#E8E8F0",
  },
  button: {
    borderWidth: 1,
    borderColor: "rgba(127, 255, 212, 0.4)",
    borderRadius: 8,
    backgroundColor: "rgba(127, 255, 212, 0.1)",
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontFamily: "monospace",
    fontSize: 14,
    color: "#7FFFD4",
  },
  footer: {
    fontFamily: "monospace",
    fontSize: 12,
    color: "#3A3A56",
    marginTop: 24,
  },
  link: {
    color: "#7FFFD4",
  },
});
