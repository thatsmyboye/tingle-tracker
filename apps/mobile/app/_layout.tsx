import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/context/AuthContext";

// Navigation guard runs inside AuthProvider (in AuthContext.tsx) via
// useSegments + useRouter, so no additional wrapper is needed here.

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#0A0A0F" },
          headerTintColor: "#E8E8F0",
          contentStyle: { backgroundColor: "#0A0A0F" },
        }}
      />
    </AuthProvider>
  );
}
