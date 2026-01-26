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
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { supabase } from '../lib/supabase';

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
  
  // ESTADO LOCAL - NÃO AFETA O COMPONENTE PAI
  const [exerciseName, setExerciseName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [exerciseType, setExerciseType] = useState<ExerciseType>('weightlifting');
  const [isLoading, setIsLoading] = useState(false);
  
  const nameInputRef = useRef<TextInput>(null);
  const imageInputRef = useRef<TextInput>(null);

  // Focar no input quando o modal abre
  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 300); // Delay maior para garantir estabilidade
    } else {
      // Limpar estado quando fecha
      setExerciseName('');
      setImageUrl('');
      setExerciseType('weightlifting');
    }
  }, [visible]);

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleAddExercise = async () => {
    if (!exerciseName.trim()) {
      Alert.alert('Erro', 'Por favor, insira um nome para o exercício');
      return;
    }

    if (imageUrl.trim() && !isValidUrl(imageUrl)) {
      Alert.alert('Erro', 'Por favor, insira uma URL de imagem válida');
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

      Alert.alert('Sucesso', 'Exercício adicionado à base de dados!');
      
      // Notificar o componente pai para atualizar a lista
      onExerciseAdded();
      
      // Fechar modal
      onClose();
    } catch (error: any) {
      console.error('Error adding exercise:', error);
      Alert.alert(
        'Erro',
        `Não foi possível adicionar o exercício: ${error.message}`,
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
        <View style={[
          styles.modalContainer,
          { backgroundColor: theme.colors.surface }
        ]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>
              Adicionar Novo Exercício
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
          >
            {/* Nome do Exercício */}
            <Text style={[styles.label, { color: theme.colors.onSurface }]}>
              Nome do Exercício *
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
              onSubmitEditing={() => imageInputRef.current?.focus()}
              blurOnSubmit={false}
            />

            {/* Tipo do Exercício */}
            <Text style={[styles.label, { color: theme.colors.onSurface, marginTop: 16 }]}>
              Tipo do Exercício
            </Text>
            <View style={styles.typeContainer}>
              {(['weightlifting', 'calisthenics', 'cardio'] as ExerciseType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeButton,
                    exerciseType === type && { backgroundColor: theme.colors.primary }
                  ]}
                  onPress={() => setExerciseType(type)}
                >
                  <Text style={[
                    styles.typeButtonText,
                    exerciseType === type 
                      ? { color: theme.colors.onPrimary }
                      : { color: theme.colors.onSurface }
                  ]}>
                    {type === 'weightlifting' ? 'Levantamento' : 
                     type === 'calisthenics' ? 'Calistenia' : 'Cardio'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* URL da Imagem */}
            <Text style={[styles.label, { color: theme.colors.onSurface, marginTop: 16 }]}>
              URL da Imagem (Opcional)
            </Text>
            <TextInput
              ref={imageInputRef}
              placeholder="https://exemplo.com/imagem.jpg"
              value={imageUrl}
              onChangeText={setImageUrl}
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
              returnKeyType="done"
              onSubmitEditing={handleAddExercise}
            />

            {/* Preview da Imagem */}
            {imageUrl.trim() && isValidUrl(imageUrl) && (
              <View style={styles.previewContainer}>
                <Text style={[styles.label, { color: theme.colors.onSurface }]}>
                  Pré-visualização:
                </Text>
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              </View>
            )}
          </ScrollView>

          {/* Botões */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: theme.colors.outline }]}
              onPress={onClose}
              disabled={isLoading}
            >
              <Text style={{ color: theme.colors.onSurface }}>
                Cancelar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: theme.colors.primary },
                (!exerciseName.trim() || isLoading) && { opacity: 0.5 }
              ]}
              onPress={handleAddExercise}
              disabled={!exerciseName.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>
                  Adicionar
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
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
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    padding: Platform.OS === 'ios' ? 14 : 10,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  typeContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  typeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  previewContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    marginRight: 12,
  },
  submitButton: {
    flex: 2,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
});