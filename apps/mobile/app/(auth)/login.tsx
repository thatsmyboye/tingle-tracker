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
// Login screen — email/password sign-in
// Navigation to (app)/ happens automatically via AuthContext's navigation guard
// =============================================================================

export default function LoginScreen() {
  const { signInWithEmail } = useAuthContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }

    setLoading(true);
    const error = await signInWithEmail(trimmedEmail, password);
    setLoading(false);

    if (error) {
      Alert.alert("Sign-in failed", error);
    }
    // On success, AuthContext's navigation guard redirects to (app)/
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.brand}>Tingle Tracker</Text>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>
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
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
              autoComplete="password"
              placeholderTextColor="#3A3A56"
              placeholder="••••••••"
              editable={!loading}
              onSubmitEditing={handleSignIn}
              returnKeyType="go"
            />
          </View>

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignIn}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? "Signing in…" : "Sign in"}</Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>
          No account?{" "}
          <Link href="/(auth)/signup" style={styles.link}>
            Create one
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
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 48,
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
  label: {
    fontFamily: "monospace",
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
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
