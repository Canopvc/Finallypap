// lib/client.ts - VERSÃO CORRIGIDA
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = 'https://qocrpcfrhkoritoomgzx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

// Configuração especial para React Native
const supabaseOptions = {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce' as const,
  },
  global: {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => {
      // Usa fetch nativo do React Native
      return fetch(input as any, init);
    },
    headers: {
      'Accept-Encoding': 'gzip, deflate',
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
  },
  // Timeouts maiores
  realtime: {
    timeout: 60000,
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, supabaseOptions);

// Função para testar conexão com timeout
export const testNetworkConnection = async () => {
  try {
    console.log('🌐 Testando conexão de rede...');
    
    // Teste 1: Ping simples ao Supabase
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      console.log('✅ Rede OK - Consegue aceder ao Supabase');
      return true;
    } else {
      console.log('❌ Resposta HTTP:', response.status);
      return false;
    }
    
  } catch (error: any) {
    console.error('💥 Erro de rede:', {
      name: error.name,
      message: error.message,
      isTimeout: error.name === 'AbortError',
    });
    
    // Diagnosticar o tipo de erro
    if (error.message.includes('Network request failed')) {
      console.log('🔧 SUGESTÃO: Verifique:');
      console.log('1. Internet está ligada');
      console.log('2. Emulador tem acesso à internet');
      console.log('3. Não está bloqueado por firewall');
      console.log('4. Para Android: adicione android:usesCleartextTraffic="true"');
    }
    
    return false;
  }
};