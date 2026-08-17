import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { login, ApiError } from "../api";
import { saveToken } from "../tokenStorage";

export function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email.trim(), password);
      await saveToken(result.token);
      onLoggedIn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Planner</Text>
      <Text style={styles.subtitle}>Sign in to see today&apos;s plan</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable style={styles.button} onPress={handleSubmit} disabled={submitting || !email || !password}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#faf7f1" },
  title: { fontSize: 28, fontWeight: "700", color: "#111111", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#555555", marginBottom: 24 },
  error: { color: "#b3261e", backgroundColor: "#fbe9e7", padding: 10, borderRadius: 8, marginBottom: 16, fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: "#e6e0d2",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
    backgroundColor: "#ffffff",
  },
  button: {
    backgroundColor: "#3f6b4f",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#ffffff", fontSize: 15, fontWeight: "600" },
});
