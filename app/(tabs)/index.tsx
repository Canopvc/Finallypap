import React, { useCallback, useState, useEffect, useRef } from 'react';
import { Image } from 'expo-image';
import {
  Platform,
  StyleSheet,
  View,
  Text,
  Pressable,
  Button,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  useColorScheme,
  Vibration,
  Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { useTheme } from 'react-native-paper';
import * as Pedometer from 'expo-sensors/build/Pedometer';
import { Subscription } from 'expo-sensors/build/Pedometer';
import { Circle, Svg } from 'react-native-svg';

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

// Helper to create a stable slug for navigation based on name + createdAt
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const workoutSlugFromFields = (name: string, createdAt: string) => `${slugify(name)}-${new Date(createdAt).getTime()}`;

export default function HomeScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [expandedName, setExpandedName] = useState<string | null>(null);
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);
  
  // Step counter state
  const [isPedometerAvailable, setIsPedometerAvailable] = useState('checking');
  const [currentStepCount, setCurrentStepCount] = useState(0);
  const STEP_TARGET = 10000;
  const [progress, setProgress] = useState(0);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  // Keep the first step value seen by watchStepCount to compute deltas (Android)
  const initialWatchStepsRef = useRef<number | null>(null);
  const [lastResetDate, setLastResetDate] = useState<string>('');
  
  
  // Update progress when step count changes
  useEffect(() => {
    const newProgress = Math.min(1, currentStepCount / STEP_TARGET);
    setProgress(newProgress);
    saveStepCount(currentStepCount);
  }, [currentStepCount, STEP_TARGET]);

  // Load saved steps and check for day reset on mount
  useEffect(() => {
    const initSteps = async () => {
      const steps = await checkAndResetSteps();
      setCurrentStepCount(steps);
    };
    initSteps();
  }, []);
  
  // Handle pedometer subscription
  useEffect(() => {
    let isMounted = true;
    let baseAtStart = currentStepCount; // baseline to add deltas on Android
    let sub: Subscription | null = null;

    const subscribe = async () => {
      try {
        const isAvailable = await Pedometer.isAvailableAsync();
        if (!isMounted) return;

        console.log('Pedometer available:', isAvailable);
        setIsPedometerAvailable(String(isAvailable));

        if (isAvailable) {
          const end = new Date();
          const start = new Date();
          // Count from today (midnight) instead of last 24h
          start.setHours(0, 0, 0, 0);

          // On iOS, try to fetch steps since midnight. On Android this API is not supported.
          if (Platform.OS === 'ios') {
            try {
              const pastStepCount = await Pedometer.getStepCountAsync(start, end);
              console.log('Past step count:', pastStepCount);
              if (isMounted && pastStepCount) {
                baseAtStart = pastStepCount.steps;
                setCurrentStepCount(prev => Math.max(prev, baseAtStart));
              }
            } catch (error) {
              console.error('Error getting step count:', error);
            }
          }

          // Subscribe to step counter updates (works on both iOS and Android)
          sub = Pedometer.watchStepCount(result => {
            if (!isMounted) return;
            
            console.log('Step count update:', result);
            
            if (initialWatchStepsRef.current === null) {
              initialWatchStepsRef.current = result.steps;
              console.log('Initial step count set to:', initialWatchStepsRef.current);
            }
            
            const delta = Math.max(0, result.steps - (initialWatchStepsRef.current ?? 0));
            const total = baseAtStart + delta;
            
            console.log('Delta:', delta, 'Total steps:', total);
            
            setCurrentStepCount(prev => {
              const newCount = total > prev ? total : prev;
              // Save to storage when steps increase
              if (newCount > prev) {
                saveStepCount(newCount);
              }
              return newCount;
            });
          });

          setSubscription(sub);
        } else {
          console.log('Pedometer not available on this device');
        }
      } catch (error) {
        console.error('Error initializing pedometer:', error);
      }
    };

      // Adiciona um atraso para garantir que o componente esteja montado
    const timer = setTimeout(() => {
      subscribe();
    }, 1000);

    // Configura um intervalo para verificar a mudança de dia a cada hora
    const dayCheckInterval = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        checkAndResetSteps();
      }
    }, 60 * 60 * 1000); // Verifica a cada hora

    return () => {
      isMounted = false;
      clearTimeout(timer);
      clearInterval(dayCheckInterval);
      if (sub && sub.remove) {
        console.log('Removendo assinatura do pedômetro');
        sub.remove();
      } else if (subscription && subscription.remove) {
        console.log('Removendo assinatura existente');
        subscription.remove();
      }
    };
  }, []);
  
  // Load saved step count from storage
  const loadStepCount = async () => {
    try {
      const savedSteps = await AsyncStorage.getItem('@step_count');
      if (savedSteps !== null) {
        setCurrentStepCount(parseInt(savedSteps, 10));
      }
    } catch (error) {
      console.error('Error loading step count:', error);
    }
  };
  
  // Save step count to storage
  const saveStepCount = async (steps: number) => {
    try {
      console.log('Saving step count:', steps);
      await AsyncStorage.setItem('@step_count', steps.toString());
      
      // Also save the current date to check for day changes
      const today = new Date().toDateString();
      await AsyncStorage.setItem('@last_reset_date', today);
      
    } catch (error) {
      console.error('Error saving step count:', error);
    }
  };
  
  // Função para verificar e resetar os passos se for um novo dia
  const checkAndResetSteps = async () => {
    try {
      const today = new Date().toDateString();
      const lastReset = await AsyncStorage.getItem('@last_reset_date');
      
      if (lastReset !== today) {
        // É um novo dia, reseta os passos
        console.log('Novo dia, reiniciando contador de passos');
        await AsyncStorage.setItem('@step_count', '0');
        await AsyncStorage.setItem('@last_reset_date', today);
        setCurrentStepCount(0);
        setProgress(0);
        initialWatchStepsRef.current = null;
        return 0;
      } else {
        // Carrega os passos salvos
        const savedSteps = await AsyncStorage.getItem('@step_count');
        return savedSteps ? parseInt(savedSteps, 10) : 0;
      }
    } catch (error) {
      console.error('Erro ao verificar/reiniciar passos:', error);
      return 0;
    }
  };
  
  // Format number with thousands separator
  const formatNumber = (num: number) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };
  
  // Calculate remaining steps to reach goal
  const remainingSteps = Math.max(0, STEP_TARGET - currentStepCount);
  const theme = useTheme();
  const { width } = Dimensions.get('window');
  const size = width - 60;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - progress * circumference;

  const loadWorkouts = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return setWorkouts([]);
      setWorkouts(parsed);
    } catch (e) {
      console.error(e);
      setWorkouts([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadWorkouts();
    }, [loadWorkouts])
  );

  useEffect(() => {
    registerForPushNotifications();
  }, []);

  async function registerForPushNotifications(){
    const { status } = await Notifications.requestPermissionsAsync();
    if(status !== 'granted'){
      alert('We need your permission to send notifications')
    }
  }

  async function sendNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Remember to drink water",
      body: "Never forget to drink at least 2 liters of water a day",
      data: { data: 'Something just for fun' },
    },
    trigger: {
      type: 'timeInterval',
      seconds: 1,   // dispara praticamente imediatamente
      repeats: false,
    } as Notifications.TimeIntervalTriggerInput,
  });
}


  async function scheduleNotification() {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Lembrete!",
        body: "Não esqueça de treinar hoje 💪",
      },
      trigger: {
        type: 'timeInterval', // obrigatório
        seconds: 10,
        repeats: false,
      } as Notifications.TimeIntervalTriggerInput, // <- casting para TS
    });
  }

  const handleLogout = useCallback(async () => {
    try {
      await AsyncStorage.removeItem('userToken');
      router.replace('/profile');
    } catch (e) {
      Alert.alert('Error', 'Could not log out.');
    }
  }, [router]);

  const toggleExpand = (name: string) => {
    if (expandedName === name) {
      setExpandedName(null);
      setEditingWorkout(null);
    } else {
      const found = workouts.find((w) => w.name === name) ?? null;
      setExpandedName(name);
      setEditingWorkout(found ? { ...found } : null);
    }
  };


  const updateEditingWorkout = (field: keyof Workout, value: any) => {
    if (!editingWorkout) return;
    setEditingWorkout({ ...editingWorkout, [field]: value });
  };

  const updateExercise = (i: number, field: keyof Exercise, value: any) => {
    if (!editingWorkout) return;
    const eps = [...editingWorkout.exercises];
    eps[i] = { ...eps[i], [field]: value };
    setEditingWorkout({ ...editingWorkout, exercises: eps });
  };

  const deleteExercise = (i: number) => {
    if (!editingWorkout) return;
    const eps = editingWorkout.exercises.filter((_, idx) => idx !== i);
    setEditingWorkout({ ...editingWorkout, exercises: eps });
  };

  const saveEditingWorkout = async () => {
    if (!editingWorkout) return;
    const updated = workouts.map((w) =>
      w.name === editingWorkout.name ? editingWorkout : w
    );
    setWorkouts(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setExpandedName(null);
    setEditingWorkout(null);
  };

  const deleteWorkout = async (name: string) => {
    const filtered = workouts.filter((w) => w.name !== name);
    setWorkouts(filtered);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    if (expandedName === name) {
      setExpandedName(null);
      setEditingWorkout(null);
    }
  };

  const renderEmpty = () => (
    <Text style={{ textAlign: 'center', marginTop: 20, color : theme.colors.onSurface }}>
      No workouts saved
    </Text>
  );

  return (

        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.headerContent}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>Fitness Hub</Text>
          <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant ?? theme.colors.onSurface }]}>
            {currentStepCount} steps • target {STEP_TARGET.toLocaleString()}
          </Text>
        </View>
        <Pressable onPress={handleLogout} hitSlop={20}>
          <Image
            source={require('../../assets/images/Settings-Icon.png')}
            style={styles.settingsIcon}
          />
        </Pressable>
      </View>
  
      {/* Progress Circle */}
      <View style={[styles.progressContainer]}>
        <View style={styles.progressWrap}>
          <View style={[styles.progressCircle, { backgroundColor: theme.dark ? '#000' : '#f1f5f9' }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: theme.colors.primary,
                  height: `${Math.min(100, progress * 100)}%`,
                },
              ]}
            />
          </View>
          <View style={styles.progressCenter}>
            <Text style={[styles.progressNumber, { color: theme.colors.onBackground }]}>
              {currentStepCount.toLocaleString()}
            </Text>
            <Text style={[styles.progressLabel, { color: theme.colors.onBackground }]}>
              passos hoje
            </Text>
          </View>
        </View>
        <View style={[styles.progressStats, ]}>
          <View style={[styles.statItem, { backgroundColor: theme.dark ? '#000' : '#fff' }]}>
            <Text style={[styles.statNumber, { color: theme.colors.primary }]}>
              {Math.round(progress * 100)}%
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.onBackground }]}>Goal</Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: theme.dark ? '#000' : '#fff' }]}>
            <Text style={[styles.statNumber, { color: theme.colors.primary }]}>
              {Math.max(0, STEP_TARGET - currentStepCount)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.onBackground }]}>remaining</Text>
          </View>
        </View>
      </View>
      {/* Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => router.push('/addWorkout')}
        >
          <Text style={[styles.addButtonText, { color: theme.colors.onPrimary }]}>+ Add New Workout</Text>
        </TouchableOpacity>
      </View>
      {/* Workout List */}
      <FlatList
        data={workouts}
        keyExtractor={(item: Workout, idx: number) =>
          `${workoutSlugFromFields(item.name, item.createdAt)}`
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={renderEmpty}
        renderItem={({ item }) => (
          <View style={styles.itemWrap}>
            <TouchableOpacity
              style={[styles.workoutItem, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }]}
              onPress={() => {
                const slug = workoutSlugFromFields(item.name, item.createdAt);
                router.push(`/workout/${slug}`);
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.workoutText, { color: theme.colors.onSurface }]}>{item.name}</Text>
                <Text style={[styles.dateText, { color: theme.colors.onSurfaceVariant ?? theme.colors.onSurface }]}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <Text style={[styles.countText, { color: theme.colors.onPrimary, backgroundColor: theme.colors.primary } ] }>
                {item.exercises.length} exercises
              </Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#1a1a1a',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
  },
  title: { color: '#fff', fontSize: 26, fontWeight: '700' },
  subtitle: { color: '#9ca3af', fontSize: 13, marginTop: 4 },
  image: {
    width: 60,
    height: 60,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'white',
  },
  actionsRow: { padding: 20 },
  addButton: {
    backgroundColor: '#D1C802',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonText: {
    color: '#3B3939',
    fontSize: 16,
    fontWeight: '600',
  },
  list: { padding: 20 },
  itemWrap: { marginBottom: 12 },
  workoutItem: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  workoutText: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  dateText: { fontSize: 12, color: '#64748b', marginTop: 4 },
  countText: { 
    fontSize: 12, 
    color: '#06b6d4', 
    marginLeft: 12,
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontWeight: '600',
  },
  editArea: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  exerciseCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#ff4444',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: { color: '#fff', fontWeight: '700' },
  deleteWorkoutButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  deleteWorkoutButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  halfInput: { width: '48%' },
  label: { marginTop: 6, marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  checkboxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  checkbox: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    minWidth: '30%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  checkboxChecked: { 
    backgroundColor: '#06b6d4',
    borderColor: '#06b6d4',
  },
  checkboxText: { 
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  saveButton: {
    backgroundColor: '#06b6d4',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  progressContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  progressWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    borderWidth: 8,
    borderColor: '#e2e8f0',
  },
  progressFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#06b6d4',
    borderRadius: 60,
  },
  progressCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressNumber: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  progressLabel: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 20,
    paddingHorizontal: 20,
  },
  statItem: {
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    minWidth: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  settingsIcon: {
    width: 24,
    height: 24,
    tintColor: '#fff',
  },
  progressSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
    textTransform: 'capitalize',
  },
});
