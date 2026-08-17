import { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { LoginScreen } from "./src/screens/LoginScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { TodayScreen } from "./src/screens/TodayScreen";
import { WeekScreen } from "./src/screens/WeekScreen";
import { GoalsScreen } from "./src/screens/GoalsScreen";
import { HabitsScreen } from "./src/screens/HabitsScreen";
import { ExpensesScreen } from "./src/screens/ExpensesScreen";
import { ReviewScreen } from "./src/screens/ReviewScreen";
import { loadToken } from "./src/tokenStorage";

// "review" is deliberately not in TABS — like the web app, it's reached via a link
// from the Week screen, not a top-level nav item.
type Tab = "dashboard" | "today" | "week" | "goals" | "habits" | "expenses" | "review";

const TABS: { key: Tab; label: string }[] = [
  { key: "dashboard", label: "Home" },
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "goals", label: "Goals" },
  { key: "habits", label: "Habits" },
  { key: "expenses", label: "Expenses" },
];

// No router — six tabs gated by simple state is less machinery than expo-router for
// an app this shape (no deep links, no nested stacks yet). See PlannerMobile/README.md
// for the trigger condition to revisit that (a screen that needs its own back-stack).
export default function App() {
  const [checkingToken, setCheckingToken] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("today");
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);

  useEffect(() => {
    loadToken().then((token) => {
      setLoggedIn(Boolean(token));
      setCheckingToken(false);
    });
  }, []);

  function handleLoggedOut() {
    setLoggedIn(false);
    setActiveTab("today");
    setSelectedDate(undefined);
  }

  function handleOpenDay(date: string) {
    setSelectedDate(date);
    setActiveTab("today");
  }

  function handleOpenReview(date: string) {
    setSelectedDate(date);
    setActiveTab("review");
  }

  if (checkingToken) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <StatusBar style="auto" />
      </View>
    );
  }

  if (!loggedIn) {
    return (
      <>
        <LoginScreen onLoggedIn={() => setLoggedIn(true)} />
        <StatusBar style="auto" />
      </>
    );
  }

  return (
    <View style={styles.app}>
      <View style={styles.screenArea}>
        {activeTab === "dashboard" && <DashboardScreen onLoggedOut={handleLoggedOut} />}
        {activeTab === "today" && <TodayScreen onLoggedOut={handleLoggedOut} initialDate={selectedDate} key={selectedDate} />}
        {activeTab === "week" && <WeekScreen onLoggedOut={handleLoggedOut} onOpenDay={handleOpenDay} onOpenReview={handleOpenReview} />}
        {activeTab === "goals" && <GoalsScreen onLoggedOut={handleLoggedOut} />}
        {activeTab === "habits" && <HabitsScreen onLoggedOut={handleLoggedOut} />}
        {activeTab === "expenses" && <ExpensesScreen onLoggedOut={handleLoggedOut} />}
        {activeTab === "review" && (
          <ReviewScreen onLoggedOut={handleLoggedOut} initialDate={selectedDate} onBack={() => setActiveTab("week")} />
        )}
      </View>
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            style={styles.tabButton}
            onPress={() => {
              if (tab.key === "today") setSelectedDate(undefined);
              setActiveTab(tab.key);
            }}
          >
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: "#faf7f1" },
  screenArea: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#faf7f1" },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e6e0d2",
    backgroundColor: "#ffffff",
    paddingBottom: 20,
    paddingTop: 8,
  },
  tabButton: { flex: 1, alignItems: "center", paddingVertical: 4 },
  tabLabel: { fontSize: 11, color: "#888888", fontWeight: "600" },
  tabLabelActive: { color: "#3f6b4f" },
});
