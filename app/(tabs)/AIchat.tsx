import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, ScrollView, Alert, TouchableOpacity, Modal, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { useTheme } from 'react-native-paper';
import axios from 'axios';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as dotenv from 'dotenv';
dotenv.config();

// ⭐️ GROQ API (GRATUITA E RÁPIDA)

const WORKOUTS_STORAGE_KEY = 'workouts';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
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

export default function App() {
  const theme = useTheme();
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingWorkout, setSavingWorkout] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [workoutName, setWorkoutName] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);

  const extractWorkoutFromText = (text: string): Workout | WorkoutPlan | null => {
    try {
      console.log('🔍 Analisando texto:', text.substring(0, 200));
      
      // ⭐️ SUPORTA "Plan" (EN) e "Plano" (PT/ES)
      const hasPlan = text.includes('Plano:') || text.includes('Plan:');
      
      // ⭐️ SUPORTA "Workout" (EN) e "Treino" (PT)
      const workoutBlocks = text.split(/(?:Treino|Workout):\s*/i).slice(1);
      
      console.log('📋 Blocos de treino encontrados:', workoutBlocks.length);
      console.log('📝 Tem plano?:', hasPlan);
  
      if (workoutBlocks.length === 0) return null;
  
      // Se tiver "Plano/Plan" ou múltiplos treinos, é WorkoutPlan
      if (hasPlan || workoutBlocks.length > 1) {
        return extractWorkoutPlan(workoutBlocks, text);
      }
  
      // Se tiver apenas um treino, retorna Workout normal
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
  
    // ⭐️ SUPORTA "Plan" (EN) e "Plano" (PT/ES)
    const planNameMatch = fullText.match(/(?:Plano|Plan|Programa):\s*([^\n]+)/i);
    if (planNameMatch) {
      planName = planNameMatch[1].trim();
      console.log('🏷️ Nome do plano detectado:', planName);
    }
  
    for (let i = 0; i < workoutBlocks.length; i++) {
      const block = workoutBlocks[i];
      
      // ⭐️ MELHOR EXTRAÇÃO DO NOME DO TREINO
      let workoutName = `Treino ${i + 1}`;
      const workoutNameMatch = block.match(/^([^\n]+?)(?=\n(?:Exercício|Exercise):|\n$)/i);
      if (workoutNameMatch) {
        workoutName = workoutNameMatch[1].trim();
        console.log(`💪 Treino ${i + 1}:`, workoutName);
      }
  
      const exercises: Exercise[] = [];
      // ⭐️ SUPORTA "Exercise" (EN) e "Exercício" (PT)
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
    
    // ⭐️ SUPORTA MULTIPLOS IDIOMAS para nome do exercício
    const nameMatch = block.match(/^([^\n]+)/);
    if (nameMatch) exercise.name = nameMatch[1].trim();
    
    // ⭐️ SUPORTA "Sets" (EN) e "Séries" (PT)
    const setsMatch = block.match(/(?:Sets|Séries|Series):\s*(\d+)/i);
    if (setsMatch) exercise.sets = parseInt(setsMatch[1]);
    
    // ⭐️ SUPORTA "Reps" (EN) e "Repetições" (PT) 
    const repsMatch = block.match(/(?:Reps|Repetições|Repeticiones):\s*(\d+)/i);
    if (repsMatch) exercise.reps = parseInt(repsMatch[1]);
    
    // ⭐️ SUPORTA "Weight" (EN) e "Peso" (PT/ES)
    const weightMatch = block.match(/(?:Weight|Peso|Poids):\s*(\d+)/i);
    if (weightMatch) exercise.weight = parseInt(weightMatch[1]);
    
    // ⭐️ SUPORTA "Duration" (EN) e "Duração" (PT)
    const minutesMatch = block.match(/(?:Duration|Duração|Durée):\s*(\d+)/i);
    if (minutesMatch) exercise.minutes = parseInt(minutesMatch[1]);
    
    // ⭐️ SUPORTA MULTIPLOS TIPOS EM DIFERENTES IDIOMAS
    const typeMatch = block.match(/(?:Type|Tipo):\s*(weightlifting|calisthenics|cardio|peso|calistenia|cardio|musculation)/i);
    if (typeMatch) {
      const type = typeMatch[1].toLowerCase();
      // Converte tipos em outros idiomas para os padrões
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
    if (!prompt) {
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
      // ⭐️ GROQ API - SUPER RÁPIDA E GRATUITA
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

Exercise: [Exercise 3]
Sets: [number]
Reps: [number]
Weight: [kg]
Duration: 0
Type: weightlifting

Exercise: [Exercise 4]
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

Exercise: [Exercise 2]
Sets: [number]
Reps: [number]
Weight: [kg]
Duration: 0
Type: weightlifting

Exercise: [Exercise 3]
Sets: [number]
Reps: [number]
Weight: [kg]
Duration: 0
Type: weightlifting

Exercise: [Exercise 4]
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

Exercise: [Exercise 2]
Sets: [number]
Reps: [number]
Weight: [kg]
Duration: 0
Type: weightlifting

Exercise: [Exercise 3]
Sets: [number]
Reps: [number]
Weight: [kg]
Duration: 0
Type: weightlifting

Exercise: [Exercise 4]
Sets: [number]
Reps: [number]
Weight: [kg]
Duration: 0
Type: weightlifting

📝 **STRICT RULES:**
1. **ONLY 3 WORKOUTS MAXIMUM** for PPL/ABC programs
2. **4-6 EXERCISES PER WORKOUT** - no empty workouts!
3. **COMPLETE EACH WORKOUT** before starting the next one
4. **REALISTIC PROGRESSION** - don't create multiple versions
5. **PROPER EXERCISE SELECTION** - compound + isolation exercises
6. **BALANCED VOLUME** - 12-20 sets per workout
7. **NO REPETITIVE STRUCTURES** - one continuous flow

💪 **PUSH WORKOUT EXAMPLE (4-6 exercises):**
- Bench Press (compound)
- Shoulder Press (compound) 
- Incline Dumbbell Press (compound)
- Triceps Pushdown (isolation)
- Lateral Raises (isolation)

🏋️ **PULL WORKOUT EXAMPLE (4-6 exercises):**
- Pull-ups (compound)
- Bent-over Rows (compound)
- Lat Pulldowns (compound)
- Bicep Curls (isolation)
- Face Pulls (isolation)

🦵 **LEGS WORKOUT EXAMPLE (4-6 exercises):**
- Squats (compound)
- Deadlifts (compound)
- Leg Press (compound)
- Leg Curls (isolation)
- Calf Raises (isolation)

🚨 **CRITICAL: NEVER create workouts with only 1-2 exercises. ALWAYS 4-6 exercises per workout!**

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
  temperature: 0.7, // Um pouco menos criativo mas mais consistente
  max_tokens: 1024,
  top_p: 0.9,
  stream: false
};

      console.log('🚀 Enviando para Groq IA...');
      
      const res = await axios.post(apiUrl, requestBody, {
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
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
      
      // ⭐️ AGORA SÓ MOSTRA ERRO - SEM FALLBACK!
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
              💾 Salvar "{msg.workoutData.name}"
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
                  // ⭐️ MELHORIA: Nome automático com plano + treino
                  setWorkoutName(`${msg.workoutPlanData!.planName} - ${workout.name}`);
                }}
              >
                <Text style={[
                  styles.saveWorkoutButtonText,
                  { color: theme.colors.secondary }
                ]}>
                  💾 {workout.name} ({workout.exercises.length} exercícios)
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
                  💾 Salvar Todos os {msg.workoutPlanData.workouts.length} Treinos
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    ));
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Header */}
      <View style={[
        styles.header, 
        { 
          backgroundColor: theme.colors.surface,
          borderBottomColor: theme.colors.outline 
        }
      ]}>
        <Text style={[
          styles.time, 
          { color: theme.colors.onSurface }
        ]}>
          12:00
        </Text>
        <View style={styles.statusIcons}>
          <Text style={[
            styles.statusText,
            { color: theme.colors.onSurfaceVariant }
          ]}>
            Fitness AI
          </Text>
          <Text style={[
            styles.statusText,
            { color: theme.colors.onSurfaceVariant }
          ]}>
            Groq IA
          </Text>
        </View>
      </View>
      
      {/* Messages Area */}
      <View style={styles.messagesWrapper}>
        <ScrollView 
          style={styles.messagesContainer}
          contentContainerStyle={[
            styles.messagesContent,
            keyboardVisible && styles.messagesContentKeyboard
          ]}
          showsVerticalScrollIndicator={false}
          ref={ref => {
            if (ref && messages.length > 0) {
              setTimeout(() => ref.scrollToEnd({ animated: true }), 100);
            }
          }}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[
                styles.emptyStateText,
                { color: theme.colors.onSurfaceVariant }
              ]}>
                🚀 Converse com a IA de Fitness!
              </Text>
              <Text style={[
                styles.demoHint,
                { color: theme.colors.onSurfaceVariant }
              ]}>
                Peça: "treino PPL", "ABC iniciante", "treino de costas avançado"
              </Text>
            </View>
          ) : (
            renderMessages()
          )}
          {loading && (
            <ActivityIndicator 
              style={styles.loading} 
              size="small" 
              color={theme.colors.primary} 
            />
          )}
        </ScrollView>
      </View>

      {/* Input Area */}
      <View style={[
        styles.inputContainer, 
        { 
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.outline 
        }
      ]}>
        <TextInput
          style={[
            styles.input,
            { 
              color: theme.colors.onSurface,
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
            { backgroundColor: theme.colors.primary }
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

      {/* Save Workout Modal */}
      <Modal visible={!!selectedWorkout} animationType="slide" transparent={true}>
        <View style={styles.modalContainer}>
          <View style={[
            styles.modalContent, 
            { backgroundColor: theme.colors.surface }
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
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.onSurface,
                  borderColor: theme.colors.outline 
                }
              ]}
              value={workoutName}
              onChangeText={setWorkoutName}
              placeholder="Ex: Treino de Peito"
              placeholderTextColor={theme.colors.onSurfaceVariant}
            />

            <Text style={[
              styles.label,
              { color: theme.colors.onSurface }
            ]}>
              Exercícios gerados pela IA:
            </Text>
            <ScrollView style={styles.exercisesList}>
              {selectedWorkout?.exercises.map((exercise, index) => (
                <View key={index} style={styles.exerciseItem}>
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
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setSelectedWorkout(null)}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.modalButton, 
                  styles.saveButton,
                  { backgroundColor: theme.colors.primary }
                ]}
                onPress={handleSaveWorkout}
                disabled={savingWorkout}
              >
                {savingWorkout ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalButtonText}>Salvar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ... (styles mantêm iguais)
const styles = StyleSheet.create({
  container: { 
    flex: 1,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  time: {
    fontSize: 17,
    fontWeight: '600',
  },
  statusIcons: {
    flexDirection: 'row',
    gap: 15,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  messagesWrapper: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 15,
    paddingBottom: 10,
    flexGrow: 1,
  },
  messagesContentKeyboard: {
    paddingBottom: 80,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  demoHint: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  messageRow: {
    marginBottom: 8,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 4,
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
    fontSize: 15,
    lineHeight: 20,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    margin: 15,
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  input: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  loading: {
    marginVertical: 10,
    alignSelf: 'center',
  },
  saveWorkoutButton: { 
    borderWidth: 1,
    padding: 10,
    borderRadius: 12,
    marginVertical: 8,
    alignSelf: 'center',
  },
  saveWorkoutButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: { 
    padding: 20, 
    borderRadius: 16, 
    width: '90%', 
    maxHeight: '80%' 
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '600',
  },
  modalInput: {
    borderWidth: 1,
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  exercisesList: {
    maxHeight: 150,
    marginBottom: 15,
  },
  exerciseItem: {
    marginBottom: 8,
  },
  exerciseText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  exerciseDetails: {
    fontSize: 12,
    marginLeft: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalButton: {
    padding: 14,
    borderRadius: 10,
    flex: 1,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#8E8E93',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  modalButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  workoutPlanContainer: {
    marginVertical: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  planTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  planSubtitle: {
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
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