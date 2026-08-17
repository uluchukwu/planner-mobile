import { Text, StyleSheet } from "react-native";

export function CacheBanner({ savedAt }: { savedAt: number }) {
  const minutesAgo = Math.max(0, Math.round((Date.now() - savedAt) / 60000));
  const label = minutesAgo < 1 ? "just now" : minutesAgo === 1 ? "1 minute ago" : `${minutesAgo} minutes ago`;

  return <Text style={styles.banner}>Couldn&apos;t reach the server — showing saved data from {label}.</Text>;
}

const styles = StyleSheet.create({
  banner: {
    fontSize: 12,
    color: "#8a6d3b",
    backgroundColor: "#fdf3d8",
    borderWidth: 1,
    borderColor: "#f0dfa3",
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
  },
});
