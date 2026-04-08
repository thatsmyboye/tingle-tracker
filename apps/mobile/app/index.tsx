import { StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tingle Tracker</Text>
      <Text style={styles.subtitle}>ASMR companion — coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A0A0F",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#7FFFD4",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: "#3A3A56",
  },
});
