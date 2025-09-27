import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { supabase } from '../../lib/supabase';

const WEIGHT_GOALS_KEY = 'weightGoals';

export default function ProfileScreen() {
  const theme = useTheme();
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
  const router = useRouter();

  // Carregar dados do usuário e metas de peso
  const getUserData = async () => {
    setBusy(true);
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      Alert.alert('Error', 'Could not fetch user data.');
      setBusy(false);
      return;
    }
    const user = data.user;
    setUserId(user.id);
    setEmail(user.email ?? '');

    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();
    setUsername(profile?.username ?? 'User');

    await loadWeightGoals();
    setBusy(false);
  };

  const loadWeightGoals = async () => {
    try {
      const savedGoals = await AsyncStorage.getItem(WEIGHT_GOALS_KEY);
      if (savedGoals) {
        const goals = JSON.parse(savedGoals);
        setWeight(goals.weight || '');
        setWeightGoal(goals.weightGoal || '');
        setTargetDate(goals.targetDate || '');
      }
    } catch (error) {
      console.error('Error loading weight goals:', error);
    }
  };

  const saveWeightGoals = async () => {
    try {
      const goals = {
        weight,
        weightGoal,
        targetDate,
        savedAt: new Date().toISOString(),
      };

      await AsyncStorage.setItem(WEIGHT_GOALS_KEY, JSON.stringify(goals));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert('Success', 'Weight goals saved!');
    } catch (error) {
      console.error('Error saving weight goals:', error);
      Alert.alert('Error', 'Could not save weight goals.');
    }
  };

  const calculateProgress = () => {
    const current = parseFloat(weight) || 0;
    const target = parseFloat(weightGoal) || 0;
    const startWeight = 80;

    if (current === 0 || target === 0) return 0;

    const totalChange = Math.abs(startWeight - target);
    const currentChange = Math.abs(startWeight - current);

    return Math.min(100, Math.max(0, (currentChange / totalChange) * 100));
  };

  const calculateWeightDifference = () => {
    const current = parseFloat(weight) || 0;
    const target = parseFloat(weightGoal) || 0;

    if (current === 0 || target === 0) return 0;

    return Math.abs(current - target);
  };

  useEffect(() => {
    getUserData();
  }, []);

  const handleUpdateEmail = async () => {
    if (!newEmail.trim()) return;
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setLoading(false);
    if (error) {
      Alert.alert('Update failed', error.message);
    } else {
      setEmail(newEmail);
      setNewEmail('');
      Alert.alert('Success', 'Check your inbox to confirm the new address.');
    }
  };

  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Logout failed', error.message);
    else router.replace('/login');
  };

  if (busy) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.headerSkeleton} />
        <View style={styles.avatarSkeleton} />
        <View style={styles.lineSkeleton} />
      </View>
    );
  }

  const progressPercentage = calculateProgress();
  const weightDifference = calculateWeightDifference();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>Profile</Text>
          <Pressable onPress={handleLogout} hitSlop={20}>
            <Image
              source={require('../../assets/images/Settings-Icon.png')}
              style={[styles.settingsIcon, { tintColor: theme.colors.onSurface }]}
            />
          </Pressable>
        </View>

        {/* Avatar & info */}
        <View style={styles.profileSection}>
          <View style={[styles.avatarRing, { backgroundColor: theme.colors.primary }]}>
            <View style={styles.avatarRing}>
              <Image
                source={require('../../assets/images/LoginImage.jpg')}
                style={styles.avatar}
                contentFit="cover"
              />
            </View>
          </View>
          <Text style={[styles.username, { color: theme.colors.onBackground }]}>{username}</Text>
          <Text style={[styles.email, { color: theme.colors.onSurfaceVariant ?? theme.colors.onSurface }]}>{email}</Text>
        </View>

        {/* Weight Goals Section */}
        <View style={styles.goalsSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>Weight Goals</Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.onSurface }]}>Current Weight (kg)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.onSurface, borderColor: theme.colors.outline }]}
              value={weight}
              onChangeText={setWeight}
              keyboardType="numeric"
              placeholder="80.0"
              placeholderTextColor={theme.colors.onSurfaceVariant ?? theme.colors.onSurface}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.onSurface }]}>Target Weight (kg)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.onSurface, borderColor: theme.colors.outline }]}
              value={weightGoal}
              onChangeText={setWeightGoal}
              keyboardType="numeric"
              placeholder="65.0"
              placeholderTextColor={theme.colors.onSurfaceVariant ?? theme.colors.onSurface}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.onSurface }]}>Target Date</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.onSurface, borderColor: theme.colors.outline }]}
              value={targetDate}
              onChangeText={setTargetDate}
              placeholder="2025-01-01"
              placeholderTextColor={theme.colors.onSurfaceVariant ?? theme.colors.onSurface}
            />
          </View>

          {(weight && weightGoal) && (
            <View style={[styles.progressCard, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.progressTitle, { color: theme.colors.onSurface }]}>Progress</Text>
              <View style={[styles.progressBar, { backgroundColor: theme.colors.outline }]}>
                <View style={[styles.progressFill, { width: `${progressPercentage}%`, backgroundColor: theme.colors.primary }]} />
              </View>
              <Text style={[styles.progressText, { color: theme.colors.onSurfaceVariant ?? theme.colors.onSurface }]}>
                {weightDifference.toFixed(1)}kg to go • {progressPercentage.toFixed(1)}% complete
              </Text>
            </View>
          )}

          <Pressable
            style={[styles.button, { backgroundColor: theme.colors.primary }, (!weight || !weightGoal) && styles.disabled]}
            onPress={saveWeightGoals}
            disabled={!weight || !weightGoal}
          >
            <Text style={styles.buttonTxt}>Save Goals</Text>
          </Pressable>
        </View>

        {/* Update email */}
        <View style={styles.form}>
          <TextInput
            placeholder="New email address"
            placeholderTextColor={theme.colors.onSurfaceVariant ?? theme.colors.onSurface}
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* styles */
const skeleton = { backgroundColor: '#e5e5e5', borderRadius: 12 };

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 24,
    paddingBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerSkeleton: { height: 120, ...skeleton, borderRadius: 0 },
  title: { fontSize: 28, fontWeight: '700' },
  settingsIcon: { width: 32, height: 32 },

  profileSection: { alignItems: 'center', marginTop: -40 },
  avatarRing: {
    width: 124,
    height: 124,
    borderRadius: 62,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  avatar: { width: 116, height: 116, borderRadius: 58 },
  avatarSkeleton: {
    width: 120,
    height: 120,
    alignSelf: 'center',
    marginTop: 20,
    ...skeleton,
  },
  username: { fontSize: 26, fontWeight: '700', marginTop: 12 },
  email: { fontSize: 16, marginTop: 4 },

  lineSkeleton: { height: 20, width: 200, alignSelf: 'center', marginTop: 10, ...skeleton },

  form: { paddingHorizontal: 24, marginTop: 36 },
  input: { paddingVertical: 14, paddingHorizontal: 18, borderRadius: 12, fontSize: 16, borderWidth: 1.2 },
  button: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#0072ff',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabled: { opacity: 0.6 },
  buttonTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },

  goalsSection: { paddingHorizontal: 24, marginTop: 24 },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  progressCard: { padding: 16, borderRadius: 12, marginTop: 16, marginBottom: 16 },
  progressTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  progressBar: { height: 8, borderRadius: 4, overflow: 'hidden', marginVertical: 8 },
  progressFill: { height: '100%', borderRadius: 4 },
  progressText: { fontSize: 14, textAlign: 'center', marginTop: 8 },
});
