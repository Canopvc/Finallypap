import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Importar traduções
import commonPt from '../locales/pt/common.json';
import workoutsPt from '../locales/pt/workouts.json';
import commonEn from '../locales/en/common.json';
import workoutsEn from '../locales/en/workouts.json';
import commonEs from '../locales/es/common.json';
import workoutsEs from '../locales/es/workouts.json';

const LANGUAGE_STORAGE_KEY = '@fitnesshub:language';

// Carregar idioma salvo ou usar o do dispositivo
const loadLanguage = async (): Promise<string> => {
  try {
    const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (savedLanguage) {
      return savedLanguage;
    }
  } catch (error) {
    console.error('Error loading language from storage:', error);
  }
  
  // Default sempre em inglês quando não há preferência salva
  return 'en';
};

// Recursos de tradução
const resources = {
  pt: {
    common: commonPt,
    workouts: workoutsPt,
  },
  en: {
    common: commonEn,
    workouts: workoutsEn,
  },
  es: {
    common: commonEs,
    workouts: workoutsEs,
  },
};

// Configuração do i18n
i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v4', // Para React Native
    resources,
    lng: 'en', // Idioma padrão (será sobrescrito)
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'workouts'],
    interpolation: {
      escapeValue: false, // React já escapa valores
    },
    react: {
      useSuspense: false, // Não usar Suspense no React Native
    },
  });

// Inicializar com o idioma correto após o i18n estar pronto
loadLanguage().then((language) => {
  i18n.changeLanguage(language);
}).catch((error) => {
  console.error('Error initializing i18n:', error);
  // Usar inglês como fallback
  i18n.changeLanguage('en');
});

// Função para mudar o idioma e salvar
export const changeLanguage = async (language: 'pt' | 'en' | 'es'): Promise<void> => {
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    await i18n.changeLanguage(language);
  } catch (error) {
    console.error('Error saving language:', error);
  }
};

// Função para obter o idioma atual
export const getCurrentLanguage = (): string => {
  return i18n.language;
};

export default i18n;

