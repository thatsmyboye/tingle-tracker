import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import { useAuthContext } from "@/context/AuthContext";

export default function AppLayout() {
  const { isLoading } = useAuthContext();

  if (isLoading) {
    return (
      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0A0A0F" }}
      >
        <ActivityIndicator color="#7FFFD4" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#0A0A0F" },
        headerTintColor: "#E8E8F0",
        contentStyle: { backgroundColor: "#0A0A0F" },
      }}
    />
  );
}
