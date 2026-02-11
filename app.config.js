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
        "android.permission.FOREGROUND_SERVICE"
      ]
    },
    plugins: [
      "expo-router",
      "expo-dev-client",
      "expo-font",
      "expo-splash-screen",
      "expo-notifications",
      "expo-secure-store",
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
      "expo-web-browser"
    ],
    extra: {
      router: {},
      eas: {
        projectId: "62b24fab-8df9-4280-8d41-293d118fec81"
      },
      // Variáveis de ambiente injetadas pelo EAS Build
      // Durante o build, o EAS substitui essas variáveis pelos valores dos secrets
      cohereApiKey: process.env.COHERE_API_KEY || "DhmTjY26uuFSYHJHsFLxmM7KRpSX7srJasxahzeya",
      supabaseUrl: process.env.SUPABASE_URL || "",
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ""
    }
  }
};
