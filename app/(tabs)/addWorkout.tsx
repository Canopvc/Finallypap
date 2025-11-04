import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';

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

function uid(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function defaultExercise(): Exercise {
  return {
    id: uid('ex-'),
    name: '',
    type: 'weightlifting',
    sets: 3,
    reps: undefined,
    weight: undefined,
    minutes: undefined,
    dropset: false,
    failure: false,
    warmup: false,
  };
}

export default function AddWorkout() {
  const router = useRouter();
  const theme = useTheme();

  const [workoutName, setWorkoutName] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([defaultExercise()]);
  const [loading, setLoading] = useState(false);

  const addExercise = useCallback(() => {
    setExercises(prev => [...prev, defaultExercise()]);
  }, []);

  const updateExercise = useCallback((id: string, field: keyof Exercise, value: any) => {
    setExercises(prev => prev.map(ex => (ex.id === id ? { ...ex, [field]: value } : ex)));
  }, []);

  const removeExercise = useCallback((id: string) => {
    setExercises(prev => prev.filter(e => e.id !== id));
  }, []);

  const validate = () => {
    if (!workoutName.trim()) {
      Alert.alert('Please enter a workout name');
      return false;
    }
    const hasNamed = exercises.some(e => e.name && e.name.trim().length > 0);
    if (!hasNamed) {
      Alert.alert('Add at least one exercise with a name');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    const newWorkout: Workout = {
      name: workoutName.trim(),
      createdAt: new Date().toISOString(),
      exercises,
    };
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const list: Workout[] = raw ? JSON.parse(raw) : [];
      list.unshift(newWorkout); // newest first
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      router.back();
    } catch (err) {
      console.error('Save workout error', err);
      Alert.alert('Error', 'Could not save workout.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={[styles.container]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.header, { color: theme.colors.onBackground }]}>
          Create Workout
        </Text>

        {/* Workout Name Card */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.label, { color: theme.colors.onSurface }]}>
            Workout name
          </Text>
          <TextInput 
            value={workoutName} 
            onChangeText={setWorkoutName} 
            placeholder="e.g. Push Day" 
            style={[
              styles.input, 
              { 
                backgroundColor: theme.colors.background,
                color: theme.colors.onSurface, 
                borderColor: theme.colors.outline 
              }
            ]} 
            placeholderTextColor={theme.colors.onSurfaceVariant ?? theme.colors.onSurface} 
          />
        </View>

        {/* Exercises */}
        {exercises.map((ex, idx) => (
          <View key={ex.id} style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            {/* Exercise Header */}
            <View style={styles.rowBetween}>
              <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                Exercise {idx + 1}
              </Text>
              <TouchableOpacity 
                onPress={() => removeExercise(ex.id)} 
                disabled={exercises.length === 1}
              >
                <Text style={[
                  styles.removeBtn,
                  { color: theme.colors.error },
                  exercises.length === 1 && { opacity: 0.4 }
                ]}>
                  Remove
                </Text>
              </TouchableOpacity>
            </View>

            {/* Exercise Name */}
            <Text style={[styles.label, { color: theme.colors.onSurface }]}>
              Name
            </Text>
            <TextInput
              placeholder="Bench Press"
              style={[
                styles.input, 
                { 
                  backgroundColor: theme.colors.background,
                  color: theme.colors.onSurface, 
                  borderColor: theme.colors.outline 
                }
              ]}
              placeholderTextColor={theme.colors.onSurfaceVariant ?? theme.colors.onSurface}
              value={ex.name}
              onChangeText={t => updateExercise(ex.id, 'name', t)}
            />

            {/* Sets and Reps */}
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={[styles.label, { color: theme.colors.onSurface }]}>
                  Sets
                </Text>
                <TextInput
                  style={[
                    styles.input, 
                    { 
                      backgroundColor: theme.colors.background,
                      color: theme.colors.onSurface, 
                      borderColor: theme.colors.outline 
                    }
                  ]}
                  keyboardType="number-pad"
                  value={String(ex.sets)}
                  onChangeText={t => updateExercise(ex.id, 'sets', Math.max(0, Number(t) || 0))}
                />
              </View>
              <View style={styles.half}>
                <Text style={[styles.label, { color: theme.colors.onSurface }]}>
                  Reps
                </Text>
                <TextInput
                  style={[
                    styles.input, 
                    { 
                      backgroundColor: theme.colors.background,
                      color: theme.colors.onSurface, 
                      borderColor: theme.colors.outline 
                    }
                  ]}
                  keyboardType="number-pad"
                  placeholder="Optional"
                  placeholderTextColor={theme.colors.onSurfaceVariant ?? theme.colors.onSurface}
                  value={ex.reps != null ? String(ex.reps) : ''}
                  onChangeText={t => updateExercise(ex.id, 'reps', t ? Number(t) : undefined)}
                />
              </View>
            </View>

            {/* Weight and Duration */}
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={[styles.label, { color: theme.colors.onSurface }]}>
                  Weight (kg)
                </Text>
                <TextInput
                  style={[
                    styles.input, 
                    { 
                      backgroundColor: theme.colors.background,
                      color: theme.colors.onSurface, 
                      borderColor: theme.colors.outline 
                    }
                  ]}
                  keyboardType="numeric"
                  placeholder="Optional"
                  placeholderTextColor={theme.colors.onSurfaceVariant ?? theme.colors.onSurface}
                  value={ex.weight != null ? String(ex.weight) : ''}
                  onChangeText={t => updateExercise(ex.id, 'weight', t ? Number(t) : undefined)}
                />
              </View>
              <View style={styles.half}>
                <Text style={[styles.label, { color: theme.colors.onSurface }]}>
                  Duration (min)
                </Text>
                <TextInput
                  style={[
                    styles.input, 
                    { 
                      backgroundColor: theme.colors.background,
                      color: theme.colors.onSurface, 
                      borderColor: theme.colors.outline 
                    }
                  ]}
                  keyboardType="numeric"
                  placeholder="Optional"
                  placeholderTextColor={theme.colors.onSurfaceVariant ?? theme.colors.onSurface}
                  value={ex.minutes != null ? String(ex.minutes) : ''}
                  onChangeText={t => updateExercise(ex.id, 'minutes', t ? Number(t) : undefined)}
                />
              </View>
            </View>

            {/* Exercise Type Segment */}
            <Text style={[styles.label, { color: theme.colors.onSurface, marginTop: 12 }]}>
              Exercise Type
            </Text>
            <View style={[
              styles.segmentContainer, 
              { 
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.outline 
              }
            ]}>
              {(['weightlifting', 'calisthenics', 'cardio'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.segmentBtn,
                    ex.type === t 
                      ? { 
                          backgroundColor: theme.colors.primary,
                          shadowColor: theme.colors.primary,
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.3,
                          shadowRadius: 4,
                          elevation: 3,
                        }
                      : { 
                          backgroundColor: 'transparent' 
                        }
                  ]}
                  onPress={() => updateExercise(ex.id, 'type', t)}
                >
                  <Text 
                    style={[
                      styles.segmentTxt,
                      ex.type === t 
                        ? { 
                            color: theme.colors.onPrimary,
                            fontWeight: '700'
                          } 
                        : { 
                            color: theme.colors.onSurfaceVariant 
                          }
                    ]}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Toggle Switches */}
            <View style={styles.switchRow}>
              <View style={styles.switchItem}>
                <Text style={[styles.switchLabel, { color: theme.colors.onSurface }]}>
                  Warm-up
                </Text>
                <Switch 
                  value={ex.warmup} 
                  onValueChange={v => updateExercise(ex.id, 'warmup', v)}
                  trackColor={{
                    false: theme.colors.surfaceVariant,
                    true: theme.colors.primaryContainer
                  }}
                  thumbColor={ex.warmup ? theme.colors.primary : theme.colors.outline}
                />
              </View>
              <View style={styles.switchItem}>
                <Text style={[styles.switchLabel, { color: theme.colors.onSurface }]}>
                  Dropset
                </Text>
                <Switch 
                  value={ex.dropset} 
                  onValueChange={v => updateExercise(ex.id, 'dropset', v)}
                  trackColor={{
                    false: theme.colors.surfaceVariant,
                    true: theme.colors.primaryContainer
                  }}
                  thumbColor={ex.dropset ? theme.colors.primary : theme.colors.outline}
                />
              </View>
              <View style={styles.switchItem}>
                <Text style={[styles.switchLabel, { color: theme.colors.onSurface }]}>
                  To failure
                </Text>
                <Switch 
                  value={ex.failure} 
                  onValueChange={v => updateExercise(ex.id, 'failure', v)}
                  trackColor={{
                    false: theme.colors.surfaceVariant,
                    true: theme.colors.primaryContainer
                  }}
                  thumbColor={ex.failure ? theme.colors.primary : theme.colors.outline}
                />
              </View>
            </View>
          </View>
        ))}

        {/* Footer Buttons */}
        <View style={styles.footerRow}>
          <TouchableOpacity 
            style={[
              styles.secondaryBtn, 
              { 
                borderColor: theme.colors.outline,
                backgroundColor: theme.colors.surface
              }
            ]} 
            onPress={addExercise}
          >
            <Text style={[styles.secondaryBtnTxt, { color: theme.colors.onSurface }]}>
              + Add Exercise
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              styles.primaryBtn, 
              { 
                backgroundColor: theme.colors.primary,
                opacity: loading ? 0.7 : 1
              }
            ]} 
            onPress={handleSave} 
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.onPrimary} size="small" />
            ) : (
              <Text style={[styles.primaryBtnTxt, { color: theme.colors.onPrimary }]}>
                Save Workout
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    padding: 20, 
    paddingBottom: 40, 
    paddingTop: Platform.OS === 'ios' ? 60 : 40 
  },
  header: { 
    fontSize: 28, 
    fontWeight: '800', 
    textAlign: 'center', 
    marginBottom: 24 
  },
  card: { 
    borderRadius: 16, 
    padding: 20, 
    marginBottom: 16, 
    shadowColor: '#000',
    shadowOffset: { 
      width: 0, 
      height: Platform.OS === 'ios' ? 4 : 2 
    },
    shadowOpacity: Platform.OS === 'ios' ? 0.1 : 0.08,
    shadowRadius: Platform.OS === 'ios'  ? 12 : 4,
    elevation: 4,
  },
  cardTitle: { 
    fontSize: 18, 
    fontWeight: '700',
    marginBottom: 4 
  },
  label: { 
    fontSize: 14, 
    fontWeight: '600',
    marginTop: 12, 
    marginBottom: 8 
  },
  input: { 
    paddingVertical: Platform.OS === 'ios' ? 14 : 10, 
    paddingHorizontal: 16, 
    borderRadius: 12, 
    fontSize: 16, 
    borderWidth: 1,
    minHeight: Platform.OS === 'ios' ? 50 : 46,
  },
  row: { 
    flexDirection: 'row', 
    gap: 12 
  },
  rowBetween: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 8 
  },
  half: { 
    flex: 1 
  },
  removeBtn: { 
    fontWeight: '600',
    fontSize: 14 
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    marginTop: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    alignItems: 'center',
    borderRadius: 10,
    marginHorizontal: 2,
  },
  segmentTxt: {
    fontSize: 14,
    fontWeight: '500',
  },
  switchRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 4 
  },
  switchItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8,
    flex: 1,
    justifyContent: 'center'
  },
  switchLabel: { 
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    textAlign: 'center'
  },
  footerRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    gap: 12, 
    marginTop: 24 
  },
  primaryBtn: { 
    paddingVertical: Platform.OS === 'ios' ? 16 : 14, 
    paddingHorizontal: 20, 
    borderRadius: 14, 
    alignItems: 'center', 
    flex: 1,
    minHeight: Platform.OS === 'ios' ? 56 : 52,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnTxt: { 
    fontWeight: '700', 
    fontSize: 16 
  },
  secondaryBtn: { 
    borderRadius: 14, 
    borderWidth: 1, 
    paddingVertical: Platform.OS === 'ios' ? 16 : 14, 
    paddingHorizontal: 20, 
    alignItems: 'center', 
    justifyContent: 'center',
    flex: 1,
    minHeight: Platform.OS === 'ios' ? 56 : 52,
  },
  secondaryBtnTxt: { 
    fontWeight: '600',
    fontSize: 15 
  },
});