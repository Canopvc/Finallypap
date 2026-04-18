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
  StatusBar,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from 'react-native-paper';
import { useTranslation } from '../../hooks/useTranslation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle as SvgCircle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { OPEN_ROUTER_API_KEY } from '@env';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Progress Ring ─────────────────────────────────────────────────────────

interface RingProps {
  label: string;
  current: number;
  goal: number;
  unit: string;
  color: string;
  gradientId: string;
  gradientFrom: string;
  gradientTo: string;
  theme: any;
}

const ProgressRing: React.FC<RingProps> = ({
  label, current, goal, unit, color, gradientId, gradientFrom, gradientTo, theme
}) => {
  const size = 96;
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = goal > 0 ? Math.min(1, current / goal) : 0;
  const offset = circumference * (1 - pct);
  const over = pct >= 1;

  return (
    <View style={ringStyles.wrapper}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={gradientFrom} />
            <Stop offset="100%" stopColor={gradientTo} />
          </LinearGradient>
        </Defs>
        {/* Track */}
        <SvgCircle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={theme.dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
          strokeWidth={strokeWidth} fill="none"
        />
        {/* Progress */}
        <SvgCircle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={over ? '#FF6B6B' : `url(#${gradientId})`}
          strokeWidth={strokeWidth} fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={ringStyles.inner}>
        <Text style={[ringStyles.value, { color: over ? '#FF6B6B' : theme.colors.onSurface }]}>
          {current > 999 ? `${(current / 1000).toFixed(1)}k` : current}
        </Text>
        <Text style={[ringStyles.unit, { color: theme.colors.onSurfaceVariant }]}>{unit}</Text>
      </View>
      <Text style={[ringStyles.label, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
        <Text style={[ringStyles.goal, { color: theme.colors.onSurfaceVariant }]}>
        of {goal}{unit}
      </Text>
    </View>
  );
};

const ringStyles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: 4 },
  inner: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 28,
    justifyContent: 'center', alignItems: 'center',
  },
  value: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  unit: { fontSize: 9, fontWeight: '600', marginTop: 1 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  goal: { fontSize: 10, fontWeight: '500', opacity: 0.7 },
});

// ─── Main Component ────────────────────────────────────────────────────────

