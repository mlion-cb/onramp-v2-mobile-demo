import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

export default function RootLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#0052FF",
        tabBarInactiveTintColor: "#8A919E",
        headerStyle: {
          backgroundColor: "#FFFFFF",
        },
        headerTitleStyle: {
          fontWeight: "600",
        },
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#E6E8EA",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Onramp",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="card" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}