import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from 'react-native-paper';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COHERE_API_KEY } from '@env';

// Definir tipos
interface Meal {
  id: string;
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  timestamp: string;
}

interface DailyGoals {
  calories: number;
  protein: number;
  carbs: number;
}

interface TodayTotals {
  calories: number;
  protein: number;
  carbs: number;
}

interface FoodAnalysis {
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface ProgressCircleProps {
  type: keyof DailyGoals;
  color: string;
}

const CalorieCounter: React.FC = () => {
  const router = useRouter();
  const theme = useTheme();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [foodInput, setFoodInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [dailyGoals, setDailyGoals] = useState<DailyGoals>({
    calories: 2000,
    protein: 50,
    carbs: 250
  });
  const [todayTotals, setTodayTotals] = useState<TodayTotals>({
    calories: 0,
    protein: 0,
    carbs: 0
  });
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [tempGoals, setTempGoals] = useState<DailyGoals>(dailyGoals);

  // Carregar metas salvas
  useEffect(() => {
    loadSavedGoals();
  }, []);

  const loadSavedGoals = async () => {
    try {
      const savedGoals = await AsyncStorage.getItem('@nutrition_goals');
      if (savedGoals) {
        const goals = JSON.parse(savedGoals);
        setDailyGoals(goals);
        setTempGoals(goals);
      }
    } catch (error) {
      console.error('Erro ao carregar metas:', error);
    }
  };

  const saveGoals = async (goals: DailyGoals) => {
    try {
      await AsyncStorage.setItem('@nutrition_goals', JSON.stringify(goals));
      setDailyGoals(goals);
      Alert.alert('Sucesso', 'Metas atualizadas!');
    } catch (error) {
      console.error('Erro ao salvar metas:', error);
      Alert.alert('Erro', 'Não foi possível salvar as metas');
    }
  };

  const openSettings = () => {
    setTempGoals(dailyGoals);
    setSettingsModalVisible(true);
  };

  const applySettings = () => {
    saveGoals(tempGoals);
    setSettingsModalVisible(false);
  };

  // Função para voltar para a tela inicial
  const handleBackToHome = (): void => {
    router.back();
  };

  // Função para analisar alimentos usando Groq API
  const analyzeFoodWithGroq = async (foodDescription: string): Promise<FoodAnalysis> => {
    const API_KEY = COHERE_API_KEY;
    
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: `Você é um nutricionista profissional especializado em análise de alimentos. 

ANÁLISE DA DESCRIÇÃO DO ALIMENTO:
- EXTRAIA A QUANTIDADE EXATA da descrição (ex: "3 ovos", "200g de frango", "1 colher de azeite")
- Se não houver quantidade, assuma uma porção padrão realista
- Para múltiplas unidades (ex: "20 batatas"), calcule o TOTAL nutricional
- Considere preparação: cozido, frito, assado, etc.
- Use valores nutricionais REAIS de bases de dados

CALCULE os valores totais baseados na quantidade especificada:
- "2 ovos" = nutrientes de 2 ovos
- "150g de arroz" = nutrientes para 150g
- "1 colher de azeite" = ~10ml

RETORNE APENAS UM JSON VÁLIDO com esta estrutura exata:
{
  "foodName": "string",
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number
}

Exemplos:
Descrição: "3 ovos cozidos" → {"foodName": "ovos cozidos", "calories": 210, "protein": 18, "carbs": 1, "fat": 15}
Descrição: "20 batatas cozidas" → {"foodName": "batatas cozidas", "calories": 1600, "protein": 40, "carbs": 360, "fat": 2}
Descrição: "1 colher de azeite" → {"foodName": "azeite", "calories": 90, "protein": 0, "carbs": 0, "fat": 10}`
            },
            {
              role: "user",
              content: `Analise nutricionalmente: "${foodDescription}"`
            }
          ],
          model: "llama-3.1-8b-instant",
          temperature: 0.3,
          max_tokens: 500,
          response_format: { type: "json_object" }
        })
      });

      const data = await response.json();
      
      if (data.choices && data.choices[0].message.content) {
        const content = data.choices[0].message.content;
        console.log('Resposta da API:', content);
        
        try {
          const parsedData = JSON.parse(content);
          return {
            foodName: parsedData.foodName || foodDescription,
            calories: parsedData.calories || 0,
            protein: parsedData.protein || 0,
            carbs: parsedData.carbs || 0,
            fat: parsedData.fat || 0
          };
        } catch (parseError) {
          console.error('Erro ao parsear JSON:', parseError);
          throw new Error('Resposta da API em formato inválido');
        }
      }
      
      throw new Error('Resposta da API inválida');
      
    } catch (error) {
      console.error('Erro Groq API:', error);
      throw error;
    }
  };

  // Fallback para quando a API não estiver disponível
  const analyzeFoodFallback = (foodDescription: string): FoodAnalysis => {
    const commonFoods: Record<string, Omit<FoodAnalysis, 'foodName'>> = {
      'arroz': { calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
      'feijão': { calories: 115, protein: 7.6, carbs: 20, fat: 0.5 },
      'frango': { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
      'carne': { calories: 250, protein: 26, carbs: 0, fat: 15 },
      'peixe': { calories: 200, protein: 22, carbs: 0, fat: 12 },
      'ovo': { calories: 78, protein: 6, carbs: 0.6, fat: 5 },
      'pão': { calories: 80, protein: 3, carbs: 15, fat: 1 },
      'macarrão': { calories: 158, protein: 5.8, carbs: 30, fat: 0.9 },
      'batata': { calories: 77, protein: 2, carbs: 17, fat: 0.1 },
      'salada': { calories: 50, protein: 2, carbs: 10, fat: 0.5 },
      'queijo': { calories: 113, protein: 7, carbs: 0.9, fat: 9 },
      'leite': { calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3 }
    };

    const lowerInput = foodDescription.toLowerCase();
    let bestMatch: Omit<FoodAnalysis, 'foodName'> = { calories: 150, protein: 10, carbs: 20, fat: 5 };

    for (const [food, nutrients] of Object.entries(commonFoods)) {
      if (lowerInput.includes(food)) {
        bestMatch = nutrients;
        break;
      }
    }

    return {
      foodName: foodDescription,
      ...bestMatch
    };
  };

  const addMeal = async (): Promise<void> => {
    if (!foodInput.trim()) {
      Alert.alert('Erro', 'Por favor, descreva o que você comeu');
      return;
    }

    setLoading(true);

    try {
      let foodData: FoodAnalysis;
      
      // Tenta usar a API do Groq primeiro
      try {
        foodData = await analyzeFoodWithGroq(foodInput);
      } catch (apiError) {
        console.log('Usando fallback:', apiError);
        // Se a API falhar, usa o fallback
        foodData = analyzeFoodFallback(foodInput);
      }

      const newMeal: Meal = {
        id: Date.now().toString(),
        ...foodData,
        timestamp: new Date().toLocaleTimeString('pt-BR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      };

      setMeals(prev => [newMeal, ...prev]);
      setTodayTotals(prev => ({
        calories: (prev.calories || 0) + (foodData.calories || 0),
        protein: (prev.protein || 0) + (foodData.protein || 0),
        carbs: (prev.carbs || 0) + (foodData.carbs || 0)
      }));

      setFoodInput('');
      Alert.alert('Sucesso', `${foodData.foodName} adicionado!`);

    } catch (error) {
      Alert.alert('Erro', 'Não foi possível analisar o alimento');
    } finally {
      setLoading(false);
    }
  };

  const removeMeal = (mealId: string): void => {
    const mealToRemove = meals.find(meal => meal.id === mealId);
    if (mealToRemove) {
      setTodayTotals(prev => ({
        calories: Math.max(0, (prev.calories || 0) - (mealToRemove.calories || 0)),
        protein: Math.max(0, (prev.protein || 0) - (mealToRemove.protein || 0)),
        carbs: Math.max(0, (prev.carbs || 0) - (mealToRemove.carbs || 0))
      }));
      setMeals(prev => prev.filter(meal => meal.id !== mealId));
    }
  };

  const calculateRemaining = (type: keyof DailyGoals): { remaining: number; percentage: number } => {
    const goal = dailyGoals[type] || 0;
    const consumed = todayTotals[type] || 0;
    const remaining = Math.max(0, goal - consumed);
    const percentage = goal > 0 ? Math.min(100, (consumed / goal) * 100) : 0;
    
    return {
      remaining,
      percentage
    };
  };

  // Função segura para formatar números
  const safeToFixed = (value: any, decimals: number = 1): string => {
    if (value === undefined || value === null) return '0.0';
    const num = Number(value);
    return isNaN(num) ? '0.0' : num.toFixed(decimals);
  };

  const ProgressCircle: React.FC<ProgressCircleProps> = ({ type, color }) => {
    const { remaining, percentage } = calculateRemaining(type);
    const radius = 40;
    const strokeWidth = 8;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
    const getTypeLabel = (): string => {
      switch (type) {
        case 'calories': return 'Calorias';
        case 'protein': return 'Proteína';
        case 'carbs': return 'Carboidratos';
        default: return '';
      }
    };
  
    const getUnit = (): string => {
      return type === 'calories' ? 'kcal' : 'g';
    };

    // Mostrar o consumo atual em vez do restante
    const currentValue = todayTotals[type] || 0;
    const goalValue = dailyGoals[type] || 0;
  
    return (
      <View style={styles.circleContainer}>
        <View style={styles.circleWrapper}>
          <Svg width="100" height="100" style={styles.circleSvg}>
            <SvgCircle
              cx="50"
              cy="50"
              r={radius}
              stroke={theme.colors.outline + '40'}
              strokeWidth={strokeWidth}
              fill="none"
            />
            <SvgCircle
              cx="50"
              cy="50"
              r={radius}
              stroke={color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
            />
          </Svg>
          <View style={styles.circleText}>
            <Text style={[styles.circleNumber, { color: theme.colors.onSurface }]}>
              {currentValue}
            </Text>
            <Text style={[styles.circleLabel, { color: theme.colors.onSurfaceVariant }]}>
              / {goalValue} {getUnit()}
            </Text>
          </View>
        </View>
        <Text style={[styles.circleTitle, { color: theme.colors.onSurface }]}>
          {getTypeLabel()}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Container */}
        <View style={[styles.headerContainer, { backgroundColor: theme.colors.surface }]}>
          <TouchableOpacity 
            style={styles.backButtonContainer}
            onPress={handleBackToHome}
          >
            <Text style={[styles.backButtonText, { color: theme.colors.primary }]}>←</Text>
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <Text style={[styles.mainTitle, { color: theme.colors.onSurface }]}>
              Nutric
            </Text>
            <Text style={[styles.subTitle, { color: theme.colors.onSurfaceVariant }]}>
              Calorie Counter
            </Text>
          </View>

          <TouchableOpacity 
            style={styles.settingsButtonContainer}
            onPress={openSettings}
          >
            <Text style={[styles.settingsIcon, { color: theme.colors.onSurface }]}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Progress Section Container */}
        <View style={[styles.progressSectionContainer, { backgroundColor: theme.colors.background }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Progresso Hoje
          </Text>
          <View style={styles.circlesContainer}>
            <ProgressCircle type="calories" color={theme.colors.primary} />
            <ProgressCircle type="protein" color="#2196F3" />
            <ProgressCircle type="carbs" color="#FF9800" />
          </View>
        </View>

        {/* Add Food Section Container */}
        <View style={[styles.addFoodSectionContainer, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Adicionar Refeição
          </Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.outline,
                color: theme.colors.onSurface
              }]}
              placeholder="Descreva o que você comeu (ex: 2 ovos cozidos, 1 pão integral)"
              placeholderTextColor={theme.colors.onSurfaceVariant}
              value={foodInput}
              onChangeText={setFoodInput}
              multiline
            />
            <TouchableOpacity 
              style={[styles.addButton, { backgroundColor: theme.colors.primary }, loading && styles.addButtonDisabled]}
              onPress={addMeal}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.onPrimary} />
              ) : (
                <Text style={[styles.addButtonText, { color: theme.colors.onPrimary }]}>
                  Adicionar Refeição
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Summary Section Container */}
        <View style={[styles.summarySectionContainer, { backgroundColor: theme.colors.background }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Resumo do Dia
          </Text>
          <View style={[styles.summaryContainer, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Calorias
                </Text>
                <Text style={[styles.summaryValue, { color: theme.colors.onSurface }]}>
                  {todayTotals.calories || 0} / {dailyGoals.calories} kcal
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Proteína
                </Text>
                <Text style={[styles.summaryValue, { color: theme.colors.onSurface }]}>
                  {safeToFixed(todayTotals.protein)} / {dailyGoals.protein} g
                </Text>
              </View>
            </View>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Carboidratos
                </Text>
                <Text style={[styles.summaryValue, { color: theme.colors.onSurface }]}>
                  {safeToFixed(todayTotals.carbs)} / {dailyGoals.carbs} g
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Restante
                </Text>
                <Text style={[styles.summaryValue, { color: theme.colors.primary }]}>
                  {calculateRemaining('calories').remaining} kcal
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Meals Section Container */}
        <View style={[styles.mealsSectionContainer, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.mealsHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Refeições de Hoje
            </Text>
            <Text style={[styles.mealsCount, { color: theme.colors.onSurfaceVariant }]}>
              {meals.length} refeições
            </Text>
          </View>
          
          {meals.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Text style={[styles.emptyStateIcon, { color: theme.colors.onSurfaceVariant }]}>
                🍽️
              </Text>
              <Text style={[styles.emptyStateText, { color: theme.colors.onSurfaceVariant }]}>
                Nenhuma refeição adicionada hoje
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: theme.colors.onSurfaceVariant }]}>
                Adicione sua primeira refeição acima
              </Text>
            </View>
          ) : (
            <View style={styles.mealsListContainer}>
              {meals.map(meal => (
                <View 
                  key={meal.id} 
                  style={[styles.mealItem, { backgroundColor: theme.colors.surfaceVariant }]}
                >
                  <View style={styles.mealContent}>
                    <View style={styles.mealHeader}>
                      <Text style={[styles.mealName, { color: theme.colors.onSurface }]}>
                        {meal.foodName}
                      </Text>
                      <Text style={[styles.mealTime, { color: theme.colors.onSurfaceVariant }]}>
                        {meal.timestamp}
                      </Text>
                    </View>
                    <View style={styles.mealDetails}>
                      <View style={styles.nutrientBadge}>
                        <Text style={[styles.nutrientValue, { color: theme.colors.onSurface }]}>
                          {meal.calories}
                        </Text>
                        <Text style={[styles.nutrientLabel, { color: theme.colors.onSurfaceVariant }]}>
                          kcal
                        </Text>
                      </View>
                      <View style={styles.nutrientBadge}>
                        <Text style={[styles.nutrientValue, { color: theme.colors.onSurface }]}>
                          {safeToFixed(meal.protein)}
                        </Text>
                        <Text style={[styles.nutrientLabel, { color: theme.colors.onSurfaceVariant }]}>
                          proteína
                        </Text>
                      </View>
                      <View style={styles.nutrientBadge}>
                        <Text style={[styles.nutrientValue, { color: theme.colors.onSurface }]}>
                          {safeToFixed(meal.carbs)}
                        </Text>
                        <Text style={[styles.nutrientLabel, { color: theme.colors.onSurfaceVariant }]}>
                          carbs
                        </Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={styles.deleteButtonContainer}
                    onPress={() => removeMeal(meal.id)}
                  >
                    <Text style={[styles.deleteButtonText, { color: theme.colors.error }]}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modal de Configurações */}
      <Modal
        visible={settingsModalVisible}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
              Configurar Metas Diárias
            </Text>
            
            <View style={styles.settingItem}>
              <Text style={[styles.settingLabel, { color: theme.colors.onSurface }]}>
                Calorias (kcal)
              </Text>
              <TextInput
                style={[styles.settingInput, { 
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.outline,
                  color: theme.colors.onSurface
                }]}
                value={tempGoals.calories.toString()}
                onChangeText={(text) => setTempGoals(prev => ({
                  ...prev,
                  calories: parseInt(text) || 0
                }))}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.settingItem}>
              <Text style={[styles.settingLabel, { color: theme.colors.onSurface }]}>
                Proteína (g)
              </Text>
              <TextInput
                style={[styles.settingInput, { 
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.outline,
                  color: theme.colors.onSurface
                }]}
                value={tempGoals.protein.toString()}
                onChangeText={(text) => setTempGoals(prev => ({
                  ...prev,
                  protein: parseInt(text) || 0
                }))}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.settingItem}>
              <Text style={[styles.settingLabel, { color: theme.colors.onSurface }]}>
                Carboidratos (g)
              </Text>
              <TextInput
                style={[styles.settingInput, { 
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.outline,
                  color: theme.colors.onSurface
                }]}
                value={tempGoals.carbs.toString()}
                onChangeText={(text) => setTempGoals(prev => ({
                  ...prev,
                  carbs: parseInt(text) || 0
                }))}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: theme.colors.surfaceVariant }]}
                onPress={() => setSettingsModalVisible(false)}
              >
                <Text style={[styles.cancelButtonText, { color: theme.colors.onSurfaceVariant }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: theme.colors.primary }]}
                onPress={applySettings}
              >
                <Text style={[styles.modalButtonText, { color: theme.colors.onPrimary }]}>
                  Salvar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },

  // Header Container
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#00000010',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  backButtonContainer: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: '600',
  },
  titleContainer: {
    alignItems: 'center',
    flex: 1,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subTitle: {
    fontSize: 14,
    marginTop: 2,
    fontWeight: '500',
  },
  settingsButtonContainer: {
    padding: 8,
  },
  settingsIcon: {
    fontSize: 20,
  },

  // Section Titles
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: 0.3,
  },

  // Progress Section
  progressSectionContainer: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  circlesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  circleContainer: {
    alignItems: 'center',
    width: '30%',
  },
  circleWrapper: {
    position: 'relative',
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleSvg: {
    position: 'absolute',
  },
  circleText: {
    alignItems: 'center',
  },
  circleNumber: {
    fontSize: 16,
    fontWeight: '700',
  },
  circleLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  circleTitle: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
  },

  // Add Food Section
  addFoodSectionContainer: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
  },
  inputContainer: {
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    fontSize: 16,
    minHeight: 80,
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  addButton: {
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Summary Section
  summarySectionContainer: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  summaryContainer: {
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Meals Section
  mealsSectionContainer: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: 8,
  },
  mealsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  mealsCount: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
  mealsListContainer: {
    gap: 12,
  },
  mealItem: {
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  mealContent: {
    flex: 1,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  mealName: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
  },
  mealTime: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.7,
  },
  mealDetails: {
    flexDirection: 'row',
    gap: 16,
  },
  nutrientBadge: {
    alignItems: 'center',
  },
  nutrientValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  nutrientLabel: {
    fontSize: 10,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  deleteButtonContainer: {
    padding: 4,
    marginLeft: 8,
  },
  deleteButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    width: '100%',
    padding: 24,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
  },
  settingItem: {
    marginBottom: 20,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  settingInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cancelButton: {
    // Cor definida inline usando theme
  },
  cancelButtonText: {
    fontWeight: '700',
    fontSize: 16,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

export default CalorieCounter;