const CalorieCounter: React.FC = () => {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [meals, setMeals] = useState<Meal[]>([]);
  const [foodInput, setFoodInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [dailyGoals, setDailyGoals] = useState<DailyGoals>({ calories: 2000, protein: 50, carbs: 250 });
  const [todayTotals, setTodayTotals] = useState<TodayTotals>({ calories: 0, protein: 0, carbs: 0 });
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [tempGoals, setTempGoals] = useState<DailyGoals>(dailyGoals);
  const [focusedGoalIndex, setFocusedGoalIndex] = useState<number | null>(null);

  useEffect(() => { loadSavedGoals(); }, []);

  const loadSavedGoals = async () => {
    try {
      const saved = await AsyncStorage.getItem('@nutrition_goals');
      if (saved) {
        const g = JSON.parse(saved);
        setDailyGoals(g);
        setTempGoals(g);
      }
    } catch (e) { console.error(e); }
  };

  const saveGoals = async (goals: DailyGoals) => {
    try {
      await AsyncStorage.setItem('@nutrition_goals', JSON.stringify(goals));
      setDailyGoals(goals);
      Alert.alert(t('success', { ns: 'common' }), t('goalsSaveSuccess', { ns: 'common' }));
    } catch {
      Alert.alert(t('error', { ns: 'common' }), t('goalsSaveError', { ns: 'common' }));
    }
  };

  const analyzeFoodWithOpenRouter = async (desc: string): Promise<FoodAnalysis> => {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPEN_ROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openrouter/auto',
        messages: [
          {
            role: 'system',
            content: `Você é um nutricionista. Analise o alimento descrito pelo usuário e RETORNE APENAS um JSON válido neste formato exato, sem texto extra:
{"foodName":"string","calories":number,"protein":number,"carbs":number,"fat":number}`,
          },
          { role: 'user', content: `Analise o alimento: "${desc}" e retorne apenas o JSON.` },
        ],
      }),
    });

    const data = await response.json();

    if (data.error) throw new Error(`Erro da API: ${data.error.message}`);
    if (!data.choices || data.choices.length === 0) throw new Error('Resposta vazia');

    const generatedText = data.choices[0].message.content;
    if (!generatedText) throw new Error('Resposta da API vazia');

    // Remove possíveis backticks de markdown
    const clean = generatedText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return {
      foodName: parsed.foodName || desc,
      calories: parsed.calories || 0,
      protein: parsed.protein || 0,
      carbs: parsed.carbs || 0,
      fat: parsed.fat || 0,
    };
  };

  const analyzeFoodFallback = (desc: string): FoodAnalysis => {
    const map: Record<string, Omit<FoodAnalysis, 'foodName'>> = {
      arroz: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
      feijão: { calories: 115, protein: 7.6, carbs: 20, fat: 0.5 },
      frango: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
      carne: { calories: 250, protein: 26, carbs: 0, fat: 15 },
      peixe: { calories: 200, protein: 22, carbs: 0, fat: 12 },
      ovo: { calories: 78, protein: 6, carbs: 0.6, fat: 5 },
      pão: { calories: 80, protein: 3, carbs: 15, fat: 1 },
      batata: { calories: 77, protein: 2, carbs: 17, fat: 0.1 },
    };
    const lower = desc.toLowerCase();
    for (const [k, v] of Object.entries(map)) {
      if (lower.includes(k)) return { foodName: desc, ...v };
    }
    return { foodName: desc, calories: 150, protein: 10, carbs: 20, fat: 5 };
  };

  const addMeal = async () => {
    if (!foodInput.trim()) {
      Alert.alert(t('error', { ns: 'common' }), t('fillFoodDescriptionError', { ns: 'common' }));
      return;
    }
    setLoading(true);
    try {
      let foodData: FoodAnalysis;
      try { foodData = await analyzeFoodWithOpenRouter(foodInput); }
      catch { foodData = analyzeFoodFallback(foodInput); }

      const newMeal: Meal = {
        id: Date.now().toString(),
        ...foodData,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };
      setMeals(prev => [newMeal, ...prev]);
      setTodayTotals(prev => ({
        calories: prev.calories + foodData.calories,
        protein: prev.protein + foodData.protein,
        carbs: prev.carbs + foodData.carbs,
      }));
      setFoodInput('');
      Alert.alert(t('success', { ns: 'common' }), t('mealAddedSuccess', { ns: 'common', foodName: foodData.foodName }));
    } catch {
      Alert.alert(t('error', { ns: 'common' }), t('nutritionGenericError', { ns: 'common' }));
    } finally {
      setLoading(false);
    }
  };

  const removeMeal = (id: string) => {
    const m = meals.find(x => x.id === id);
    if (m) {
      setTodayTotals(prev => ({
        calories: Math.max(0, prev.calories - m.calories),
        protein: Math.max(0, prev.protein - m.protein),
        carbs: Math.max(0, prev.carbs - m.carbs),
      }));
      setMeals(prev => prev.filter(x => x.id !== id));
    }
  };

  const fmt = (v: any, d = 0) => {
    const n = Number(v);
    return isNaN(n) ? '0' : n.toFixed(d);
  };

  const calPct = dailyGoals.calories > 0 ? Math.min(100, (todayTotals.calories / dailyGoals.calories) * 100) : 0;
  const remaining = Math.max(0, dailyGoals.calories - todayTotals.calories);

  const isDark = theme.dark;
  const bg = theme.colors.background;
  const surface = theme.colors.surface;
  const primary = theme.colors.primary;

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={{ flex: 1 }}>
          <StatusBar
            barStyle={isDark ? 'light-content' : 'dark-content'}
            backgroundColor="transparent"
            translucent
          />

          <ScrollView
            contentContainerStyle={[
              s.scroll,
              { paddingTop: insets.top, paddingBottom: insets.bottom + 32 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          >

        {/* ── Header ── */}
        <View style={[s.header, { backgroundColor: surface }]}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path
                d="M15.75 19.5 8.25 12l7.5-7.5"
                stroke={primary} strokeWidth={2.2}
                strokeLinecap="round" strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>

          <View style={s.headerCenter}>
            <Text style={[s.headerTitle, { color: theme.colors.onSurface }]}>
              {t('nutritionAppTitle', { ns: 'common' })}
            </Text>
            <Text style={[s.headerSub, { color: theme.colors.onSurfaceVariant }]}>
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>

          <TouchableOpacity
            style={[s.settingsBtn, { backgroundColor: theme.colors.surfaceVariant }]}
            onPress={() => { setTempGoals(dailyGoals); setSettingsVisible(true); }}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                strokeLinecap="round" strokeLinejoin="round"
                stroke={theme.colors.onSurfaceVariant} strokeWidth={1.8}
                d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"
              />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* ── Calorie Hero Card ── */}
        <View style={[s.heroCard, { backgroundColor: surface }]}>
          <View style={s.heroTop}>
            <View>
              <Text style={[s.heroLabel, { color: theme.colors.onSurfaceVariant }]}>{t('progressToday', { ns: 'common' })}</Text>
              <View style={s.heroRow}>
                <Text style={[s.heroCalories, { color: theme.colors.onSurface }]}>
                  {todayTotals.calories}
                </Text>
                <Text style={[s.heroKcal, { color: theme.colors.onSurfaceVariant }]}> {t('kcalUnit', { ns: 'common' })}</Text>
              </View>
            </View>
            <View style={[s.remainingBadge, { backgroundColor: remaining === 0 ? '#FF6B6B20' : primary + '18' }]}>
              <Text style={[s.remainingNum, { color: remaining === 0 ? '#FF6B6B' : primary }]}>
                {remaining}
              </Text>
              <Text style={[s.remainingLabel, { color: remaining === 0 ? '#FF6B6B' : primary }]}>{t('remaining', { ns: 'common' })}</Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={[s.barTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
            <View
              style={[
                s.barFill,
                {
                  width: `${calPct}%` as any,
                  backgroundColor: calPct >= 100 ? '#FF6B6B' : primary,
                },
              ]}
            />
          </View>
          <View style={s.barLabels}>
            <Text style={[s.barLabel, { color: theme.colors.onSurfaceVariant }]}>0</Text>
            <Text style={[s.barLabel, { color: theme.colors.onSurfaceVariant }]}>
              {t('goal', { ns: 'common' })}: {dailyGoals.calories} kcal
            </Text>
          </View>
        </View>

        {/* ── Macro Rings ── */}
        <View style={[s.macroCard, { backgroundColor: surface }]}>
          <Text style={[s.cardTitle, { color: theme.colors.onSurface }]}>{t('macroNutrients', { ns: 'common' })}</Text>
          <View style={s.rings}>
            <ProgressRing
              label="Proteína" current={Math.round(todayTotals.protein)}
              goal={dailyGoals.protein} unit="g"
              color="#3B82F6" gradientId="pg" gradientFrom="#60A5FA" gradientTo="#2563EB"
              theme={theme}
            />
            <ProgressRing
              label="Carboidratos" current={Math.round(todayTotals.carbs)}
              goal={dailyGoals.carbs} unit="g"
              color="#F59E0B" gradientId="cg" gradientFrom="#FCD34D" gradientTo="#D97706"
              theme={theme}
            />
            <ProgressRing
              label="Gordura" current={Math.round(meals.reduce((a, m) => a + m.fat, 0))}
              goal={Math.round(dailyGoals.calories * 0.25 / 9)}
              unit="g"
              color="#10B981" gradientId="fg" gradientFrom="#34D399" gradientTo="#059669"
              theme={theme}
            />
          </View>
        </View>

        {/* ── Add Food ── */}
        <View style={[s.addCard, { backgroundColor: surface }]}>
          <Text style={[s.cardTitle, { color: theme.colors.onSurface }]}>
            {t('addMealSectionTitle', { ns: 'common' })}
          </Text>
          <TextInput
            style={[
              s.input,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                borderColor: theme.colors.outline + '60',
                color: theme.colors.onSurface,
              },
            ]}
            placeholder={t('addMealPlaceholder', { ns: 'common' })}
            placeholderTextColor={theme.colors.onSurfaceVariant + '80'}
            value={foodInput}
            onChangeText={setFoodInput}
            multiline
          />
          <TouchableOpacity
            style={[s.addBtn, { backgroundColor: primary }, loading && { opacity: 0.6 }]}
            onPress={addMeal}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 4.5v15m7.5-7.5h-15"
                    stroke="#fff" strokeWidth={2.2}
                    strokeLinecap="round"
                  />
                </Svg>
                <Text style={s.addBtnText}>{t('addMealButton', { ns: 'common' })}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Meals List ── */}
        <View style={[s.mealsCard, { backgroundColor: surface }]}>
          <View style={s.mealsHeader}>
            <Text style={[s.cardTitle, { color: theme.colors.onSurface }, { marginBottom: 0 }]}>
              {t('todayMeals', { ns: 'common' })}
            </Text>
            <View style={[s.countBadge, { backgroundColor: primary + '20' }]}>
              <Text style={[s.countText, { color: primary }]}>{meals.length}</Text>
            </View>
          </View>

          {meals.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>🍽️</Text>
              <Text style={[s.emptyTitle, { color: theme.colors.onSurface }]}>
                {t('noMealsTitle', { ns: 'common' })}
              </Text>
              <Text style={[s.emptySub, { color: theme.colors.onSurfaceVariant }]}>
                {t('noMealsSubtitle', { ns: 'common' })}
              </Text>
            </View>
          ) : (
            <View style={s.mealsList}>
              {meals.map((meal, i) => (
                <View
                  key={meal.id}
                  style={[
                    s.mealRow,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.025)',
                      borderBottomWidth: i < meals.length - 1 ? 1 : 0,
                      borderBottomColor: theme.colors.outline + '30',
                    },
                  ]}
                >
                  <View style={s.mealLeft}>
                    <View style={s.mealTitleRow}>
                      <Text style={[s.mealName, { color: theme.colors.onSurface }]} numberOfLines={1}>
                        {meal.foodName}
                      </Text>
                      <Text style={[s.mealTime, { color: theme.colors.onSurfaceVariant }]}>
                        {meal.timestamp}
                      </Text>
                    </View>
                    <View style={s.macroRow}>
                      <MacroChip value={`${meal.calories} kcal`} color={primary} />
                      <MacroChip value={`${fmt(meal.protein)}g prot`} color="#3B82F6" />
                      <MacroChip value={`${fmt(meal.carbs)}g carbs`} color="#F59E0B" />
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[s.deleteBtn, { backgroundColor: '#FF6B6B15' }]}
                    onPress={() => removeMeal(meal.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M6 18 18 6M6 6l12 12"
                        stroke="#FF6B6B" strokeWidth={2.2}
                        strokeLinecap="round"
                      />
                    </Svg>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
          </ScrollView>

      {/* ── Settings Modal ── */}
      <Modal visible={settingsVisible} animationType="slide" transparent>
        <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setSettingsVisible(false); }}>
          <View style={s.modalOverlay}>
            <TouchableWithoutFeedback>
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={
                  Platform.OS === 'ios'
                    ? insets.bottom + (focusedGoalIndex !== null ? (focusedGoalIndex + 1) * 40 : 0)
                    : 0
                }
                style={s.modalSheetWrapper}
              >
              <View style={[s.modalSheet, { backgroundColor: surface, paddingBottom: insets.bottom + 16 }]}>
                {/* Handle */}
                <View style={[s.handle, { backgroundColor: theme.colors.outline + '50' }]} />

                <Text style={[s.modalTitle, { color: theme.colors.onSurface }]}>{t('settingsDailyGoalsTitle', { ns: 'common' })}</Text>

                {([
                  { key: 'calories', label: t('caloriesKcal', { ns: 'common' }), unit: 'kcal' },
                  { key: 'protein', label: t('proteinGrams', { ns: 'common' }), unit: 'g' },
                  { key: 'carbs', label: t('carbsGrams', { ns: 'common' }), unit: 'g' },
                ] as { key: keyof DailyGoals; label: string; unit: string }[]).map(({ key, label, unit }, index) => (
                  <View key={key} style={s.settingRow}>
                    <Text style={[s.settingLabel, { color: theme.colors.onSurface }]}>{label}</Text>
                    <View style={s.settingInputWrap}>
                      <TextInput
                        style={[
                          s.settingInput,
                          {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                            borderColor: theme.colors.outline + '50',
                            color: theme.colors.onSurface,
                          },
                        ]}
                        value={tempGoals[key].toString()}
                        onChangeText={text =>
                          setTempGoals(prev => ({ ...prev, [key]: parseInt(text) || 0 }))
                        }
                        keyboardType="numeric"
                        onFocus={() => setFocusedGoalIndex(index)}
                        onBlur={() => setFocusedGoalIndex(null)}
                      />
                      <Text style={[s.settingUnit, { color: theme.colors.onSurfaceVariant }]}>{unit}</Text>
                    </View>
                  </View>
                ))}

                <View style={s.modalBtns}>
                  <TouchableOpacity
                    style={[s.modalBtn, { backgroundColor: theme.colors.surfaceVariant }]}
                    onPress={() => setSettingsVisible(false)}
                  >
                    <Text style={[s.modalBtnLabel, { color: theme.colors.onSurfaceVariant }]}>
                      {t('cancelSettings', { ns: 'common' })}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.modalBtn, { backgroundColor: primary, flex: 1.4 }]}
                    onPress={() => { saveGoals(tempGoals); setSettingsVisible(false); }}
                  >
                    <Text style={[s.modalBtnLabel, { color: '#fff' }]}>
                      {t('saveSettings', { ns: 'common' })}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

// ── Small helper ──────────────────────────────────────────────────────────────

const MacroChip = ({ value, color }: { value: string; color: string }) => (
  <View style={[chipS.chip, { backgroundColor: color + '18' }]}>
    <Text style={[chipS.text, { color }]}>{value}</Text>
  </View>
);

const chipS = StyleSheet.create({
  chip: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, marginRight: 6 },
  text: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { gap: 12, paddingHorizontal: 16 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 4, paddingVertical: 12,
    borderRadius: 20, marginTop: 8,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  headerTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  headerSub: { fontSize: 11, marginTop: 2, fontWeight: '500', textTransform: 'capitalize' },
  settingsBtn: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },

  // Hero card
  heroCard: {
    borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  heroLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  heroRow: { flexDirection: 'row', alignItems: 'baseline' },
  heroCalories: { fontSize: 48, fontWeight: '900', letterSpacing: -2 },
  heroKcal: { fontSize: 16, fontWeight: '600' },
  remainingBadge: {
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
    alignItems: 'center', minWidth: 80,
  },
  remainingNum: { fontSize: 22, fontWeight: '800', letterSpacing: -1 },
  remainingLabel: { fontSize: 10, fontWeight: '600', marginTop: 1 },
  barTrack: { height: 8, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  barLabel: { fontSize: 10, fontWeight: '600' },

  // Macro card
  macroCard: {
    borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  rings: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 4 },

  // Add card
  addCard: {
    borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2, marginBottom: 14 },
  input: {
    borderWidth: 1, borderRadius: 14, padding: 14,
    fontSize: 15, minHeight: 80, textAlignVertical: 'top',
    marginBottom: 12, lineHeight: 22,
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 16, borderRadius: 14,
  },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Meals card
  mealsCard: {
    borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  mealsHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  countBadge: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  countText: { fontSize: 13, fontWeight: '800' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  mealsList: { gap: 0 },
  mealRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, gap: 10,
  },
  mealLeft: { flex: 1 },
  mealTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  mealName: { fontSize: 14, fontWeight: '700', flex: 1, marginRight: 8 },
  mealTime: { fontSize: 11, fontWeight: '600' },
  macroRow: { flexDirection: 'row', flexWrap: 'wrap' },
  deleteBtn: { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheetWrapper: {
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 12,
  },
  handle: { width: 36, height: 4, borderRadius: 99, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 24, letterSpacing: -0.3 },
  settingRow: { marginBottom: 18 },
  settingLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  settingInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  settingInput: {
    flex: 1, borderWidth: 1, borderRadius: 12,
    padding: 13, fontSize: 16, fontWeight: '600',
  },
  settingUnit: { fontSize: 14, fontWeight: '600', width: 36 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalBtn: { flex: 1, padding: 16, borderRadius: 14, alignItems: 'center' },
  modalBtnLabel: { fontSize: 15, fontWeight: '700' },
});

export default CalorieCounter;