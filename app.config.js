// app.config.js - Permite usar variáveis de ambiente do EAS Build
export default {
  expo: {
    name: "Zedith",
    slug: "FitnessHUB",
    version: "1.0.0",
    icon: "./assets/images/Icon.png",
    orientation: "portrait",
    userInterfaceStyle: "automatic",
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.yourname.fitnesshub"
    },
    android: {
      package: "com.yourname.fitnesshub",
      softwareKeyboardLayoutMode: "pan",
      enableDangerousExperimentalWebImplementation: true,
      minSdkVersion: 26,
      navigationBar: {
        backgroundColor: "#00000000",
        barStyle: "light-content",
        visible: "leanBack"
      },
      permissions: [
        "android.permission.ACTIVITY_RECOGNITION",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.INTERNET",
        "android.permission.ACCESS_NETWORK_STATE",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.CAMERA",
        "android.permission.RECEIVE_BOOT_COMPLETED",
        "android.permission.BLUETOOTH",
        "android.permission.BLUETOOTH_ADMIN",
        "android.permission.BLUETOOTH_SCAN",
        "android.permission.BLUETOOTH_CONNECT",
        "android.permission.ACCESS_FINE_LOCATION"
      ],
      usesCleartextTraffic: true
    },
    plugins: [
      "expo-router",
      "expo-dev-client",
      "expo-font",
      "expo-splash-screen",
      "expo-notifications",
      "expo-secure-store",
      [
        "expo-build-properties",
        {
          android: {
            bridgelessEnabled: false
          }
        }
      ],
      [
        "react-native-google-fit",
        {
          scopes: [
            "https://www.googleapis.com/auth/fitness.activity.read",
            "https://www.googleapis.com/auth/fitness.activity.write"
          ]
        }
      ],
      "expo-localization",
      "expo-web-browser",
      [
        "react-native-android-widget",
        {
          widgets: [
            {
              name: "StepsToday",
              label: "Passos de Hoje",
              description: "Mostra os passos acumulados hoje",
              minWidth: "250dp",
              minHeight: "120dp",
              targetCellWidth: 4,
              targetCellHeight: 2,
              previewImage: "./assets/images/Icon.png",
              updatePeriodMillis: 1800000
            },
            {
              name: "NextWorkout",
              label: "Proximo Treino",
              description: "Mostra o treino mais recente guardado",
              minWidth: "250dp",
              minHeight: "120dp",
              targetCellWidth: 4,
              targetCellHeight: 2,
              previewImage: "./assets/images/Icon.png",
              updatePeriodMillis: 1800000
            }
          ]
        }
      ]
    ],
    extra: {
      router: {},
      eas: {
        projectId: "62b24fab-8df9-4280-8d41-293d118fec81"
      },
      // Variáveis de ambiente injetadas pelo EAS Build
      // Durante o build, o EAS substitui essas variáveis pelos valores dos secrets
      gemini_api_key: process.env.GEMINI_API_KEY || "AQ.Ab8RN6JYDm4HqM-IjzCBYJOxQo7hfEvtbW_PFn2h86bpv5kcQA",
      supabaseUrl: process.env.SUPABASE_URL || "",
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ""
    }
  }
};
