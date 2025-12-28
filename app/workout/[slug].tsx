import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChevronLeft, Plus, Trash2, GripVertical, Clock, Flame, Play } from 'lucide-react-native';

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

  const estimatedDuration = useMemo(() => {
    if (!workout) return 0;
    return Math.ceil(workout.exercises.length * 10);
  }, [workout]);

  const estimatedCalories = useMemo(() => {
    if (!workout) return 0;
    return Math.ceil(workout.exercises.length * 50);
  }, [workout]);

  if (loading || !workout) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.onSurface }}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ChevronLeft size={20} color={theme.colors.primary} />
              <Text style={[styles.backButtonText, { color: theme.colors.primary }]}>Back</Text>
            </TouchableOpacity>
            <View style={[styles.exerciseBadge, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Text style={[styles.exerciseBadgeText, { color: theme.colors.onSurfaceVariant }]}>
                {workout.exercises.length} exercises
              </Text>
            </View>
          </View>

          <View style={styles.headerInfo}>
            <TextInput
              style={[styles.workoutTitle, { color: theme.colors.primary }]}
              value={workout.name}
              onChangeText={(t) => updateWorkoutField('name', t)}
              placeholder="Workout Name"
              placeholderTextColor={theme.colors.onSurfaceVariant}
            />

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Clock size={16} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}>
                  ~{estimatedDuration} min
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Flame size={16} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}>
                  ~{estimatedCalories} cal
                </Text>
              </View>
            </View>

            <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
              Customize your workout before starting
            </Text>
          </View>
        </View>
      </View>

      {/* Exercises List */}
      <ScrollView contentContainerStyle={styles.content}>
        {workout.exercises.map((exercise, index) => (
          <View key={exercise.id} style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.cardHeader}>
              <View style={styles.exerciseHeader}>
                <GripVertical size={18} color={theme.colors.onSurfaceVariant} />
                <View style={styles.exerciseTitleContainer}>
                  <Text style={[styles.exerciseLabel, { color: theme.colors.onSurfaceVariant }]}>
                    Exercise Name
                  </Text>
                  <TextInput
                    style={[styles.exerciseInput, { color: theme.colors.onSurface }]}
                    value={exercise.name}
                    onChangeText={(t) => updateExercise(index, 'name', t)}
                    placeholder="Enter exercise name"
                    placeholderTextColor={theme.colors.onSurfaceVariant}
                  />
                </View>
              </View>

              <TouchableOpacity
                onPress={() => deleteExercise(index)}
                style={styles.deleteButton}
              >
                <Trash2 size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>

            <View style={styles.exerciseGrid}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.colors.onSurfaceVariant }]}>Sets</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.onSurface, borderColor: theme.colors.outline }]}
                  keyboardType="numeric"
                  value={String(exercise.sets)}
                  onChangeText={(t) => updateExercise(index, 'sets', parseInt(t) || 0)}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.colors.onSurfaceVariant }]}>Reps</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.onSurface, borderColor: theme.colors.outline }]}
                  keyboardType="numeric"
                  value={exercise.reps?.toString() ?? ''}
                  onChangeText={(t) => updateExercise(index, 'reps', parseInt(t) || undefined)}
                  placeholder="10"
                  placeholderTextColor={theme.colors.onSurfaceVariant}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.colors.onSurfaceVariant }]}>Weight (kg)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.onSurface, borderColor: theme.colors.outline }]}
                  keyboardType="numeric"
                  value={exercise.weight?.toString() ?? ''}
                  onChangeText={(t) => updateExercise(index, 'weight', parseFloat(t) || undefined)}
                  placeholder="0"
                  placeholderTextColor={theme.colors.onSurfaceVariant}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.colors.onSurfaceVariant }]}>Minutes</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.onSurface, borderColor: theme.colors.outline }]}
                  keyboardType="numeric"
                  value={exercise.minutes?.toString() ?? ''}
                  onChangeText={(t) => updateExercise(index, 'minutes', parseInt(t) || undefined)}
                  placeholder="0"
                  placeholderTextColor={theme.colors.onSurfaceVariant}
                />
              </View>
            </View>

            <View style={styles.tagRow}>
              <TouchableOpacity
                style={[
                  styles.tag,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline },
                  exercise.dropset && [styles.tagActive, { backgroundColor: theme.colors.primary }]
                ]}
                onPress={() => updateExercise(index, 'dropset', !exercise.dropset)}
              >
                <Text style={[
                  styles.tagText,
                  { color: theme.colors.onSurface },
                  exercise.dropset && [styles.tagTextActive, { color: theme.colors.onPrimary }]
                ]}>
                  Dropset
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tag,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline },
                  exercise.failure && [styles.tagActive, { backgroundColor: theme.colors.primary }]
                ]}
                onPress={() => updateExercise(index, 'failure', !exercise.failure)}
              >
                <Text style={[
                  styles.tagText,
                  { color: theme.colors.onSurface },
                  exercise.failure && [styles.tagTextActive, { color: theme.colors.onPrimary }]
                ]}>
                  Failure
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tag,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline },
                  exercise.warmup && [styles.tagActive, { backgroundColor: theme.colors.primary }]
                ]}
                onPress={() => updateExercise(index, 'warmup', !exercise.warmup)}
              >
                <Text style={[
                  styles.tagText,
                  { color: theme.colors.onSurface },
                  exercise.warmup && [styles.tagTextActive, { color: theme.colors.onPrimary }]
                ]}>
                  Warmup
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.addExerciseButton, { borderColor: theme.colors.outline }]}
          onPress={addExercise}
        >
          <Plus size={20} color={theme.colors.primary} />
          <Text style={[styles.addExerciseText, { color: theme.colors.primary }]}>
            Add Exercise
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Footer Actions */}
      <View style={[styles.footer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outline }]}>
        <TouchableOpacity
          style={[styles.footerButton, styles.secondaryButton]}
          onPress={deleteWorkout}
        >
          <Text style={styles.secondaryButtonText}>Delete</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.footerButton, { backgroundColor: theme.colors.primary }]}
          onPress={saveWorkout}
        >
          <Text style={[styles.footerButtonText, { color: theme.colors.onPrimary }]}>Save</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.footerButton, styles.primaryButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => router.push(`/workout/${slug}/start`)}
        >
          <Play size={20} color={theme.colors.onPrimary} />
          <Text style={[styles.footerButtonText, { color: theme.colors.onPrimary }]}>Start</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerContent: {
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  exerciseBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  exerciseBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerInfo: {
    gap: 8,
  },
  workoutTitle: {
    fontSize: 28,
    fontWeight: '700',
    padding: 0,
    margin: 0,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  exerciseTitleContainer: {
    flex: 1,
  },
  exerciseLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  exerciseInput: {
    fontSize: 16,
    fontWeight: '600',
    padding: 0,
  },
  deleteButton: {
    padding: 4,
  },
  exerciseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  inputGroup: {
    flex: 1,
    minWidth: '45%',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tag: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  tagActive: {
    borderWidth: 0,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tagTextActive: {
    fontWeight: '700',
  },
  addExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
  },
  addExerciseText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  footerButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButton: {
    backgroundColor: '#ef4444',
  },
  footerButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});