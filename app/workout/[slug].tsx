import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types should mirror the list screen
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

export type Workout = {
  name: string;
  createdAt: string;
  exercises: Exercise[];
};

const STORAGE_KEY = 'workouts';


const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const workoutSlugFromFields = (name: string, createdAt: string) => `${slugify(name)}-${new Date(createdAt).getTime()}`;
function uid(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export default function WorkoutDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const theme = useTheme();

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWorkout = useCallback(async () => {
    try {
      setLoading(true);
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed: Workout[] = raw ? JSON.parse(raw) : [];
      setWorkouts(parsed);
      const found = parsed.find(w => workoutSlugFromFields(w.name, w.createdAt) === slug);
      if (found) {
        // clone to edit safely
        setWorkout(JSON.parse(JSON.stringify(found)));
      } else {
        Alert.alert('Not found', 'Workout not found.');
        router.back();
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to load workout.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadWorkout();
  }, [loadWorkout]);

  const updateWorkoutField = (field: keyof Workout, value: any) => {
    if (!workout) return;
    setWorkout({ ...workout, [field]: value });
  };

  const updateExercise = (index: number, field: keyof Exercise, value: any) => {
    if (!workout) return;
    const list = [...workout.exercises];
    list[index] = { ...list[index], [field]: value };
    setWorkout({ ...workout, exercises: list });
  };

  const deleteExercise = (index: number) => {
    if (!workout) return;
    const list = workout.exercises.filter((_, i) => i !== index);
    setWorkout({ ...workout, exercises: list });
  };

  const addExercise = () => {
    if (!workout) return;
    const newExercise: Exercise = {
      id: uid('ex-'),
      name: 'New Exercise',
      type: 'weightlifting',
      sets: 3,
      reps: 10,
      weight: 0,
      minutes: undefined,
      dropset: false,
      failure: false,
      warmup: false,
    };
    setWorkout({ ...workout, exercises: [...workout.exercises, newExercise] });
  };

  const saveWorkout = async () => {
    if (!workout) return;
    try {
      // Replace in list by matching original slug (from URL)
      const updated = workouts.map(w =>
        workoutSlugFromFields(w.name, w.createdAt) === slug ? workout : w
      );
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      Alert.alert('Saved', 'Workout updated successfully.');
      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not save workout.');
    }
  };

  const deleteWorkout = async () => {
    if (!workout) return;
    try {
      const filtered = workouts.filter(w => workoutSlugFromFields(w.name, w.createdAt) !== slug);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      Alert.alert('Deleted', 'Workout deleted successfully.');
      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not delete workout.');
    }
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
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: theme.colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>Workout Detail</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content] }>
        {/* Title */}
        <Text style={[styles.label, { color: theme.colors.onBackground }]}>Workout name</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.onSurface, borderColor: theme.colors.outline }]}
          value={workout.name}
          onChangeText={(t) => updateWorkoutField('name', t)}
          placeholder="Ex: Chest Day"
        />

        <View style={styles.metaRow}>
          <Text style={[styles.metaText, { color: theme.colors.onSurfaceVariant ?? theme.colors.onSurface }]}>Created: {new Date(workout.createdAt).toLocaleString()}</Text>
          <Text style={[styles.metaText, { color: theme.colors.onSurfaceVariant ?? theme.colors.onSurface }]}>Exercises: {workout.exercises.length}</Text>
        </View>

        <TouchableOpacity style={[styles.addExercise, { backgroundColor: theme.colors.primary }]} onPress={addExercise}>
          <Text style={[{ color: theme.colors.onPrimary, fontWeight: '700', fontSize: 16 }]}>+ Add Exercise</Text>
        </TouchableOpacity>

        {/* Exercises */}
        {workout.exercises.map((ex, i) => (
          <View key={ex.id ?? i} style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>Exercise {i + 1}</Text>
              <TouchableOpacity onPress={() => deleteExercise(i)} style={[styles.deletePill, { backgroundColor: '#ef4444' }]}>
                <Text style={styles.deletePillText}>Delete</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.smallLabel, { color: theme.colors.onSurface }]}>Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.onSurface, borderColor: theme.colors.outline }]}
              value={ex.name}
              onChangeText={(t) => updateExercise(i, 'name', t)}
              placeholder="Bench Press"
            />

            <View style={styles.row}> 
              <View style={styles.col}>
                <Text style={[styles.smallLabel, { color: theme.colors.onSurface }]}>Sets</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.onSurface, borderColor: theme.colors.outline }]}
                  keyboardType="numeric"
                  value={String(ex.sets)}
                  onChangeText={(t) => updateExercise(i, 'sets', parseInt(t) || 0)}
                />
              </View>
              <View style={styles.col}>
                <Text style={[styles.smallLabel, { color: theme.colors.onSurface }]}>Reps</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.onSurface, borderColor: theme.colors.outline }]}
                  keyboardType="numeric"
                  value={ex.reps?.toString() ?? ''}
                  onChangeText={(t) => updateExercise(i, 'reps', parseInt(t) || undefined)}
                />
              </View>
            </View>

            <View style={styles.row}> 
              <View style={styles.col}>
                <Text style={[styles.smallLabel, { color: theme.colors.onSurface }]}>Weight (kg)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.onSurface, borderColor: theme.colors.outline }]}
                  keyboardType="numeric"
                  value={ex.weight?.toString() ?? ''}
                  onChangeText={(t) => updateExercise(i, 'weight', parseFloat(t) || undefined)}
                />
              </View>
              <View style={styles.col}>
                <Text style={[styles.smallLabel, { color: theme.colors.onSurface }]}>Minutes</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.onSurface, borderColor: theme.colors.outline }]}
                  keyboardType="numeric"
                  value={ex.minutes?.toString() ?? ''}
                  onChangeText={(t) => updateExercise(i, 'minutes', parseInt(t) || undefined)}
                />
              </View>
            </View>

            <View style={styles.tagRow}>
              <TouchableOpacity
                style={[styles.tag, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }, ex.dropset && styles.tagActive]}
                onPress={() => updateExercise(i, 'dropset', !ex.dropset)}
              >
                <Text style={[styles.tagText, { color: theme.colors.onSurface }, ex.dropset && styles.tagTextActive]}>Dropset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tag, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }, ex.failure && styles.tagActive]}
                onPress={() => updateExercise(i, 'failure', !ex.failure)}
              >
                <Text style={[styles.tagText, { color: theme.colors.onSurface }, ex.failure && styles.tagTextActive]}>Failure</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tag, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }, ex.warmup && styles.tagActive]}
                onPress={() => updateExercise(i, 'warmup', !ex.warmup)}
              >
                <Text style={[styles.tagText, { color: theme.colors.onSurface }, ex.warmup && styles.tagTextActive]}>Warmup</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Footer actions */}
      <View style={[styles.footer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outline }] }>
        <TouchableOpacity style={[styles.button, styles.secondary]} onPress={deleteWorkout}>
          <Text style={styles.buttonText}>Delete</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, { backgroundColor: theme.colors.primary }]} onPress={saveWorkout}>
          <Text style={[styles.buttonText, { color: theme.colors.onPrimary }]}>Save</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
          onPress={() => router.push(`/workout/${slug}/start`)}
        >
          <Text style={[styles.buttonText, { color: theme.colors.onPrimary }]}>Start Workout</Text>
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
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1a1a1a',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: { paddingVertical: 6, paddingRight: 12, paddingLeft: 2 },
  backButtonText: { color: '#93c5fd', fontSize: 16 },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 24 },
  label: { fontWeight: '700', marginBottom: 6, color: '#0f172a' },
  smallLabel: { fontWeight: '600', marginBottom: 6, color: '#334155' },
  input: {
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  metaText: { color: '#64748b', fontSize: 12 },
  addExercise: { marginTop: 6, marginBottom: 4, alignSelf: 'flex-start', backgroundColor: '#06b6d4', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  deletePill: { backgroundColor: '#ef4444', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  deletePillText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  row: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },
  tagRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  tag: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minWidth: '30%',
    alignItems: 'center',
  },
  tagActive: { backgroundColor: '#06b6d4', borderColor: '#06b6d4' },
  tagText: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  tagTextActive: { color: '#fff' },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  button: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  primary: { backgroundColor: '#06b6d4' },
  secondary: { backgroundColor: '#ef4444' },
  start: { backgroundColor: '#22c55e' },
  buttonText: { color: '#fff', fontWeight: '700' },
});