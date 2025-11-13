import React, { useCallback, useState, useEffect, useRef } from 'react';
import { Image } from 'expo-image';
import {
  Platform,
  StyleSheet,
  View,
  Text,
  Pressable,
  FlatList,
  TouchableOpacity,
  Alert,
  useColorScheme,
  Vibration,
  LogBox,
  PermissionsAndroid,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { useTheme } from 'react-native-paper';
import { Pedometer } from 'expo-sensors';
import { useTranslation } from '../../hooks/useTranslation';

LogBox.ignoreLogs(['expo-notifications']);
LogBox.ignoreLogs(['VirtualizedLists should never be nested inside plain ScrollViews with tje same orientation']);

// Types (mantidos iguais)
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

// Constants
const STORAGE_KEY = 'workouts';
const STEP_TARGET = 10000;

// Utils
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const workoutSlugFromFields = (name: string, createdAt: string) => 
  `${slugify(name)}-${new Date(createdAt).getTime()}`;

export default function HomeScreen() {
  // Hooks
  const router = useRouter();
  const theme = useTheme();
  const scheme = useColorScheme();
  const { t } = useTranslation();

  // State (mantido igual)
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [currentStepCount, setCurrentStepCount] = useState(0);
  const [isPedometerAvailable, setIsPedometerAvailable] = useState(false);
  const [progress, setProgress] = useState(0);

  // Refs (mantido igual)
  const notificationsSentRef = useRef({
    half: false,
    target: false,
    double: false
  });

  // Effects (mantidos iguais)
  useEffect(() => {
    const newProgress = Math.min(1, currentStepCount / STEP_TARGET);
    setProgress(newProgress);
  }, [currentStepCount]);

  useEffect(() => {
    checkStepMilestones();
  }, [currentStepCount]);

  useEffect(() => {
    initSteps();
    registerForPushNotifications();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadWorkouts();
    }, [])
  );

  // Step Tracking Functions (mantidas iguais)
  const requestActivityPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        if (Platform.Version >= 29) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
            {
              title: "Permissão para Contagem de Passos",
              message: "Esta aplicação precisa de acesso aos sensores de atividade física para contar os seus passos.",
              buttonNeutral: "Perguntar Depois",
              buttonNegative: "Cancelar",
              buttonPositive: "Permitir",
            }
          );
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        } else {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.BODY_SENSORS,
            {
              title: "Permissão para Sensores",
              message: "Esta aplicação precisa de acesso aos sensores para contar os seus passos.",
              buttonNeutral: "Perguntar Depois",
              buttonNegative: "Cancelar",
              buttonPositive: "Permitir",
            }
          );
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
      } catch (err) {
        console.warn('Erro na permissão:', err);
        return false;
      }
    }
    return true;
  };

  const initSteps = async () => {
    const hasPermission = await requestActivityPermission();
    if (!hasPermission) {
      Alert.alert("Permissão necessária", "Ative a permissão de atividade física nas configurações para contar os passos.");
      await loadStoredSteps();
      return;
    }

    const steps = await checkAndResetSteps();
    setCurrentStepCount(steps);
    await initPedometer();
  };

  const initPedometer = async () => {
    try {
      const available = await Pedometer.isAvailableAsync();
      setIsPedometerAvailable(available);
      
      if (available) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        try {
          const stepCountResult = await Pedometer.getStepCountAsync(today, new Date());
          
          if (stepCountResult && stepCountResult.steps !== undefined) {
            const steps = stepCountResult.steps;
            setCurrentStepCount(steps);
            await saveStepCount(steps);
          }
        } catch (stepError) {
          console.error('Erro ao obter passos:', stepError);
          await loadStoredSteps();
        }
        
        const subscription = Pedometer.watchStepCount(result => {
          if (result.steps !== undefined) {
            setCurrentStepCount(result.steps);
            saveStepCount(result.steps);
          }
        });
        
        return () => subscription && subscription.remove();
      } else {
        console.log('Pedómetro não disponível - usando modo manual');
        await loadStoredSteps();
      }
    } catch (error) {
      console.error('Erro ao inicializar pedómetro:', error);
      await loadStoredSteps();
    }
  };

  const loadStoredSteps = async () => {
    try {
      const savedSteps = await AsyncStorage.getItem('@step_count');
      const steps = savedSteps ? parseInt(savedSteps, 10) : 0;
      setCurrentStepCount(steps);
    } catch (error) {
      console.error('Error loading stored steps:', error);
      setCurrentStepCount(0);
    }
  };

  const saveStepCount = async (steps: number) => {
    try {
      await AsyncStorage.setItem('@step_count', steps.toString());
      const today = new Date().toDateString();
      await AsyncStorage.setItem('@last_reset_date', today);
    } catch (error) {
      console.error('Error saving step count:', error);
    }
  };

  const checkAndResetSteps = async () => {
    try {
      const today = new Date().toDateString();
      const lastReset = await AsyncStorage.getItem('@last_reset_date');
      
      if (lastReset !== today) {
        await AsyncStorage.setItem('@step_count', '0');
        await AsyncStorage.setItem('@last_reset_date', today);
        setCurrentStepCount(0);
        setProgress(0);
        
        notificationsSentRef.current = { half: false, target: false, double: false };
        return 0;
      } else {
        const savedSteps = await AsyncStorage.getItem('@step_count');
        return savedSteps ? parseInt(savedSteps, 10) : 0;
      }
    } catch (error) {
      console.error('Error checking/resetting steps:', error);
      return 0;
    }
  };

  // Notification Functions (mantidas iguais)
  const checkStepMilestones = async () => {
    if (currentStepCount === 0) return;

    const halfTarget = STEP_TARGET / 2;
    const doubleTarget = STEP_TARGET * 2;

    if (currentStepCount >= halfTarget && currentStepCount < halfTarget + 100 && !notificationsSentRef.current.half) {
      await sendMilestoneNotification(
        "🎉 Metade do Caminho!",
        `Você atingiu ${currentStepCount.toLocaleString()} passos! Continue assim para bater sua meta de ${STEP_TARGET.toLocaleString()} passos! 💪`
      );
      notificationsSentRef.current.half = true;
    }

    if (currentStepCount >= STEP_TARGET && currentStepCount < STEP_TARGET + 100 && !notificationsSentRef.current.target) {
      await sendMilestoneNotification(
        "🏆 Meta Batida!",
        `PARABÉNS! Você atingiu ${currentStepCount.toLocaleString()} passos! 🎊 Continue mantendo esse ritmo incrível! ✨`
      );
      notificationsSentRef.current.target = true;
    }

    if (currentStepCount >= doubleTarget && currentStepCount < doubleTarget + 100 && !notificationsSentRef.current.double) {
      await sendMilestoneNotification(
        "🚀 DOBRO DA META!",
        `INCRÍVEL! Você já deu ${currentStepCount.toLocaleString()} passos! Isso é o DOBRO da sua meta diária! 🌟 Você é uma máquina!`
      );
      notificationsSentRef.current.double = true;
    }

    // Reset notifications if steps decrease
    if (currentStepCount < halfTarget) notificationsSentRef.current.half = false;
    if (currentStepCount < STEP_TARGET) notificationsSentRef.current.target = false;
    if (currentStepCount < doubleTarget) notificationsSentRef.current.double = false;
  };

  const sendMilestoneNotification = async (title: string, body: string) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, sound: 'default', data: { type: 'step_milestone' } },
        trigger: null,
      });
      
      if (Platform.OS !== 'web') {
        Vibration.vibrate([0, 500, 200, 500]);
      }
    } catch (error) {
      console.error('Erro ao enviar notificação:', error);
    }
  };

  const registerForPushNotifications = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      alert('We need your permission to send notifications');
    }
  };

  // Workout Functions (mantidas iguais)
  const loadWorkouts = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      setWorkouts(Array.isArray(parsed) ? parsed : []);
    } catch (e) {
      console.error(e);
      setWorkouts([]);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await AsyncStorage.removeItem('userToken');
      router.replace('/profile');
    } catch (e) {
      Alert.alert('Error', 'Could not log out.');
    }
  }, [router]);

  // Render Functions
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyText, { color: theme.colors.onSurface }]}>
        {t('noWorkoutsFound', { ns: 'common' })}
      </Text>
      <Text style={[styles.emptySubtext, { color: theme.colors.onSurfaceVariant }]}>
        {t('startByAdding', { ns: 'common' })}
      </Text>
    </View>
  );

  const renderWorkoutItem = ({ item }: { item: Workout }) => (
    <View style={styles.itemWrap}>
      <TouchableOpacity
        style={[
          styles.workoutItem, 
          { 
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outline,
          }
        ]}
        onPress={() => {
          const slug = workoutSlugFromFields(item.name, item.createdAt);
          router.push(`/workout/${slug}`);
        }}
      >
        <View style={styles.workoutContent}>
          <View style={styles.workoutInfo}>
            <Text style={[styles.workoutText, { color: theme.colors.onSurface }]}>
              {item.name}
            </Text>
            <Text style={[
              styles.dateText, 
              { color: theme.colors.onSurfaceVariant }
            ]}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>
          <View style={[
            styles.exerciseCount, 
            { backgroundColor: theme.colors.primary + '20' }
          ]}>
            <Text style={[
              styles.countText, 
              { color: theme.colors.primary }
            ]}>
              {item.exercises.length} {item.exercises.length === 1 ? 'exercise' : 'exercises'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );

  // Calculate metrics
  const remainingSteps = Math.max(0, STEP_TARGET - currentStepCount);
  const caloriesBurned = Math.round(currentStepCount * 0.05);
  const activeMinutes = Math.round(currentStepCount / 175);

  return (
    
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} style={{ flex: 1 }}>

    
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.headerContent}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>
            Fitness HUB
          </Text>
          <Text style={[
            styles.subtitle, 
            { color: theme.colors.onSurfaceVariant }
          ]}>
            {t('Track your daily activity and progress', { ns: 'common' })}
          </Text>
        </View>
        <Pressable onPress={handleLogout} hitSlop={20}>
          <Image
            source={require('../../assets/images/Settings-Icon.png')}
            style={[styles.settingsIcon, { tintColor: theme.colors.onSurface }]}
          />
        </Pressable>
      </View>

      {/* Steps Progress Section */}
      <View style={[styles.progressContainer, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.progressHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            {t('steps', { ns: 'common' })} {t('today', { ns: 'common' })}
          </Text>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
            {t('keepMoving', { ns: 'common' })}
          </Text>
        </View>
        
        <View style={styles.stepsContainer}>
          <View style={styles.stepsCount}>
            <Text style={[styles.stepsNumber, { color: theme.colors.primary }]}>
              {currentStepCount.toLocaleString()}
            </Text>
            <Text style={[styles.stepsDivider, { color: theme.colors.onSurfaceVariant }]}>
              /
            </Text>
            <Text style={[styles.stepsTarget, { color: theme.colors.onSurfaceVariant }]}>
              {STEP_TARGET.toLocaleString()}
            </Text>
          </View>
          <Text style={[styles.stepsRemaining, { color: theme.colors.onSurface }]}>
            {remainingSteps.toLocaleString()} {t('steps', { ns: 'common' })} {t('toGo', { ns: 'common' })}
          </Text>
        </View>

        {/* Progress Bar */}
        <View style={[styles.progressBar, { backgroundColor: theme.colors.surfaceVariant }]}>
          <View 
            style={[
              styles.progressFill, 
              { 
                backgroundColor: theme.colors.primary,
                width: `${Math.min(100, progress * 100)}%`,
              }
            ]} 
          />
        </View>

        {!isPedometerAvailable && (
          <Text style={[styles.pedometerWarning, { color: theme.colors.error }]}>
            Pedometer not available
          </Text>
        )}
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.statValue, { color: theme.colors.primary }]}>
            {caloriesBurned}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
            {t('Calories Burned', { ns: 'common' })}
          </Text>
          <Text style={[styles.statSubtext, { color: theme.colors.onSurfaceVariant }]}>
            {t('from', { ns: 'common' })} {currentStepCount.toLocaleString()} {t('steps', { ns: 'common' })}
          </Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.statValue, { color: theme.colors.primary }]}>
            {activeMinutes}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
            {t('Active Minutes', { ns: 'common' })}
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      
      {/* Workouts Section */}
      <View style={styles.workoutsSection}>
        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          {t('workouts', { ns: 'common' })}
        </Text>
        <FlatList
          data={workouts}
          keyExtractor={(item: Workout) => workoutSlugFromFields(item.name, item.createdAt)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={renderEmpty}
          renderItem={renderWorkoutItem}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>

        <TouchableOpacity
  style={[styles.fab, { backgroundColor: theme.colors.primary }]}
  onPress={() => router.push('/addWorkout')}
>
  <Text style={[styles.fabText, { color: theme.colors.surface }]}>+</Text>
</TouchableOpacity>


    </ScrollView>

      
    
  );

  
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerContent: {
    flex: 1,
  },
  title: { 
    fontSize: 28, 
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: { 
    fontSize: 16,
    opacity: 0.7,
  },
  settingsIcon: {
    width: 24,
    height: 24,
    marginTop: 16,
  },
  progressContainer: {
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    marginTop: 12,
  },
  progressHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  stepsContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  stepsCount: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  stepsNumber: {
    fontSize: 32,
    fontWeight: '700',
  },
  stepsDivider: {
    fontSize: 20,
    fontWeight: '600',
    marginHorizontal: 8,
  },
  stepsTarget: {
    fontSize: 20,
    fontWeight: '600',
  },
  stepsRemaining: {
    fontSize: 14,
    opacity: 0.8,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  pedometerWarning: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  statSubtext: {
    fontSize: 12,
    opacity: 0.7,
  },
  actionsRow: { 
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 12,
  },
  addButton: {
    paddingVertical: 16,
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
    fontSize: 16,
    fontWeight: '600',
  },
  nutritionButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  nutritionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  workoutsSection: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    marginBottom: 25,
  },
  list: { 
    paddingBottom: 20,
  },
  itemWrap: { 
    marginBottom: 20,
  },
  workoutItem: {
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  workoutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  workoutInfo: {
    flex: 1,
  },
  workoutText: { 
    fontSize: 18, 
    fontWeight: '700',
    marginBottom: 6,
  },
  dateText: { 
    fontSize: 14,
    opacity: 0.7,
  },
  exerciseCount: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  countText: { 
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
  fab: {
  position: 'absolute',
  bottom: 83,
  right: 30,
  width: 64,
  height: 64,
  borderRadius: 32,
  alignItems: 'center',
  justifyContent: 'center',
  elevation: 8,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.3,
  shadowRadius: 5,
  zIndex: 999, // garante que fica por cima do conteúdo
},
fabText: {
  fontSize: 36,
  fontWeight: 'bold',
  lineHeight: 38,
},

},
);


