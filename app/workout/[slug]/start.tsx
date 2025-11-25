import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, Vibration, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { ChevronLeft, Play, Pause, Check, Trophy, Flame, Timer, Target, Settings, Weight, Clock, Plus, Volume2, VolumeX } from 'lucide-react-native';

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

const raresound = require('../../../assets/Trumpsinging.mp3');

function formatTime(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function StartWorkoutScreen() {
  const DEBUG_FORCE_EASTER_EGG = false;

  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const theme = useTheme();

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);

  const [defaultRest, setDefaultRest] = useState(90);
  const [restRemaining, setRestRemaining] = useState(0);
  const [resting, setResting] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const playAlarm = useCallback(async () => {
  if (!soundEnabled) {
    console.log("🔇 Som desativado — alarme silencioso");
    Vibration.vibrate([500, 500, 500]);
    return;
  }

  try {
    console.log("🔊 Tentando tocar alarme...");
    
    const isEasterEgg = DEBUG_FORCE_EASTER_EGG || Math.floor(Math.random() * 7000) === 0;
    console.log("🎲 Easter egg?", isEasterEgg);

    const soundFile = isEasterEgg
      ? raresound
      : require('../../../assets/hold-up-tiktok.mp3');

    console.log("📁 Carregando arquivo:", soundFile);
    
    // PARA TESTE - força um som que sabemos que existe
    const { sound } = await Audio.Sound.createAsync(
      require('../../../assets/hold-up-tiktok.mp3')
    );
    
    console.log("▶️ Reproduzindo som...");
    await sound.playAsync();
    
    // Vibrar também
    Vibration.vibrate([0, 1000, 500, 1000]);

    // Parar após 5 segundos
    setTimeout(async () => {
      console.log("⏹️ Parando som...");
      await sound.stopAsync();
      await sound.unloadAsync();
    }, 5000);

  } catch (e) {
    console.error('❌ Failed to play alarm', e);
    // Fallback - vibrar apenas
    Vibration.vibrate([0, 1000, 500, 1000, 500, 1000]);
  }
}, [soundEnabled]);


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

      // Initialize session data
      const w: Record<number, Record<number, string>> = {};
      const r: Record<number, Record<number, string>> = {};
      const c: Record<number, Record<number, boolean>> = {};
      
      found.exercises.forEach((ex, ei) => {
        w[ei] = {};
        r[ei] = {};
        c[ei] = {};
        const sets = ex.sets || 0;
        for (let si = 0; si < sets; si++) {
          w[ei][si] = ex.weight?.toString() ?? '';
          r[ei][si] = ex.reps?.toString() ?? '';
          c[ei][si] = false;
        }
      });
      setSessionWeights(w);
      setSessionReps(r);
      setCompleted(c);
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

  const stopRest = () => {
    setResting(false);
    setRestRemaining(0);
  };

  const markSetDone = (ei: number, si: number) => {
    setCompleted((prev) => ({
      ...prev,
      [ei]: { 
        ...(prev[ei] || {}), 
        [si]: !prev?.[ei]?.[si] 
      },
    }));
    
    const afterToggleIsDone = !(completed?.[ei]?.[si]);
    if (afterToggleIsDone) {
      startRest();
    }
  };

  const finishWorkout = async () => {
    setRunning(false);
    stopRest();
    
    // Save workout progress
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const workouts: Workout[] = raw ? JSON.parse(raw) : [];
      const workoutIndex = workouts.findIndex(w => 
        workoutSlugFromFields(w.name, w.createdAt) === slug
      );
      
      if (workoutIndex !== -1) {
        // Update the workout with session data if needed
        const updatedWorkout = { ...workouts[workoutIndex] };
        workouts[workoutIndex] = updatedWorkout;
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(workouts));
      }
    } catch (error) {
      console.error('Error saving workout progress:', error);
    }

    Alert.alert(
      'Workout Completed!', 
      `Great job! You finished in ${formatTime(elapsed)}.`,
      [
        { 
          text: 'Back to Details', 
          onPress: () => router.back() 
        }
      ]
    );
  };

  const totalSets = workout?.exercises.reduce((acc, ex) => acc + ex.sets, 0) || 0;
  const completedSets = Object.values(completed).reduce((acc, exercise) => 
    acc + Object.values(exercise).filter(Boolean).length, 0
  );
  const progressPercentage = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;
  const allSetsCompleted = completedSets === totalSets && totalSets > 0;

  if (loading || !workout) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.onSurface }}>Loading workout...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <TouchableOpacity 
              onPress={() => router.back()} 
              style={styles.backButton}
            >
              <ChevronLeft size={20} color={theme.colors.primary} />
              <Text style={[styles.backButtonText, { color: theme.colors.primary }]}>
                Back
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={togglePause}
              style={[styles.pauseButton, { backgroundColor: theme.colors.surfaceVariant }]}
            >
              {running ? (
                <>
                  <Pause size={16} color={theme.colors.primary} />
                  <Text style={[styles.pauseText, { color: theme.colors.primary }]}>
                    Pause
                  </Text>
                </>
              ) : (
                <>
                  <Play size={16} color={theme.colors.primary} />
                  <Text style={[styles.pauseText, { color: theme.colors.primary }]}>
                    Resume
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.headerInfo}>
            <View style={styles.workoutTitleRow}>
              <Text style={[styles.workoutTitle, { color: theme.colors.primary }]}>
                {workout.name}
              </Text>
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

      {/* Rest Timer Panel - Improved Design */}
      <View style={[styles.restPanel, { backgroundColor: theme.colors.surface }]}>
        {/* Informação da pausa */}
        <View style={styles.restInfo}>
          <Text style={[styles.restLabel, { color: theme.colors.onSurface }]}>
            Rest Timer
          </Text>
          <Text style={[
            styles.restTime, 
            { 
              color: resting ? theme.colors.primary : theme.colors.onSurfaceVariant 
            }
          ]}>
            {resting ? formatTime(restRemaining) : "--:--"}
          </Text>
        </View>

        {/* Controles */}
        <View style={styles.restControls}>
          <TouchableOpacity
            style={[
              styles.restButton,
              styles.secondaryButton,
              { 
                borderColor: theme.colors.outline,
                backgroundColor: soundEnabled ? theme.colors.primary + '20' : 'transparent'
              }
            ]}
            onPress={() => setSoundEnabled((s) => !s)}
          >
            {soundEnabled ? (
              <Volume2 size={16} color={theme.colors.primary} />
            ) : (
              <VolumeX size={16} color={theme.colors.onSurface} />
            )}
            <Text style={[
              styles.restButtonText, 
              { 
                color: soundEnabled ? theme.colors.primary : theme.colors.onSurface 
              }
            ]}>
              {soundEnabled ? "Sound ON" : "Sound OFF"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.restButton, 
              { 
                backgroundColor: resting ? theme.colors.secondary : theme.colors.primary,
                opacity: resting ? 0.7 : 1
              }
            ]}
            onPress={resting ? stopRest : () => startRest()}
            disabled={resting}
          >
            {resting ? (
              <>
                <Pause size={16} color={theme.colors.onPrimary} />
                <Text style={[styles.restButtonText, { color: theme.colors.onPrimary }]}>
                  Resting...
                </Text>
              </>
            ) : (
              <>
                <Play size={16} color={theme.colors.onPrimary} />
                <Text style={[styles.restButtonText, { color: theme.colors.onPrimary }]}>
                  Start Rest
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.restButton,
              styles.secondaryButton,
              { 
                borderColor: theme.colors.outline,
                opacity: resting ? 1 : 0.5
              }
            ]}
            onPress={stopRest}
            disabled={!resting}
          >
            <Text style={[styles.restButtonText, { color: theme.colors.onSurface }]}>
              Stop
            </Text>
          </TouchableOpacity>
        </View>

        {/* Ajuste do tempo padrão */}
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
                borderColor: theme.colors.outline,
              }
            ]}
            keyboardType="numeric"
            value={String(defaultRest)}
            onChangeText={(t) => {
              const value = parseInt(t.replace(/[^0-9]/g, '') || '0');
              setDefaultRest(Math.max(0, Math.min(999, value)));
            }}
            maxLength={3}
            editable={!resting}
          />
        </View>
      </View>

      {/* Exercises List */}
      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {workout.exercises.map((ex, ei) => {
          const exerciseCompleted = Object.values(completed[ei] || {}).filter(Boolean).length === ex.sets;
          const completedSetsCount = Object.values(completed[ei] || {}).filter(Boolean).length;
          
          return (
            <View
              key={ex.id ?? ei}
              style={[
                styles.card,
                { 
                  backgroundColor: theme.colors.surface,
                  borderColor: exerciseCompleted ? '#22c55e' : theme.colors.outline,
                  borderWidth: exerciseCompleted ? 2 : 1,
                }
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.exerciseHeader}>
                  <View style={[
                    styles.exerciseNumber,
                    { 
                      backgroundColor: exerciseCompleted ? '#22c55e' : theme.colors.primary,
                      transform: [{ scale: exerciseCompleted ? 1.1 : 1 }]
                    }
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
                        {completedSetsCount}/{ex.sets} sets • {ex.reps || '--'} reps
                      </Text>
                      {ex.weight && ex.weight > 0 && (
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
              {(ex.warmup || ex.failure || ex.dropset) && (
                <View style={styles.flagRow}>
                  {ex.warmup && (
                    <View style={[styles.flag, { backgroundColor: '#3b82f6' }]}>
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
              )}

              {/* Sets Grid */}
              <View style={styles.setsGrid}>
                {Array.from({ length: ex.sets }).map((_, si) => {
                  const isCompleted = completed?.[ei]?.[si];
                  const currentWeight = sessionWeights?.[ei]?.[si] ?? ex.weight?.toString() ?? '';
                  const currentReps = sessionReps?.[ei]?.[si] ?? ex.reps?.toString() ?? '';
                  
                  return (
                    <TouchableOpacity
                      key={si}
                      style={[
                        styles.setButton,
                        { 
                          borderColor: isCompleted ? theme.colors.primary : theme.colors.outline,
                          backgroundColor: isCompleted ? theme.colors.primary + '20' : theme.colors.surface
                        },
                        isCompleted && styles.setButtonCompleted
                      ]}
                      onPress={() => markSetDone(ei, si)}
                    >
                      <View style={styles.setContent}>
                        <View style={[
                          styles.setIndicator,
                          { 
                            backgroundColor: isCompleted ? theme.colors.primary : 'transparent',
                            borderColor: isCompleted ? theme.colors.primary : theme.colors.outline
                          }
                        ]}>
                          {isCompleted && <Check size={12} color="#ffffff" />}
                        </View>
                        <Text style={[
                          styles.setLabel,
                          { 
                            color: isCompleted ? theme.colors.primary : theme.colors.onSurfaceVariant 
                          }
                        ]}>
                          Set {si + 1}
                        </Text>
                      </View>
                      
                      <View style={styles.setInputs}>
                        <View style={styles.inputContainer}>
                          <Text style={[styles.inputLabel, { color: theme.colors.onSurfaceVariant }]}>
                            Weight
                          </Text>
                          <TextInput
                            style={[
                              styles.setInput,
                              { 
                                backgroundColor: theme.colors.surface,
                                color: theme.colors.onSurface,
                                borderColor: isCompleted ? theme.colors.primary : theme.colors.outline
                              }
                            ]}
                            placeholder="kg"
                            keyboardType="numeric"
                            value={currentWeight}
                            onChangeText={(t) => {
                              const filtered = t.replace(/[^0-9]/g, '');
                              setSessionWeights((prev) => ({
                                ...prev,
                                [ei]: { ...(prev[ei] || {}), [si]: filtered },
                              }));
                            }}
                            maxLength={3}
                          />
                        </View>
                        
                        <View style={styles.inputContainer}>
                          <Text style={[styles.inputLabel, { color: theme.colors.onSurfaceVariant }]}>
                            Reps
                          </Text>
                          <TextInput
                            style={[
                              styles.setInput,
                              { 
                                backgroundColor: theme.colors.surface,
                                color: theme.colors.onSurface,
                                borderColor: isCompleted ? theme.colors.primary : theme.colors.outline
                              }
                            ]}
                            placeholder="reps"
                            keyboardType="numeric"
                            value={currentReps}
                            onChangeText={(t) => {
                              const filtered = t.replace(/[^0-9]/g, '');
                              setSessionReps((prev) => ({
                                ...prev,
                                [ei]: { ...(prev[ei] || {}), [si]: filtered },
                              }));
                            }}
                            maxLength={2}
                          />
                        </View>
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
          <Text style={styles.completionText}>
            Amazing Work! You've completed all exercises! 🎉
          </Text>
        </View>
      )}

      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity
          style={[
            styles.finishButton,
            { 
              backgroundColor: allSetsCompleted ? '#22c55e' : theme.colors.primary,
              transform: [{ scale: allSetsCompleted ? 1.02 : 1 }]
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
  container: { 
    flex: 1,
  },
  centered: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  
  // Header
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
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
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  pauseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  pauseText: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerInfo: {
    gap: 16,
  },
  workoutTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  workoutTitle: {
    fontSize: 28,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  timerText: {
    fontSize: 14,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 20,
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
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
  },

  // Rest Panel - Improved
  restPanel: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  restInfo: {
    alignItems: 'center',
  },
  restLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    opacity: 0.8,
  },
  restTime: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 1,
  },
  restControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  restButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    flex: 1,
    minHeight: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  restButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  restAdjust: {
    alignItems: 'center',
    marginTop: 8,
  },
  smallLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
    opacity: 0.7,
  },
  restInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: 80,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },

  // Content
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
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
  exerciseNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  exerciseNumberText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  exerciseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  exerciseMetaText: {
    fontSize: 15,
    fontWeight: '500',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  completedBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },

  // Flags
  flagRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  flag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  flagText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },

  // Sets
  setsGrid: {
    gap: 12,
  },
  setButton: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  setButtonCompleted: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  setContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  setIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setLabel: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  setInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  inputContainer: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
    marginLeft: 4,
  },
  setInput: {
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Completion Banner
  completionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 20,
    margin: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  completionText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
    flex: 1,
    textAlign: 'center',
  },

  // Footer
  footer: {
    padding: 20,
    paddingBottom: 34,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  finishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  footerButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
});