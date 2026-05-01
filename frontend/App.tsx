import { StatusBar } from "expo-status-bar";
import { enableScreens } from "react-native-screens";
import MapboxGL from "@rnmapbox/maps";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/auth/AuthContext";
import { AppNavigator } from "./src/navigation/AppNavigator";

enableScreens();

const mapboxToken =
  process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ||
  process.env.MAPBOX_ACCESS_TOKEN;

if (mapboxToken && String(mapboxToken).trim()) {
  MapboxGL.setAccessToken(String(mapboxToken).trim());
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
