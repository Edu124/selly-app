import React, { useEffect, useState } from "react";
import { Platform }         from "react-native";
import { StatusBar }        from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications   from "expo-notifications";
import * as Device          from "expo-device";
import * as Updates         from "expo-updates";

import { AuthProvider }     from "./src/context/AuthContext";
import AppNavigator         from "./src/navigation/AppNavigator";
import { registerPushToken } from "./src/lib/api";
import { checkOTAUpdate, checkForceUpdate } from "./src/lib/updateService";
import UpdateModal          from "./src/components/UpdateModal";

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
  // Layer 2 — null = no update required, object = show blocking modal
  const [forceUpdateInfo, setForceUpdateInfo] = useState(null);

  useEffect(() => {
    // Push notifications (non-blocking, fire-and-forget)
    registerForPushNotifications();

    // Layer 1: OTA JS bundle update — download silently, then reload
    checkOTAUpdate().then(({ updated }) => {
      if (updated) {
        // Reloads the JS engine with the new bundle.
        // This terminates the current JS context — nothing below runs.
        Updates.reloadAsync().catch(err =>
          console.warn("[OTA] reloadAsync failed:", err.message)
        );
      }
    });

    // Layer 2: Force-update gate — blocks app if APK is too old
    checkForceUpdate().then(result => {
      if (result.required) setForceUpdateInfo(result);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor="#0a0a0f" />
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>

      {/* Force-update modal renders on top of the entire navigator */}
      <UpdateModal
        visible={!!forceUpdateInfo}
        apkUrl={forceUpdateInfo?.apkUrl}
        releaseNotes={forceUpdateInfo?.releaseNotes}
        latestVersion={forceUpdateInfo?.latestVersion}
      />
    </SafeAreaProvider>
  );
}
