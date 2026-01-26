import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, Vibration, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { ChevronLeft, Play, Pause, Check, Trophy, Flame, Timer, Target, Weight, Volume2, VolumeX } from 'lucide-react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from '../../../lib/supabase';

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
const ALARM_SETTINGS_KEY = 'alarmSettings';
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const workoutSlugFromFields = (name: string, createdAt: string) => `${slugify(name)}-${new Date(createdAt).getTime()}`;





const raresound = require('../../../assets/Trumpsinging.mp3');

function formatTime(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

interface SoundToggleProps {
  soundEnabled: boolean;
  onToggle: () => void;
  theme: any;
}

const SoundToggleButton: React.FC<SoundToggleProps> = ({ soundEnabled, onToggle, theme }) => (
  <TouchableOpacity
    onPress={onToggle}
    style={[
      styles.soundToggleButton,
      {
        backgroundColor: soundEnabled ? theme.colors.primary + '15' : theme.colors.surfaceVariant,
        borderColor: soundEnabled ? theme.colors.primary : theme.colors.outline
      }
    ]}
  >
    {soundEnabled ? (
      <Volume2 size={18} color={theme.colors.primary} />
    ) : (
      <VolumeX size={18} color={theme.colors.onSurfaceVariant} />
    )}
  </TouchableOpacity>
);

interface RestToggleProps {
  resting: boolean;
  restRemaining: number;
  onPress: () => void;
  theme: any;
}
const RestToggleButton: React.FC<RestToggleProps> = ({
  resting,
  restRemaining,
  onPress,
  theme,
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={[
      styles.soundToggleButton,
      {
        backgroundColor: resting
          ? theme.colors.primary + '20'
          : theme.colors.surfaceVariant,
        borderColor: resting
          ? theme.colors.primary
          : theme.colors.outline,
      },
    ]}
  >
    <Timer
      size={18}
      color={resting ? theme.colors.primary : theme.colors.onSurfaceVariant}
    />
  </TouchableOpacity>
);



export default function StartWorkoutScreen() {
  const DEBUG_FORCE_EASTER_EGG = false;

  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const theme = useTheme();
  const [workoutStartTime, setWorkoutStartTime] = useState<number | null>(null);
  const [restStartTime, setRestStartTime] = useState<number | null>(null);
  const [initialRestSeconds, setInitialRestSeconds] = useState(0);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);

  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);

  const [defaultRest, setDefaultRest] = useState(90);
  const [restRemaining, setRestRemaining] = useState(0);
  const [resting, setResting] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showSoundTooltip, setShowSoundTooltip] = useState(false);
  const [showRestMenu, setShowRestMenu] = useState(false);
  const [restPaused, setRestPaused] = useState(false);


  
  
  // Configurar notificações
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }, []);

  // Verificar se é a primeira vez que vê o tooltip
  useEffect(() => {
    const checkFirstTime = async () => {
      const hasSeenTooltip = await AsyncStorage.getItem('hasSeenSoundTooltip');
      if (!hasSeenTooltip) {
        setShowSoundTooltip(true);
        setTimeout(() => setShowSoundTooltip(false), 3000);
        await AsyncStorage.setItem('hasSeenSoundTooltip', 'true');
      }
    };
    checkFirstTime();
  }, []);



  // Função para tocar alarme do dispositivo
  const playDeviceAlarm = async () => {
    try {
      console.log("📱 Tocando alarme do dispositivo...");

      // Solicitar permissões para notificações
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log("❌ Permissão de notificações não concedida");
        throw new Error('Notification permission not granted');
      }

      // Criar uma notificação com som padrão
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "⏰ Rest Time Complete!",
          body: "Time to start your next set! 💪",
          sound: 'default', // Usa o som padrão do dispositivo
          priority: Notifications.AndroidNotificationPriority.HIGH,
          data: { type: 'workout_timer' },
        },
        trigger: null, // Imediato
      });

      // Vibrar também
      Vibration.vibrate([0, 1000, 500, 1000]);

    } catch (e) {
      console.error('❌ Failed to play device alarm', e);
      throw e;
    }
  };

  // Função para tocar alarme da aplicação
  const playAppAlarm = async () => {
    try {
      console.log("📱 Tocando alarme da aplicação...");

      const isEasterEgg = DEBUG_FORCE_EASTER_EGG || Math.floor(Math.random() * 7000) === 0;
      console.log("🎲 Easter egg?", isEasterEgg);

      const soundFile = isEasterEgg
        ? raresound
        : require('../../../assets/hold-up-tiktok.mp3');

      console.log("📁 Carregando arquivo:", soundFile);

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
      console.error('❌ Failed to play app alarm', e);
      throw e;
    }
  };

  const playAlarm = useCallback(async (soundEnabled: boolean) => {
    try {
      if (!soundEnabled) {
        Vibration.vibrate([500, 500, 500]);
        return;
      }

      const alarmSettings = await AsyncStorage.getItem(ALARM_SETTINGS_KEY);
      const useDeviceAlarm = alarmSettings
        ? JSON.parse(alarmSettings).useDeviceAlarm
        : false;

      if (useDeviceAlarm) {
        await playDeviceAlarm();
      } else {
        await playAppAlarm();
      }
    } catch (e) {
      console.error('❌ Failed to play alarm', e);
      Vibration.vibrate([0, 1000, 500, 1000, 500, 1000]);
    }
  }, []);

  const [completed, setCompleted] = useState<Record<number, Record<number, boolean>>>({});
  const [sessionWeights, setSessionWeights] = useState<Record<number, Record<number, string>>>({});
  const [sessionReps, setSessionReps] = useState<Record<number, Record<number, string>>>({});

  const loadWorkout = useCallback(async () => {
    try {
      setLoading(true);
      
      // 1. Primeiro tentar buscar no AsyncStorage
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed: Workout[] = raw ? JSON.parse(raw) : [];
      let found = parsed.find(w => workoutSlugFromFields(w.name, w.createdAt) === slug);
      
      if (found) {
        // Encontrado no AsyncStorage
        setWorkout(found);
      } else {
        // 2. Se não encontrou no AsyncStorage, buscar na DB
        console.log('Workout não encontrado localmente, buscando na DB...');
        try {
          const userResp = await supabase.auth.getUser();
          const userId = userResp.data.user?.id;
          
          if (!userId) {
            Alert.alert('Not found', 'Workout not found and user not authenticated.');
            router.back();
            return;
          }
          
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          const isUuid = uuidRegex.test(userId);
          
          // Buscar todos os workouts do utilizador
          let query = supabase
            .from('workouts')
            .select('*')
            .order('created_at', { ascending: false });
          
          if (isUuid) {
            query = query.eq('user_uuid', userId);
          } else {
            query = query.eq('user_id', userId);
          }
          
          const { data, error } = await query;
          
          if (error) {
            console.error('Erro ao buscar workouts da DB:', error);
            Alert.alert('Error', 'Failed to load workout from database.');
            router.back();
            return;
          }
          
          if (data && data.length > 0) {
            // Converter workouts da DB para o formato local
            const dbWorkouts: Workout[] = data.map((w: any) => ({
              name: w.name,
              createdAt: w.created_at || w.createdAt,
              exercises: w.exercises || [],
            }));
            
            // Procurar pelo slug nos workouts da DB
            found = dbWorkouts.find(w => workoutSlugFromFields(w.name, w.createdAt) === slug);
            
            if (found) {
              console.log('Workout encontrado na DB!');
              setWorkout(found);
            } else {
              Alert.alert('Not found', 'Workout not found.');
              router.back();
              return;
            }
          } else {
            Alert.alert('Not found', 'Workout not found.');
            router.back();
            return;
          }
        } catch (dbError) {
          console.error('Erro ao buscar workout da DB:', dbError);
          Alert.alert('Error', 'Failed to load workout from database.');
          router.back();
          return;
        }
      }
      
      if (!found) {
        Alert.alert('Not found', 'Workout not found.');
        router.back();
        return;
      }

      // Initialize session data (para workouts encontrados tanto localmente quanto na DB)
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
      try {
        const savedStartTime = await AsyncStorage.getItem(`@workout_start_${slug}`);
        if (savedStartTime) {
          const startTime = parseInt(savedStartTime, 10);
          setWorkoutStartTime(startTime);
          // Calculate elapsed time from saved start time
          const now = Date.now();
          const elapsedSeconds = Math.floor((now - startTime) / 1000);
          setElapsed(elapsedSeconds);
        }
      } catch (e) {
        console.error('Error loading workout start time:', e);
      }
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadWorkout();
  }, [loadWorkout]);

  useEffect(() => {
    const initializeWorkoutStart = async () => {
      if (running && !workoutStartTime) {
        const start = Date.now();
        setWorkoutStartTime(start);
        try {
          await AsyncStorage.setItem('@workout_start_${slug}', start.toString());
        } catch (e) {
          console.error('Error saving workout start time:', e);
        }
      }
    };
    initializeWorkoutStart();
  }, [running, workoutStartTime, slug]);

  useEffect(() => {
    if (!running || !workoutStartTime) return;

    const calculateElapsed = () => {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - workoutStartTime) / 1000);
      setElapsed(elapsedSeconds);
    };

    calculateElapsed();


    const id = setInterval(calculateElapsed, 1000);
    return () => clearInterval(id);
  }, [running, workoutStartTime]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && running && workoutStartTime) {
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - workoutStartTime) / 1000);
        setElapsed(elapsedSeconds);
      }
    });
    return () => subscription.remove();
  }, [running, workoutStartTime]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!resting || restPaused) return;

    if (restRemaining <= 0) {
      setResting(false);
      setRestPaused(false);
      playAlarm(soundEnabled);
      return;
    }

    const id = setInterval(() => {
      setRestRemaining(t => t - 1);
    }, 1000);

    return () => clearInterval(id);
  }, [resting, restPaused, restRemaining, soundEnabled]);

  const togglePause = () => {
    setRunning((p) => {
      const newRunning = !p;
      if (newRunning && workoutStartTime) {
        const now = Date.now();
        const adjustedStartTime = now - (elapsed * 1000);
        setWorkoutStartTime(adjustedStartTime);
        AsyncStorage.setItem(`@workout_start_${slug}`, adjustedStartTime.toString()).catch(e =>
          console.error('Error saving adjusted start time:', e)
        );
      }
      return newRunning;
    });
  };

  const startRest = (secs?: number) => {
    const restSeconds = secs ?? defaultRest;
    setRestRemaining(restSeconds);
    setInitialRestSeconds(restSeconds);
    setRestStartTime(Date.now());
    setRestPaused(false);
    setResting(true);
  };

  const stopRest = () => {
    setResting(false);
    setRestPaused(false);
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

            <View style={styles.headerRightActions}>
              <View style={styles.soundToggleContainer}>
                <SoundToggleButton
                  soundEnabled={soundEnabled}
                  onToggle={() => setSoundEnabled(s => !s)}
                  theme={theme}
                />



                {showSoundTooltip && (
                  <View style={[styles.tooltip, { backgroundColor: theme.colors.primary }]}>
                  </View>
                )}
              </View>

              <View style={styles.headerRightActions}>

                <RestToggleButton
                  resting={resting}
                  restRemaining={restRemaining}
                  theme={theme}
                  onPress={() => {
                    if (resting) {
                      stopRest();
                    } else {
                      setShowRestMenu(s => !s);
                    }
                  }}
                />

                {showRestMenu && !resting && (
                  <View style={[
                    styles.restDropdown,
                    { backgroundColor: theme.colors.surface }
                  ]}>
                    {[30, 60, 90, 120].map(seconds => (
                      <TouchableOpacity
                        key={seconds}
                        style={styles.restOption}
                        onPress={() => {
                          setShowRestMenu(false);
                          startRest(seconds);
                        }}
                      >
                        <Text style={[
                          styles.restOptionText,
                          { color: theme.colors.onSurface }
                        ]}>
                          {seconds}s
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}





              </View>

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
          </View>

          <View style={styles.headerInfo}>
            <View style={styles.workoutTitleRow}>
              <Text style={[styles.workoutTitle, { color: theme.colors.primary }]}>
                {workout.name}
              </Text>

              <View style={styles.timerRow}>

                {/* Timer principal */}
                <View style={[
                  styles.timerBadge,
                  { backgroundColor: theme.colors.primaryContainer }
                ]}>
                  <Timer size={16} color={theme.colors.onPrimaryContainer} />
                  <Text style={[styles.timerText, { color: theme.colors.onPrimaryContainer }]}>
                    {formatTime(elapsed)}
                  </Text>
                </View>

                {/* Mini Rest Timer */}
                {resting && (
                  <TouchableOpacity
                    onPress={() => setRestPaused(p => !p)}
                    style={[
                      styles.miniRestBadge,
                      {
                        backgroundColor: restPaused
                          ? theme.colors.errorContainer
                          : theme.colors.secondaryContainer
                      }
                    ]}
                  >
                    {restPaused ? (
                      <Pause size={14} color={theme.colors.onErrorContainer} />
                    ) : (
                      <Timer size={14} color={theme.colors.onSecondaryContainer} />
                    )}

                    <Text
                      style={[
                        styles.miniRestText,
                        {
                          color: restPaused
                            ? theme.colors.onErrorContainer
                            : theme.colors.onSecondaryContainer
                        }
                      ]}
                    >
                      {formatTime(restRemaining)}
                    </Text>
                  </TouchableOpacity>
                )}

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
                                borderColor: isCompleted ? theme.colors.primary : theme.colors.outline
                              }
                            ]}
                            placeholder="kg"
                            keyboardType="numeric"
                            value={currentWeight}
                            placeholderTextColor={theme.colors.onSurfaceVariant}
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
                            placeholderTextColor={theme.colors.onSurfaceVariant}
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
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  soundToggleContainer: {
    position: 'relative',
  },
  soundToggleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  tooltip: {
    position: 'absolute',
    top: 45,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    zIndex: 1000,
  },
  tooltipText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
    marginLeft: -21,
  },
  backButtonText: {
    fontSize: 17,
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
    margin: 10,
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
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  miniRestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },

  miniRestText: {
    fontSize: 12,
    fontWeight: '700',
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
    marginRight: 12.9,
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

  restDropdown: {
    position: 'absolute',
    top: 48,
    right: 0,
    borderRadius: 12,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 2000,
  },

  restOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  restOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },


  // Rest Panel
  restPanel: {
    margin: 10,
    padding: 17,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  restHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  restLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    opacity: 0.8,
  },
  restTime: {
    fontWeight: '700',
    letterSpacing: 1,
  },
  restControls: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  restButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 48,
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
  restQuickButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  quickButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  quickButtonText: {
    fontSize: 14,
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
    color: '#ffffff',
  },
});