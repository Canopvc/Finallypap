import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Configurações do Supabase - usa variáveis de ambiente do EAS Build
// ⚠️ IMPORTANTE: Configure as variáveis SUPABASE_URL e SUPABASE_ANON_KEY no EAS Build ou no arquivo .env
// Para desenvolvimento local, crie um arquivo .env na raiz do projeto

// Valores padrão para desenvolvimento (serão substituídos pelas variáveis de ambiente no build)
const DEFAULT_SUPABASE_URL = 'https://qocrpcfrhkoritoomgzx.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvY3JwY2ZyaGtvcml0b29tZ3p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5OTMwNTAsImV4cCI6MjA2NzU2OTA1MH0.ghC4kqLz1cvB4Oz2olFRyudCLxr__I1-v3_n35V8SbE';

// Tenta obter das variáveis de ambiente (EAS Build ou .env)
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

// Validação: garante que as chaves estão configuradas
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ ERRO: Variáveis de ambiente do Supabase não configuradas!');
  console.error('Configure SUPABASE_URL e SUPABASE_ANON_KEY no EAS Build ou no arquivo .env');
  throw new Error('Supabase configuration is required');
}

// Configuração condicional baseada na plataforma
const supabaseConfig = {
  auth: {
    // Persist session and refresh tokens automatically
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    // Usa AsyncStorage apenas em dispositivos móveis (Android/iOS)
    // No web, não especifica storage para usar localStorage padrão
    ...(Platform.OS !== 'web' && { storage: AsyncStorage }),
  },
};

// Criação do cliente Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey, supabaseConfig);

// Função helper para verificar se está rodando em dispositivo móvel
export const isMobilePlatform = (): boolean => {
  return Platform.OS === 'ios' || Platform.OS === 'android';
};

// Função helper para verificar se está rodando no web
export const isWebPlatform = (): boolean => {
  return Platform.OS === 'web';
};

// Função helper para obter informações da plataforma atual
export const getPlatformInfo = () => {
  return {
    platform: Platform.OS,
    isMobile: isMobilePlatform(),
    isWeb: isWebPlatform(),
    version: Platform.Version,
  };
};