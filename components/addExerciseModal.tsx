// components/AddExerciseModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { supabase } from '../lib/supabase';
import { useTranslation } from '../hooks/useTranslation';

type AddExerciseModalProps = {
  visible: boolean;
  onClose: () => void;
  onExerciseAdded: () => void;
};

type ExerciseType = 'weightlifting' | 'calisthenics' | 'cardio';

export const AddExerciseModal: React.FC<AddExerciseModalProps> = ({
  visible,
  onClose,
  onExerciseAdded,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  
  // ESTADO LOCAL - NÃO AFETA O COMPONENTE PAI
  const [exerciseName, setExerciseName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [exerciseType, setExerciseType] = useState<ExerciseType>('weightlifting');
  const [isLoading, setIsLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);
  
  const nameInputRef = useRef<TextInput>(null);
  const imageInputRef = useRef<TextInput>(null);

  const resetForm = () => {
    setExerciseName('');
    setImageUrl('');
    setExerciseType('weightlifting');
    setImageError(false);
    setImageAspectRatio(null);
  };

  // Focar no input quando o modal abre
  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 300); // Delay maior para garantir estabilidade
    } else {
      // Limpar estado quando fecha
      resetForm();
    }
  }, [visible]);

  const isValidBase64 = (str: string) => {
    try {
      // Verificar se começa com data:image
      if (!str.startsWith('data:image')) return false;
      
      // Extrair a parte base64
      const base64Part = str.split(',')[1];
      if (!base64Part) return false;
      
      // Verificar formato básico de base64 (caracteres válidos)
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Regex.test(base64Part)) return false;
      
      // Verificar se tem tamanho mínimo razoável
      if (base64Part.length < 10) return false;
      
      return true;
    } catch {
      return false;
    }
  };

  const isValidUrl = (url: string) => {
    if (!url || !url.trim()) return false;
    
    // Verificar se é base64
    if (url.startsWith('data:image')) {
      return isValidBase64(url);
    }
    
    // Verificar se é uma URL válida
    try {
      const urlObj = new URL(url);
      // Verificar se é http ou https
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const getImageSource = (url: string) => {
    // Sempre retornar como URI, o React Native trata automaticamente
    return { uri: url };
  };

  const handleAddExercise = async () => {
    if (!exerciseName.trim()) {
      Alert.alert(
        t('error', { ns: 'common' }) || 'Erro', 
        t('pleaseEnterExerciseName', { ns: 'workouts' }) || 'Por favor, insira um nome para o exercício'
      );
      return;
    }

    if (imageUrl.trim() && !isValidUrl(imageUrl)) {
      Alert.alert(
        t('error', { ns: 'common' }) || 'Erro', 
        t('pleaseEnterValidImageUrl', { ns: 'workouts' }) || 'Por favor, insira uma URL de imagem válida (http/https) ou uma imagem em base64 válida'
      );
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('Exercicios_table')
        .insert([
          {
            exercise_name: exerciseName.trim(),
            exercise_img: imageUrl.trim() || null,
            exercise_type: exerciseType,
          },
        ]);

      if (error) throw error;

      Alert.alert(
        t('success', { ns: 'common' }) || 'Sucesso', 
        t('exerciseAddedToDatabase', { ns: 'workouts' }) || 'Exercício adicionado à base de dados!'
      );
      
      // Notificar o componente pai para atualizar a lista
      onExerciseAdded();
      
      // Limpar e fechar
      resetForm();
      onClose();
    } catch (error: any) {
      console.error('Error adding exercise:', error);
      Alert.alert(
        t('error', { ns: 'common' }) || 'Erro',
        `${t('couldNotAddExercise', { ns: 'workouts' }) || 'Não foi possível adicionar o exercício'}: ${error.message}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <View 
          style={StyleSheet.absoluteFill}
          pointerEvents="box-none"
        >
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
        </View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View 
            style={[
              styles.modalContainer,
              { 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.outline,
              }
            ]}
          >
              {/* Header */}
              <View style={styles.header}>
                <Text style={[styles.title, { color: theme.colors.onSurface }]}>
                  {t('addNewExercise', { ns: 'workouts' }) || 'Adicionar Novo Exercício'}
                </Text>
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                onClose();
              }}
              style={styles.closeButton}
            >
              <Text style={{ color: theme.colors.primary, fontSize: 24 }}>
                ×
              </Text>
            </TouchableOpacity>
          </View>

          {/* Conteúdo */}
          <ScrollView 
            style={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            {/* 1. Nome do Exercício */}
            <Text style={[styles.label, { color: theme.colors.onSurface }]}>
              {t('exerciseName', { ns: 'workouts' }) || 'Nome do Exercício'} *
            </Text>
            <TextInput
              ref={nameInputRef}
              placeholder="Ex: Supino Reto"
              value={exerciseName}
              onChangeText={setExerciseName}
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.background,
                  color: theme.colors.onSurface,
                  borderColor: theme.colors.outline,
                },
              ]}
              placeholderTextColor={theme.colors.onSurfaceVariant}
              returnKeyType="next"
              autoCapitalize="words"
              editable={true}
              selectTextOnFocus={false}
              pointerEvents="auto"
              onSubmitEditing={() => imageInputRef.current?.focus()}
              blurOnSubmit={false}
            />

            {/* 2. Tipo do Exercício */}
            <Text style={[styles.label, { color: theme.colors.onSurface, marginTop: 16 }]}>
              {t('type', { ns: 'workouts' }) || 'Tipo do Exercício'}
            </Text>
            <View style={[
              styles.typeContainer,
              {
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.outline,
              }
            ]}>
              {(['weightlifting', 'calisthenics', 'cardio'] as ExerciseType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeButton,
                    exerciseType === type 
                      ? { backgroundColor: theme.colors.primary }
                      : { backgroundColor: 'transparent' }
                  ]}
                  onPress={() => setExerciseType(type)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.typeButtonText,
                    exerciseType === type 
                      ? { color: theme.colors.onPrimary, fontWeight: '700' }
                      : { color: theme.colors.onSurfaceVariant }
                  ]}>
                    {t(type, { ns: 'workouts' })}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 3. URL da Imagem */}
            <Text style={[styles.label, { color: theme.colors.onSurface, marginTop: 16 }]}>
              {t('imageUrlOptional', { ns: 'workouts' }) || 'URL da Imagem (Opcional)'}
            </Text>
            <TextInput
              ref={imageInputRef}
              placeholder="https://exemplo.com/imagem.jpg"
              value={imageUrl}
              onChangeText={(text) => {
                setImageUrl(text);
                setImageError(false); // Reset error when URL changes
                setImageAspectRatio(null); // Reset aspect ratio when URL changes
              }}
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.background,
                  color: theme.colors.onSurface,
                  borderColor: theme.colors.outline,
                },
              ]}
              placeholderTextColor={theme.colors.onSurfaceVariant}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              editable={true}
              selectTextOnFocus={false}
              pointerEvents="auto"
              returnKeyType="done"
              onSubmitEditing={handleAddExercise}
            />

            {/* Preview da Imagem */}
            {imageUrl.trim() && isValidUrl(imageUrl) && (
              <View style={styles.previewContainer}>
                <Text style={[styles.label, { color: theme.colors.onSurface }]}>
                  {t('preview', { ns: 'workouts' }) || 'Pré-visualização'}:
                </Text>
                {!imageError ? (
                  <View style={[
                    styles.previewImageWrapper,
                    imageAspectRatio && imageAspectRatio > 0 
                      ? { aspectRatio: imageAspectRatio, maxHeight: 400 }
                      : {}
                  ]}>
                    <Image
                      source={getImageSource(imageUrl)}
                      style={styles.previewImage}
                      resizeMode="contain"
                      onError={(error) => {
                        console.log('Erro ao carregar imagem:', error?.nativeEvent?.error || 'Erro desconhecido');
                        setImageError(true);
                      }}
                    onLoad={(event) => {
                      console.log('Imagem carregada com sucesso');
                      setImageError(false);
                      // Calcular aspect ratio para ajustar o container
                      const { width, height } = event.nativeEvent.source;
                      if (width && height && height > 0) {
                        const aspectRatio = width / height;
                        setImageAspectRatio(aspectRatio);
                        console.log(`Dimensões da imagem: ${width}x${height}, Aspect Ratio: ${aspectRatio}`);
                      }
                    }}
                    />
                  </View>
                ) : (
                  <View style={[styles.previewImage, styles.imageErrorContainer]}>
                    <Text style={styles.imageErrorText}>
                      Erro ao carregar imagem
                    </Text>
                    <Text style={styles.imageErrorSubtext}>
                      Verifique se a URL está correta
                    </Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {/* Botões */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.cancelButton, 
                { 
                  borderColor: theme.colors.outline,
                  backgroundColor: theme.colors.surface,
                }
              ]}
              onPress={onClose}
              disabled={isLoading}
            >
              <Text style={{ color: theme.colors.onSurface }}>
                {t('cancel', { ns: 'common' }) || 'Cancelar'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: theme.colors.primary },
                (!exerciseName.trim() || isLoading) && { opacity: 0.7 }
              ]}
              onPress={handleAddExercise}
              disabled={!exerciseName.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={theme.colors.onPrimary} size="small" />
              ) : (
                <Text style={{ color: theme.colors.onPrimary, fontWeight: 'bold' }}>
                  {t('add', { ns: 'common' }) || 'Adicionar'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  keyboardView: {
    width: '100%',
    maxWidth: 500,
  },
  modalContainer: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    paddingTop: 10,
    width: '100%',
    maxWidth: 500,
    maxHeight: Platform.OS === 'ios' ? '80%' : '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  closeButton: {
    padding: 8,
  },
  content: {
    maxHeight: 400,
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 10,
  },
  input: {
    paddingVertical: Platform.OS === 'ios' ? 16 : 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    fontSize: 17,
    borderWidth: 1,
    minHeight: Platform.OS === 'ios' ? 56 : 52,
    marginBottom: 18,
  },
  typeContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    marginTop: 4,
    marginBottom: 16,
  },
  typeButton: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    alignItems: 'center',
    borderRadius: 10,
    marginHorizontal: 2,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  previewContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  previewImageWrapper: {
    width: '100%',
    minHeight: 200,
    maxHeight: 500,
    borderRadius: 12,
    marginTop: 8,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    // A imagem se ajusta ao container mantendo proporção
  },
  imageErrorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  imageErrorText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  imageErrorSubtext: {
    color: '#999',
    fontSize: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});