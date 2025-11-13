import 'react-native-url-polyfill/auto';
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useTheme } from 'react-native-paper';
import { useTranslation } from '../hooks/useTranslation';

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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.onBackground }]}>{t('login', { ns: 'common' })}</Text>
      
      <TextInput
        placeholder={t('email', { ns: 'common' })}
        placeholderTextColor={theme.colors.onSurfaceVariant ?? theme.colors.onSurface}
        style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.onSurface, borderColor: theme.colors.outline }]}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      
      <TextInput
        placeholder={t('password', { ns: 'common' })}
        placeholderTextColor={theme.colors.onSurfaceVariant ?? theme.colors.onSurface}
        style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.onSurface, borderColor: theme.colors.outline }]}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      
      <TouchableOpacity
        onPress={handleLogin}
        disabled={isLoading}
        style={[styles.primaryBtn, { backgroundColor: theme.colors.primary, opacity: isLoading ? 0.7 : 1 }]}
      >
        {isLoading ? (
          <ActivityIndicator color={theme.colors.onPrimary} />
        ) : (
          <Text style={[styles.primaryBtnTxt, { color: theme.colors.onPrimary }]}>{t('enter', { ns: 'common' })}</Text>
        )}
      </TouchableOpacity>
      
      <Pressable onPress={handleRegister} style={{ marginTop: 16 }}>
        <Text style={[styles.registerText, { color: theme.colors.primary }]}>{t('noAccount', { ns: 'common' })}</Text>
      </Pressable>
      
      {!!error && <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    paddingTop: 100, 
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    marginBottom: 30,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  primaryBtn: { 
    paddingVertical: 16, 
    borderRadius: 12, 
    alignItems: 'center',
    marginTop: 10,
  },
  primaryBtnTxt: { 
    fontSize: 16, 
    fontWeight: '700' 
  },
  registerText: { 
    marginTop: 18, 
    fontSize: 15, 
    textAlign: 'center', 
    textDecorationLine: 'underline' 
  },
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 25,
  },
  separatorLine: {
    flex: 1,
    height: 1,
  },
  separatorText: {
    marginHorizontal: 15,
    fontSize: 14,
  },
  googleButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 15,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 14,
  },
});