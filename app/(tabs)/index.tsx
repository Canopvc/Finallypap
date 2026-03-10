import React, { useCallback, useState, useEffect, useRef } from "react";
import {
  Platform,
  StyleSheet,
  View,
  Text,
  Pressable,
  TouchableOpacity,
  Alert,
  Vibration,
  LogBox,
  PermissionsAndroid,
  Animated,
  Dimensions,
  AppState,
  AppStateStatus,
  AppRegistry,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import { useTheme } from "react-native-paper";
import { Pedometer } from "expo-sensors";
import { useTranslation } from "../../hooks/useTranslation";
import Svg, { Path } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import * as Haptics from "expo-haptics";
import AnimatedList from "../../components/animatedList";

LogBox.ignoreLogs(["expo-notifications"]);
LogBox.ignoreLogs([
  "VirtualizedLists should never be nested inside plain ScrollViews with tje same orientation",
]);

type Exercise = {
  id: string;
  name: string;
  type: "calisthenics" | "cardio" | "weightlifting";
  sets: number;
  reps?: number;
  weight?: number;
  minutes?: number;
  dropset: boolean;
  failure: boolean;
  warmup: boolean;
};

type Workout = {
  name: string;
  createdAt: string;
  exercises: Exercise[];
};

const STORAGE_KEY = "workouts";
const STEP_TARGET = 10000;
const SCREEN_HEIGHT = Dimensions.get("window").height;

const STEP_COUNT_KEY = "@step_count";
const LAST_RESET_KEY = "@last_reset_date";
const STEP_SESSION_KEY = "@step_session_base";
const STEP_SAVED_KEY = "@step_saved_at_start";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const workoutSlugFromFields = (name: string, createdAt: string) =>
  `${slugify(name)}-${new Date(createdAt).getTime()}`;

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation();

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [currentStepCount, setCurrentStepCount] = useState(0);
  const [isPedometerAvailable, setIsPedometerAvailable] = useState(false);
  const [progress, setProgress] = useState(0);

  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Lógica de delta para Android
  // O sensor reinicia a cada sessão, então guardamos a base e o ponto de partida
  const sessionBaseRef = useRef<number | null>(null);
  const savedAtStartRef = useRef<number>(0);
  const pedometerSubRef = useRef<{ remove: () => void } | null>(null);

  const notificationsSentRef = useRef({
    half: false,
    target: false,
    double: false,
  });

  // ─── Animação de entrada ───────────────────────────────────────────────────

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    setProgress(Math.min(1, currentStepCount / STEP_TARGET));
  }, [currentStepCount]);

  // ─── Helpers de AsyncStorage ───────────────────────────────────────────────

  const loadStoredSteps = async (): Promise<number> => {
    try {
      const s = await AsyncStorage.getItem(STEP_COUNT_KEY);
      return s ? parseInt(s, 10) : 0;
    } catch {
      return 0;
    }
  };

  const persistSteps = async (steps: number) => {
    try {
      await AsyncStorage.multiSet([
        [STEP_COUNT_KEY, steps.toString()],
        [LAST_RESET_KEY, new Date().toDateString()],
      ]);
    } catch (e) {
      console.error("persistSteps:", e);
    }
  };

  const isNewDay = async (): Promise<boolean> => {
    try {
      const last = await AsyncStorage.getItem(LAST_RESET_KEY);
      return last !== new Date().toDateString();
    } catch {
      return true;
    }
  };

  const resetDailySteps = async () => {
    try {
      await AsyncStorage.multiSet([
        [STEP_COUNT_KEY, "0"],
        [LAST_RESET_KEY, new Date().toDateString()],
        [STEP_SESSION_KEY, "-1"],
        [STEP_SAVED_KEY, "0"],
      ]);
    } catch (e) {
      console.error("resetDailySteps:", e);
    }
    sessionBaseRef.current = null;
    savedAtStartRef.current = 0;
    notificationsSentRef.current = {
      half: false,
      target: false,
      double: false,
    };
    setCurrentStepCount(0);
    setProgress(0);
  };

  // ─── Permissões ────────────────────────────────────────────────────────────

  const requestActivityPermission = async (): Promise<boolean> => {
    if (Platform.OS !== "android") return true;
    try {
      const perm =
        (Platform.Version as number) >= 29
          ? PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION
          : PermissionsAndroid.PERMISSIONS.BODY_SENSORS;
      const result = await PermissionsAndroid.request(perm, {
        title: t("permissionActivityTitle", { ns: "common" }),
        message: t("permissionActivityMessage", { ns: "common" }),
        buttonNeutral: t("permissionAskLater", { ns: "common" }),
        buttonNegative: t("permissionCancel", { ns: "common" }),
        buttonPositive: t("permissionAllow", { ns: "common" }),
      });
      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  };

  // ─── Pedómetro ─────────────────────────────────────────────────────────────
  //
  // Estratégia delta:
  //   total_hoje = savedAtStart + (sensorAgora - sessionBase)
  //
  // Quando a app fecha e reabre:
  //   - savedAtStart = valor guardado no AsyncStorage
  //   - sessionBase  = primeira leitura do sensor nesta sessão (começa do 0 no Android)
  //   - delta        = 0 inicialmente, cresce conforme o utilizador anda

  const startPedometer = async (savedSteps: number) => {
    // Remove subscrição anterior se existir
    pedometerSubRef.current?.remove();
    pedometerSubRef.current = null;
    sessionBaseRef.current = null;

    try {
      const available = await Pedometer.isAvailableAsync();
      setIsPedometerAvailable(available);
      if (!available) return;

      savedAtStartRef.current = savedSteps;
      await AsyncStorage.setItem(STEP_SAVED_KEY, savedSteps.toString());

      const sub = Pedometer.watchStepCount(async (result) => {
        if (result?.steps === undefined) return;
        const sensorNow = result.steps;

        // Novo dia com app aberta
        if (await isNewDay()) {
          await resetDailySteps();
          sessionBaseRef.current = sensorNow;
          savedAtStartRef.current = 0;
          await AsyncStorage.multiSet([
            [STEP_SESSION_KEY, sensorNow.toString()],
            [STEP_SAVED_KEY, "0"],
          ]);
          return;
        }

        // Primeira leitura desta sessão → define a base do sensor
        if (sessionBaseRef.current === null) {
          sessionBaseRef.current = sensorNow;
          await AsyncStorage.setItem(STEP_SESSION_KEY, sensorNow.toString());
        }

        // Passos de hoje = base guardada + delta desta sessão
        const delta = Math.max(0, sensorNow - sessionBaseRef.current);
        const totalHoje = savedAtStartRef.current + delta;

        setCurrentStepCount(totalHoje);
        await persistSteps(totalHoje);
      });

      pedometerSubRef.current = sub;
    } catch (e) {
      console.error("startPedometer:", e);
      setCurrentStepCount(savedSteps);
    }
  };

  const initSteps = async () => {
    const ok = await requestActivityPermission();
    if (!ok) {
      Alert.alert(
        t("permissionRequiredTitle", { ns: "common" }),
        t("permissionRequiredMessage", { ns: "common" }),
      );
      const stored = await loadStoredSteps();
      setCurrentStepCount(stored);
      return;
    }

    if (await isNewDay()) {
      await resetDailySteps();
      await startPedometer(0);
    } else {
      const stored = await loadStoredSteps();
      setCurrentStepCount(stored); // mostra imediatamente o valor guardado
      await startPedometer(stored);
    }
  };

  // ─── AppState: quando a app volta do background ────────────────────────────
  //
  // Quando o utilizador volta à app depois de a ter em background,
  // relemos o AsyncStorage (que pode ter sido atualizado pela task de background
  // ou simplesmente para garantir consistência) e reiniciamos o pedómetro
  // com o valor mais recente.

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      async (nextState: AppStateStatus) => {
        if (nextState === "active") {
          if (await isNewDay()) {
            await resetDailySteps();
            await startPedometer(0);
            return;
          }
          // Lê o valor mais recente guardado e reinicia o sensor a partir daí
          const stored = await loadStoredSteps();
          setCurrentStepCount(stored);
          await startPedometer(stored);
        }
      },
    );

    return () => subscription.remove();
  }, []);

  // ─── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    initSteps();
    registerForPushNotifications();
    return () => {
      pedometerSubRef.current?.remove();
    };
  }, []);

  useEffect(() => {
    checkStepMilestones();
  }, [currentStepCount]);

  // ─── Workouts ──────────────────────────────────────────────────────────────

  const clearAllWorkouts = useCallback(() => {
    Alert.alert(
      t("deleteAllWorkouts", { ns: "common" }),
      t("deleteAllWorkoutsConfirm", { ns: "common" }),
      [
        { text: t("cancel", { ns: "common" }), style: "cancel" },
        {
          text: t("delete", { ns: "common" }),
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));
              try {
                const {
                  data: { user },
                } = await supabase.auth.getUser();
                if (user?.id) {
                  const isUuid =
                    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                      user.id,
                    );
                  let q = supabase.from("workouts").delete();
                  q = isUuid
                    ? q.eq("user_uuid", user.id)
                    : q.eq("user_id", user.id);
                  const { error } = await q;
                  if (error) console.error(error);
                }
              } catch (e) {
                console.error(e);
              }
              setWorkouts([]);
            } catch {
              Alert.alert(
                t("error", { ns: "common" }),
                t("couldNotSave", { ns: "common" }),
              );
            }
          },
        },
      ],
    );
  }, []);

  const loadWorkouts = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const local: Workout[] = raw ? JSON.parse(raw) : [];
      let db: Workout[] = [];
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user?.id) {
          const isUuid =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              user.id,
            );
          let q = supabase
            .from("workouts")
            .select("*")
            .order("created_at", { ascending: false });
          q = isUuid ? q.eq("user_uuid", user.id) : q.eq("user_id", user.id);
          const { data, error } = await q;
          if (!error && data) {
            db = data.map((w: any) => ({
              name: w.name,
              createdAt: w.created_at || w.createdAt,
              exercises: w.exercises || [],
            }));
          }
        }
      } catch (e) {
        console.error(e);
      }
      const all = [...local, ...db];
      const unique = all.filter(
        (w, i, s) =>
          i ===
          s.findIndex((x) => x.name === w.name && x.createdAt === w.createdAt),
      );
      unique.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setWorkouts(unique);
    } catch {
      setWorkouts([]);
    }
  }, []);

  useEffect(() => {
    loadWorkouts();
    const id = setInterval(loadWorkouts, 5000);
    return () => clearInterval(id);
  }, [loadWorkouts]);

  useFocusEffect(
    useCallback(() => {
      loadWorkouts();
    }, [loadWorkouts]),
  );

  // ─── Notifications ─────────────────────────────────────────────────────────

  const checkStepMilestones = async () => {
    if (currentStepCount === 0) return;
    const half = STEP_TARGET / 2;
    const dbl = STEP_TARGET * 2;
    if (
      currentStepCount >= half &&
      currentStepCount < half + 100 &&
      !notificationsSentRef.current.half
    ) {
      await sendMilestone(
        "🎉 Metade do Caminho!",
        `Atingiste ${currentStepCount.toLocaleString()} passos! 💪`,
      );
      notificationsSentRef.current.half = true;
    }
    if (
      currentStepCount >= STEP_TARGET &&
      currentStepCount < STEP_TARGET + 100 &&
      !notificationsSentRef.current.target
    ) {
      await sendMilestone(
        "🏆 Meta Batida!",
        `PARABÉNS! ${currentStepCount.toLocaleString()} passos! 🎊`,
      );
      notificationsSentRef.current.target = true;
    }
    if (
      currentStepCount >= dbl &&
      currentStepCount < dbl + 100 &&
      !notificationsSentRef.current.double
    ) {
      await sendMilestone(
        "🚀 DOBRO DA META!",
        `INCRÍVEL! ${currentStepCount.toLocaleString()} passos! 🌟`,
      );
      notificationsSentRef.current.double = true;
    }
    if (currentStepCount < half) notificationsSentRef.current.half = false;
    if (currentStepCount < STEP_TARGET)
      notificationsSentRef.current.target = false;
    if (currentStepCount < dbl) notificationsSentRef.current.double = false;
  };

  const sendMilestone = async (title: string, body: string) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: "default",
          data: { type: "step_milestone" },
        },
        trigger: null,
      });
      if (Platform.OS !== "web") Vibration.vibrate([0, 500, 200, 500]);
    } catch (e) {
      console.error(e);
    }
  };

  const registerForPushNotifications = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted")
      alert("We need your permission to send notifications");
  };

  const caloriesBurned = Math.round(currentStepCount * 0.05);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <Animated.View
          style={[
            styles.header,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>
            Zedith
          </Text>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
              router.push("/profile");
            }}
          >
            <Svg
              width={24}
              height={24}
              viewBox="0 0 24 24"
              fill="none"
              stroke={theme.colors.onSurface}
              strokeWidth={2}
            >
              <Path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
              />
              <Path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
              />
            </Svg>
          </Pressable>
        </Animated.View>

        {/* ── Steps Card ──────────────────────────────────────────────── */}
        <Animated.View
          style={[
            styles.stepsCard,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.outline + "30",
            },
          ]}
        >
          <View style={styles.cardPadding}>
            <View style={styles.stepsHeader}>
              <Text
                style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
              >
                {t("steps", { ns: "common" })} {t("today", { ns: "common" })}
              </Text>
              <View
                style={[
                  styles.caloriesBadge,
                  { backgroundColor: theme.colors.primary + "20" },
                ]}
              >
                <Svg
                  width={16}
                  height={16}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={theme.colors.primary}
                  strokeWidth={2}
                >
                  <Path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.5 10.0003C14.5 9.20875 15.5528 8.99895 15.8321 9.73957C16.5077 11.5311 17 13.1337 17 14.0002C17 16.7616 14.7614 19.0002 12 19.0002C9.23858 19.0002 7 16.7616 7 14.0002C7 13.0693 7.56822 11.2887 8.32156 9.33698C9.29743 6.80879 9.78536 5.54469 10.3877 5.4766C10.5804 5.45482 10.7907 5.49399 10.9626 5.58371C11.5 5.86413 11.5 7.24285 11.5 10.0003C11.5 10.8287 12.1716 11.5003 13 11.5003C13.8284 11.5003 14.5 10.8287 14.5 10.0003Z"
                  />
                </Svg>
                <Text
                  style={[styles.caloriesText, { color: theme.colors.primary }]}
                >
                  {caloriesBurned}
                </Text>
              </View>
            </View>

            <View style={styles.stepsCount}>
              <Text
                style={[styles.stepsNumber, { color: theme.colors.onSurface }]}
              >
                {currentStepCount.toLocaleString()}
              </Text>
              <Text
                style={[
                  styles.stepsDivider,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                /
              </Text>
              <Text
                style={[
                  styles.stepsTarget,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {STEP_TARGET.toLocaleString()}
              </Text>
            </View>

            <View
              style={[
                styles.progressBar,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(100, progress * 100)}%`,
                    backgroundColor: theme.colors.primary,
                  },
                ]}
              />
            </View>
          </View>
        </Animated.View>

        {/* ── Workouts Section ────────────────────────────────────────── */}
        <Animated.View
          style={[
            styles.workoutsSection,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.workoutsHeader}>
            <Text
              style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
            >
              {t("workouts", { ns: "common" })}
            </Text>
            <TouchableOpacity
              onPress={() => {
                clearAllWorkouts();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
              }}
              style={[
                styles.deleteBtn,
                {
                  backgroundColor: theme.colors.error + "20",
                  borderColor: theme.colors.error + "30",
                },
              ]}
            >
              <Text
                style={[styles.deleteBtnText, { color: theme.colors.error }]}
              >
                Clear All
              </Text>
            </TouchableOpacity>
          </View>

          {workouts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text
                style={[styles.emptyText, { color: theme.colors.onSurface }]}
              >
                {t("noWorkoutsFound", { ns: "common" })}
              </Text>
              <Text
                style={[
                  styles.emptySubtext,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {t("startByAdding", { ns: "common" })}
              </Text>
            </View>
          ) : (
            <AnimatedList
              items={workouts}
              delay={80}
              initialDelay={100}
              scrollY={scrollY}
              viewportHeight={SCREEN_HEIGHT}
              renderItem={(item: Workout) => (
                <View style={styles.itemWrap}>
                  <TouchableOpacity
                    style={[
                      styles.workoutItem,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.outline + "30",
                      },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push(
                        `/workout/${workoutSlugFromFields(item.name, item.createdAt)}`,
                      );
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.workoutContent}>
                      <View style={styles.workoutInfo}>
                        <Text
                          style={[
                            styles.workoutText,
                            { color: theme.colors.onSurface },
                          ]}
                        >
                          {item.name}
                        </Text>
                        <Text
                          style={[
                            styles.dateText,
                            { color: theme.colors.onSurfaceVariant },
                          ]}
                        >
                          {new Date(item.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.exerciseCount,
                          { backgroundColor: theme.colors.primary + "30" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.countText,
                            { color: theme.colors.primary },
                          ]}
                        >
                          {item.exercises.length}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </Animated.View>
      </Animated.ScrollView>

      {/* ── FAB ─────────────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.fab, { shadowColor: theme.colors.primary }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
          router.push("/addWorkout");
        }}
        activeOpacity={0.85}
      >
        <View
          style={[
            styles.fabGradient,
            { backgroundColor: theme.colors.primary },
          ]}
        >
          <Text style={[styles.fabText, { color: theme.colors.onPrimary }]}>
            +
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 100 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 60 : 50,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  title: { fontSize: 32, fontWeight: "700" },
  stepsCard: {
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
  },
  cardPadding: { padding: 24 },
  stepsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: "600" },
  caloriesBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  caloriesText: { fontSize: 14, fontWeight: "600" },
  stepsCount: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  stepsNumber: { fontSize: 36, fontWeight: "700" },
  stepsDivider: {
    fontSize: 24,
    fontWeight: "600",
    marginHorizontal: 8,
    opacity: 0.6,
  },
  stepsTarget: { fontSize: 24, fontWeight: "600", opacity: 0.8 },
  progressBar: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },
  workoutsSection: { paddingHorizontal: 24 },
  workoutsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  deleteBtnText: { fontSize: 13, fontWeight: "600" },
  itemWrap: { marginBottom: 12 },
  workoutItem: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    padding: 20,
  },
  workoutContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  workoutInfo: { flex: 1 },
  workoutText: { fontSize: 17, fontWeight: "600", marginBottom: 4 },
  dateText: { fontSize: 14 },
  exerciseCount: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { fontSize: 16, fontWeight: "700" },
  emptyContainer: { alignItems: "center", paddingVertical: 40 },
  emptyText: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  emptySubtext: { fontSize: 14 },
  fab: {
    position: "absolute",
    bottom: 89,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  fabText: { fontSize: 34, fontWeight: "300", paddingBottom: 3.7,},
});
