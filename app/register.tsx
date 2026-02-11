import 'react-native-url-polyfill/auto';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useTheme } from 'react-native-paper';
import { useTranslation } from '../hooks/useTranslation';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const { height, width } = Dimensions.get('window');

export default function RegisterScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [phone_number, setPhoneNumber] = useState('');
  const [confirmpassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Animações
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Animação de entrada
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Animação de pulso contínua
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  async function handleRegister() {
    setLoading(true);
    try {
      console.log('Attempting to register...');
      if (password !== confirmpassword) {
        console.log('Passwords do not match:', { password, confirmpassword });
        Alert.alert(t('error', { ns: 'common' }), 'Passwords do not match.');
        setLoading(false);
        return;
      }

      console.log('Passwords match, creating account...');
      console.log('Data for signUp:', { email });

      // 1. Criar conta com autenticação do Supabase
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      console.log('supabase.auth.signUp response:', { authData, authError });

      if (authError) {
        console.log('Authentication error:', authError.message, authError);
        Alert.alert('Error creating account', authError.message);
        setLoading(false);
        return;
      }

      console.log('Auth account created, inserting into ContasRegistradas...');
      console.log('Data for insert:', { username, user_email: email, phone_number });

      // 2. Inserir na tabela personalizada
      const { data: dbData, error: dbError } = await supabase.from('ContasRegistradas').insert([
        {
          username: username,
          user_email: email,
          phone_number: phone_number,
        },
      ]);

      console.log('Resposta do insert:', { dbData, dbError });

      if (dbError) {
        console.log('Error inserting into table:', dbError.message, dbError);
        Alert.alert('Account created, but failed to save additional data.', dbError.message);
        setLoading(false);
        router.replace('/login');
        return;
      }
      console.log('Database insert successful:', dbData);
      Alert.alert('Account created successfully!');
      router.replace('/login');
    } catch (e) {
      console.log('Erro inesperado no registro:', e);
      Alert.alert('Erro inesperado', String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient
      colors={[theme.colors.background, '#302b63', '#24243e']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientContainer}
    >
      {/* Efeito de partículas/círculos de fundo */}
      <View style={styles.backgroundEffects}>
        <Animated.View style={[styles.circle1, { 
          transform: [{ scale: pulseAnim }],
          backgroundColor: theme.colors.primary + '26',
          shadowColor: theme.colors.primary
        }]} />
        <Animated.View style={[styles.circle2, { 
          transform: [{ scale: pulseAnim }],
          backgroundColor: theme.colors.secondary + '26',
          shadowColor: theme.colors.secondary
        }]} />
        <Animated.View style={[styles.circle3, {
          backgroundColor: theme.colors.primary + '1A'
        }]} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [
                  { translateY: slideAnim },
                  { scale: scaleAnim }
                ],
              },
            ]}
          >
            {/* Logo */}
            <View style={styles.header}>
              <Image
                source={require('../assets/images/LOGO.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            {/* Título simples */}
            <Text style={[styles.screenTitle, { color: theme.colors.onSurface }]}>
              {t('register', { ns: 'common' })}
            </Text>

            {/* Card com blur e glassmorphism */}
            <BlurView intensity={20} tint="dark" style={styles.blurContainer}>
              <View style={[styles.card, { 
                backgroundColor: theme.colors.surface + 'CC',
                borderColor: theme.colors.outline + '30'
              }]}>
                <View style={styles.inputContainer}>
                  <LinearGradient
                    colors={[theme.colors.primary + '1A', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.inputGradient}
                  >
                    <TextInput
                      placeholder={t('name', { ns: 'common' })}
                      placeholderTextColor={theme.colors.onSurfaceVariant + '80'}
                      style={[styles.input, { 
                        color: theme.colors.onSurface,
                        backgroundColor: theme.colors.surface + 'CC',
                        borderColor: theme.colors.outline + '40'
                      }]}
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="words"
                    />
                  </LinearGradient>
                </View>

                <View style={styles.inputContainer}>
                  <LinearGradient
                    colors={[theme.colors.primary + '1A', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.inputGradient}
                  >
                    <TextInput
                      placeholder={t('email', { ns: 'common' })}
                      placeholderTextColor={theme.colors.onSurfaceVariant + '80'}
                      style={[styles.input, { 
                        color: theme.colors.onSurface,
                        backgroundColor: theme.colors.surface + 'CC',
                        borderColor: theme.colors.outline + '40'
                      }]}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </LinearGradient>
                </View>

                <View style={styles.inputContainer}>
                  <LinearGradient
                    colors={[theme.colors.primary + '1A', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.inputGradient}
                  >
                    <TextInput
                      placeholder="Phone number"
                      placeholderTextColor={theme.colors.onSurfaceVariant + '80'}
                      style={[styles.input, { 
                        color: theme.colors.onSurface,
                        backgroundColor: theme.colors.surface + 'CC',
                        borderColor: theme.colors.outline + '40'
                      }]}
                      value={phone_number}
                      onChangeText={setPhoneNumber}
                      keyboardType="phone-pad"
                    />
                  </LinearGradient>
                </View>

                <View style={styles.inputContainer}>
                  <LinearGradient
                    colors={[theme.colors.primary + '1A', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.inputGradient}
                  >
                    <TextInput
                      placeholder={t('password', { ns: 'common' })}
                      placeholderTextColor={theme.colors.onSurfaceVariant + '80'}
                      style={[styles.input, { 
                        color: theme.colors.onSurface,
                        backgroundColor: theme.colors.surface + 'CC',
                        borderColor: theme.colors.outline + '40'
                      }]}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                    />
                  </LinearGradient>
                </View>

                <View style={styles.inputContainer}>
                  <LinearGradient
                    colors={[theme.colors.primary + '1A', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.inputGradient}
                  >
                    <TextInput
                      placeholder={`${t('confirm', { ns: 'common' })} ${t('password', { ns: 'common' })}`}
                      placeholderTextColor={theme.colors.onSurfaceVariant + '80'}
                      style={[styles.input, { 
                        color: theme.colors.onSurface,
                        backgroundColor: theme.colors.surface + 'CC',
                        borderColor: theme.colors.outline + '40'
                      }]}
                      value={confirmpassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry
                    />
                  </LinearGradient>
                </View>
              </View>
            </BlurView>

            {/* Botão moderno e limpo */}
            <View style={styles.bottomArea}>
              <TouchableOpacity
                onPress={handleRegister}
                disabled={loading}
                activeOpacity={0.85}
                style={[styles.primaryBtn, { 
                  opacity: loading ? 0.7 : 1,
                  backgroundColor: theme.colors.primary,
                  shadowColor: theme.colors.primary
                }]}
              >
                {loading ? (
                  <ActivityIndicator color={theme.colors.onPrimary} />
                ) : (
                  <Text style={[styles.primaryBtnTxt, { color: theme.colors.onPrimary }]}>
                    {t('register', { ns: 'common' })}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.replace('/login')} style={styles.footer}>
                <Text style={[styles.footerText, { color: theme.colors.onSurface }]}>
                  If you already have an account, Login
                </Text>
                <View style={[styles.underline, { backgroundColor: theme.colors.primary + '80' }]} />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  backgroundEffects: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  circle1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    top: -100,
    right: -100,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 50,
  },
  circle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    bottom: -50,
    left: -50,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 50,
  },
  circle3: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    top: '50%',
    right: '10%',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  content: {
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 150,
    height: 110,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
  blurContainer: {
    width: '100%',
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 24,
  },
  card: {
    width: '100%',
    paddingHorizontal: 24,
    paddingVertical: 28,
    borderWidth: 1,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputGradient: {
    borderRadius: 999,
    padding: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontSize: 16,
  },
  bottomArea: {
    width: '100%',
    alignItems: 'center',
  },
  primaryBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryBtnTxt: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 15,
    fontWeight: '500',
  },
  underline: {
    width: '100%',
    height: 1,
    marginTop: 2,
  },
});