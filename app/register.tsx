import { View, Text, StyleSheet, TextInput, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useTheme } from 'react-native-paper';

export default function RegisterScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [phone_number, setPhoneNumber] = useState('');
  const [confirmpassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  async function handleRegister() {
    setLoading(true);
    try {
      console.log('Attempting to register...')
      if (password !== confirmpassword) {
        console.log('Passwords do not match:', { password, confirmpassword });
        Alert.alert('Error', 'Passwords do not match.');
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

      // Se o usuário já existe, pode retornar erro, mas tentamos inserir na tabela personalizada mesmo assim
  console.log('Auth account created, inserting into ContasRegistradas (no password saved)...');
  console.log('Data for insert:', { username, user_email: email, phone_number });

      // 2. Inserir na tabela personalizada
      // IMPORTANT: do NOT store plaintext passwords. We only save non-sensitive profile fields here.
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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.onBackground }]}>Create Account</Text>

      <TextInput
        style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline, color: theme.colors.onSurface }]}
        placeholder="Username"
        placeholderTextColor={theme.colors.onSurfaceVariant ?? theme.colors.onSurface}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline, color: theme.colors.onSurface }]}
        placeholder="Email"
        placeholderTextColor={theme.colors.onSurfaceVariant ?? theme.colors.onSurface}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      <TextInput
        style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline, color: theme.colors.onSurface }]}
        placeholder="Phone number"
        placeholderTextColor={theme.colors.onSurfaceVariant ?? theme.colors.onSurface}
        value={phone_number}
        onChangeText={setPhoneNumber}
        autoCapitalize="none"
      />
      <TextInput
        style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline, color: theme.colors.onSurface }]}
        placeholder="Password"
        placeholderTextColor={theme.colors.onSurfaceVariant ?? theme.colors.onSurface}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TextInput
        style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline, color: theme.colors.onSurface }]}
        placeholder="Confirm Password"
        placeholderTextColor={theme.colors.onSurfaceVariant ?? theme.colors.onSurface}
        value={confirmpassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />

      {loading ? (
        <ActivityIndicator size="large" style={{ marginTop: 20 }} />
      ) : (
        <TouchableOpacity onPress={handleRegister} style={[styles.primaryBtn, { backgroundColor: theme.colors.primary }] }>
          <Text style={[styles.primaryBtnTxt, { color: theme.colors.onPrimary }]}>Register</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 13,
    paddingTop: 10,
    paddingLeft: 5,
    color: '#2AACF5',
  },
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
  primaryBtn: { marginTop: 8, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  primaryBtnTxt: { fontWeight: '700', fontSize: 16 },
});