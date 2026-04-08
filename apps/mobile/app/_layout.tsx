import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#0A0A0F" },
          headerTintColor: "#E8E8F0",
          contentStyle: { backgroundColor: "#0A0A0F" },
        }}
      />
    </>
  );
}
