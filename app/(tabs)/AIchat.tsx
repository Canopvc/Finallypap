import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { useTranslation } from '../../hooks/useTranslation';
import { CohereClientV2 } from 'cohere-ai';
import Constants from 'expo-constants';
//import { COHERE_API_KEY } from '@env';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COHERE_API_KEY } from '@env';
// ⭐️ COHERE API
const WORKOUTS_STORAGE_KEY = 'workouts';

// Usa variável de ambiente do EAS Build ou fallback para @env
const cohereApiKey = Constants.expoConfig?.extra?.cohereApiKey || COHERE_API_KEY || '';
const cohere = new CohereClientV2({ token: cohereApiKey });

type ExerciseType = 'calisthenics' | 'cardio' | 'weightlifting';

type Exercise = {
  id: string;
  name: string;
  type: ExerciseType;
  sets: number;
  reps?: number;
  weight?: number;
  minutes?: number;
  dropset: boolean;
  failure: boolean;
  warmup: boolean;
};

type Workout = {
  name: string;
  createdAt: string;
  exercises: Exercise[];
};

type WorkoutPlan = {
  workouts: Workout[];
  planName: string;
  createdAt: string;
};

type MessageType = {
  text: string;
  isUser: boolean;
  timestamp: Date;
  isWorkout?: boolean;
  isWorkoutPlan?: boolean;
  workoutData?: Workout;
  workoutPlanData?: WorkoutPlan;
};

