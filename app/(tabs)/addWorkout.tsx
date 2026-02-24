import { useRouter } from "expo-router";
import React, { useCallback, useState, useEffect, useRef } from "react";
import { insertWorkout } from "../../components/Insert_Workouts_DB";
import { supabase } from "../../lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  Image,
  Keyboard,
  TouchableWithoutFeedback,
  Animated,
} from "react-native";
import { useTheme } from "react-native-paper";
import { useTranslation } from "../../hooks/useTranslation";
import Svg, { Path } from "react-native-svg";
import { AddExerciseModal } from "../../components/addExerciseModal";
import * as Haptics from 'expo-haptics'

type Exercise = {
  id: string;
  name: string;
  type: "calisthenics" | "cardio" | "weightlifting";
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

type DatabaseExercise = {
  id: string;
  exercise_name: string;
  exercise_img: string;
  exercise_type?: string;
};

const STORAGE_KEY = "workouts";

function uid(prefix = "") {
  return (
    prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

function defaultExercise(): Exercise {
  return {
    id: uid("ex-"),
    name: "",
    type: "weightlifting",
    sets: 3,
    reps: undefined,
    weight: undefined,
    minutes: undefined,
    dropset: false,
    failure: false,
    warmup: false,
  };
}

export default function AddWorkout() {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation();

  const [workoutName, setWorkoutName] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([defaultExercise()]);
  const [loading, setLoading] = useState(false);
  const [databaseExercises, setDatabaseExercises] = useState<DatabaseExercise[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState<number | null>(null);
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const DB_UPDATE_INTERVAL = 60000;

  const handleImageError = useCallback((exerciseId: string) => {
    setImageErrors(prev => new Set(prev).add(exerciseId));
  }, []);

  const fetchDatabaseExercises = async () => {
    setLoadingExercises(true);
    try {
      const { data, error } = await supabase
        .from("Exercicios_table")
        .select("id, exercise_name, exercise_img, exercise_type")
        .order("exercise_name", { ascending: true });

      if (error) {
        console.error("Error fetching exercises:", error);
        return;
      }

      setDatabaseExercises(data || []);
    } catch (err) {
      console.error("Failed to fetch exercises:", err);
    } finally {
      setLoadingExercises(false);
    }
  };

  useEffect(() => {
    fetchDatabaseExercises();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchDatabaseExercises();
    }, DB_UPDATE_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const addExercise = useCallback(() => {
    setExercises((prev) => [...prev, defaultExercise()]);
  }, []);

  const updateExercise = useCallback(
    (id: string, field: keyof Exercise, value: any) => {
      setExercises((prev) =>
        prev.map((ex) => (ex.id === id ? { ...ex, [field]: value } : ex)),
      );
    },
    [],
  );

  const removeExercise = useCallback((id: string) => {
    setExercises((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const selectExerciseFromDatabase = (
    exercise: DatabaseExercise,
    index: number,
  ) => {
    if (selectedExerciseIndex !== null) {
      const exerciseId = exercises[selectedExerciseIndex].id;

      let exerciseType: "weightlifting" | "calisthenics" | "cardio" = "weightlifting";
      if (exercise.exercise_type) {
        const type = exercise.exercise_type.toLowerCase();
        if (type.includes("calisthenics") || type.includes("bodyweight")) {
          exerciseType = "calisthenics";
        } else if (type.includes("cardio")) {
          exerciseType = "cardio";
        }
      }

      updateExercise(exerciseId, "name", exercise.exercise_name);
      updateExercise(exerciseId, "type", exerciseType);
      setShowExerciseModal(false);
      setSelectedExerciseIndex(null);
    }
  };

  const handleExerciseAdded = useCallback(() => {
    fetchDatabaseExercises();
  }, []);

  const ExerciseSelectionModal = useCallback(() => {
    return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showExerciseModal}
      onRequestClose={() => {
        setShowExerciseModal(false);
        setSelectedExerciseIndex(null);
      }}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.exerciseModalContainer,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.outline + '30',
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
                Selecione um Exercício
              </Text>
              <View style={styles.modalHeaderButtons}>
                <TouchableOpacity
                  onPress={() => {
                    setShowExerciseModal(false);
                    setShowAddExerciseModal(true);
                  }}
                  style={[
                    styles.addToDbButton,
                    { backgroundColor: theme.colors.primary },
                  ]}
                >
                  <Text style={[styles.addToDbButtonText, { color: theme.colors.onPrimary }]}>
                    + Novo
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setShowExerciseModal(false);
                    setSelectedExerciseIndex(null);
                  }}
                  style={styles.closeButton}
                >
                  <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 28, fontWeight: '300' }}>
                    ×
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {loadingExercises ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 10 }}>
                  Carregando exercícios...
                </Text>
              </View>
            ) : databaseExercises.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={{ color: theme.colors.onSurfaceVariant, marginBottom: 20 }}>
                  Nenhum exercício encontrado no banco de dados.
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowExerciseModal(false);
                    setShowAddExerciseModal(true);
                  }}
                  style={[styles.emptyAddButton, { backgroundColor: theme.colors.primary }]}
                >
                  <Text style={{ color: theme.colors.onPrimary, fontWeight: "600" }}>
                    Adicionar Primeiro Exercício
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={databaseExercises}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.exerciseListItem,
                      { borderBottomColor: theme.colors.outline + "20" },
                    ]}
                    onPress={() => selectExerciseFromDatabase(item, selectedExerciseIndex!)}
                  >
                    <View style={styles.exerciseListItemContent}>
                      {item.exercise_img && item.exercise_img.trim() && !imageErrors.has(item.id) ? (
                        <View style={[styles.exerciseImageContainer, { 
                          borderColor: theme.colors.outline + '40',
                          backgroundColor: theme.colors.surfaceVariant
                        }]}>
                          <Image
                            source={{ uri: item.exercise_img }}
                            style={styles.exerciseImage}
                            resizeMode="cover"
                            onError={() => handleImageError(item.id)}
                          />
                        </View>
                      ) : (
                        <View style={[
                          styles.exerciseImageContainer,
                          { 
                            backgroundColor: theme.colors.surfaceVariant,
                            borderColor: theme.colors.outline + '40'
                          },
                        ]}>
                          <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 20 }}>
                            📷
                          </Text>
                        </View>
                      )}
                      <View style={styles.exerciseListInfo}>
                        <Text style={[styles.exerciseListName, { color: theme.colors.onSurface }]}>
                          {item.exercise_name}
                        </Text>
                        {item.exercise_type && (
                          <Text style={[styles.exerciseListType, { color: theme.colors.onSurfaceVariant }]}>
                            {item.exercise_type}
                          </Text>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => selectExerciseFromDatabase(item, selectedExerciseIndex!)}
                      style={[
                        styles.selectExerciseButton,
                        { backgroundColor: theme.colors.primary + "20" },
                      ]}
                    >
                      <Text style={{ color: theme.colors.primary, fontWeight: "600", fontSize: 13 }}>
                        Selecionar
                      </Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}
                style={styles.exerciseList}
                contentContainerStyle={styles.exerciseListContent}
                ListFooterComponent={
                  <TouchableOpacity
                    onPress={() => {
                      setShowExerciseModal(false);
                      setShowAddExerciseModal(true);
                    }}
                    style={[
                      styles.addMoreButton,
                      { 
                        backgroundColor: theme.colors.surfaceVariant,
                        borderColor: theme.colors.outline + '30'
                      },
                    ]}
                  >
                    <Text style={{ color: theme.colors.onSurfaceVariant, fontWeight: "600" }}>
                      + Adicionar Novo Exercício ao Banco
                    </Text>
                  </TouchableOpacity>
                }
              />
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
    );
  }, [showExerciseModal, databaseExercises, loadingExercises, selectedExerciseIndex, theme, exercises, selectExerciseFromDatabase, imageErrors, handleImageError]);

  const validate = () => {
    if (!workoutName.trim()) {
      Alert.alert(t("error", { ns: "common" }), "Por favor, insira um nome para o treino");
      return false;
    }
    
    const validExercises = exercises.filter(e => 
      e.name && e.name.trim().length > 0 && e.sets > 0
    );
    
    if (validExercises.length === 0) {
      Alert.alert(t("error", { ns: "common" }), "Adicione pelo menos um exercício válido com nome e séries");
      return false;
    }
    
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;

    const newWorkout: Workout = {
      name: workoutName.trim(),
      createdAt: new Date().toISOString(),
      exercises,
    };

    Alert.alert(
      t('saveWorkoutTitle', { ns: 'common' }),
      t('saveWorkoutQuestion', { ns: 'common' }),
      [
        {
          text: t('no', { ns: 'common' }),
          style: "cancel",
          onPress: () => saveWorkout(newWorkout, false),
        },
        {
          text: t('yes', { ns: 'common' }),
          onPress: () => saveWorkout(newWorkout, true),
        },
      ]
    );
  };

  const saveWorkout = async (workout: Workout, saveOnline: boolean) => {
    setLoading(true);

    try {
      if (saveOnline) {
        const userResp = await supabase.auth.getUser();
        const userId = userResp.data.user?.id;

        if (!userId) {
          Alert.alert(t("error", { ns: 'common' }), t('userNotAuthenticated', { ns: 'common' }));
          setLoading(false);
          return;
        }

        await insertWorkout(workout, userId);
      } else {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const list: Workout[] = raw ? JSON.parse(raw) : [];
        list.unshift(workout);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      }

      router.back();
    } catch (err) {
      console.error("Save workout error", err);
      Alert.alert(t("error"), t("couldNotSave", { ns: "common" }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.container]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }}>
          <Text style={[styles.header, { color: theme.colors.onBackground }]}>
            {t("createWorkout", { ns: "workouts" })}
          </Text>

          <View style={[styles.card, { 
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outline + '30'
          }]}>
            <Text style={[styles.label, { color: theme.colors.onSurface }]}>
              {t("workoutName", { ns: "workouts" })}
            </Text>
            <TextInput
              value={workoutName}
              onChangeText={setWorkoutName}
              placeholder={t("exampleWorkoutName", { ns: "workouts" })}
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.background,
                  color: theme.colors.onSurface,
                  borderColor: theme.colors.outline + '50',
                },
              ]}
              placeholderTextColor={theme.colors.onSurfaceVariant}
            />
          </View>

          {exercises.map((ex, idx) => (
            <View
              key={ex.id}
              style={[styles.card, { 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.outline + '30'
              }]}
            >
              <View style={styles.rowBetween}>
                <View style={[styles.exerciseNumberBadge, { backgroundColor: theme.colors.primary + '20' }]}>
                  <Text style={[styles.exerciseNumber, { color: theme.colors.primary }]}>
                    {idx + 1}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);  removeExercise(ex.id)}}
                  disabled={exercises.length === 1}
                  style={[styles.removeButton, { opacity: exercises.length === 1 ? 0.4 : 1 }]}
                >
                  <Text style={[styles.removeBtn, { color: theme.colors.error }]}>
                    {t("remove", { ns: "common" })}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.rowBetween}>
                <Text style={[styles.label, { color: theme.colors.onSurface }]}>
                  {t("name", { ns: "common" })}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedExerciseIndex(idx);
                    setShowExerciseModal(true);
                  }}
                  style={[styles.databaseButton, { backgroundColor: theme.colors.primary + "15" }]}
                >
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={theme.colors.primary} strokeWidth={2}>
                    <Path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </Svg>
                </TouchableOpacity>
              </View>

              <TextInput
                placeholder={t("Bench Press", { ns: "workouts" })}
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.colors.background,
                    color: theme.colors.onSurface,
                    borderColor: theme.colors.outline + '50',
                  },
                ]}
                placeholderTextColor={theme.colors.onSurfaceVariant}
                value={ex.name}
                onChangeText={(t) => updateExercise(ex.id, "name", t)}
              />

              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={[styles.label, { color: theme.colors.onSurface }]}>
                    {t("sets", { ns: "workouts" })}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.colors.background,
                        color: theme.colors.onSurface,
                        borderColor: theme.colors.outline + '50',
                      },
                    ]}
                    keyboardType="number-pad"
                    value={String(ex.sets)}
                    onChangeText={(t) =>
                      updateExercise(ex.id, "sets", Math.max(0, Number(t) || 0))
                    }
                  />
                </View>
                <View style={styles.half}>
                  <Text style={[styles.label, { color: theme.colors.onSurface }]}>
                    {t("reps", { ns: "workouts" })}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.colors.background,
                        color: theme.colors.onSurface,
                        borderColor: theme.colors.outline + '50',
                      },
                    ]}
                    keyboardType="number-pad"
                    placeholder={t("optional", { ns: "common" })}
                    placeholderTextColor={theme.colors.onSurfaceVariant}
                    value={ex.reps != null ? String(ex.reps) : ""}
                    onChangeText={(t) =>
                      updateExercise(ex.id, "reps", t ? Number(t) : undefined)
                    }
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={[styles.label, { color: theme.colors.onSurface }]}>
                    {t("weightKg", { ns: "workouts" })}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.colors.background,
                        color: theme.colors.onSurface,
                        borderColor: theme.colors.outline + '50',
                      },
                    ]}
                    keyboardType="numeric"
                    placeholder={t("optional", { ns: "common" })}
                    placeholderTextColor={theme.colors.onSurfaceVariant}
                    value={ex.weight != null ? String(ex.weight) : ""}
                    onChangeText={(t) =>
                      updateExercise(ex.id, "weight", t ? Number(t) : undefined)
                    }
                  />
                </View>
                <View style={styles.half}>
                  <Text style={[styles.label, { color: theme.colors.onSurface }]}>
                    {t("durationMinutes", { ns: "workouts" })}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.colors.background,
                        color: theme.colors.onSurface,
                        borderColor: theme.colors.outline + '50',
                      },
                    ]}
                    keyboardType="numeric"
                    placeholder={t("optional", { ns: "common" })}
                    placeholderTextColor={theme.colors.onSurfaceVariant}
                    value={ex.minutes != null ? String(ex.minutes) : ""}
                    onChangeText={(t) =>
                      updateExercise(ex.id, "minutes", t ? Number(t) : undefined)
                    }
                  />
                </View>
              </View>

              <Text style={[styles.label, { color: theme.colors.onSurface, marginTop: 12 }]}>
                {t("type", { ns: "workouts" })}
              </Text>
              <View style={[
                styles.segmentContainer,
                {
                  backgroundColor: theme.colors.surfaceVariant,
                  borderColor: theme.colors.outline + '30',
                },
              ]}>
                {(["weightlifting", "calisthenics", "cardio"] as const).map(
                  (type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.segmentBtn,
                        ex.type === type
                          ? { backgroundColor: theme.colors.primary }
                          : { backgroundColor: "transparent" },
                      ]}
                      onPress={() => updateExercise(ex.id, "type", type)}
                    >
                      <Text
                        style={[
                          styles.segmentTxt,
                          ex.type === type
                            ? { color: theme.colors.onPrimary, fontWeight: "700" }
                            : { color: theme.colors.onSurfaceVariant },
                        ]}
                      >
                        {t(type, { ns: "workouts" })}
                      </Text>
                    </TouchableOpacity>
                  ),
                )}
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchItem}>
                  <Text style={[styles.switchLabel, { color: theme.colors.onSurface }]}>
                    {t("warmup", { ns: "workouts" })}
                  </Text>
                  <Switch
                    value={ex.warmup}
                    onValueChange={(v) => updateExercise(ex.id, "warmup", v)}
                    trackColor={{
                      false: theme.colors.surfaceVariant,
                      true: theme.colors.primary + '50',
                    }}
                    thumbColor={ex.warmup ? theme.colors.primary : theme.colors.outline}
                  />
                </View>
                <View style={styles.switchItem}>
                  <Text style={[styles.switchLabel, { color: theme.colors.onSurface }]}>
                    {t("dropset", { ns: "workouts" })}
                  </Text>
                  <Switch
                    value={ex.dropset}
                    onValueChange={(v) => updateExercise(ex.id, "dropset", v)}
                    trackColor={{
                      false: theme.colors.surfaceVariant,
                      true: theme.colors.primary + '50',
                    }}
                    thumbColor={ex.dropset ? theme.colors.primary : theme.colors.outline}
                  />
                </View>
                <View style={styles.switchItem}>
                  <Text style={[styles.switchLabel, { color: theme.colors.onSurface }]}>
                    {t("failure", { ns: "workouts" })}
                  </Text>
                  <Switch
                    value={ex.failure}
                    onValueChange={(v) => updateExercise(ex.id, "failure", v)}
                    trackColor={{
                      false: theme.colors.surfaceVariant,
                      true: theme.colors.primary + '50',
                    }}
                    thumbColor={ex.failure ? theme.colors.primary : theme.colors.outline}
                  />
                </View>
              </View>
            </View>
          ))}

          <View style={styles.footerRow}>
            <TouchableOpacity
              style={[
                styles.secondaryBtn,
                {
                  borderColor: theme.colors.outline + '50',
                  backgroundColor: theme.colors.surface,
                },
              ]}
              onPress={() => {Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); addExercise()}}
            >
              <Text style={[styles.secondaryBtnTxt, { color: theme.colors.onSurface }]}>
                + {t("addExercise", { ns: "workouts" })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                {
                  backgroundColor: theme.colors.primary,
                  opacity: loading ? 0.7 : 1,
                },
              ]}
              onPress={() => {Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); handleSave()
                
              }}
            
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.onPrimary} size="small" />
              ) : (
                <Text style={[styles.primaryBtnTxt, { color: theme.colors.onPrimary }]}>
                  {t("saveWorkout", { ns: "workouts" })}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>

        {ExerciseSelectionModal()}
      </ScrollView>
    </KeyboardAvoidingView>
    
    <AddExerciseModal 
      visible={showAddExerciseModal}
      onClose={() => setShowAddExerciseModal(false)}
      onExerciseAdded={handleExerciseAdded}
    />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
  },
  header: {
    fontSize: 32,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 28,
  },
  card: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  exerciseNumberBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseNumber: {
    fontSize: 16,
    fontWeight: '700',
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    paddingVertical: Platform.OS === "ios" ? 14 : 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    minHeight: Platform.OS === "ios" ? 50 : 48,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  half: {
    flex: 1,
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  removeBtn: {
    fontWeight: "600",
    fontSize: 14,
  },
  segmentContainer: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    marginTop: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: Platform.OS === "ios" ? 10 : 9,
    alignItems: "center",
    borderRadius: 10,
    marginHorizontal: 1,
  },
  segmentTxt: {
    fontSize: 13,
    fontWeight: "600",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    paddingHorizontal: 0,
    gap: 8,
  },
  switchItem: {
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    flex: 1,
    justifyContent: "center",
    minWidth: 70,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 28,
    marginBottom: 40,
  },
  primaryBtn: {
    paddingVertical: Platform.OS === "ios" ? 16 : 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: "center",
    flex: 1,
    minHeight: Platform.OS === "ios" ? 56 : 52,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryBtnTxt: {
    fontWeight: "700",
    fontSize: 16,
  },
  secondaryBtn: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: Platform.OS === "ios" ? 16 : 14,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    minHeight: Platform.OS === "ios" ? 56 : 52,
  },
  secondaryBtnTxt: {
    fontWeight: "600",
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  exerciseModalContainer: {
    width: "100%",
    maxHeight: "80%",
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalHeaderButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    flex: 1,
  },
  closeButton: {
    padding: 4,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  exerciseList: {
    maxHeight: 400,
  },
  exerciseListContent: {
    paddingBottom: 10,
  },
  exerciseListItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  exerciseListItemContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  exerciseImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginRight: 12,
    overflow: "hidden",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  exerciseImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  exerciseListInfo: {
    flex: 1,
  },
  exerciseListName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  exerciseListType: {
    fontSize: 13,
    opacity: 0.7,
  },
  selectExerciseButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  databaseButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addToDbButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addToDbButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  emptyAddButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  addMoreButton: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
});