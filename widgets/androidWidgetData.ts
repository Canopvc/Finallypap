import AsyncStorage from "@react-native-async-storage/async-storage";

const STEP_COUNT_KEY = "@step_count";
const WORKOUTS_STORAGE_KEY = "workouts";

type Workout = {
  name: string;
  createdAt: string;
  exercises?: Array<unknown>;
};

export async function getTodaySteps(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(STEP_COUNT_KEY);
    const parsed = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  } catch {
    return 0;
  }
}

export async function getNextWorkout(): Promise<Workout | null> {
  try {
    const raw = await AsyncStorage.getItem(WORKOUTS_STORAGE_KEY);
    const workouts: Workout[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(workouts) || workouts.length === 0) return null;

    const sorted = workouts
      .filter((w) => w && typeof w.name === "string")
      .sort(
        (a, b) =>
          new Date(b.createdAt ?? "").getTime() - new Date(a.createdAt ?? "").getTime(),
      );

    return sorted[0] ?? null;
  } catch {
    return null;
  }
}
