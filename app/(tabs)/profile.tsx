import { Ionicons } from '@expo/vector-icons';
import WeightChart from '../../components/Area_chart';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { getAppTheme } from '../../lib/theme';
import * as Notifications from 'expo-notifications';
import { LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Line } from 'recharts';
import { useTranslation } from '../../hooks/useTranslation';

const { width } = Dimensions.get('window');
const WEIGHT_GOALS_KEY = 'weightGoals';
const WEIGHT_HISTORY_KEY = 'weightHistory';
const NOTIFICATION_SETTINGS_KEY = 'notificationSettings';

// Configurar notificações corrigido
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const theme = getAppTheme(colorScheme);
  const { t } = useTranslation();
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [age, setAge] = useState('');
  const [weightGoal, setWeightGoal] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [busy, setBusy] = useState(true);
  const [activeTab, setActiveTab] = useState('goals');
  const [startingWeight, setStartingWeight] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const [weightHistory, setWeightHistory] = useState<any[]>([]);
  const [notificationEnabled, setNotificationEnabled] = useState(true);

  const progressAnim = useState(new Animated.Value(0))[0];
  const fadeAnim = useState(new Animated.Value(0))[0];
  
  const router = useRouter();

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(progressAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const getUserData = async () => {
    try {
      setBusy(true);
      
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error('Auth error:', error);
        Alert.alert('Error', 'Could not fetch user data.');
        setBusy(false);
        return;
      }
      
      if (!data.user) {
        console.error('No user found');
        Alert.alert('Error', 'No user session found.');
        setBusy(false);
        return;
      }
      
      const user = data.user;
      setUserId(user.id);
      setEmail(user.email ?? '');
      setUsername(user.email?.split('@')[0] ?? 'User');

      await loadWeightGoals();
      await loadWeightHistory();
      await loadNotificationSettings();
      //
      
    } catch (error) {
      console.error('Unexpected error in getUserData:', error);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setBusy(false);
    }
  };

  const loadWeightGoals = async () => {
    try {
      const savedGoals = await AsyncStorage.getItem(WEIGHT_GOALS_KEY);
      if (savedGoals) {
        const goals = JSON.parse(savedGoals);
        setWeight(goals.weight || '');
        setWeightGoal(goals.weightGoal || '');
        setTargetDate(goals.targetDate || '');
        setStartingWeight(goals.startingWeight || '');
        setHeight(goals.height || '');
        setAge(goals.age || '');
        
        if (goals.targetDate) {
          setTempDate(new Date(goals.targetDate));
        }
      }
    } catch (error) {
      console.error('Error loading weight goals:', error);
    }
  };

  const loadWeightHistory = async () => {
    try {
      const savedHistory = await AsyncStorage.getItem(WEIGHT_HISTORY_KEY);
      if (savedHistory) {
        const history = JSON.parse(savedHistory);
        setWeightHistory(history);
      }
    } catch (error) {
      console.error('Error loading weight history:', error);
    }
  };

  const loadNotificationSettings = async () => {
    try {
      const settings = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (settings) {
        const { enabled } = JSON.parse(settings);
        setNotificationEnabled(enabled);
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  
  const saveWeightGoals = async () => {
    try {
      console.log('💾 Salvando goals...');
      
      if (!weight || !weightGoal) {
        Alert.alert(t('error', { ns: 'common' }), t('pleaseFill', { ns: 'common' }));
        return;
      }

      const weightNum = parseFloat(weight);
      const weightGoalNum = parseFloat(weightGoal);
      const bmiNum = calculateBMI();

      // Adicionar ao histórico
      const newWeightEntry = {
        weight: weightNum,
        date: new Date().toISOString(),
        timestamp: Date.now(),
      };

      const updatedHistory = [...weightHistory, newWeightEntry]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 30);

      setWeightHistory(updatedHistory);

      // Salvar localmente
      const goals = {
        weight,
        weightGoal,
        targetDate,
        startingWeight: startingWeight || weight,
        height,
        age,
        savedAt: new Date().toISOString(),
      };
      
      await AsyncStorage.setItem(WEIGHT_GOALS_KEY, JSON.stringify(goals));
      await AsyncStorage.setItem(WEIGHT_HISTORY_KEY, JSON.stringify(updatedHistory));

      // Enviar para Supabase
      await sendUserDataToSupabase(goals, updatedHistory, bmiNum);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert(t('success', { ns: 'common' }), t('goalsSaved', { ns: 'common' }));
      
    } catch (error) {
      console.error('❌ Error saving weight goals:', error);
      Alert.alert(t('error', { ns: 'common' }), t('couldNotSaveGoals', { ns: 'common' }));
    }
  };

  const sendUserDataToSupabase = async (goals: any, history: any[], bmi: string) => {
    try {
      console.log('🚀 Enviando dados para Supabase...');
      
      if (!email) {
        console.error('❌ Email não disponível');
        return;
      }

      // Inserir/Atualizar informações do usuário na tabela userinfo
      const { data: userData, error: userError } = await supabase
        .from('UserInfo')
        .upsert([{ 
          user_email: email,
          Weight: parseFloat(goals.weight),
          BMI: parseFloat(bmi) || null,
        }], { 
          onConflict: 'user_email',
          ignoreDuplicates: false 
        });

      if (userError) {
        console.error('❌ Erro ao salvar userinfo:', userError);
        return;
      }

      // Inserir histórico de pesos (se tiver uma tabela para isso)
      if (history.length > 0) {
        const latestEntry = history[0];
        const { error: historyError } = await supabase
          .from('weight_history')
          .insert([{
            user_email: email,
            weight: latestEntry.weight,
            date: latestEntry.date,
            created_at: new Date().toISOString(),
          }]);

        if (historyError) {
          console.log('ℹ️ Tabela weight_history não existe ou erro ao salvar:', historyError);
        }
      }

      console.log('✅ Dados enviados com sucesso para Supabase');
      
    } catch (error) {
      console.error('❌ Erro inesperado no envio para Supabase:', error);
    }
  };

  const toggleNotifications = async () => {
    try {
      const newNotificationEnabled = !notificationEnabled;
      setNotificationEnabled(newNotificationEnabled);
      
      await AsyncStorage.setItem(
        NOTIFICATION_SETTINGS_KEY, 
        JSON.stringify({ enabled: newNotificationEnabled })
      );

      if (newNotificationEnabled) {
        //await setupNotifications();
        Alert.alert('Success', 'Monthly reminders enabled!');
      } else {
        await Notifications.cancelAllScheduledNotificationsAsync();
        Alert.alert('Success', 'Monthly reminders disabled.');
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
    }
  };

  const getChartData = () => {
    if (weightHistory.length === 0) return [];

    const last30Days = weightHistory
      .slice(0, 7)
      .map(entry => ({
        date: new Date(entry.date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }),
        weight: entry.weight,
        fullDate: entry.date,
      }))
      .reverse();

    return last30Days;
  };

  const handleShowDatePicker = () => {
    if (targetDate) {
      setTempDate(new Date(targetDate));
    } else {
      setTempDate(new Date());
    }
    setShowDatePicker(true);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    
    if (selectedDate) {
      setTempDate(selectedDate);
      const formattedDate = selectedDate.toISOString().split('T')[0];
      setTargetDate(formattedDate);
    }
  };

  const handleUpdateEmail = async () => {
    const trimmedEmail = newEmail.trim();
    
    if (!trimmedEmail) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      const { data, error } = await supabase.auth.updateUser({ 
        email: trimmedEmail 
      });
      
      if (error) throw error;
      
      setEmail(trimmedEmail);
      setNewEmail('');
      Alert.alert(
        'Success', 
        'Confirmation email sent! Please check your inbox to verify your new email address.'
      );
      
    } catch (error: any) {
      console.error('Email update error:', error);
      Alert.alert(
        'Update Failed', 
        error?.message || 'Unable to update email. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const calculateProgress = () => {
    const current = parseFloat(weight) || 0;
    const target = parseFloat(weightGoal) || 0;

    if (current === 0 || target === 0) return 0;

    if (target > current) {
      const progress = (current / target) * 100;
      return Math.min(100, Math.max(0, progress));
    }

    if (target < current) {
      const progress = ((current - target) / current) * 100;
      return Math.min(100, Math.max(0, progress));
    }

    return 0;
  };

  const calculateWeightDifference = () => {
    const current = parseFloat(weight) || 0;
    const target = parseFloat(weightGoal) || 0;

    if (current === 0 || target === 0) return 0;

    return Math.abs(current - target);
  };

  const calculateBMI = () => {
    const weightNum = parseFloat(weight) || 0;
    const heightNum = parseFloat(height) || 0;
    
    if (weightNum === 0 || heightNum === 0) return '0';
    
    const heightInMeters = heightNum / 100;
    return (weightNum / (heightInMeters * heightInMeters)).toFixed(1);
  };

  const getBMICategory = (bmi: string) => {
    const bmiNum = parseFloat(bmi);
    if (bmiNum < 18.5) return { category: 'Underweight', color: '#FF6B6B' };
    if (bmiNum < 25) return { category: 'Normal', color: '#4ECDC4' };
    if (bmiNum < 30) return { category: 'Overweight', color: '#FFD166' };
    return { category: 'Obese', color: '#FF6B6B' };
  };

  const handleLogout = async () => {
    Alert.alert(
      t('logout', { ns: 'common' }),
      t('logoutConfirm', { ns: 'common' }),
      [
        { text: t('cancel', { ns: 'common' }), style: 'cancel' },
        { 
          text: t('logout', { ns: 'common' }), 
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const { error } = await supabase.auth.signOut();
            if (error) Alert.alert('Logout failed', error.message);
            else router.replace('/login');
          }
        }
      ]
    );
  };

  const clearWeightHistory = async () => {
    Alert.alert(
      t('delete', { ns: 'common' }),
      t('clearHistoryConfirm', { ns: 'common' }),
      [
        { text: t('cancel', { ns: 'common' }), style: 'cancel' },
        { 
          text: t('delete', { ns: 'common' }),
          style: 'destructive',
          onPress: async () => {
            setWeightHistory([]);
            await AsyncStorage.removeItem(WEIGHT_HISTORY_KEY);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert(t('success', { ns: 'common' }), t('historyCleared', { ns: 'common' }));
          }
        }
      ]
    );
  };

  useEffect(() => {
    getUserData();
  }, []);

  if (busy) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.headerSkeleton} />
        <View style={styles.avatarSkeleton} />
        <View style={styles.lineSkeleton} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.onSurface }]}>
            {t('loadingProfile', { ns: 'common' })}
          </Text>
        </View>
      </View>
    );
  }

  const progressPercentage = calculateProgress();
  const weightDifference = calculateWeightDifference();
  const bmi = calculateBMI();
  const bmiCategory = getBMICategory(bmi.toString());
  const chartData = getChartData();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: progressAnim }] }}>
          
          {/* Header */}
          <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.headerContent}>
              <Text style={styles.title}>{t('profile', { ns: 'common' })}</Text>
              <Pressable onPress={handleLogout} hitSlop={20} style={styles.settingsButton}>
                <Ionicons name="settings-outline" size={24} color="#fff" />
              </Pressable>
            </View>
          </View>

          {/* Avatar & info */}
          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              <View style={[styles.avatarRing, { backgroundColor: theme.colors.primary }]}>
                <View style={styles.avatarInnerRing}>
                  <Image
                    source={require('../../assets/images/LoginImage.jpg')}
                    style={styles.avatar}
                    contentFit="cover"
                  />
                </View>
              </View>
              <Pressable style={[styles.editAvatarButton, { backgroundColor: theme.colors.primary }]}>
                <Ionicons name="camera" size={16} color="#fff" />
              </Pressable>
            </View>
            <Text style={[styles.username, { color: theme.colors.onBackground }]}>{username}</Text>
            <Text style={[styles.email, { color: theme.colors.onSurfaceVariant }]} 
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.8}
      ellipsizeMode="tail">
  {email}
