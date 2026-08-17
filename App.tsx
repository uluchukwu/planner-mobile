import { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { LoginScreen } from "./src/screens/LoginScreen";
import { TodayScreen } from "./src/screens/TodayScreen";
import { loadToken } from "./src/tokenStorage";

// No router yet — two screens gated by "do we have a stored token" is less machinery
// than wiring expo-router for a bare-bones slice. Revisit once a third screen needs
// real navigation (see PlannerMobile's README).
export default function App() {
  const [checkingToken, setCheckingToken] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    loadToken().then((token) => {
      setLoggedIn(Boolean(token));
      setCheckingToken(false);
    });
  }, []);

  if (checkingToken) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <>
      {loggedIn ? (
        <TodayScreen onLoggedOut={() => setLoggedIn(false)} />
      ) : (
        <LoginScreen onLoggedIn={() => setLoggedIn(true)} />
      )}
      <StatusBar style="auto" />
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#faf7f1" },
});
