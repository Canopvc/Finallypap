import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, Vibration, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { ChevronLeft, Play, Pause, Check, Trophy, Flame, Timer, Target, Settings, Weight, Clock, Plus } from 'lucide-react-native';

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

type Registro = {
  id: number;
  data: string;
  texto: string;
}

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
      const isEasterEgg = DEBUG_FORCE_EASTER_EGG || Math.floor(Math.random() * 7000) === 0;

      console.log('🔊 DEBUG_FORCE_EASTER_EGG:', DEBUG_FORCE_EASTER_EGG);
      console.log('🎲 Random result:', Math.floor(Math.random() * 10));
      console.log('🔥 Easter egg activated:', isEasterEgg);

      const soundFile = isEasterEgg
        ? raresound
        : require('../../../assets/hold-up-tiktok.mp3');

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

  const [texto, setTexto] = useState('');
  const [registos, SetRegistos] = useState<Registro[]>([]);

  useEffect(() => {
    carregarRegistos();
  }, []);

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);

  const [defaultRest, setDefaultRest] = useState(90);
  const [restRemaining, setRestRemaining] = useState(0);
  const [resting, setResting] = useState(false);

  const [completed, setCompleted] = useState<Record<number, Record<number, boolean>>>({});
  const [sessionWeights, setSessionWeights] = useState<Record<number, Record<number, string>>>({});
  const [sessionReps, setSessionReps] = useState<Record<number, Record<number, string>>>({});

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

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!resting) return;
    if (restRemaining <= 0) {
      setResting(false);
      playAlarm();
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
    const afterToggleIsDone = !(completed?.[ei]?.[si]);
    if (afterToggleIsDone) startRest();
  };

  const finishWorkout = () => {
    Alert.alert('Finish workout?', 'This will stop the timer and return to details.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Finish', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  const totalSets = workout?.exercises.reduce((acc, ex) => acc + ex.sets, 0) || 0;
  const completedSets = Object.values(completed).reduce((acc, exercise) => 
    acc + Object.values(exercise).filter(Boolean).length, 0
  );
  const progressPercentage = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;
  const allSetsCompleted = completedSets === totalSets && totalSets > 0;

  async function carregarRegistos() {
    try {
      const dados = await AsyncStorage.getItem('registos');
      if (dados) SetRegistos(JSON.parse(dados));
    } catch (error) {
      console.log('Erro ao carregar registos:', error);
    }
  }

  async function guardarRegisto() {
    if (!texto.trim()) {
      Alert.alert('Erro', 'O registo não pode estar vazio.');
      return;
    }

    const novo = {
      id: Date.now(),
      data: new Date().toISOString().split('T')[0],
      texto: texto.trim(),
    };

    const atualizados = [novo, ...registos];
    SetRegistos(atualizados);

    try {
      await AsyncStorage.setItem('registos', JSON.stringify(atualizados));
      setTexto('');
      Alert.alert('Sucesso', 'Registo guardado com sucesso!');
    } catch (error) {
      console.log('Erro ao guardar registo:', error);
    }
  }

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
            
            <TouchableOpacity
              onPress={togglePause}
              style={[styles.pauseButton, { backgroundColor: theme.colors.surfaceVariant }]}
            >
              {running ? (
                <>
                  <Pause size={16} color={theme.colors.primary} />
                  <Text style={[styles.pauseText, { color: theme.colors.primary }]}>Pause</Text>
                </>
              ) : (
                <>
                  <Play size={16} color={theme.colors.primary} />
                  <Text style={[styles.pauseText, { color: theme.colors.primary }]}>Resume</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.headerInfo}>
            <View style={styles.workoutTitleRow}>
              <Text style={[styles.workoutTitle, { color: theme.colors.primary }]}>{workout.name}</Text>
              <View style={[styles.timerBadge, { backgroundColor: theme.colors.primaryContainer }]}>
                <Timer size={16} color={theme.colors.onPrimaryContainer} />
                <Text style={[styles.timerText, { color: theme.colors.onPrimaryContainer }]}>
                  {formatTime(elapsed)}
                </Text>
              </View>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Target size={16} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}>
                  {completedSets} / {totalSets} sets
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Flame size={16} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}>
                  ~{Math.round((elapsed / 60) * 8)} cal
                </Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={[styles.progressBackground, { backgroundColor: theme.colors.surfaceVariant }]}>
                <View 
                  style={[
                    styles.progressFill, 
                    { 
                      width: `${progressPercentage}%`,
                      backgroundColor: theme.colors.primary 
                    }
                  ]} 
                />
              </View>
              <Text style={[styles.progressText, { color: theme.colors.onSurfaceVariant }]}>
                {Math.round(progressPercentage)}% complete
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Rest Timer Panel */}
      <View style={[styles.restPanel, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.restInfo}>
          <Text style={[styles.restLabel, { color: theme.colors.onSurface }]}>Rest Timer</Text>
          <Text style={[styles.restTime, { color: theme.colors.primary }]}>
            {resting ? formatTime(restRemaining) : '--:--'}
          </Text>
        </View>

        <View style={styles.restControls}>
          <TouchableOpacity
            style={[styles.restButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => startRest()}
          >
            <Play size={16} color={theme.colors.onPrimary} />
            <Text style={[styles.restButtonText, { color: theme.colors.onPrimary }]}>Start</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.restButton, styles.secondaryButton, { borderColor: theme.colors.outline }]}
            onPress={() => {
              setResting(false);
              setRestRemaining(0);
            }}
          >
            <Text style={[styles.restButtonText, { color: theme.colors.onSurface }]}>Stop</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.restAdjust}>
          <Text style={[styles.smallLabel, { color: theme.colors.onSurfaceVariant }]}>
            Default Rest (s)
          </Text>
          <TextInput
            style={[
              styles.restInput,
              { 
                backgroundColor: theme.colors.surface,
                color: theme.colors.onSurface,
                borderColor: theme.colors.outline
              }
            ]}
            keyboardType="numeric"
            value={String(defaultRest)}
            onChangeText={(t) => setDefaultRest(Math.max(0, parseInt(t || '0')))}
          />
        </View>
      </View>

      {/* Exercises List */}
      <ScrollView contentContainerStyle={styles.content}>
        {workout.exercises.map((ex, ei) => {
          const exerciseCompleted = Object.values(completed[ei] || {}).filter(Boolean).length === ex.sets;
          
          return (
            <View
              key={ex.id ?? ei}
              style={[
                styles.card,
                { 
                  backgroundColor: theme.colors.surface,
                  borderColor: exerciseCompleted ? '#22c55e' : theme.colors.outline
                }
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.exerciseHeader}>
                  <View style={[
                    styles.exerciseNumber,
                    { backgroundColor: exerciseCompleted ? '#22c55e' : theme.colors.primary }
                  ]}>
                    {exerciseCompleted ? (
                      <Check size={16} color="#ffffff" />
                    ) : (
                      <Text style={styles.exerciseNumberText}>{ei + 1}</Text>
                    )}
                  </View>
                  <View style={styles.exerciseInfo}>
                    <Text style={[styles.exerciseTitle, { color: theme.colors.onSurface }]}>
                      {ex.name}
                    </Text>
                    <View style={styles.exerciseMeta}>
                      <Text style={[styles.exerciseMetaText, { color: theme.colors.onSurfaceVariant }]}>
                        {ex.sets} × {ex.reps || '--'}
                      </Text>
                      {ex.weight && (
                        <View style={[styles.badge, { backgroundColor: theme.colors.surfaceVariant }]}>
                          <Weight size={12} color={theme.colors.onSurfaceVariant} />
                          <Text style={[styles.badgeText, { color: theme.colors.onSurfaceVariant }]}>
                            {ex.weight}kg
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {exerciseCompleted && (
                  <View style={[styles.completedBadge, { backgroundColor: '#22c55e' }]}>
                    <Check size={12} color="#ffffff" />
                    <Text style={styles.completedBadgeText}>Done</Text>
                  </View>
                )}
              </View>

              {/* Flags */}
              <View style={styles.flagRow}>
                {ex.warmup && (
                  <View style={[styles.flag, { backgroundColor: theme.colors.primary }]}>
                    <Text style={styles.flagText}>Warmup</Text>
                  </View>
                )}
                {ex.failure && (
                  <View style={[styles.flag, { backgroundColor: '#ef4444' }]}>
                    <Text style={styles.flagText}>Failure</Text>
                  </View>
                )}
                {ex.dropset && (
                  <View style={[styles.flag, { backgroundColor: '#9333ea' }]}>
                    <Text style={styles.flagText}>Dropset</Text>
                  </View>
                )}
              </View>

              {/* Sets Grid */}
              <View style={styles.setsGrid}>
                {Array.from({ length: ex.sets }).map((_, si) => {
                  const isCompleted = completed?.[ei]?.[si];
                  
                  return (
                    <TouchableOpacity
                      key={si}
                      style={[
                        styles.setButton,
                        { borderColor: theme.colors.outline },
                        isCompleted && [styles.setButtonCompleted, { backgroundColor: theme.colors.primary }]
                      ]}
                      onPress={() => markSetDone(ei, si)}
                    >
                      <View style={styles.setContent}>
                        {isCompleted ? (
                          <Check size={20} color="#ffffff" />
                        ) : (
                          <View style={[styles.setCircle, { borderColor: theme.colors.outline }]} />
                        )}
                        <Text style={[
                          styles.setLabel,
                          { color: theme.colors.onSurfaceVariant },
                          isCompleted && styles.setLabelCompleted
                        ]}>
                          Set {si + 1}
                        </Text>
                      </View>
                      
                      <View style={styles.setInputs}>
                        <TextInput
                          style={[
                            styles.setInput,
                            { 
                              backgroundColor: theme.colors.surface,
                              color: theme.colors.onSurface,
                              borderColor: theme.colors.outline
                            }
                          ]}
                          placeholder="kg"
                          keyboardType="numeric"
                          value={sessionWeights?.[ei]?.[si] ?? ''}
                          onChangeText={(t) =>
                            setSessionWeights((prev) => ({
                              ...prev,
                              [ei]: { ...(prev[ei] || {}), [si]: t },
                            }))
                          }
                        />
                        <TextInput
                          style={[
                            styles.setInput,
                            { 
                              backgroundColor: theme.colors.surface,
                              color: theme.colors.onSurface,
                              borderColor: theme.colors.outline
                            }
                          ]}
                          placeholder="reps"
                          keyboardType="numeric"
                          value={sessionReps?.[ei]?.[si] ?? ''}
                          onChangeText={(t) =>
                            setSessionReps((prev) => ({
                              ...prev,
                              [ei]: { ...(prev[ei] || {}), [si]: t },
                            }))
                          }
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Completion Banner */}
      {allSetsCompleted && (
        <View style={[styles.completionBanner, { backgroundColor: '#22c55e' }]}>
          <Trophy size={20} color="#ffffff" />
          <Text style={styles.completionText}>Amazing Work! You've completed all exercises! 🎉</Text>
        </View>
      )}

      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.footerLabel, { color: theme.colors.onSurface }]}>
          How did you feel about this workout?
        </Text>

        <TextInput
          style={[
            styles.textInput,
            { 
              backgroundColor: theme.colors.background,
              color: theme.colors.onSurface,
              borderColor: theme.colors.outline
            }
          ]}
          placeholder="Write your thoughts here..."
          value={texto}
          onChangeText={setTexto}
          multiline
          numberOfLines={3}
        />

        <TouchableOpacity
          style={[styles.footerButton, { backgroundColor: theme.colors.primary }]}
          onPress={guardarRegisto}
        >
          <Text style={[styles.footerButtonText, { color: theme.colors.onPrimary }]}>
            Save Note
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.footerButton,
            styles.finishButton,
            { 
              backgroundColor: allSetsCompleted ? '#22c55e' : theme.colors.primary
            }
          ]}
          onPress={finishWorkout}
        >
          {allSetsCompleted ? (
            <>
              <Trophy size={20} color="#ffffff" />
              <Text style={[styles.footerButtonText, { color: '#ffffff' }]}>
                Finish Workout
              </Text>
            </>
          ) : (
            <>
              <Check size={20} color="#ffffff" />
              <Text style={[styles.footerButtonText, { color: '#ffffff' }]}>
                Complete Workout
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  
  // Header
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
  pauseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  pauseText: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerInfo: {
    gap: 12,
  },
  workoutTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workoutTitle: {
    fontSize: 24,
    fontWeight: '700',
    flex: 1,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  timerText: {
    fontSize: 14,
    fontWeight: '600',
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
  progressContainer: {
    gap: 8,
  },
  progressBackground: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    textAlign: 'right',
  },

  // Rest Panel
  restPanel: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  restInfo: {
    flex: 1,
  },
  restLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  restTime: {
    fontSize: 24,
    fontWeight: '700',
  },
  restControls: {
    flexDirection: 'row',
    gap: 8,
  },
  restButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  restButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  restAdjust: {
    alignItems: 'center',
  },
  smallLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  restInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 60,
    textAlign: 'center',
    fontSize: 14,
  },

  // Content
  content: {
    padding: 16,
    paddingBottom: 20,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
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
    marginBottom: 12,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  exerciseNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseNumberText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  exerciseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exerciseMetaText: {
    fontSize: 14,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  completedBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },

  // Flags
  flagRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  flag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  flagText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },

  // Sets
  setsGrid: {
    gap: 8,
  },
  setButton: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  setButtonCompleted: {
    borderWidth: 0,
  },
  setContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  setCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  setLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  setLabelCompleted: {
    color: '#ffffff',
  },
  setInputs: {
    flexDirection: 'row',
    gap: 8,
  },
  setInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
    textAlign: 'center',
  },

  // Completion Banner
  completionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    margin: 16,
    borderRadius: 12,
  },
  completionText: {
    color: '#ffffff',
    fontWeight: '600',
    flex: 1,
  },

  // Footer
  footer: {
    padding: 16,
    gap: 12,
  },
  footerLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  finishButton: {
    marginTop: 8,
  },
  footerButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});