import { useTranslation as useI18nTranslation } from 'react-i18next';

/**
 * Hook personalizado para usar traduções
 * 
 * @example
 * const { t, i18n } = useTranslation();
 * 
 * // Usar tradução do namespace padrão (common)
 * <Text>{t('home')}</Text>
 * 
 * // Usar tradução de outro namespace
 * <Text>{t('workout', { ns: 'workouts' })}</Text>
 * 
 * // Mudar idioma
 * i18n.changeLanguage('pt');
 */
export const useTranslation = () => {
  const { t, i18n } = useI18nTranslation();

  return {
    t,
    i18n,
    currentLanguage: i18n.language,
    isRTL: i18n.dir() === 'rtl',
  };
};

export default useTranslation;

