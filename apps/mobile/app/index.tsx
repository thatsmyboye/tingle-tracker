import { Redirect } from "expo-router";

// Root index — redirect to the auth group as a default.
// AuthContext's navigation guard will immediately redirect to (app)/ if a
// valid session is already persisted in AsyncStorage.
export default function Index() {
  return <Redirect href="/(auth)/login" />;
}
