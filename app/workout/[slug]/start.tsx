import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, Vibration, View } from 'react-native';
import { useTheme } from 'react-native-paper';

// Types mirrored from detail screen
 type Exercise = {
  id: string;
  name: string;
  type: 'calisthenics' | 'cardio' | 'weightlifting';
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

const STORAGE_KEY = 'workouts';
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const workoutSlugFromFields = (name: string, createdAt: string) => `${slugify(name)}-${new Date(createdAt).getTime()}`;

  


  const raresound = require('../../../assets/Trumpsinging.mp3')


function formatTime(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function StartWorkoutScreen() {

  const DEBUG_FORCE_EASTER_EGG = false;

  const playAlarm = useCallback(async () => {
  try {
    const isEasterEgg =
      DEBUG_FORCE_EASTER_EGG || Math.floor(Math.random() * 7000) === 0;

      console.log('🔊 DEBUG_FORCE_EASTER_EGG:', DEBUG_FORCE_EASTER_EGG);
      console.log('🎲 Random result:', Math.floor(Math.random() * 10));
      console.log('🔥 Easter egg activated:', isEasterEgg);

    const soundFile = isEasterEgg
      ? raresound // 🔥 toca o raro
      : require('../../../assets/hold-up-tiktok.mp3'); // som normal

    const { sound } = await Audio.Sound.createAsync(soundFile);
    await sound.playAsync();

    Vibration.vibrate(1000);

    
      const duration = isEasterEgg ? 15000 : 5000;


    setTimeout(() => {
      sound.stopAsync();
      sound.unloadAsync();
    }, duration);
  } catch (e) {
    console.error('Failed to play alarm', e);
  }
}, []);


  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const theme = useTheme();

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);

  // Overall timer
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);

  // Rest timer
  const [defaultRest, setDefaultRest] = useState(90); // seconds
  const [restRemaining, setRestRemaining] = useState(0);
  const [resting, setResting] = useState(false);

  // Per-set state
  // completed[exerciseIndex][setIndex] => boolean
  const [completed, setCompleted] = useState<Record<number, Record<number, boolean>>>({});
  // sessionWeights[exerciseIndex][setIndex] and sessionReps[exerciseIndex][setIndex]
  const [sessionWeights, setSessionWeights] = useState<Record<number, Record<number, string>>>({});
  const [sessionReps, setSessionReps] = useState<Record<number, Record<number, string>>>({});

  // Load workout
  const loadWorkout = useCallback(async () => {
    try {
      setLoading(true);
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed: Workout[] = raw ? JSON.parse(raw) : [];
      const found = parsed.find(w => workoutSlugFromFields(w.name, w.createdAt) === slug);
      if (!found) {
        Alert.alert('Not found', 'Workout not found.');
        router.back();
        return;
      }
      setWorkout(found);

      // Prime session weights/reps with defaults from workout
      const w: Record<number, Record<number, string>> = {};
      const r: Record<number, Record<number, string>> = {};
      found.exercises.forEach((ex, ei) => {
        w[ei] = {};
        r[ei] = {};
        const sets = ex.sets || 0;
        for (let si = 0; si < sets; si++) {
          w[ei][si] = ex.weight?.toString() ?? '';
          r[ei][si] = ex.reps?.toString() ?? '';
        }
      });
      setSessionWeights(w);
      setSessionReps(r);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to load workout.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { loadWorkout(); }, [loadWorkout]);

  // Overall timer interval
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Rest timer interval
  useEffect(() => {
    if (!resting) return;
    if (restRemaining <= 0) {
      setResting(false);
      playAlarm();  // 🔔 tocar alarme
      return;
    }
    const id = setInterval(() => setRestRemaining((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [resting, restRemaining, playAlarm]);

  const togglePause = () => setRunning((p) => !p);
  const startRest = (secs?: number) => {
    setRestRemaining(secs ?? defaultRest);
    setResting(true);
  };

  const markSetDone = (ei: number, si: number) => {
    setCompleted((prev) => ({
      ...prev,
      [ei]: { ...(prev[ei] || {}), [si]: !prev?.[ei]?.[si] },
    }));
    // Start rest only when marking as complete
    const afterToggleIsDone = !(completed?.[ei]?.[si]);
    if (afterToggleIsDone) startRest();
  };

  const finishWorkout = () => {
    Alert.alert('Finish workout?', 'This will stop the timer and return to details.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Finish', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  if (loading || !workout) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.onBackground }}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header with overall timer */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backText, { color: theme.colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>{workout.name}</Text>
          <Text style={[styles.timerText, { color: theme.colors.onSurface }]}>{formatTime(elapsed)}</Text>
        </View>
        <TouchableOpacity onPress={togglePause} style={[styles.pauseButton, { backgroundColor: theme.colors.primary }]}>
          <Text style={[styles.pauseText, { color: theme.colors.onPrimary }]}>{running ? 'Pause' : 'Resume'}</Text>
        </TouchableOpacity>
      </View>

      {/* Rest timer panel */}
      <View style={[styles.restPanel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.restLabel, { color: theme.colors.onSurface }]}>Rest</Text>
          <Text style={[styles.restTime, { color: theme.colors.primary }]}>{resting ? formatTime(restRemaining) : '--:--'}</Text>
        </View>
        <View style={styles.restControls}>
          <TouchableOpacity style={[styles.restBtn, { backgroundColor: theme.colors.primary }]} onPress={() => startRest()}>
            <Text style={[styles.restBtnText, { color: theme.colors.onPrimary }]}>Start</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.restBtn, { backgroundColor: theme.colors.secondary ?? theme.colors.primary }]} onPress={() => { setResting(false); setRestRemaining(0); }}>
            <Text style={[styles.restBtnText, { color: theme.colors.onPrimary }]}>Stop</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.restAdjust}>
          <Text style={[styles.smallLabel, { color: theme.colors.onSurface }]}>Default rest (sec)</Text>
          <TextInput
            style={[styles.restInput, { backgroundColor: theme.colors.surface, color: theme.colors.onSurface }]}
            keyboardType="numeric"
            value={String(defaultRest)}
            onChangeText={(t) => setDefaultRest(Math.max(0, parseInt(t || '0')))}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {workout.exercises.map((ex, ei) => (
          <View key={ex.id ?? ei} style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }]}>
            <Text style={[styles.exerciseTitle, { color: theme.colors.onSurface }]}>{ex.name}</Text>
            <Text style={[styles.exerciseMeta, { color: theme.colors.onSurfaceVariant ?? theme.colors.onSurface }]}>
              {ex.type} • {ex.sets} sets{ex.reps ? ` • ${ex.reps} reps` : ''}{ex.weight ? ` • ${ex.weight} kg` : ''}
            </Text>
            {/* Flags reminder */}
            <View style={styles.flagRow}>
              {ex.warmup ? (
                <View style={[styles.flag, { backgroundColor: theme.colors.primary }]}>
                  <Text style={styles.flagText}>Warmup</Text>
                </View>
              ) : null}
              {ex.failure ? (
                <View style={[styles.flag, { backgroundColor: '#ef4444' }]}>
                  <Text style={styles.flagText}>Failure</Text>
                </View>
              ) : null}
              {ex.dropset ? (
                <View style={[styles.flag, { backgroundColor: '#9333ea' }]}>
                  <Text style={styles.flagText}>Dropset</Text>
                </View>
              ) : null}
            </View>

            {/* Sets */}
            {Array.from({ length: ex.sets }).map((_, si) => (
              <View key={si} style={styles.setRow}>
                <Text style={styles.setLabel}>Set {si + 1}</Text>
                <View style={styles.setInputs}>
                  <TextInput
                    style={[styles.input, styles.setInput, { backgroundColor: theme.colors.surface, color: theme.colors.onSurface, borderColor: theme.colors.outline }]}
                    placeholder="kg"
                    keyboardType="numeric"
                    value={sessionWeights?.[ei]?.[si] ?? ''}
                    onChangeText={(t) => setSessionWeights((prev) => ({
                      ...prev,
                      [ei]: { ...(prev[ei] || {}), [si]: t },
                    }))}
                  />
                  <TextInput
                    style={[styles.input, styles.setInput, { backgroundColor: theme.colors.surface, color: theme.colors.onSurface, borderColor: theme.colors.outline }]}
                    placeholder="reps"
                    keyboardType="numeric"
                    value={sessionReps?.[ei]?.[si] ?? ''}
                    onChangeText={(t) => setSessionReps((prev) => ({
                      ...prev,
                      [ei]: { ...(prev[ei] || {}), [si]: t },
                    }))}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.doneBtn, { borderColor: theme.colors.outline, backgroundColor: theme.colors.surface }, completed?.[ei]?.[si] && styles.doneBtnActive]}
                  onPress={() => markSetDone(ei, si)}
                >
                  <Text style={[styles.doneBtnText, { color: theme.colors.onSurface }, completed?.[ei]?.[si] && styles.doneBtnTextActive]}>
                    {completed?.[ei]?.[si] ? 'Done' : 'Mark'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ))}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Bottom actions */}
      <View style={[styles.footer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outline }]}>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]} onPress={finishWorkout}>
          <Text style={[styles.actionText, { color: theme.colors.onPrimary }]}>Finish</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  loadingText: { color: '#475569' },
  header: {
    paddingTop: 50,
    paddingBottom: 10,
    paddingHorizontal: 16,
    backgroundColor: '#1a1a1a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: { paddingVertical: 6, paddingRight: 12, paddingLeft: 2 },
  backText: { color: '#93c5fd', fontSize: 16 },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerTitle: { color: 'white', fontSize: 16, fontWeight: '700' },
  timerText: { color: 'white', fontSize: 20, fontWeight: '800', marginTop: 4 },
  pauseButton: { padding: 8, borderRadius: 8 },
  pauseText: { fontWeight: '700' },

  restPanel: {
    margin: 16,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  restLabel: { color: '#0f172a', fontWeight: '700' },
  restTime: { color: '#06b6d4', fontWeight: '800', fontSize: 20, marginTop: 2 },
  restControls: { flexDirection: 'row', gap: 8 },
  restBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8 },
  restBtnText: { fontWeight: '700' },
  restAdjust: { marginLeft: 'auto' },
  restInput: { backgroundColor: '#f1f5f9', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, minWidth: 70, textAlign: 'center' },

  content: { paddingHorizontal: 16, paddingBottom: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  exerciseTitle: { fontWeight: '800', color: '#1e293b', fontSize: 16 },
  exerciseMeta: { color: '#64748b', marginTop: 2, marginBottom: 8, fontSize: 12 },
  smallLabel: { fontWeight: '600', marginBottom: 6, color: '#334155' },
  flagRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  flag: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999 },
  flagText: { color: 'white', fontWeight: '700', fontSize: 12 },
  flagWarmup: { backgroundColor: '#06b6d4' },
  flagFailure: { backgroundColor: '#ef4444' },
  flagDropset: { backgroundColor: '#9333ea' },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  setLabel: { width: 48, color: '#334155', fontWeight: '700' },
  setInputs: { flexDirection: 'row', gap: 8, flex: 1 },
  input: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0', borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10 },
  setInput: { flex: 1, textAlign: 'center' },
  doneBtn: { paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#f1f5f9', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  doneBtnActive: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  doneBtnText: { color: '#64748b', fontWeight: '700' },
  doneBtnTextActive: { color: '#fff' },

  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0', backgroundColor: '#fff' },
  actionBtn: { paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  finish: { },
  actionText: { fontWeight: '700' },
});