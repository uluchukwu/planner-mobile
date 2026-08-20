import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

// PWA installability (Chrome/Android) needs a registered service worker, not just
// a manifest.json -- this is what makes "Add to Home Screen" available. Native
// builds have no `navigator.serviceWorker` at all, and Expo Go's web preview
// doesn't need one either, so this only ever runs for the deployed web export.
if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Best-effort: a failed registration shouldn't break the app, just the
      // offline-shell and install-prompt affordances.
    });
  });
}
