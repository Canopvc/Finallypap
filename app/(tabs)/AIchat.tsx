import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
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
  View
} from 'react-native';
import { useTheme } from 'react-native-paper';
import {GROQ_API_KEY} from '@env';

// ⭐️ GROQ API (GRATUITA E RÁPIDA)
const WORKOUTS_STORAGE_KEY = 'workouts';
const API_KEY = GROQ_API_KEY;

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
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingWorkout, setSavingWorkout] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [workoutName, setWorkoutName] = useState('');
  
  const scrollViewRef = useRef<ScrollView>(null);

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
  
    const userMessage: MessageType = {
      text: prompt,
      isUser: true,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setPrompt('');
    setLoading(true);
  
    try {
      const apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
      
      const systemInstruction = `You are an expert fitness coach. Follow these rules STRICTLY:

🎯 **MANDATORY STRUCTURE:**

For PPL/ABC programs - Create ONLY 3 COMPLETE workouts:

Plan: [Plan Name - e.g., "PPL Strength Program"]

Workout: Push (Chest, Shoulders, Triceps)
Exercise: [Exercise 1]
Sets: [number]
Reps: [number]
Weight: [kg]
Duration: 0
Type: weightlifting

Exercise: [Exercise 2]
Sets: [number]
Reps: [number]
Weight: [kg]
Duration: 0
Type: weightlifting

Workout: Pull (Back, Biceps)
Exercise: [Exercise 1]
Sets: [number]
Reps: [number]
Weight: [kg]
Duration: 0
Type: weightlifting

Workout: Legs (Quadriceps, Hamstrings, Glutes)
Exercise: [Exercise 1]
Sets: [number]
Reps: [number]
Weight: [kg]
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

Respond in the same language as the user's query.`;

      const requestBody = {
        messages: [
          {
            role: "system",
            content: systemInstruction
          },
          {
            role: "user", 
            content: prompt
          }
        ],
        model: "llama-3.1-8b-instant",
        temperature: 0.7,
        max_tokens: 1024,
        top_p: 0.9,
        stream: false
      };

      console.log('🚀 Enviando para Groq IA...');
      
      const res = await axios.post(apiUrl, requestBody, {
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        timeout: 30000
      });

      console.log('✅ Resposta recebida:', res.status);

      if (!res.data.choices || !res.data.choices[0].message.content) {
        throw new Error('Resposta da API inválida');
      }

      const generatedText = res.data.choices[0].message.content;
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
      console.error('❌ Erro na IA:', error);
      
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
        
        if (error.response.status === 401) {
          Alert.alert('Chave API Inválida', 'Verifique sua chave da API Groq.');
        } else if (error.response.status === 429) {
          Alert.alert('Limite Atingido', 'Muitas requisições. Tente novamente em alguns segundos.');
        } else {
          Alert.alert('Erro da API', `Status: ${error.response.status}`);
        }
      } else if (error.request) {
        Alert.alert('Erro de Rede', 'Não foi possível conectar ao servidor da IA.');
      } else {
        Alert.alert('Erro', error.message || 'Falha ao obter resposta da IA.');
      }
      
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
      <View key={index} style={styles.messageRow}>
        <View 
          style={[
            styles.messageContainer,
            msg.isUser ? styles.userMessageContainer : styles.geminiMessageContainer
          ]}
        >
          <View 
            style={[
              styles.messageBubble,
              { 
                backgroundColor: msg.isUser 
                  ? theme.colors.primaryContainer 
                  : theme.colors.surfaceVariant 
              }
            ]}
          >
            <Text 
              style={[
                styles.messageText,
                { 
                  color: msg.isUser 
                    ? theme.colors.onPrimaryContainer 
                    : theme.colors.onSurfaceVariant 
                }
              ]}
            >
              {msg.text}
            </Text>
            <Text style={[
              styles.timestamp,
              { color: theme.colors.outline }
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
                borderColor: theme.colors.primary,
                backgroundColor: theme.colors.surface
              }
            ]}
            onPress={() => {
              setSelectedWorkout(msg.workoutData!);
              setWorkoutName(msg.workoutData!.name);
            }}
          >
            <Text style={[
              styles.saveWorkoutButtonText,
              { color: theme.colors.primary }
            ]}>
              {`💾 Salvar "${msg.workoutData.name}"`}
            </Text>
          </TouchableOpacity>
        )}
  
        {msg.isWorkoutPlan && msg.workoutPlanData && (
          <View style={[
            styles.workoutPlanContainer,
            { backgroundColor: theme.colors.surfaceVariant }
          ]}>
            <Text style={[
              styles.planTitle,
              { color: theme.colors.onSurface }
            ]}>
              📋 {msg.workoutPlanData.planName}
            </Text>
            <Text style={[
              styles.planSubtitle,
              { color: theme.colors.onSurfaceVariant }
            ]}>
              {msg.workoutPlanData.workouts.length} treinos do programa
            </Text>
            
            {msg.workoutPlanData.workouts.map((workout, workoutIndex) => (
              <TouchableOpacity 
                key={workoutIndex}
                style={[
                  styles.saveWorkoutButton,
                  { 
                    borderColor: theme.colors.secondary,
                    backgroundColor: theme.colors.surface,
                    marginVertical: 4
                  }
                ]}
                onPress={() => {
                  setSelectedWorkout(workout);
                  setWorkoutName(`${msg.workoutPlanData!.planName} - ${workout.name}`);
                }}
              >
                <Text style={[
                  styles.saveWorkoutButtonText,
                  { color: theme.colors.secondary }
                ]}>
                  {`💾 ${workout.name} (${workout.exercises.length} exercícios)`}
                </Text>
              </TouchableOpacity>
            ))}
            
            <TouchableOpacity 
              style={[
                styles.saveAllButton,
                { 
                  backgroundColor: theme.colors.primary,
                  marginTop: 8
                }
              ]}
              onPress={() => {
                console.log('💾 Salvando todos os treinos:', msg.workoutPlanData!.workouts.length);
                handleSaveAllWorkouts(msg.workoutPlanData!);
              }}
              disabled={savingWorkout}
            >
              {savingWorkout ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={[
                  styles.saveAllButtonText,
                  { color: theme.colors.onPrimary }
                ]}>
                  {`💾 Salvar Todos os ${msg.workoutPlanData.workouts.length} Treinos`}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    ));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar 
        barStyle={theme.dark ? "light-content" : "dark-content"} 
        backgroundColor={theme.colors.background}
      />
      
      {/* HEADER FIXO */}
      <View style={[
        styles.header, 
        { 
          backgroundColor: theme.colors.surface,
          borderBottomColor: theme.colors.outline 
        }
      ]}>
        <Text style={[
          styles.headerTitle,
          { color: theme.colors.onSurface }
        ]}>
          Fitness AI
        </Text>
      </View>
      
      {/* ÁREA DE MENSAGENS - CRESCÍVEL */}
      <View style={styles.messagesWrapper}>
        <ScrollView 
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[
                styles.emptyStateTitle,
                { color: theme.colors.onSurface }
              ]}>
                Converse com a IA de Fitness!
              </Text>
              <Text style={[
                styles.emptyStateText,
                { color: theme.colors.onSurfaceVariant }
              ]}>
                Peça: treino PPL, ABC iniciante, treino de costas avançado
              </Text>
            </View>
          ) : (
            renderMessages()
          )}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator 
                size="small" 
                color={theme.colors.primary} 
              />
              <Text style={[
                styles.loadingText,
                { color: theme.colors.onSurfaceVariant }
              ]}>
                IA está pensando...
              </Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* INPUT - COM KEYBOARD AVOIDING APENAS AQUI */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputWrapper}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={[
          styles.inputContainer, 
          { 
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outline,
          }
        ]}>
          <TextInput
            style={[
              styles.input,
              { 
                color: theme.colors.onSurface,
                backgroundColor: theme.colors.background
              }
            ]}
            placeholder="Pergunte à IA sobre treinos..."
            placeholderTextColor={theme.colors.onSurfaceVariant}
            value={prompt}
            onChangeText={setPrompt}
            multiline
            maxLength={500}
          />
          <TouchableOpacity 
            onPress={handleGenerateResponse} 
            style={[
              styles.sendButton,
              { 
                backgroundColor: theme.colors.primary,
                opacity: loading || !prompt.trim() ? 0.6 : 1
              }
            ]}
            disabled={loading || !prompt.trim()}
          >
            <MaterialCommunityIcons 
              name="send" 
              size={20} 
              color={theme.colors.onPrimary} 
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Save Workout Modal */}
      <Modal visible={!!selectedWorkout} animationType="slide" transparent={true}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={[
              styles.modalContent, 
              { 
                backgroundColor: theme.colors.surface,
              }
            ]}>
              <Text style={[
                styles.modalTitle,
                { color: theme.colors.onSurface }
              ]}>
                Salvar Treino da IA
              </Text>
              
              <Text style={[
                styles.label,
                { color: theme.colors.onSurface }
              ]}>
                Nome do Treino
              </Text>
              <TextInput
                style={[
                  styles.modalInput, 
                  { 
                    backgroundColor: theme.colors.background,
                    color: theme.colors.onSurface,
                    borderColor: theme.colors.outline 
                  }
                ]}
                value={workoutName}
                onChangeText={setWorkoutName}
                placeholder="Ex: Treino de Peito"
                placeholderTextColor={theme.colors.onSurfaceVariant}
                autoFocus={true}
              />

              <Text style={[
                styles.label,
                { color: theme.colors.onSurface }
              ]}>
                Exercícios gerados pela IA:
              </Text>
              <ScrollView 
                style={styles.exercisesList}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled"
              >
                {selectedWorkout?.exercises.map((exercise, index) => (
                  <View key={index} style={[
                    styles.exerciseItem,
                    { backgroundColor: theme.colors.background }
                  ]}>
                    <Text style={[
                      styles.exerciseText,
                      { color: theme.colors.onSurface }
                    ]}>
                      • {exercise.name}
                    </Text>
                    <Text style={[
                      styles.exerciseDetails,
                      { color: theme.colors.onSurfaceVariant }
                    ]}>
                      {exercise.sets} séries de {exercise.reps} reps {exercise.weight ? `- ${exercise.weight}kg` : ''}
                    </Text>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.modalButtons}>
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
                >
                  <Text style={[styles.modalButtonText, { color: theme.colors.onSurfaceVariant }]}>
                    Cancelar
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.modalButton, 
                    styles.saveButton,
                    { 
                      backgroundColor: theme.colors.primary,
                      opacity: savingWorkout ? 0.6 : 1
                    }
                  ]}
                  onPress={handleSaveWorkout}
                  disabled={savingWorkout || !workoutName.trim()}
                >
                  {savingWorkout ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={[styles.modalButtonText, { color: theme.colors.onPrimary }]}>
                      Salvar
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
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
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    paddingTop: 16,
  },
  messagesWrapper: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  messageRow: {
    marginBottom: 16,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  geminiMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '85%',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 11,
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  inputWrapper: {
    width: '100%',
  },
  inputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center',
    marginHorizontal: 16,
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
  },
  saveWorkoutButton: { 
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    marginVertical: 8,
    alignSelf: 'center',
    minWidth: '80%',
  },
  saveWorkoutButtonText: {
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: { 
    width: '100%',
    padding: 20, 
    borderRadius: 16,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '600',
  },
  modalInput: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    fontSize: 16,
  },
  exercisesList: {
    maxHeight: 200,
    marginBottom: 20,
  },
  exerciseItem: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
  },
  exerciseText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  exerciseDetails: {
    fontSize: 12,
    marginLeft: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    padding: 14,
    borderRadius: 10,
    flex: 1,
    alignItems: 'center',
  },
  modalButtonText: {
    fontWeight: '600',
    fontSize: 16,
  },
  workoutPlanContainer: {
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  planSubtitle: {
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'center',
  },
  cancelButton: {
    
  },
  saveButton: {
    
  },
  saveAllButton: {
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveAllButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },
});