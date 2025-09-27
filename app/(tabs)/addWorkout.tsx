import React, { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from 'react-native-paper';

type Exercise = {
  id: string;
  name: string;
  type: 'calisthenics ' | 'cardio ' | 'weightlifting';
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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={[styles.container]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.header, { color: theme.colors.onBackground }]}>Create Workout</Text>

        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.label, { color: theme.colors.onSurface }]}>Workout name</Text>
          <TextInput value={workoutName} onChangeText={setWorkoutName} placeholder="e.g. Push Day" style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.onSurface, borderColor: theme.colors.outline }]} placeholderTextColor={theme.colors.onSurfaceVariant ?? theme.colors.onSurface} />
        </View>

        {exercises.map((ex, idx) => (
          <View key={ex.id ?? idx} style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.rowBetween}>
              <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>Exercise {idx + 1}</Text>
              <TouchableOpacity onPress={() => removeExercise(ex.id)} disabled={exercises.length === 1}>
                <Text style={[
                  styles.removeBtn,
                  exercises.length === 1 && { opacity: 0.4 }
                ]}>
                  Remove
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: theme.colors.onSurface }]}>Name</Text>
            <TextInput
              placeholder="Bench Press"
              style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.onSurface, borderColor: theme.colors.outline }]}
              placeholderTextColor={theme.colors.onSurfaceVariant ?? theme.colors.onSurface}
              value={ex.name}
              onChangeText={t => updateExercise(ex.id, 'name', t)}
            />

            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={[styles.label, { color: theme.colors.onSurface }]}>Sets</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.onSurface, borderColor: theme.colors.outline }]}
                  keyboardType="number-pad"
                  value={String(ex.sets)}
                  onChangeText={t => updateExercise(ex.id, 'sets', Math.max(0, Number(t) || 0))}
                />
              </View>
              <View style={styles.half}>
                <Text style={[styles.label, { color: theme.colors.onSurface }]}>Reps</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.onSurface, borderColor: theme.colors.outline }]}
                  keyboardType="number-pad"
                  placeholder="Optional"
                  placeholderTextColor={theme.colors.onSurfaceVariant ?? theme.colors.onSurface}
                  value={ex.reps != null ? String(ex.reps) : ''}
                  onChangeText={t => updateExercise(ex.id, 'reps', t ? Number(t) : undefined)}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={[styles.label, { color: theme.colors.onSurface }]}>Weight (kg)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.onSurface, borderColor: theme.colors.outline }]}
                  keyboardType="numeric"
                  placeholder="Optional"
                  placeholderTextColor={theme.colors.onSurfaceVariant ?? theme.colors.onSurface}
                  value={ex.weight != null ? String(ex.weight) : ''}
                  onChangeText={t => updateExercise(ex.id, 'weight', t ? Number(t) : undefined)}
                />
              </View>
              <View style={styles.half}>
                <Text style={[styles.label, { color: theme.colors.onSurface }]}>Duration (min)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.onSurface, borderColor: theme.colors.outline }]}
                  keyboardType="numeric"
                  placeholder="Optional"
                  placeholderTextColor={theme.colors.onSurfaceVariant ?? theme.colors.onSurface}
                  value={ex.minutes != null ? String(ex.minutes) : ''}
                  onChangeText={t => updateExercise(ex.id, 'minutes', t ? Number(t) : undefined)}
                />
              </View>
            </View>

            <View style={[styles.segment, { backgroundColor: theme.colors.surface }]}>
              {(['weightlifting', 'calisthenics', 'cardio '] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.segmentBtn, ex.type === t && { backgroundColor: theme.colors.primary }]}
                  onPress={() => updateExercise(ex.id, 'type', t)}
                >
                  <Text style={[styles.segmentTxt, { color: theme.colors.onSurface }, ex.type === t && styles.segmentTxtActive]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.switchRow}>
              <View style={styles.switchItem}>
                <Text style={[styles.switchLabel, { color: theme.colors.onSurface }]}>Warm-up </Text>
                <Switch value={ex.warmup} onValueChange={v => updateExercise(ex.id, 'warmup', v)} />
              </View>
              <View style={styles.switchItem}>
                <Text style={[styles.switchLabel, { color: theme.colors.onSurface }]}>Dropset </Text>
                <Switch value={ex.dropset} onValueChange={v => updateExercise(ex.id, 'dropset', v)} />
              </View>
              <View style={styles.switchItem}>
                <Text style={[styles.switchLabel, { color: theme.colors.onSurface }]}>To failure </Text>
                <Switch value={ex.failure} onValueChange={v => updateExercise(ex.id, 'failure', v)} />
              </View>
            </View>
          </View>
        ))}

        <View style={styles.footerRow}>
          <TouchableOpacity style={[styles.secondaryBtn, { borderColor: theme.colors.outline }]} onPress={addExercise}>
            <Text style={[styles.secondaryBtnTxt, { color: theme.colors.onSurface }]}>+ Add Exercise</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.colors.primary }]} onPress={handleSave} disabled={loading}>
            {loading ? <ActivityIndicator color={theme.colors.onPrimary} /> : <Text style={[styles.primaryBtnTxt, { color: theme.colors.onPrimary }]} >Save Workout</Text>}
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40, paddingTop: 40 },
  header: { fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 18 },
  card: { borderRadius: 14, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 13, marginTop: 10, marginBottom: 6 },
  input: { paddingVertical: Platform.OS === 'ios' ? 12 : 8, paddingHorizontal: 12, borderRadius: 10, fontSize: 15, borderWidth: 1, },
  row: { flexDirection: 'row', gap: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  half: { flex: 1, marginRight: 8 },
  removeBtn: { color: '#ef4444', fontWeight: '700' },
  segment: { flexDirection: 'row', borderRadius: 10, marginTop: 12, overflow: 'hidden' },
  segmentBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', paddingLeft: 6, paddingRight: 6 },
  segmentActive: { backgroundColor: '#2563eb' },
  segmentTxt: { fontSize: 13 },
  segmentTxtActive: { color: '#fff', fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  switchItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  switchLabel: { fontSize: 13 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  primaryBtn: { paddingVertical: 14, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center', flex: 1 },
  primaryBtnTxt: { fontWeight: '800', fontSize: 15 },
  secondaryBtn: { borderRadius: 12, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnTxt: { fontWeight: '700' },
});