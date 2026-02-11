import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  Text,
  Pressable,
  FlatList,
  TouchableOpacity,
  Alert,
  Vibration,
  LogBox,
  PermissionsAndroid,
  ScrollView,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { useTheme } from 'react-native-paper';
import { Pedometer } from 'expo-sensors';
import { useTranslation } from '../../hooks/useTranslation';
import Svg, { Path } from "react-native-svg";
import { supabase } from '../../lib/supabase';

LogBox.ignoreLogs(['expo-notifications']);
LogBox.ignoreLogs(['VirtualizedLists should never be nested inside plain ScrollViews with tje same orientation']);

// Types
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
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation();

  // State
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [currentStepCount, setCurrentStepCount] = useState(0);
  const [isPedometerAvailable, setIsPedometerAvailable] = useState(false);
  const [progress, setProgress] = useState(0);

  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Refs
  const notificationsSentRef = useRef({
    half: false,
    target: false,
    double: false
  });

  // Effects
  useEffect(() => {
    const newProgress = Math.min(1, currentStepCount / STEP_TARGET);
    setProgress(newProgress);
  }, [currentStepCount]);

  useEffect(() => {
    const checkForDailyReset = async () => {
      try {
        const now = new Date();
        const today = now.toDateString();
        const lastReset = await AsyncStorage.getItem('@last_reset_date');
        
        if (lastReset !== today && now.getHours() >= 0) {
          console.log('⏰ É meia-noite! Resetando passos...');
          await AsyncStorage.setItem('@step_count', '0');
          await AsyncStorage.setItem('@last_reset_date', today);
          setCurrentStepCount(0);
          setProgress(0);
          
          notificationsSentRef.current = { half: false, target: false, double: false };
        }
      } catch (error) {
        console.error('Erro ao verificar reset diário:', error);
      }
    };

    checkForDailyReset();
    const intervalId = setInterval(checkForDailyReset, 60000);
    
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    checkStepMilestones();
  }, [currentStepCount]);

  useEffect(() => {
    initSteps();
    registerForPushNotifications();
  }, []);

  // Step Tracking Functions
  const requestActivityPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        if (Platform.Version >= 29) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
            {
              title: t('permissionActivityTitle', { ns: 'common' }),
              message: t('permissionActivityMessage', { ns: 'common' }),
              buttonNeutral: t('permissionAskLater', { ns: 'common' }),
              buttonNegative: t('permissionCancel', { ns: 'common' }),
              buttonPositive: t('permissionAllow', { ns: 'common' }),
            }
          );
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        } else {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.BODY_SENSORS,
            {
              title: t('permissionSensorsTitle', { ns: 'common' }),
              message: t('permissionSensorsMessage', { ns: 'common' }),
              buttonNeutral: t('permissionAskLater', { ns: 'common' }),
              buttonNegative: t('permissionCancel', { ns: 'common' }),
              buttonPositive: t('permissionAllow', { ns: 'common' }),
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
      Alert.alert(
        t('permissionRequiredTitle', { ns: 'common' }),
        t('permissionRequiredMessage', { ns: 'common' }),
      );
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
        console.log(t('pedometerNotAvailable', { ns: 'common' }));
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
      const now = new Date();
      const today = now.toDateString();
      const lastReset = await AsyncStorage.getItem('@last_reset_date');
      
      if (lastReset !== today && now.getHours() >= 0) {
        console.log('📅 Novo dia detectado, resetando contador...');
        await AsyncStorage.setItem('@step_count', '0');
        await AsyncStorage.setItem('@last_reset_date', today);
        setCurrentStepCount(0);
        setProgress(0);
        notificationsSentRef.current = { half: false, target: false, double: false };
        return;
      }
      
      await AsyncStorage.setItem('@step_count', steps.toString());
      
    } catch (error) {
      console.error('❌ Erro ao salvar passos:', error);
    }
  };

  const clearAllWorkouts = useCallback(() => {
    Alert.alert(
      t('deleteAllWorkouts', { ns: 'common' }),
      t('deleteAllWorkoutsConfirm', { ns: 'common' }),
      [
        { text: t('cancel', { ns: 'common' }), style: "cancel" },
        {
          text: t('delete', { ns: 'common' }),
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));
              
              try {
                const userResp = await supabase.auth.getUser();
                const userId = userResp.data.user?.id;
                
                if (userId) {
                  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                  const isUuid = uuidRegex.test(userId);
                  
                  let query = supabase.from('workouts').delete();
                  
                  if (isUuid) {
                    query = query.eq('user_uuid', userId);
                  } else {
                    query = query.eq('user_id', userId);
                  }
                  
                  const { error: deleteError } = await query;
                  
                  if (deleteError) {
                    console.error('Erro ao apagar workouts da DB:', deleteError);
                  } else {
                    console.log('Todos os workouts apagados da DB com sucesso');
                  }
                }
              } catch (dbError) {
                console.error('Erro ao apagar workouts da base de dados:', dbError);
              }
              
              setWorkouts([]);
            } catch (e) {
              console.error(e);
              Alert.alert(t('error', { ns: 'common' }), t('couldNotSave', { ns: 'common' }));
            }
          }
        }
      ]
    );
  }, []);

  const checkAndResetSteps = async () => {
    try {
      const now = new Date();
      const today = now.toDateString();
      const lastResetDate = await AsyncStorage.getItem('@last_reset_date');
      
      if (lastResetDate !== today) {
        const lastReset = lastResetDate ? new Date(lastResetDate) : null;
        const shouldReset = !lastReset || now.getHours() >= 0;
        
        if (shouldReset) {
          console.log('🔄 Resetando passos diários...');
          await AsyncStorage.setItem('@step_count', '0');
          await AsyncStorage.setItem('@last_reset_date', today);
          
          notificationsSentRef.current = { half: false, target: false, double: false };
          
          return 0;
        }
      }
      
      const savedSteps = await AsyncStorage.getItem('@step_count');
      return savedSteps ? parseInt(savedSteps, 10) : 0;
      
    } catch (error) {
      console.error('❌ Erro ao verificar/resetar passos:', error);
      return 0;
    }
  };

  // Notification Functions
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

  // Workout Functions
  const loadWorkouts = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const localWorkouts: Workout[] = raw ? JSON.parse(raw) : [];
      
      let dbWorkouts: Workout[] = [];
      try {
        const userResp = await supabase.auth.getUser();
        const userId = userResp.data.user?.id;
        
        if (userId) {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          const isUuid = uuidRegex.test(userId);
          
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
          } else if (data) {
            dbWorkouts = data.map((w: any) => ({
              name: w.name,
              createdAt: w.created_at || w.createdAt,
              exercises: w.exercises || [],
            }));
          }
        }
      } catch (dbError) {
        console.error('Erro ao buscar workouts da base de dados:', dbError);
      }
      
      const allWorkouts = [...localWorkouts, ...dbWorkouts];
      const uniqueWorkouts = allWorkouts.filter((workout, index, self) =>
        index === self.findIndex((w) => 
          w.name === workout.name && w.createdAt === workout.createdAt
        )
      );
      
      uniqueWorkouts.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      setWorkouts(uniqueWorkouts);
    } catch (e) {
      console.error('Erro ao carregar workouts:', e);
      setWorkouts([]);
    }
  }, []);

  useEffect(() => {
    loadWorkouts();
    
    const intervalId = setInterval(() => {
      loadWorkouts();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [loadWorkouts]);

  useFocusEffect(
    useCallback(() => {
      loadWorkouts();
    }, [loadWorkouts])
  );

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
        style={[styles.workoutItem, { 
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.outline + '30'
        }]}
        onPress={() => {
          const slug = workoutSlugFromFields(item.name, item.createdAt);
          router.push(`/workout/${slug}`);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.workoutContent}>
          <View style={styles.workoutInfo}>
            <Text style={[styles.workoutText, { color: theme.colors.onSurface }]}>
              {item.name}
            </Text>
            <Text style={[styles.dateText, { color: theme.colors.onSurfaceVariant }]}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>
          <View style={[styles.exerciseCount, { 
            backgroundColor: theme.colors.primary + '30'
          }]}>
            <Text style={[styles.countText, { color: theme.colors.primary }]}>
              {item.exercises.length}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );

  // Calculate metrics
  const caloriesBurned = Math.round(currentStepCount * 0.05);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.gradientBg}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View 
            style={[
              styles.header,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>Zedith</Text>
            <Pressable onPress={handleLogout} hitSlop={20}>
              <Svg
                width={24}
                height={24}
                viewBox="0 0 24 24"
                fill="none"
                stroke={theme.colors.onSurface}
                strokeWidth={2}
              >
                <Path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
                />
                <Path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                />
              </Svg>
            </Pressable>
          </Animated.View>

          {/* Steps Card */}
          <Animated.View 
            style={[
              styles.stepsCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.outline + '30'
              }
            ]}
          >
            <View style={styles.cardGradient}>
              <View style={styles.stepsHeader}>
                <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                  {t('steps', { ns: 'common' })} {t('today', { ns: 'common' })}
                </Text>
                <View style={[styles.caloriesBadge, { backgroundColor: theme.colors.primary + '20' }]}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={theme.colors.primary} strokeWidth={2}>
                    <Path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14.5 10.0003C14.5 9.20875 15.5528 8.99895 15.8321 9.73957C16.5077 11.5311 17 13.1337 17 14.0002C17 16.7616 14.7614 19.0002 12 19.0002C9.23858 19.0002 7 16.7616 7 14.0002C7 13.0693 7.56822 11.2887 8.32156 9.33698C9.29743 6.80879 9.78536 5.54469 10.3877 5.4766C10.5804 5.45482 10.7907 5.49399 10.9626 5.58371C11.5 5.86413 11.5 7.24285 11.5 10.0003C11.5 10.8287 12.1716 11.5003 13 11.5003C13.8284 11.5003 14.5 10.8287 14.5 10.0003Z"
                    />
                  </Svg>
                  <Text style={[styles.caloriesText, { color: theme.colors.primary }]}>{caloriesBurned}</Text>
                </View>
              </View>

              <View style={styles.stepsCount}>
                <Text style={[styles.stepsNumber, { color: theme.colors.onSurface }]}>
                  {currentStepCount.toLocaleString()}
                </Text>
                <Text style={[styles.stepsDivider, { color: theme.colors.onSurfaceVariant }]}>
                  /
                </Text>
                <Text style={[styles.stepsTarget, { color: theme.colors.onSurfaceVariant }]}>
                  {STEP_TARGET.toLocaleString()}
                </Text>
              </View>

              <View style={[styles.progressBar, { backgroundColor: theme.colors.surfaceVariant }]}>
                <View
                  style={[
                    styles.progressFill,
                    { 
                      width: `${Math.min(100, progress * 100)}%`,
                      backgroundColor: theme.colors.primary
                    }
                  ]}
                />
              </View>
            </View>
          </Animated.View>

          {/* Workouts Section */}
          <Animated.View 
            style={[
              styles.workoutsSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <View style={styles.workoutsHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                {t('workouts', { ns: 'common' })}
              </Text>
              <TouchableOpacity onPress={clearAllWorkouts} style={[styles.deleteBtn, {
                backgroundColor: theme.colors.error + '20',
                borderColor: theme.colors.error + '30'
              }]}>
                <Text style={[styles.deleteBtnText, { color: theme.colors.error }]}>Clear All</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={workouts}
              keyExtractor={(item: Workout) => workoutSlugFromFields(item.name, item.createdAt)}
              contentContainerStyle={styles.list}
              ListEmptyComponent={renderEmpty}
              renderItem={renderWorkoutItem}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
            />
          </Animated.View>
        </ScrollView>

        {/* FAB */}
        <TouchableOpacity
          style={[styles.fab, {
            shadowColor: theme.colors.primary,
          }]}
          onPress={() => router.push('/addWorkout')}
          activeOpacity={0.85}
        >
          <View style={[styles.fabGradient, { backgroundColor: theme.colors.primary }]}>
            <Text style={[styles.fabText, { color: theme.colors.onPrimary }]}>+</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientBg: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
  },
  stepsCard: {
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
  },
  cardGradient: {
    padding: 24,
  },
  stepsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  caloriesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  caloriesText: {
    fontSize: 14,
    fontWeight: '600',
  },
  stepsCount: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepsNumber: {
    fontSize: 36,
    fontWeight: '700',
  },
  stepsDivider: {
    fontSize: 24,
    fontWeight: '600',
    marginHorizontal: 8,
    opacity: 0.6,
  },
  stepsTarget: {
    fontSize: 24,
    fontWeight: '600',
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
  workoutsSection: {
    paddingHorizontal: 24,
  },
  workoutsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    paddingBottom: 20,
  },
  itemWrap: {
    marginBottom: 12,
  },
  workoutItem: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    padding: 20,
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
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 14,
  },
  exerciseCount: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabText: {
    fontSize: 32,
    fontWeight: '300',
  },
});