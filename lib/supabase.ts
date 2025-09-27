import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Configurações do Supabase
const supabaseUrl = 'https://qocrpcfrhkoritoomgzx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvY3JwY2ZyaGtvcml0b29tZ3p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5OTMwNTAsImV4cCI6MjA2NzU2OTA1MH0.ghC4kqLz1cvB4Oz2olFRyudCLxr__I1-v3_n35V8SbE';

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