</Text>
            
            {/* Stats Cards */}
            <View style={styles.statsContainer}>
              <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
                <Text style={[styles.statValue, { color: theme.colors.primary }]}>{weight || '--'}</Text>
                <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>{t('currentWeight', { ns: 'common' })}</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
                <Text style={[styles.statValue, { color: theme.colors.primary }]}>{weightGoal || '--'}</Text>
                <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>{t('targetWeight', { ns: 'common' })}</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
                <Text style={[styles.statValue, { color: bmiCategory.color }]}>{bmi || '--'}</Text>
                <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>BMI</Text>
              </View>
            </View>
          </View>

          {/* Navigation Tabs */}
          <View style={[styles.tabContainer, { backgroundColor: theme.colors.surface }]}>
            <Pressable 
              style={[styles.tab, activeTab === 'goals' && [styles.activeTab, { backgroundColor: theme.colors.primary }]]}
              onPress={() => setActiveTab('goals')}
            >
              <Text style={[styles.tabText, {color: theme.colors.primary }, activeTab === 'goals' && styles.activeTabText]}>
                {t('goals', { ns: 'common' })}
              </Text>
            </Pressable>
            <Pressable 
              style={[styles.tab, activeTab === 'progress' && [styles.activeTab, { backgroundColor: theme.colors.primary }]]}
              onPress={() => setActiveTab('progress')}
            >
              <Text style={[styles.tabText, {color: theme.colors.primary}, activeTab === 'progress' && styles.activeTabText]}>
                {t('Progress', { ns: 'common' })}
              </Text>
            </Pressable>
            <Pressable 
              style={[styles.tab, activeTab === 'profile' && [styles.activeTab, { backgroundColor: theme.colors.primary }]]}
              onPress={() => setActiveTab('profile')}
            >
              <Text style={[styles.tabText, {color: theme.colors.primary}, activeTab === 'profile' && styles.activeTabText]}>
                {t('profile', { ns: 'common' })}
              </Text>
            </Pressable>
          </View>

          {/* Goals Tab */}
          {activeTab === 'goals' && (
            <View style={styles.tabContent}>
              <Text style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>{t('weightGoals', { ns: 'common' })}</Text>

              <View style={styles.inputRow}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.colors.onSurface }]}>{t('currentWeightKg', { ns: 'common' })}</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.onSurface, borderColor: theme.colors.outline }]}
                    value={weight}
                    onChangeText={setWeight}
                    keyboardType="numeric"
                    placeholder="80.0"
                    placeholderTextColor={theme.colors.onSurfaceVariant}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.colors.onSurface }]}>{t('targetWeightKg', { ns: 'common' })}</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.onSurface, borderColor: theme.colors.outline }]}
                    value={weightGoal}
                    onChangeText={setWeightGoal}
                    keyboardType="numeric"
                    placeholder="65.0"
                    placeholderTextColor={theme.colors.onSurfaceVariant}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.onSurface }]}>{t('Target Date', { ns: 'common' })}</Text>
                <Pressable 
                  style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline, justifyContent: 'center' }]}
                  onPress={handleShowDatePicker}
                >
                  <Text style={{ color: targetDate ? theme.colors.onSurface : theme.colors.onSurfaceVariant }}>
                    {targetDate || 'Select target date'}
                  </Text>
                </Pressable>
              </View>

              {showDatePicker && (
                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleDateChange}
                  minimumDate={new Date()}
                />
              )}

              {(weight && weightGoal) && (
                <View style={[styles.progressCard, { backgroundColor: theme.colors.surface }]}>
                  <View style={styles.progressHeader}>
                    <Text style={[styles.progressTitle, { color: theme.colors.onSurface }]}>{t('Progress', { ns: 'common' })}</Text>
                    <Text style={[styles.progressPercentage, { color: theme.colors.primary }]}>
                      {progressPercentage.toFixed(1)}%
                    </Text>
                  </View>
                  <View style={[styles.progressBar, { backgroundColor: theme.colors.outline }]}>
                    <Animated.View 
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
                    {weightDifference.toFixed(1)}kg {parseFloat(weight) > parseFloat(weightGoal) ? t('toLose', { ns: 'common' }) : t('toGain', { ns: 'common' })} {t('toReach', { ns: 'common' })}
                  </Text>
                  {parseFloat(bmi.toString()) > 0 && (
                    <View style={styles.bmiSection}>
                      <Text style={[styles.bmiText, { color: bmiCategory.color }]}>
                        BMI: {bmi} • {bmiCategory.category}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <Pressable
                style={[styles.button, { backgroundColor: theme.colors.primary }, (!weight || !weightGoal) && styles.disabled]}
                onPress={saveWeightGoals}
                disabled={!weight || !weightGoal}
              >
                <Text style={styles.buttonTxt}>{t('saveGoals', { ns: 'common' })}</Text>
              </Pressable>
            </View>
          )}

          {/* Progress Tab */}
          {/* Progress Tab */}
{activeTab === 'progress' && (
  <View style={styles.tabContent}>
    <Text style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>{t('weightProgress', { ns: 'common' })}</Text>

    {weightHistory.length > 0 ? (
      <>
        {/* Gráfico Simples de Barras */}
        <View style={[styles.chartContainer, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.chartTitle, { color: theme.colors.onSurface }]}>
            {t('weightHistory', { ns: 'common' })}
          </Text>
          
          <View style={styles.simpleChart}>
            {chartData.map((item, index) => {
              const maxWeight = Math.max(...chartData.map(d => d.weight));
              const minWeight = Math.min(...chartData.map(d => d.weight));
              const range = maxWeight - minWeight;
              const barHeight = ((item.weight - minWeight) / range) * 80 + 20; // 20-100% height
              
              return (
                <View key={index} style={styles.barContainer}>
                  <View style={styles.barWrapper}>
                    <View 
                      style={[
                        styles.bar, 
                        { 
                          height: barHeight,
                          backgroundColor: theme.colors.primary 
                        }
                      ]} 
                    />
                  </View>
                  <Text style={[styles.barLabel, { color: theme.colors.onSurfaceVariant }]}>
                    {item.date}
                  </Text>
                  <Text style={[styles.barValue, { color: theme.colors.primary }]}>
                    {item.weight}kg
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <Text style={[styles.historyTitle, { color: theme.colors.onSurface }]}>
              Recent Entries
            </Text>
            <Pressable onPress={clearWeightHistory}>
              <Text style={[styles.clearButton, { color: '#FF6B6B' }]}>
                Clear All
              </Text>
            </Pressable>
          </View>
          {weightHistory.slice(0, 5).map((entry, index) => (
            <View key={index} style={[styles.historyItem, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.historyDate, { color: theme.colors.onSurface }]}>
                {new Date(entry.date).toLocaleDateString('pt-PT', { 
                  weekday: 'short', 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </Text>
              <Text style={[styles.historyWeight, { color: theme.colors.primary }]}>
                {entry.weight} kg
              </Text>
            </View>
          ))}
        </View>
      </>
    ) : (
      <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}>
        <Ionicons name="stats-chart" size={64} color={theme.colors.onSurfaceVariant} />
        <Text style={[styles.emptyStateText, { color: theme.colors.onSurfaceVariant }]}>
          {t('noWeightHistory', { ns: 'common' })}
        </Text>
      </View>
    )}
  </View>
)}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <View style={styles.tabContent}>
              <Text style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>{t('personalInfo', { ns: 'common' })}</Text>

              <View style={styles.inputRow}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.colors.onSurface }]}>{t('height', { ns: 'common' })} (cm)</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.onSurface, borderColor: theme.colors.outline }]}
                    value={height}
                    onChangeText={setHeight}
                    keyboardType="numeric"
                    placeholder="175"
                    placeholderTextColor={theme.colors.onSurfaceVariant}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.colors.onSurface }]}>{t('age', { ns: 'common' })}</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.onSurface, borderColor: theme.colors.outline }]}
                    value={age}
                    onChangeText={setAge}
                    keyboardType="numeric"
                    placeholder="25"
                    placeholderTextColor={theme.colors.onSurfaceVariant}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.onSurface }]}>Update Email</Text>
                <TextInput
                  placeholder="New email address"
                  placeholderTextColor={theme.colors.onSurfaceVariant}
                  value={newEmail}
                  onChangeText={setNewEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.onSurface, borderColor: theme.colors.outline }]}
                />
                <Pressable
                  style={[styles.button, { backgroundColor: theme.colors.primary }, !newEmail.trim() && styles.disabled]}
                  onPress={handleUpdateEmail}
                  disabled={!newEmail.trim() || loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonTxt}>Update Email</Text>
                  )}
                </Pressable>
              </View>

              <View style={[styles.notificationSection, { backgroundColor: theme.colors.surface }]}>
                <View style={styles.notificationHeader}>
                  <View style={styles.notificationInfo}>
                    <Ionicons name="notifications" size={20} color={theme.colors.onSurface} />
                    <Text style={[styles.notificationTitle, { color: theme.colors.onSurface }]}>
                      Monthly Reminders
                    </Text>
                  </View>
                  <Pressable onPress={toggleNotifications}>
                    <View style={[
                      styles.toggle, 
                      { backgroundColor: notificationEnabled ? theme.colors.primary : theme.colors.outline }
                    ]}>
                      <View style={[
                        styles.toggleThumb,
                        { transform: [{ translateX: notificationEnabled ? 20 : 0 }] }
                      ]} />
                    </View>
                  </Pressable>
                </View>
                <Text style={[styles.notificationDescription, { color: theme.colors.onSurfaceVariant }]}>
                  {t('monthlyNotifications', { ns: 'common' })}
                </Text>
              </View>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// No final do arquivo profile.tsx, no StyleSheet, remova as duplicatas:

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 45,
  },
  headerContent: {
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { 
    fontSize: 32, 
    fontWeight: '700',
    color: '#fff',
  },
  settingsButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  profileSection: { 
    alignItems: 'center', 
    marginTop: -60,
    paddingHorizontal: 24,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarInnerRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: { 
    width: 104, 
    height: 104, 
    borderRadius: 52,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  username: { 
    fontSize: 28, 
    fontWeight: '700', 
    marginTop: 16,
  },
  email: { 
    fontSize: 16, 
    marginTop: 4,
    textAlign: 'center',
    maxWidth: '95%',
    paddingHorizontal: 20,
    includeFontPadding: false,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    width: '100%',
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },

  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginTop: 24,
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {},
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#d7eaecff',
  },

  tabContent: {
    paddingHorizontal: 24,
    marginTop: 24,
    marginBottom: 53,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
  },

  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputGroup: {
    flex: 1,
    marginHorizontal: 4,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1.2,
  },

  progressCard: {
    padding: 20,
    borderRadius: 16,
    marginTop: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  progressPercentage: {
    fontSize: 18,
    fontWeight: '700',
  },
  progressBar: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginVertical: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  progressText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '500',
  },
  bmiSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  bmiText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Chart Styles - APENAS UMA VEZ
  chartContainer: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  simpleChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 150,
    paddingHorizontal: 10,
  },
  barContainer: {
    alignItems: 'center',
    flex: 1,
  },
  barWrapper: {
    height: 100,
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 8,
  },
  bar: {
    width: 20,
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
  },
  barValue: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },

  // History Styles
  historySection: {
    marginTop: 20,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  clearButton: {
    fontSize: 14,
    fontWeight: '600',
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: '500',
  },
  historyWeight: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Empty State
  emptyState: {
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '500',
    lineHeight: 24,
  },

  // Notification Styles
  notificationSection: {
    padding: 20,
    borderRadius: 16,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  notificationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  notificationDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },

  button: {
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  disabled: {
    opacity: 0.6,
  },
  buttonTxt: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Skeleton styles
  headerSkeleton: { 
    height: 120, 
    backgroundColor: '#e5e5e5',
  },
  avatarSkeleton: {
    width: 120,
    height: 120,
    alignSelf: 'center',
    marginTop: 20,
    backgroundColor: '#e5e5e5',
    borderRadius: 60,
  },
  lineSkeleton: { 
    height: 20, 
    width: 200, 
    alignSelf: 'center', 
    marginTop: 10, 
    backgroundColor: '#e5e5e5',
    borderRadius: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
});