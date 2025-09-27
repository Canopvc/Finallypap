import 'react-native-url-polyfill/auto';
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useTheme } from 'react-native-paper';

export default function LoginScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Por favor, preencha todos os campos');
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
      
      // The onAuthStateChange listener in _layout.tsx will handle the navigation
    } catch (error: any) {
      console.error('Erro no login:', error);
      setError(error.message || 'Erro ao fazer login. Verifique suas credenciais.');
      setIsLoading(false);
    }
  };

  const handleRegister = () => {
    router.push('/register');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.onBackground }]}>Login</Text>
      <TextInput
        placeholder="Email"
        placeholderTextColor={theme.colors.onSurfaceVariant ?? theme.colors.onSurface}
        style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.onSurface, borderColor: theme.colors.outline }]}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Password"
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
          <Text style={[styles.primaryBtnTxt, { color: theme.colors.onPrimary }]}>Entrar</Text>
        )}
      </TouchableOpacity>
      <Pressable onPress={handleRegister} style={{ marginTop: 16 }}>
        <Text style={[styles.registerText, { color: theme.colors.primary }]}>Não tem uma conta? Cadastre-se</Text>
      </Pressable>
      {!!error && <Text style={{ color: '#ef4444', marginTop: 10 }}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 215, paddingHorizontal: 20 },
  title: {
    fontSize: 28,
    marginBottom: 20,
    textAlign: 'left',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
  },
  registerText: { marginTop: 18, fontSize: 15, textAlign: 'center', textDecorationLine: 'underline' },
  primaryBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  primaryBtnTxt: { fontSize: 16, fontWeight: '700' },
});