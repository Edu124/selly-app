import React, { useEffect } from "react";
import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { AuthProvider } from "./src/context/AuthContext";
import AppNavigator    from "./src/navigation/AppNavigator";
import { registerPushToken } from "./src/lib/api";

// Show notification banners when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert : true,
    shouldPlaySound : true,
    shouldSetBadge  : true,
  }),
});

async function registerForPushNotifications() {
  if (!Device.isDevice) return; // skip in emulator / simulator
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("orders", {
      name            : "New Orders",
      importance      : Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor      : "#7c3aed",
    });
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return;
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: "085c3fc3-9b68-45ef-a873-c35236d8ff45",
  });
  await registerPushToken(tokenData.data);
}

export default function App() {
  useEffect(() => {
    registerForPushNotifications();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor="#0a0a0f" />
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
