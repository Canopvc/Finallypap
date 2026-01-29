import 'react-native-url-polyfill/auto';
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useTheme } from 'react-native-paper';
import { useTranslation } from '../hooks/useTranslation';
import { LinearGradient } from 'expo-linear-gradient';

const { height } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError(t('pleaseFill', { ns: 'common' }));
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('Erro no login:', error);
      setError(error.message || t('couldNotSave', { ns: 'common' }));
      setIsLoading(false);
    }
  };

  const handleRegister = () => {
    router.push('/register');
  };

  return (
  <LinearGradient
    colors={['#020917', '#020024', '#000000']}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={styles.gradientContainer}
  >
    <View style={styles.overlay}>
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.header}>
          <Image
            source={require('../assets/images/LOGO.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Título LOGIN FORA DA CAIXA */}
        <Text style={styles.screenTitle}>
          {t('login', { ns: 'common' })}
        </Text>

        {/* Caixa só com inputs */}
        <View style={styles.card}>
          <TextInput
            placeholder={t('email', { ns: 'common' })}
            placeholderTextColor="rgba(255,255,255,0.6)"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TextInput
            placeholder={t('password', { ns: 'common' })}
            placeholderTextColor="rgba(255,255,255,0.6)"
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        {/* Botão + texto */}
        <View style={styles.bottomArea}>
          <TouchableOpacity
            onPress={handleLogin}
            disabled={isLoading}
            style={[styles.primaryBtn, { opacity: isLoading ? 0.7 : 1 }]}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryBtnTxt}>
                {t('enter', { ns: 'common' })}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleRegister} style={styles.footer}>
            <Text style={styles.footerText}>
              {t('noAccount', { ns: 'common' })}
            </Text>
          </TouchableOpacity>

          {!!error && <Text style={styles.errorText}>{error}</Text>}
        </View>
      </View>
    </View>
  </LinearGradient>
);


}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',   // centro vertical
  },
  content: {
    alignItems: 'center',       // centro horizontal
  },
  header: {
    alignItems: 'center',
    marginBottom: 12,           // espaço entre logo e título
  },
  logo: {
    width: 150,
    height: 110,
  },
  // TÍTULO PRINCIPAL (fora da caixa)
  screenTitle: {
    fontSize: 28,               // maior
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,           // espaçamento entre título e card
    textAlign: 'center',
  },
  // Card apenas com inputs
  card: {
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 24,
    backgroundColor: 'rgba(5, 10, 25, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 18,           // espaço entre card e botão
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginBottom: 12,           // mais espaço entre os inputs
    fontSize: 16,               // maior
    color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  bottomArea: {
    width: '100%',
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: '#0EA5E9',
  },
  primaryBtnTxt: {
    fontSize: 17,               // texto do botão maior
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footer: {
    marginTop: 8,               // pouco espaço entre botão e texto
  },
  footerText: {
    color: '#E5E7EB',
    fontSize: 15,               // maior
    textDecorationLine: 'underline',
  },
  errorText: {
    color: '#fecaca',
    textAlign: 'center',
    fontSize: 14,
    marginTop: 6,
  },
});
