// Sentry's wrapper around Expo's default config: it stamps each bundle with
// a debug ID so uploaded source maps match the exact build.
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

module.exports = getSentryExpoConfig(__dirname);
