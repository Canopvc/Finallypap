/* eslint-disable import/namespace */
import { Ionicons } from '@expo/vector-icons';
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
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { useTranslation } from '../../hooks/useTranslation';
import { useThemeContext } from '../../contexts/ThemeContext';
import Svg, { Path } from "react-native-svg";
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/client';
import { getAppTheme } from '../../lib/theme';
import * as FileSystem from 'expo-file-system';

const WEIGHT_GOALS_KEY = 'weightGoals';
const WEIGHT_HISTORY_KEY = 'weightHistory';
const NOTIFICATION_SETTINGS_KEY = 'notificationSettings';
const ALARM_SETTINGS_KEY = 'alarmSettings';

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
  const { themeMode, setThemeMode, colorScheme } = useThemeContext();
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
  const [useDeviceAlarm, setUseDeviceAlarm] = useState(false); 
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [showChangeImageDialog, setShowChangeImageDialog] = useState(false);
  const [uploading, setUploading] = useState(false);

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
  }, [fadeAnim, progressAnim]);

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
      await loadAlarmSettings();
      await loadProfileImage();

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

  const loadAlarmSettings = async () => {
    try {
      const settings = await AsyncStorage.getItem(ALARM_SETTINGS_KEY);
      if (settings) {
        const { useDeviceAlarm: savedSetting } = JSON.parse(settings);
        setUseDeviceAlarm(savedSetting || false);
      }
    } catch (error) {
      console.error('Error loading alarm settings:', error);
    }
  };

  const toggleDeviceAlarm = async () => {
    try {
      const newSetting = !useDeviceAlarm;
      setUseDeviceAlarm(newSetting);

      await AsyncStorage.setItem(
        ALARM_SETTINGS_KEY,
        JSON.stringify({ useDeviceAlarm: newSetting })
      );

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert(
        'Alarm Settings Updated',
        newSetting
          ? 'Device alarm will be used for workout timers'
          : 'App sounds will be used for workout timers'
      );
    } catch (error) {
      console.error('Error saving alarm settings:', error);
      Alert.alert('Error', 'Could not save alarm settings.');
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
      const bmiNum = calculateBMI();

      const newWeightEntry = {
        weight: weightNum,
        date: new Date().toISOString(),
        timestamp: Date.now(),
      };

      const updatedHistory = [...weightHistory, newWeightEntry]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 30);

      setWeightHistory(updatedHistory);

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

      const { error: userError } = await supabase
        .from('ContasRegistradas')
        .upsert({
          user_email: email,
          username: username,
          Weight: parseFloat(goals.weight) || null,
          BMI: parseFloat(bmi) || null,
          height: parseFloat(goals.height) || null,
          age: parseInt(goals.age) || null,
        }, {
          onConflict: 'user_email'
        });

      if (userError) {
        console.error('❌ Erro ao salvar dados:', userError);
        return;
      }

      console.log('✅ Dados enviados com sucesso para CONTASREGISTRADAS');

    } catch (error) {
      console.error('❌ Erro inesperado:', error);
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

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (newNotificationEnabled) {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === 'granted') {
          Alert.alert('Success', 'Monthly reminders enabled!');
        } else {
          Alert.alert('Permission Required', 'Please enable notifications in settings.');
        }
      } else {
        await Notifications.cancelAllScheduledNotificationsAsync();
        Alert.alert('Success', 'Monthly reminders disabled.');
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
      Alert.alert('Error', 'Could not update notification settings.');
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
      const { error } = await supabase.auth.updateUser({
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

  const handleChooseImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Por favor, permita o acesso à galeria nas configurações.');
        return;
      }
  
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
  
      if (!result.canceled && result.assets[0]) {
        await handleUploadProfileImage(result.assets[0]);
      }
      
    } catch (error) {
      console.error('Erro ao escolher imagem:', error);
      Alert.alert('Erro', 'Não foi possível escolher a imagem.');
    } finally {
      setShowChangeImageDialog(false);
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Por favor, permita o acesso à câmera nas configurações.');
        return;
      }
  
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
  
      if (!result.canceled && result.assets[0]) {
        await handleUploadProfileImage(result.assets[0]);
      }
      
    } catch (error) {
      console.error('Erro ao tirar foto:', error);
      Alert.alert('Erro', 'Não foi possível tirar a foto.');
    } finally {
      setShowChangeImageDialog(false);
    }
  };

  // Função auxiliar para converter URI para Blob
  const uriToBlob = async (uri: string): Promise<Blob> => {
    const response = await fetch(uri);
    return await response.blob();
  };

  const uploadViaRestAPI = async (blob: Blob, fileName: string, accessToken: string) => {
    try {
      console.log('🔄 Upload via API REST...');
      
      // Converter blob para base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const formData = new FormData();
      formData.append('file', {
        uri: `data:image/jpeg;base64,${base64}`,
        type: 'image/jpeg',
        name: fileName,
      } as any);
      
      const uploadUrl = `https://qocrpcfrhkoritoomgzx.supabase.co/storage/v1/object/USER_IMAGE/${fileName}`;
      
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvY3JwY2ZyaGtvcml0b29tZ3p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5OTMwNTAsImV4cCI6MjA2NzU2OTA1MH0.ghC4kqLz1cvB4Oz2olFRyudCLxr__I1-v3_n35V8SbE',
        },
        body: formData,
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || `HTTP ${response.status}`);
      }
      
      console.log('✅ Upload REST funcionou!', result);
      return { success: true, data: result };
      
    } catch (error: any) {
      console.error('❌ Upload REST falhou:', error);
      return { success: false, error: error.message };
    }
  };

  // FUNÇÃO PRINCIPAL DE UPLOAD
  const handleUploadProfileImage = async (imageAsset: any) => {
    try {
      setUploading(true);
      setShowChangeImageDialog(false);
      
      console.log('📱 Iniciando upload...');
      
      // 1. OBTER SESSÃO ATUAL
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        Alert.alert('Sessão Expirada', 'Faça login novamente.');
        await supabase.auth.signOut();
        router.replace('/login');
        return;
      }
      
      const accessToken = session.access_token;
      console.log('✅ Token JWT obtido');
      
      // 2. Obter nome da imagem atual (se existir)
      const oldImageName = await getCurrentImageFilename();
      console.log('📄 Imagem atual:', oldImageName || 'Nenhuma');
      
      // 3. Converter para Blob
      console.log('Convertendo imagem para Blob...');
      const blob = await uriToBlob(imageAsset.uri);
      console.log(`Blob criado: ${Math.round(blob.size / 1024)}KB`);
      
      // 4. Verificar tamanho
      if (blob.size > 5 * 1024 * 1024) {
        Alert.alert('Arquivo Grande', 'A imagem deve ter menos de 5MB.');
        setUploading(false);
        return;
      }
      
      // 5. Preparar nome do arquivo
      const fileExt = imageAsset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      
      if (!allowedExtensions.includes(fileExt)) {
        Alert.alert('Formato Inválido', 'Use apenas imagens JPG, PNG ou GIF.');
        setUploading(false);
        return;
      }
      
      // Usar nome consistente: profile_{userId}.{ext}
      // Isso substitui a imagem existente
      const fileName = `profile_${userId}.${fileExt}`;
      console.log('📝 Nome do arquivo:', fileName);
      
      // 6. Fazer upload da nova imagem
      console.log('🚀 Fazendo upload da nova imagem...');
      
      const uploadResult = await uploadViaRestAPI(blob, fileName, accessToken);
      
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Upload falhou');
      }
      
      console.log('✅ Upload concluído!');
      
      // 7. Obter URL pública
      const publicUrl = `https://qocrpcfrhkoritoomgzx.supabase.co/storage/v1/object/public/USER_IMAGE/${fileName}`;
      console.log('🔗 URL pública:', publicUrl);
      
      // 8. Deletar imagem antiga (se existir e for diferente da nova)
      if (oldImageName && oldImageName !== fileName) {
        await deleteOldImage(oldImageName);
      }
      
      // 9. Atualizar banco de dados
      console.log('💾 Atualizando CONTASREGISTRADAS...');
      const { error: dbError } = await supabase
        .from('ContasRegistradas')
        .upsert({
          user_email: email,
          username: username,
          profile_image_url: publicUrl,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_email'
        });
      
      if (dbError) {
        console.error('❌ Erro ao atualizar CONTASREGISTRADAS:', dbError);
      } else {
        console.log('✅ Dados atualizados na CONTASREGISTRADAS');
      }
      
      // 10. Atualizar estado local
      setProfileImage(publicUrl);
      await AsyncStorage.setItem('profile_image', publicUrl);
      
      Alert.alert('Sucesso!', 'Foto de perfil atualizada com sucesso.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
    } catch (error: any) {
      console.error('💥 ERRO NO PROCESSO DE UPLOAD:', error?.message || error);
      
      // Mensagens de erro mais específicas
      let errorMessage = 'Não foi possível completar o upload. Tente novamente.';
      
      if (error.message.includes('409') || error.message.includes('Duplicate')) {
        errorMessage = 'Já existe uma imagem com este nome. Tente novamente.';
      } else if (error.message.includes('413')) {
        errorMessage = 'A imagem é muito grande. Use uma foto menor.';
      } else if (error.message.includes('403')) {
        errorMessage = 'Permissão negada. Verifique as configurações do bucket.';
      }
      
      Alert.alert('Erro', errorMessage);
      
    } finally {
      setUploading(false);
    }
  };

  const getCurrentImageFilename = async (): Promise<string | null> => {
    try {
      if (!email) return null;
      
      const { data } = await supabase
        .from('ContasRegistradas')
        .select('profile_image_url')
        .eq('user_email', email)
        .single();
      
      if (data?.profile_image_url) {
        // Extrai o nome do arquivo da URL
        const url = data.profile_image_url;
        const fileName = url.split('/').pop(); // Pega a última parte da URL
        return fileName || null;
      }
      
      return null;
    } catch (error) {
      console.error('Erro ao obter nome do arquivo atual:', error);
      return null;
    }
  };

  const deleteOldImage = async (fileName: string): Promise<boolean> => {
    try {
      console.log(`🗑️ Tentando deletar imagem antiga: ${fileName}`);
      
      // Obter sessão atual
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;
      
      // Usar o storage API do Supabase
      const { error } = await supabase
        .storage
        .from('USER_IMAGE')
        .remove([fileName]);
      
      if (error) {
        console.error('❌ Erro ao deletar imagem antiga:', error);
        return false;
      }
      
      console.log('✅ Imagem antiga deletada com sucesso');
      return true;
    } catch (error) {
      console.error('❌ Erro inesperado ao deletar:', error);
      return false;
    }
  };

  const loadProfileImage = async () => {
    try {
      const cachedImage = await AsyncStorage.getItem('profile_image');
      if (cachedImage) {
        setProfileImage(cachedImage);
      }
    
      if (email) {
        const { data } = await supabase
          .from('ContasRegistradas')
          .select('profile_image_url')
          .eq('user_email', email)
          .single();

        if (data && data.profile_image_url) {
          setProfileImage(data.profile_image_url);
          await AsyncStorage.setItem('profile_image', data.profile_image_url);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar imagem:', error);
    }
  };

  const deleteAllProfileImagesFromBucket = async (): Promise<{ success: boolean; deletedCount: number; error?: string }> => {
    try {
      console.log('🧹 Iniciando limpeza completa do bucket...');
      
      // 1. Obter sessão
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, deletedCount: 0, error: 'Sessão não encontrada' };
      }
      
      // 2. Listar TODOS os arquivos do bucket USER_IMAGE
      const { data: files, error: listError } = await supabase
        .storage
        .from('USER_IMAGE')
        .list();
      
      if (listError) {
        console.error('❌ Erro ao listar arquivos:', listError);
        return { success: false, deletedCount: 0, error: listError.message };
      }
      
      if (!files || files.length === 0) {
        console.log('📭 Bucket já está vazio');
        return { success: true, deletedCount: 0 };
      }
      
      console.log(`📁 Total de arquivos no bucket: ${files.length}`);
      
      // 4. Deletar todos os arquivos (em lotes de 100)
      const allFileNames = files.map(file => file.name);
      const batches = [];
      
      for (let i = 0; i < allFileNames.length; i += 100) {
        batches.push(allFileNames.slice(i, i + 100));
      }
      
      let totalDeleted = 0;
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`🔄 Deletando lote ${i + 1}/${batches.length} (${batch.length} arquivos)...`);
        
        const { error: deleteError } = await supabase
          .storage
          .from('USER_IMAGE')
          .remove(batch);
        
        if (deleteError) {
          console.error(`❌ Erro ao deletar lote ${i + 1}:`, deleteError);
          return { success: false, deletedCount: totalDeleted, error: deleteError.message };
        }
        
        totalDeleted += batch.length;
      }
      
      console.log(`✅ ${totalDeleted} arquivos deletados do bucket`);
      
      // 5. Verificar se o bucket está vazio
      const { data: remainingFiles } = await supabase
        .storage
        .from('USER_IMAGE')
        .list();
      
      if (remainingFiles && remainingFiles.length > 0) {
        console.warn(`⚠️ Ainda restam ${remainingFiles.length} arquivos no bucket`);
      }
      
      return { success: true, deletedCount: totalDeleted };
      
    } catch (error: any) {
      console.error('💥 Erro inesperado na limpeza do bucket:', error);
      return { success: false, deletedCount: 0, error: error.message };
    }
  };

  const deleteAllLocalImages = async (): Promise<{ success: boolean; deletedCount: number }> => {
  try {
    console.log('📱 Limpando imagens locais do dispositivo...');
    
    let deletedCount = 0;
    
    // 1. Limpar todas as chaves relacionadas a imagens no AsyncStorage
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      console.log(`📁 Total de chaves no AsyncStorage: ${allKeys.length}`);
      
      // Filtrar chaves relacionadas a imagens
      const imageRelatedKeys = allKeys.filter(key => {
        const keyLower = key.toLowerCase();
        return (
          keyLower.includes('image') || 
          keyLower.includes('avatar') || 
          keyLower.includes('profile') ||
          keyLower.includes('photo') ||
          keyLower.includes('picture') ||
          key === 'profile_image' // chave específica que você usa
        );
      });
      
      console.log(`🔑 Chaves de imagem encontradas: ${imageRelatedKeys.length}`);
      
      if (imageRelatedKeys.length > 0) {
        await AsyncStorage.multiRemove(imageRelatedKeys);
        console.log(`✅ ${imageRelatedKeys.length} chaves de imagem removidas do AsyncStorage`);
        deletedCount = imageRelatedKeys.length;
      } else {
        console.log('📭 Nenhuma chave de imagem encontrada no AsyncStorage');
      }
      
    } catch (storageError) {
      console.error('❌ Erro ao limpar AsyncStorage:', storageError);
      return { success: false, deletedCount: 0 };
    }
    
    // 2. Limpar estado local
    setProfileImage(null);
    
    // 3. Forçar atualização do componente
    setTimeout(() => {
      loadProfileImage().catch(console.error);
    }, 100);
    
    console.log(`✅ ${deletedCount} itens locais removidos com sucesso`);
    
    return { success: true, deletedCount };
    
  } catch (error: any) {
    console.error('💥 Erro inesperado ao limpar imagens locais:', error);
    return { success: false, deletedCount: 0 };
  }
};

  const cleanupAllImages = async (): Promise<void> => {
    try {
      // 1. Confirmar com o usuário (IMPORTANTE!)
      Alert.alert(
        '⚠️ Limpeza Total',
        'Tem certeza que deseja apagar TODAS as imagens?\n\nEsta ação irá:'
        + '\n• Apagar todas as imagens do servidor'
        + '\n• Remover imagens locais do dispositivo'
        + '\n• Resetar sua foto de perfil',
        [
          {
            text: 'Cancelar',
            style: 'cancel',
            onPress: () => console.log('Limpeza cancelada pelo usuário')
          },
          {
            text: 'LIMPAR TUDO',
            style: 'destructive',
            onPress: async () => {
              try {
                // Mostrar loading
                setBusy(true);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                
                // 2. Apagar do bucket (servidor)
                console.log('🚀 Iniciando limpeza do servidor...');
                const bucketResult = await deleteAllProfileImagesFromBucket();
                
                if (!bucketResult.success) {
                  Alert.alert(
                    'Atenção',
                    `Não foi possível limpar todas as imagens do servidor.\n\nErro: ${bucketResult.error}`
                  );
                }
                
                // 3. Apagar locais
                console.log('📱 Iniciando limpeza local...');
                const localResult = await deleteAllLocalImages();
                
                // 4. Atualizar banco de dados para remover referências
                console.log('🗄️ Atualizando banco de dados...');
                if (email) {
                  const { error: updateError } = await supabase
                    .from('ContasRegistradas')
                    .update({
                      profile_image_url: null,
                      updated_at: new Date().toISOString()
                    })
                    .eq('user_email', email);
                  
                  if (updateError) {
                    console.error('❌ Erro ao atualizar banco:', updateError);
                  } else {
                    console.log('✅ Banco de dados atualizado');
                  }
                }
                
                // 5. Feedback para o usuário
                let message = 'Limpeza concluída!';
                
                if (bucketResult.deletedCount > 0 || localResult.deletedCount > 0) {
                  message = `✅ Limpeza concluída com sucesso!\n\n` +
                            `• ${bucketResult.deletedCount} imagens removidas do servidor\n` +
                            `• ${localResult.deletedCount} itens removidos localmente`;
                } else {
                  message = '✅ Não havia imagens para remover.';
                }
                
                Alert.alert('Sucesso', message);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                
              } catch (error: any) {
                console.error('💥 Erro durante a limpeza completa:', error);
                Alert.alert('Erro', 'Ocorreu um erro durante a limpeza: ' + error.message);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                
              } finally {
                setBusy(false);
              }
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('❌ Erro ao iniciar limpeza:', error);
    }
  };

  const renderChangeImageDialog = () => {
    return (
      showChangeImageDialog && (
        <View style={styles.dialogOverlay}>
          <View style={[styles.dialogContainer, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.dialogTitle, { color: theme.colors.onSurface }]}>
              Alterar foto de perfil
            </Text>
            <Text style={[styles.dialogMessage, { color: theme.colors.onSurfaceVariant }]}>
              Como deseja alterar sua foto de perfil?
            </Text>
            
            <View style={styles.dialogButtons}>
              <Pressable
                style={[styles.dialogButton, styles.cancelButton]}
                onPress={() => setShowChangeImageDialog(false)}
              >
                <Text style={[styles.dialogButtonText, { color: theme.colors.onSurfaceVariant }]}>
                  Cancelar
                </Text>
              </Pressable>
              
              <Pressable
                style={[styles.dialogButton, styles.actionButton]}
                onPress={takePhoto}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="camera" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Tirar foto</Text>
                  </>
                )}
              </Pressable>
              
              <Pressable
                style={[styles.dialogButton, styles.actionButton]}
                onPress={handleChooseImage}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="image" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Escolher da galeria</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      )
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
                <Svg
                  width={26}
                  height={26}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth={1.5}
                >
                  <Path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
                  />
                </Svg>
              </Pressable>
            </View>
          </View>

          {/* Avatar & info */}
          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              <View style={[styles.avatarRing, { backgroundColor: theme.colors.primary }]}>
                <View style={styles.avatarInnerRing}>
                  <Pressable
                    onPress={() => setShowChangeImageDialog(true)}
                    style={styles.imagePressable}
                  >
                    <Image
                      source={
                        profileImage ? { uri: profileImage } : require('../../assets/images/LoginImage.jpg')
                      }
                      style={styles.avatar}
                      contentFit="cover"
                    />
                  </Pressable> 
                </View>
              </View>
              <Pressable 
                style={[styles.editAvatarButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => setShowChangeImageDialog(true)}
              >
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
              <Text style={[styles.tabText, { color: theme.colors.primary }, activeTab === 'goals' && styles.activeTabText]}>
                {t('goals', { ns: 'common' })}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === 'progress' && [styles.activeTab, { backgroundColor: theme.colors.primary }]]}
              onPress={() => setActiveTab('progress')}
            >
              <Text style={[styles.tabText, { color: theme.colors.primary }, activeTab === 'progress' && styles.activeTabText]}>
                {t('Progress', { ns: 'common' })}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === 'profile' && [styles.activeTab, { backgroundColor: theme.colors.primary }]]}
              onPress={() => setActiveTab('profile')}
            >
              <Text style={[styles.tabText, { color: theme.colors.primary }, activeTab === 'profile' && styles.activeTabText]}>
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

              {/* Botão para limpar imagens */}
              <Pressable
                style={[styles.button, { backgroundColor: '#FF6B6B', marginTop: 20 }]}
                onPress={cleanupAllImages}
              >
                <Ionicons name="trash-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.buttonTxt}>Limpar Todas as Imagens</Text>
              </Pressable>
            </View>
          )}

          {/* Progress Tab */}
          {activeTab === 'progress' && (
            <View style={styles.tabContent}>
              <Text style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>{t('weightProgress', { ns: 'common' })}</Text>

              {weightHistory.length > 0 ? (
                <>
                  <View style={[styles.chartContainer, { backgroundColor: theme.colors.surface }]}>
                    <Text style={[styles.chartTitle, { color: theme.colors.onSurface }]}>
                      {t('weightHistory', { ns: 'common' })}
                    </Text>

                    <View style={styles.simpleChart}>
                      {chartData.map((item, index) => {
                        const maxWeight = Math.max(...chartData.map(d => d.weight));
                        const minWeight = Math.min(...chartData.map(d => d.weight));
                        const range = maxWeight - minWeight;
                        const barHeight = ((item.weight - minWeight) / range) * 80 + 20;

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
                    <Ionicons name="alarm-outline" size={20} color={theme.colors.onSurface} />
                    <Text style={[styles.notificationTitle, { color: theme.colors.onSurface }]}>
                      Workout Timer Alarm
                    </Text>
                  </View>
                  <Pressable onPress={toggleDeviceAlarm}>
                    <View style={[
                      styles.toggle,
                      { backgroundColor: useDeviceAlarm ? theme.colors.primary : theme.colors.outline }
                    ]}>
                      <View style={[
                        styles.toggleThumb,
                        { transform: [{ translateX: useDeviceAlarm ? 20 : 0 }] }
                      ]} />
                    </View>
                  </Pressable>
                </View>
                <Text style={[styles.notificationDescription, { color: theme.colors.onSurfaceVariant }]}>
                  {useDeviceAlarm
                    ? 'Using device default alarm sound (loudest)'
                    : 'Using app sounds for workout timers'
                  }
                </Text>
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

              <View style={[styles.notificationSection, { backgroundColor: theme.colors.surface }]}>
                <View style={styles.notificationHeader}>
                  <View style={styles.notificationInfo}>
                    <Ionicons
                      name={colorScheme === 'dark' ? 'moon' : 'sunny'}
                      size={20}
                      color={theme.colors.onSurface}
                    />
                    <Text style={[styles.notificationTitle, { color: theme.colors.onSurface }]}>
                      App Theme
                    </Text>
                  </View>
                </View>
                <Text style={[styles.notificationDescription, { color: theme.colors.onSurfaceVariant, marginBottom: 12 }]}>
                  Choose how the app theme should behave
                </Text>

                <View style={styles.themeOptions}>
                  <Pressable
                    onPress={() => {
                      setThemeMode('automatic');
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={[
                      styles.themeOption,
                      {
                        backgroundColor: themeMode === 'automatic' ? theme.colors.primaryContainer : theme.colors.surfaceVariant,
                        borderColor: themeMode === 'automatic' ? theme.colors.primary : theme.colors.outline,
                      }
                    ]}
                  >
                    <Ionicons
                      name="phone-portrait"
                      size={18}
                      color={themeMode === 'automatic' ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant}
                    />
                    <Text style={[
                      styles.themeOptionText,
                      { color: themeMode === 'automatic' ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant }
                    ]}>
                      Automatic
                    </Text>
                    {themeMode === 'automatic' && (
                      <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />
                    )}
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setThemeMode('light');
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={[
                      styles.themeOption,
                      {
                        backgroundColor: themeMode === 'light' ? theme.colors.primaryContainer : theme.colors.surfaceVariant,
                        borderColor: themeMode === 'light' ? theme.colors.primary : theme.colors.outline,
                      }
                    ]}
                  >
                    <Ionicons
                      name="sunny"
                      size={18}
                      color={themeMode === 'light' ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant}
                    />
                    <Text style={[
                      styles.themeOptionText,
                      { color: themeMode === 'light' ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant }
                    ]}>
                      Light
                    </Text>
                    {themeMode === 'light' && (
                      <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />
                    )}
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setThemeMode('dark');
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={[
                      styles.themeOption,
                      {
                        backgroundColor: themeMode === 'dark' ? theme.colors.primaryContainer : theme.colors.surfaceVariant,
                        borderColor: themeMode === 'dark' ? theme.colors.primary : theme.colors.outline,
                      }
                    ]}
                  >
                    <Ionicons
                      name="moon"
                      size={18}
                      color={themeMode === 'dark' ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant}
                    />
                    <Text style={[
                      styles.themeOptionText,
                      { color: themeMode === 'dark' ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant }
                    ]}>
                      Dark
                    </Text>
                    {themeMode === 'dark' && (
                      <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        </Animated.View>
      </ScrollView>
      {renderChangeImageDialog()}
    </KeyboardAvoidingView>
  );
}

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

  // Chart Styles
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
  dialogOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  dialogContainer: {
    width: '85%',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  dialogMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  dialogButtons: {
    flexDirection: 'column',
    gap: 12,
  },
  dialogButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#e5e5e5',
  },
  actionButton: {
    backgroundColor: '#007AFF',
  },
  dialogButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  imagePressable: {
    width: '100%',
    height: '100%',
    borderRadius: 52,
    overflow: 'hidden',
  },
  notificationDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  themeOptions: {
    gap: 12,
    marginTop: 8,
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    gap: 12,
  },
  themeOptionText: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
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