function uid(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export default function FitnessAIChat() {
  const theme = useTheme();
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingWorkout, setSavingWorkout] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [workoutName, setWorkoutName] = useState('');

  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, loading]);

  const extractWorkoutFromText = (text: string): Workout | WorkoutPlan | null => {
    try {
      console.log('🔍 Analisando texto:', text.substring(0, 200));

      const hasPlan = text.includes('Plano:') || text.includes('Plan:');
      const workoutBlocks = text.split(/(?:Treino|Workout):\s*/i).slice(1);

      console.log('📋 Blocos de treino encontrados:', workoutBlocks.length);
      console.log('📝 Tem plano?:', hasPlan);

      if (workoutBlocks.length === 0) return null;

      if (hasPlan || workoutBlocks.length > 1) {
        return extractWorkoutPlan(workoutBlocks, text);
      }

      return extractSingleWorkout(workoutBlocks[0], text);
    } catch (error) {
      console.error('Erro ao extrair treino:', error);
      return null;
    }
  };


  const extractSingleWorkout = (block: string, fullText: string): Workout | null => {
    const exercises: Exercise[] = [];
    let workoutName = 'Treino Gerado pela IA';

    const workoutNameMatch = fullText.match(/Treino:\s*([^\n]+)/i);
    if (workoutNameMatch) {
      workoutName = workoutNameMatch[1].trim();
    }

    const exerciseBlocks = block.split(/Exercício:\s*/i).slice(1);

    for (const exerciseBlock of exerciseBlocks) {
      const exercise = extractExercise(exerciseBlock);
      if (exercise) {
        exercises.push(exercise);
      }
    }

    return exercises.length > 0 ? {
      name: workoutName,
      createdAt: new Date().toISOString(),
      exercises
    } : null;
  };

  const extractWorkoutPlan = (workoutBlocks: string[], fullText: string): WorkoutPlan | null => {
    const workouts: Workout[] = [];
    let planName = 'Plano de Treino Gerado pela IA';

    const planNameMatch = fullText.match(/(?:Plano|Plan|Programa):\s*([^\n]+)/i);
    if (planNameMatch) {
      planName = planNameMatch[1].trim();
      console.log('🏷️ Nome do plano detectado:', planName);
    }

    for (let i = 0; i < workoutBlocks.length; i++) {
      const block = workoutBlocks[i];

      let workoutName = `Treino ${i + 1}`;
      const workoutNameMatch = block.match(/^([^\n]+?)(?=\n(?:Exercício|Exercise):|\n$)/i);
      if (workoutNameMatch) {
        workoutName = workoutNameMatch[1].trim();
        console.log(`💪 Treino ${i + 1}:`, workoutName);
      }

      const exercises: Exercise[] = [];
      const exerciseBlocks = block.split(/(?:Exercício|Exercise):\s*/i).slice(1);

      console.log(`📊 Exercícios no treino ${i + 1}:`, exerciseBlocks.length);

      for (const exerciseBlock of exerciseBlocks) {
        const exercise = extractExercise(exerciseBlock);
        if (exercise) {
          exercises.push(exercise);
          console.log(`➡️ Exercício: ${exercise.name}`);
        }
      }

      if (exercises.length > 0) {
        workouts.push({
          name: workoutName,
          createdAt: new Date().toISOString(),
          exercises
        });
      }
    }

    console.log(`✅ Total de treinos extraídos: ${workouts.length}`);

    return workouts.length > 0 ? {
      workouts,
      planName,
      createdAt: new Date().toISOString()
    } : null;
  };

  const extractExercise = (block: string): Exercise | null => {
    const exercise: Partial<Exercise> = {};

    const nameMatch = block.match(/^([^\n]+)/);
    if (nameMatch) exercise.name = nameMatch[1].trim();

    const setsMatch = block.match(/(?:Sets|Séries|Series):\s*(\d+)/i);
    if (setsMatch) exercise.sets = parseInt(setsMatch[1]);

    const repsMatch = block.match(/(?:Reps|Repetições|Repeticiones):\s*(\d+)/i);
    if (repsMatch) exercise.reps = parseInt(repsMatch[1]);

    const weightMatch = block.match(/(?:Weight|Peso|Poids):\s*(\d+)/i);
    if (weightMatch) exercise.weight = parseInt(weightMatch[1]);

    const minutesMatch = block.match(/(?:Duration|Duração|Durée):\s*(\d+)/i);
    if (minutesMatch) exercise.minutes = parseInt(minutesMatch[1]);

    const typeMatch = block.match(/(?:Type|Tipo):\s*(weightlifting|calisthenics|cardio|peso|calistenia|cardio|musculation)/i);
    if (typeMatch) {
      const type = typeMatch[1].toLowerCase();
      if (type === 'peso' || type === 'musculation') exercise.type = 'weightlifting';
      else if (type === 'calistenia') exercise.type = 'calisthenics';
      else exercise.type = type as ExerciseType;
    }

    if (exercise.name) {
      return {
        id: uid('ex-'),
        name: exercise.name,
        type: exercise.type || 'weightlifting',
        sets: exercise.sets || 3,
        reps: exercise.reps,
        weight: exercise.weight,
        minutes: exercise.minutes,
        dropset: false,
        failure: false,
        warmup: false,
      };
    }

    return null;
  };

  const handleGenerateResponse = async () => {
    if (!prompt.trim()) {
      Alert.alert('Erro', 'Por favor, insira um texto.');
      return;
    }
    console.log('extra.cohereApiKey:', Constants.expoConfig?.extra?.cohereApiKey);

    const userMessage: MessageType = {
      text: prompt,
      isUser: true,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setPrompt('');
    setLoading(true);

    try {
      console.log('🚀 Enviando para Cohere AI...');

      const response = await cohere.chat({
        model: 'command-a-03-2025',
        messages: [
          {
            role: 'system',
            content: `You are an expert fitness coach. Follow these rules STRICTLY:

🎯 **MANDATORY STRUCTURE:**

For PPL/ABC programs - Create ONLY 3 COMPLETE workouts:

Plan: [Plan Name - e.g., "PPL Strength Program"]

Workout: Push (Chest, Shoulders, Triceps)
Exercise: [Exercise 1]
Sets: [number]
Reps: [number]
Weight: [kg] (never fill this one)
Duration: 0
Type: weightlifting

Exercise: [Exercise 2]
Sets: [number]
Reps: [number]
Weight: [kg] (never fill this one)
Duration: 0
Type: weightlifting

Workout: Pull (Back, Biceps)
Exercise: [Exercise 1]
Sets: [number]
Reps: [number]
Weight: [kg] (never fill this one)
Duration: 0
Type: weightlifting

Workout: Legs (Quadriceps, Hamstrings, Glutes)
Exercise: [Exercise 1]
Sets: [number]
Reps: [number]
Weight: [kg] (never fill this one)
Duration: 0
Type: weightlifting

📝 **STRICT RULES:**
ONLY 5 WORKOUTS MAXIMUM for PPL/ABC programs or ppl upper lower and other combinations that the user wants
→ Never go above 5 workouts, no matter what.

4-6 EXERCISES PER WORKOUT if the user asks for more give him 1 at max 2 more - no empty workouts! And use the the most famous exercises and their names and make obvious the variations, for exemple overhead tricep extension, overhead tricep extension with dumbbell, etc.
→ Each workout must contain 4 to 6 exercises (7 or 8 only if explicitly asked). Always fill every workout and use clear, famous exercise names.

COMPLETE EACH WORKOUT before starting the next one
→ Never start a new workout until the previous one is fully completed.

REALISTIC PROGRESSION - don't create multiple versions
→ Always create one clear, realistic program version.

PROPER EXERCISE SELECTION - compound + isolation exercises
→ Combine both compound and isolation movements in a balanced way.

BALANCED VOLUME - 12-20 sets per workout
→ Total volume per workout must always be between 12 and 20 sets.

NO REPETITIVE STRUCTURES - one continuous flow
→ Avoid robotic or repetitive layouts. Every workout should flow naturally.

IF THE USER ASK FOR A CARDIO PROGRAM, CREATE ONLY 1 WORKOUT
→ Cardio programs = strictly 1 workout only.

IF THE USER SAYS HE WANTS A LOT OF VOLUME IN A SPECIFIC MUSCLE, ADAPT THE WORKOUT PROGRAM AS HE WANTS, WHILE FOLLOWIG THE PREVIOUS RULES
→ You can increase volume for a muscle, but must still respect all other rules.

NEVER MAKE A LOT OF WORKOUTS, YOU SHOULD ONLY DO THE MAX OF 5 WORKOUTS
→ Never exceed 5 workouts in total, regardless of context.

ALWAYS PUT THE WORKOUT NAMES AS THEY ARE, THE LEG WORKOUT IS LEG DAY, THE UPPER WORKOUT IS UPPER WORKOUT, THE LOWER WORKOUT IS LOWER WORKOUT
→ Always use these exact names, never alternatives.

ALWAYS USE THE MOST SIMPLE NAMES OF THE EXERCISES, USE SIMPLE AND USEFULL LANGUAGE
→ Always use short, clear and standard exercise names. Avoid complex or fancy terms.

Respond in the same language as the user's query. `
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      console.log('✅ Resposta recebida da Cohere:', response);

      let generatedText = '';

      if (response.message?.content) {
        if (typeof response.message.content === 'string') {
          generatedText = response.message.content;
        } else if (Array.isArray(response.message.content)) {
          generatedText = response.message.content
            .map(part => {
              if (part && typeof part === 'object' && 'text' in part) {
                return part.text;
              }
              return '';
            })
            .filter(text => text !== '')
            .join('\n');
        }
      }

      if (!generatedText && response.message?.content) {
        generatedText = JSON.stringify(response.message.content);
      }

      if (!generatedText) {
        throw new Error('Resposta da API vazia');
      }

      console.log('📝 Resposta IA:', generatedText);

      const workoutData = extractWorkoutFromText(generatedText);

      console.log('💪 Dados extraídos:', workoutData);

      let isWorkoutPlan = false;
      let isSingleWorkout = false;

      if (workoutData) {
        if ('workouts' in workoutData) {
          isWorkoutPlan = true;
          console.log('📋 Múltiplos treinos detectados:', workoutData.workouts.length);
        } else {
          isSingleWorkout = true;
          console.log('🎯 Treino único detectado');
        }
      }

      const botMessage: MessageType = {
        text: generatedText,
        isUser: false,
        timestamp: new Date(),
        isWorkout: isSingleWorkout,
        isWorkoutPlan: isWorkoutPlan,
        workoutData: isSingleWorkout ? workoutData as Workout : undefined,
        workoutPlanData: isWorkoutPlan ? workoutData as WorkoutPlan : undefined
      };

      setMessages(prev => [...prev, botMessage]);

    } catch (error: any) {
      console.error('❌ Erro na Cohere AI:', error);

      Alert.alert('Erro', 'Falha ao obter resposta da IA. Verifique sua conexão e chave API.');

      const errorMessage: MessageType = {
        text: '❌ Erro ao conectar com a IA. Verifique sua conexão e chave API.',
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWorkout = async () => {
    if (!selectedWorkout || !workoutName.trim()) {
      Alert.alert('Erro', 'Por favor, insira um nome para o treino.');
      return;
    }

    setSavingWorkout(true);
    try {
      const workoutToSave: Workout = {
        ...selectedWorkout,
        name: workoutName.trim(),
        createdAt: new Date().toISOString()
      };

      const raw = await AsyncStorage.getItem(WORKOUTS_STORAGE_KEY);
      const list: Workout[] = raw ? JSON.parse(raw) : [];
      list.unshift(workoutToSave);
      await AsyncStorage.setItem(WORKOUTS_STORAGE_KEY, JSON.stringify(list));

      Alert.alert('Sucesso', 'Treino salvo com sucesso!');
      setSelectedWorkout(null);
      setWorkoutName('');
    } catch (error) {
      console.error('Erro ao salvar treino:', error);
      Alert.alert('Erro', 'Não foi possível salvar o treino.');
    } finally {
      setSavingWorkout(false);
    }
  };

  const handleSaveAllWorkouts = async (workoutPlan: WorkoutPlan) => {
    setSavingWorkout(true);
    try {
      const raw = await AsyncStorage.getItem(WORKOUTS_STORAGE_KEY);
      const list: Workout[] = raw ? JSON.parse(raw) : [];

      let savedCount = 0;
      for (const workout of workoutPlan.workouts) {
        const workoutToSave: Workout = {
          ...workout,
          name: `${workoutPlan.planName} - ${workout.name}`,
          createdAt: new Date().toISOString()
        };
        list.unshift(workoutToSave);
        savedCount++;
      }

      await AsyncStorage.setItem(WORKOUTS_STORAGE_KEY, JSON.stringify(list));

      Alert.alert('Sucesso', `${savedCount} treinos salvos com sucesso!`);
    } catch (error) {
      console.error('Erro ao salvar treinos:', error);
      Alert.alert('Erro', 'Não foi possível salvar os treinos.');
    } finally {
      setSavingWorkout(false);
    }
  };

  const renderMessages = () => {
    return messages.map((msg, index) => (
      <Animated.View 
        key={index} 
        style={[
          styles.messageRow,
          {
            opacity: fadeAnim,
            transform: [{
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0]
              })
            }]
          }
        ]}
      >
        <View
          style={[
            styles.messageContainer,
            msg.isUser ? styles.userMessageContainer : styles.aiMessageContainer
          ]}
        >
          <View
            style={[
              styles.messageBubble,
              msg.isUser ? {
                backgroundColor: theme.colors.primary,
              } : {
                backgroundColor: theme.colors.surfaceVariant,
              }
            ]}
          >
            <Text
              style={[
                styles.messageText,
                {
                  color: msg.isUser
                    ? theme.colors.onPrimary
                    : theme.colors.onSurfaceVariant
                }
              ]}
            >
              {msg.text}
            </Text>
            <Text style={[
              styles.timestamp,
              { color: msg.isUser ? theme.colors.onPrimary + '99' : theme.colors.outline }
            ]}>
              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>

        {msg.isWorkout && msg.workoutData && (
          <TouchableOpacity
            style={[
              styles.saveWorkoutButton,
              {
                backgroundColor: theme.colors.secondaryContainer,
                borderColor: theme.colors.secondary,
              }
            ]}
            onPress={() => {
              setSelectedWorkout(msg.workoutData!);
              setWorkoutName(msg.workoutData!.name);
            }}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="content-save" size={18} color={theme.colors.onSecondaryContainer} />
            <Text style={[
              styles.saveWorkoutButtonText,
              { color: theme.colors.onSecondaryContainer }
            ]}>
              {`Save "${msg.workoutData.name}"`}
            </Text>
          </TouchableOpacity>
        )}

        {msg.isWorkoutPlan && msg.workoutPlanData && (
          <View style={[
            styles.workoutPlanContainer,
            { 
              backgroundColor: theme.colors.tertiaryContainer,
              borderColor: theme.colors.tertiary + '40'
            }
          ]}>
            <View style={styles.planHeader}>
              <MaterialCommunityIcons name="calendar-month" size={24} color={theme.colors.onTertiaryContainer} />
              <Text style={[
                styles.planTitle,
                { color: theme.colors.onTertiaryContainer }
              ]}>
                {msg.workoutPlanData.planName}
              </Text>
            </View>
            <Text style={[
              styles.planSubtitle,
              { color: theme.colors.onTertiaryContainer + 'CC' }
            ]}>
              {msg.workoutPlanData.workouts.length} workout{msg.workoutPlanData.workouts.length > 1 ? 's' : ''} in this plan
            </Text>

            <View style={styles.workoutsList}>
              {msg.workoutPlanData.workouts.map((workout, workoutIndex) => (
                <TouchableOpacity
                  key={workoutIndex}
                  style={[
                    styles.workoutPlanItem,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.outline + '30'
                    }
                  ]}
                  onPress={() => {
                    setSelectedWorkout(workout);
                    setWorkoutName(`${msg.workoutPlanData!.planName} - ${workout.name}`);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.workoutPlanItemContent}>
                    <View style={styles.workoutPlanItemLeft}>
                      <Text style={[
                        styles.workoutPlanItemTitle,
                        { color: theme.colors.onSurface }
                      ]}>
                        {workout.name}
                      </Text>
                      <Text style={[
                        styles.workoutPlanItemSubtitle,
                        { color: theme.colors.onSurfaceVariant }
                      ]}>
                        {workout.exercises.length} exercise{workout.exercises.length > 1 ? 's' : ''}
                      </Text>
                    </View>
                    <MaterialCommunityIcons 
                      name="chevron-right" 
                      size={20} 
                      color={theme.colors.onSurfaceVariant} 
                    />
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[
                styles.saveAllButton,
                {
                  backgroundColor: theme.colors.tertiary,
                }
              ]}
              onPress={() => {
                console.log('💾 Salvando todos os treinos:', msg.workoutPlanData!.workouts.length);
                handleSaveAllWorkouts(msg.workoutPlanData!);
              }}
              disabled={savingWorkout}
              activeOpacity={0.8}
            >
              {savingWorkout ? (
                <ActivityIndicator color={theme.colors.onTertiary} size="small" />
              ) : (
                <>
                  <MaterialCommunityIcons name="download-multiple" size={20} color={theme.colors.onTertiary} />
                  <Text style={[
                    styles.saveAllButtonText,
                    { color: theme.colors.onTertiary }
                  ]}>
                    {`Save All ${msg.workoutPlanData.workouts.length} Workouts`}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    ));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar
        barStyle={theme.dark ? "light-content" : "dark-content"}
        backgroundColor={theme.colors.background}
      />

      {/* HEADER */}
      <View style={[
        styles.header,
        {
          backgroundColor: theme.colors.surface,
          borderBottomColor: theme.colors.outlineVariant
        }
      ]}>
        <View style={styles.headerContent}>
          <MaterialCommunityIcons 
            name="robot-excited" 
            size={28} 
            color={theme.colors.primary} 
          />
          <Text style={[
            styles.headerTitle,
            { color: theme.colors.onSurface }
          ]}>
            {t('fitnessAI', { ns: 'common' })}
          </Text>
        </View>
      </View>

      {/* MESSAGES AREA */}
      <View style={styles.messagesWrapper}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {messages.length === 0 ? (
            <Animated.View style={[styles.emptyState, { opacity: fadeAnim }]}>
              <View style={[styles.emptyStateIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                <MaterialCommunityIcons 
                  name="message-text" 
                  size={48} 
                  color={theme.colors.onPrimaryContainer} 
                />
              </View>
              <Text style={[
                styles.emptyStateTitle,
                { color: theme.colors.onSurface }
              ]}>
                {t('converseAI', { ns: 'common' })}
              </Text>
              <Text style={[
                styles.emptyStateText,
                { color: theme.colors.onSurfaceVariant }
              ]}>
                {t('examples', { ns: 'common' })}
              </Text>
            </Animated.View>
          ) : (
            renderMessages()
          )}
          {loading && (
            <View style={styles.loadingContainer}>
              <View style={[styles.loadingBubble, { backgroundColor: theme.colors.surfaceVariant }]}>
                <View style={styles.typingDots}>
                  <View style={[styles.dot, { backgroundColor: theme.colors.onSurfaceVariant }]} />
                  <View style={[styles.dot, { backgroundColor: theme.colors.onSurfaceVariant }]} />
                  <View style={[styles.dot, { backgroundColor: theme.colors.onSurfaceVariant }]} />
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </View>

      {/* INPUT AREA */}
      <View style={styles.inputWrapper} pointerEvents="box-none">
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.outlineVariant,
              shadowColor: theme.colors.shadow,
            }
          ]}
          pointerEvents="auto"
        >
          <TextInput
            style={[
              styles.input,
              {
                color: theme.colors.onSurface,
              }
            ]}
            placeholder={t('askAI', { ns: 'common' })}
            placeholderTextColor={theme.colors.onSurfaceVariant}
            value={prompt}
            onChangeText={setPrompt}
            multiline
            maxLength={500}
            returnKeyType="send"
            blurOnSubmit={false}
            editable={true}
            onFocus={() => {
              setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }, 300);
            }}
          />
          <TouchableOpacity
            onPress={() => {Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); handleGenerateResponse()}}
            style={[
              styles.sendButton,
              {
                backgroundColor: theme.colors.primary,
                opacity: loading || !prompt.trim() ? 0.5 : 1
              }
            ]}
            disabled={loading || !prompt.trim()}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name={loading ? "dots-horizontal" : "send"}
              size={22}
              color={theme.colors.onPrimary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* SAVE WORKOUT MODAL */}
      <Modal visible={!!selectedWorkout} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity 
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => {
              setSelectedWorkout(null);
              setWorkoutName('');
              Keyboard.dismiss();
            }}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View style={[
                styles.modalContent,
                {
                  backgroundColor: theme.colors.surface,
                }
              ]}>
                <View style={styles.modalHandle} />
                
                <View style={styles.modalHeader}>
                  <MaterialCommunityIcons name="content-save" size={28} color={theme.colors.primary} />
                  <Text style={[
                    styles.modalTitle,
                    { color: theme.colors.onSurface }
                  ]}>
                    Save Workout
                  </Text>
                </View>

                <View style={styles.modalBody}>
                  <Text style={[
                    styles.label,
                    { color: theme.colors.onSurface }
                  ]}>
                    Workout Name
                  </Text>
                  <TextInput
                    style={[
                      styles.modalInput,
                      {
                        backgroundColor: theme.colors.surfaceVariant,
                        color: theme.colors.onSurface,
                        borderColor: theme.colors.outline
                      }
                    ]}
                    value={workoutName}
                    onChangeText={setWorkoutName}
                    placeholder="e.g., Chest Day"
                    placeholderTextColor={theme.colors.onSurfaceVariant}
                    autoFocus={true}
                  />

                  <Text style={[
                    styles.label,
                    { color: theme.colors.onSurface, marginTop: 16 }
                  ]}>
                    Exercises ({selectedWorkout?.exercises.length})
                  </Text>
                  <ScrollView
                    style={styles.exercisesList}
                    showsVerticalScrollIndicator={true}
                    keyboardShouldPersistTaps="handled"
                  >
                    {selectedWorkout?.exercises.map((exercise, index) => (
                      <View key={index} style={[
                        styles.exerciseItem,
                        { 
                          backgroundColor: theme.colors.surfaceVariant,
                          borderColor: theme.colors.outline + '20'
                        }
                      ]}>
                        <View style={styles.exerciseItemHeader}>
                          <MaterialCommunityIcons 
                            name="dumbbell" 
                            size={18} 
                            color={theme.colors.primary} 
                          />
                          <Text style={[
                            styles.exerciseText,
                            { color: theme.colors.onSurface }
                          ]}>
                            {exercise.name}
                          </Text>
                        </View>
                        <Text style={[
                          styles.exerciseDetails,
                          { color: theme.colors.onSurfaceVariant }
                        ]}>
                          {exercise.sets} sets × {exercise.reps} reps {exercise.weight ? `• ${exercise.weight}kg` : ''}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.cancelButton,
                      { backgroundColor: theme.colors.surfaceVariant }
                    ]}
                    onPress={() => {
                      setSelectedWorkout(null);
                      setWorkoutName('');
                      Keyboard.dismiss();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modalButtonText, { color: theme.colors.onSurfaceVariant }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.saveButton,
                      {
                        backgroundColor: theme.colors.primary,
                        opacity: savingWorkout || !workoutName.trim() ? 0.5 : 1
                      }
                    ]}
                    onPress={handleSaveWorkout}
                    disabled={savingWorkout || !workoutName.trim()}
                    activeOpacity={0.7}
                  >
                    {savingWorkout ? (
                      <ActivityIndicator color={theme.colors.onPrimary} size="small" />
                    ) : (
                      <Text style={[styles.modalButtonText, { color: theme.colors.onPrimary }]}>
                        Save Workout
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  messagesWrapper: {
    flex: 1,
    minHeight: 0,
    paddingBottom: Platform.OS === 'android' ? 140 : 0,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingBottom: Platform.OS === 'android' ? 20 : 100,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  emptyStateIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  messageRow: {
    marginBottom: 20,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  aiMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '82%',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0.2,
  },
  timestamp: {
    fontSize: 11,
    marginTop: 8,
    alignSelf: 'flex-end',
    fontWeight: '500',
  },
  inputWrapper: {
    width: '100%',
    backgroundColor: 'transparent',
    ...(Platform.OS === 'android' ? {
      position: 'absolute',
      bottom: 60,
      left: 0,
      right: 0,
      zIndex: 1000,
      elevation: 10,
    } : {}),
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    minHeight: 56,
    marginBottom: Platform.OS === 'android' ? 16 : 20,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  input: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: 8,
    paddingHorizontal: 4,
    lineHeight: 22,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  loadingContainer: {
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  loadingBubble: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.6,
  },
  saveWorkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  saveWorkoutButtonText: {
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  workoutPlanContainer: {
    marginTop: 12,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
    flex: 1,
  },
  planSubtitle: {
    fontSize: 14,
    marginBottom: 16,
    fontWeight: '500',
  },
  workoutsList: {
    gap: 8,
  },
  workoutPlanItem: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 8,
  },
  workoutPlanItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  workoutPlanItemLeft: {
    flex: 1,
  },
  workoutPlanItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  workoutPlanItemSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  saveAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 12,
  },
  saveAllButtonText: {
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '90%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#00000020',
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  modalBody: {
    paddingHorizontal: 24,
  },
  label: {
    fontSize: 15,
    marginBottom: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  modalInput: {
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    fontSize: 16,
    letterSpacing: 0.2,
  },
  exercisesList: {
    maxHeight: 240,
    marginTop: 8,
  },
  exerciseItem: {
    marginBottom: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  exerciseItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  exerciseText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
    flex: 1,
  },
  exerciseDetails: {
    fontSize: 13,
    marginLeft: 26,
    fontWeight: '500',
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 12,
  },
  modalButton: {
    paddingVertical: 16,
    borderRadius: 16,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  modalButtonText: {
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  cancelButton: {},
  saveButton: {},
});