import { registerRootComponent } from 'expo';

// Define tasks (incl. notificaciones en background) antes de registrar el root.
import "./src/notifications/backgroundSoundTask";
import "./src/location/driverBackgroundLocationTask";

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

