// lib/client.ts - CONFIGURAÇÃO ATUALIZADA
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qocrpcfrhkoritoomgzx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvY3JwY2ZyaGtvcml0b29tZ3p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5OTMwNTAsImV4cCI6MjA2NzU2OTA1MH0.ghC4kqLz1cvB4Oz2olFRyudCLxr__I1-v3_n35V8SbE';

// CONFIGURAÇÃO ESPECIAL PARA REACT NATIVE
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
  global: {
    // ESSENCIAL para React Native
    fetch: (...args) => {
      // Garante que o fetch seja chamado corretamente
      return fetch(...args);
    },
  },
});

// FUNÇÃO PARA TESTAR CONEXÃO
export const testConnection = async () => {
  try {
    console.log('🔍 Testando conexão básica...');
    
    // Teste simples de ping
    const { data, error } = await supabase
      .from('UserInfo')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log('❌ Erro na conexão:', error.message);
      return { success: false, error: error.message };
    }
    
    console.log('✅ Conexão com Supabase estabelecida');
    return { success: true };
  } catch (error: any) {
    console.error('💥 Erro crítico:', error);
    return { success: false, error: error.message };
  }
};