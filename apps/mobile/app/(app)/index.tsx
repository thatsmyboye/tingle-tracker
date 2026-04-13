import { View, Text, Pressable, StyleSheet } from "react-native";
import { useAuthContext } from "@/context/AuthContext";

// =============================================================================
// Main app home screen (authenticated)
// Will host the TingleLogger in a future iteration.
// =============================================================================

export default function HomeScreen() {
  const { user, signOut } = useAuthContext();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tingle Tracker</Text>
      <Text style={styles.subtitle}>ASMR companion — coming soon</Text>

      {user?.email && (
        <Text style={styles.email}>{user.email}</Text>
      )}

      <Pressable style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A0A0F",
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#7FFFD4",
  },
  subtitle: {
    fontFamily: "monospace",
    fontSize: 13,
    color: "#3A3A56",
  },
  email: {
    fontFamily: "monospace",
    fontSize: 11,
    color: "#3A3A56",
    marginTop: 4,
  },
  signOutButton: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: "#1E1E2E",
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  signOutText: {
    fontFamily: "monospace",
    fontSize: 12,
    color: "#3A3A56",
  },
});
