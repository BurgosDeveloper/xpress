import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../auth/AuthContext";
import { colors } from "../theme/colors";
import { LogoMark } from "../components/LogoMark";
import { SplashScreen } from "../screens/SplashScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { RegisterPassengerScreen } from "../screens/RegisterPassengerScreen";
import { PasswordResetRequestScreen } from "../screens/PasswordResetRequestScreen";
import { PasswordResetVerifyScreen } from "../screens/PasswordResetVerifyScreen";
import { PasswordResetConfirmScreen } from "../screens/PasswordResetConfirmScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { PassengerDriversMapScreen } from "../screens/PassengerDriversMapScreen";
import { PassengerOffersWaitScreen } from "../screens/PassengerOffersWaitScreen";
import { PassengerWaitingScreen } from "../screens/PassengerWaitingScreen";
import { PassengerMakeOfferScreen } from "../screens/PassengerMakeOfferScreen";
import { DriverOffersListScreen } from "../screens/DriverOffersListScreen";
import { DriverOfferDetailsScreen } from "../screens/DriverOfferDetailsScreen";
import { DriverMapScreen } from "../screens/DriverMapScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { AdminDriversScreen } from "../screens/AdminDriversScreen";
import { AdminDriverUpsertScreen } from "../screens/AdminDriverUpsertScreen";
import { AdminPassengersScreen } from "../screens/AdminPassengersScreen";
import { AdminPassengerUpsertScreen } from "../screens/AdminPassengerUpsertScreen";
import { AdminPasswordResetsScreen } from "../screens/AdminPasswordResetsScreen";
import { AdminRidesScreen } from "../screens/AdminRidesScreen";
import { AdminRideAssignMapScreen } from "../screens/AdminRideAssignMapScreen";
import { AdminSettingsScreen } from "../screens/AdminSettingsScreen";
import { AdminZonesScreen } from "../screens/AdminZonesScreen";
import { CreditsScreen } from "../screens/CreditsScreen";
import { RidesHistoryScreen } from "../screens/RidesHistoryScreen";
import { RideDetailsScreen } from "../screens/RideDetailsScreen";
import { RouteMapScreen } from "../screens/RouteMapScreen";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type RootStackParamList = {
  Login: undefined;
  RegisterPassenger: undefined;
  PasswordResetRequest: { presetUser?: string } | undefined;
  PasswordResetVerify: { resetRequestId: string; phoneLast3: string };
  PasswordResetConfirm: { resetToken: string };
  Home: undefined;
  AdminZones: undefined;
  AdminDrivers: undefined;
  AdminDriverUpsert: { driver?: any } | undefined;
  AdminPassengers: undefined;
  AdminPassengerUpsert: { passenger?: any } | undefined;
  AdminRides: undefined;
  AdminRideAssignMap: { ride: any };
  AdminPasswordResets: undefined;
  AdminSettings: undefined;
  Credits: undefined;
  PassengerDriversMap: undefined;
  PassengerOffersWait: { rideId: string };
  PassengerWaiting: { rideId: string; driverName: string };
  PassengerMakeOffer: undefined;
  DriverOffersList: undefined;
  DriverOfferDetails: { offerId: string };
  DriverMap: undefined;
  Profile: undefined;
  RidesHistory: undefined;
  RideDetails: { rideId: string };
  RouteMap: { pickup: { lat: number; lng: number }; dropoff: { lat: number; lng: number }; routePath?: { lat: number; lng: number }[] | null };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const auth = useAuth();

  if (!auth.bootstrapped) return <SplashScreen />;

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={({ navigation, route }) => ({
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          headerTitle: () => null,
          headerLeft: () => {
            const canGoBack = navigation.canGoBack();
            const hideLogo =
              route.name === "Login" ||
              route.name === "RegisterPassenger" ||
              route.name === "PasswordResetRequest" ||
              route.name === "PasswordResetVerify" ||
              route.name === "PasswordResetConfirm";

            if (hideLogo && !canGoBack) return null;

            return (
              <View style={styles.headerLeftRow}>
                {canGoBack ? (
                  <Pressable
                    onPress={() => navigation.goBack()}
                    hitSlop={10}
                    style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
                    accessibilityRole="button"
                    accessibilityLabel="Regresar"
                  >
                    <Ionicons name="chevron-back" size={22} color={colors.gold} />
                  </Pressable>
                ) : null}

                {!hideLogo ? <LogoMark size={54} /> : null}
              </View>
            );
          },
          headerRight: () => {
            const role = auth.user?.role;
            if (!auth.token) return null;
            if (role === "ADMIN") return null;

            return (
              <Pressable
                onPress={() => navigation.navigate("Profile")}
                style={({ pressed }) => ({
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Ionicons name="people-outline" size={20} color={colors.gold} />
              </Pressable>
            );
          },
        })}
      >
        {!auth.token ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ title: "" }} />
            <Stack.Screen name="RegisterPassenger" component={RegisterPassengerScreen} options={{ title: "" }} />
            <Stack.Screen name="PasswordResetRequest" component={PasswordResetRequestScreen} options={{ title: "" }} />
            <Stack.Screen name="PasswordResetVerify" component={PasswordResetVerifyScreen} options={{ title: "" }} />
            <Stack.Screen name="PasswordResetConfirm" component={PasswordResetConfirmScreen} options={{ title: "" }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: "" }} />

            <Stack.Screen name="Credits" component={CreditsScreen} options={{ title: "" }} />

            <Stack.Screen name="AdminDrivers" component={AdminDriversScreen} options={{ title: "" }} />
            <Stack.Screen name="AdminDriverUpsert" component={AdminDriverUpsertScreen} options={{ title: "" }} />
            <Stack.Screen name="AdminPassengers" component={AdminPassengersScreen} options={{ title: "" }} />
            <Stack.Screen name="AdminPassengerUpsert" component={AdminPassengerUpsertScreen} options={{ title: "" }} />
            <Stack.Screen name="AdminRides" component={AdminRidesScreen} options={{ title: "" }} />
            <Stack.Screen name="AdminRideAssignMap" component={AdminRideAssignMapScreen} options={{ title: "" }} />
            <Stack.Screen name="AdminPasswordResets" component={AdminPasswordResetsScreen} options={{ title: "" }} />
            <Stack.Screen name="AdminSettings" component={AdminSettingsScreen} options={{ title: "" }} />
            <Stack.Screen name="AdminZones" component={AdminZonesScreen} options={{ title: "" }} />

            <Stack.Screen name="PassengerDriversMap" component={PassengerDriversMapScreen} options={{ title: "" }} />
            <Stack.Screen name="PassengerOffersWait" component={PassengerOffersWaitScreen} options={{ title: "" }} />
            <Stack.Screen name="PassengerWaiting" component={PassengerWaitingScreen} options={{ title: "" }} />
            <Stack.Screen name="PassengerMakeOffer" component={PassengerMakeOfferScreen} options={{ title: "" }} />
            <Stack.Screen name="DriverOffersList" component={DriverOffersListScreen} options={{ title: "" }} />
            <Stack.Screen name="DriverOfferDetails" component={DriverOfferDetailsScreen} options={{ title: "" }} />
            <Stack.Screen name="DriverMap" component={DriverMapScreen} options={{ title: "" }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "", headerRight: () => null }} />
            <Stack.Screen name="RidesHistory" component={RidesHistoryScreen} options={{ title: "" }} />
            <Stack.Screen name="RideDetails" component={RideDetailsScreen} options={{ title: "" }} />
            <Stack.Screen name="RouteMap" component={RouteMapScreen} options={{ title: "" }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  headerLeftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  backBtnPressed: {
    opacity: 0.85,
  },
});

