/// Where the Re:meeet backend lives. Override per build:
///   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000     (Android emulator)
///   flutter build ipa                                               (default: https://remeeet.com)
const String apiBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'https://remeeet.com');

/// The public website (legal pages, share links). Defaults to the API host.
const String webBaseUrl = String.fromEnvironment('WEB_BASE_URL', defaultValue: apiBaseUrl);

const String appVersion = '1.0.0';
