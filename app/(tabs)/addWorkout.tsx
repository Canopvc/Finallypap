import { useRouter } from "expo-router";
import React, { useCallback, useState, useEffect } from "react";
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
} from "react-native";
import { useTheme } from "react-native-paper";
import { useTranslation } from "../../hooks/useTranslation";
import Svg, { Path } from "react-native-svg";

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

// 🔄 COMPONENTE MODAL COMPLETAMENTE ISOLADO
const AddExerciseModal = React.memo(({ 
  visible, 
  onClose, 
  onExerciseAdded 
}: { 
  visible: boolean; 
  onClose: () => void; 
  onExerciseAdded: () => void; 
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  
  // ESTADO LOCAL - NÃO AFETA O COMPONENTE PAI
  const [exerciseName, setExerciseName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [exerciseType, setExerciseType] = useState<"weightlifting" | "calisthenics" | "cardio">("weightlifting");
  const [isLoading, setIsLoading] = useState(false);
  
  const nameInputRef = React.useRef<TextInput>(null);
  const imageInputRef = React.useRef<TextInput>(null);

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
      Alert.alert("Erro", "Por favor, insira um nome para o exercício");
      return;
    }

    if (imageUrl.trim() && !isValidUrl(imageUrl)) {
      Alert.alert("Erro", "Por favor, insira uma URL de imagem válida");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("Exercicios_table")
        .insert([
          {
            exercise_name: exerciseName.trim(),
            exercise_img: imageUrl.trim() || null,
            exercise_type: exerciseType,
          },
        ]);

      if (error) throw error;

      Alert.alert("Sucesso", "Exercício adicionado à base de dados!");
      
      // Notificar o componente pai para atualizar a lista
      onExerciseAdded();
      
      // Limpar e fechar
      setExerciseName("");
      setImageUrl("");
      setExerciseType("weightlifting");
      onClose();
    } catch (error: any) {
      console.error("Error adding exercise:", error);
      Alert.alert(
        "Erro",
        `Não foi possível adicionar o exercício: ${error.message}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Focar no input quando o modal abre
  useEffect(() => {
    if (visible) {
      // Pequeno delay para garantir que o modal está renderizado
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 300);
    } else {
      // Limpar quando fecha
      setExerciseName("");
      setImageUrl("");
      setExerciseType("weightlifting");
    }
  }, [visible]);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlayFixed}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlayFixed}>
            <View style={[
              styles.modalContainerFixed,
              { 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.outline,
              }
            ]}>
              {/* Header */}
              <View style={styles.modalHeaderFixed}>
                <Text style={[styles.modalTitleFixed, { color: theme.colors.onSurface }]}>
                  Adicionar Novo Exercício
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    Keyboard.dismiss();
                    onClose();
                  }}
                  style={styles.closeButtonFixed}
                >
                  <Text style={{ color: theme.colors.primary, fontSize: 24 }}>×</Text>
                </TouchableOpacity>
              </View>

              {/* Conteúdo */}
              <ScrollView 
                style={styles.modalScrollFixed}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalContentFixed}
              >
                {/* Nome do Exercício */}
                <Text style={[styles.labelFixed, { color: theme.colors.onSurface }]}>
                  Nome do Exercício *
                </Text>
                <TextInput
                  ref={nameInputRef}
                  placeholder="Ex: Supino Reto"
                  value={exerciseName}
                  onChangeText={setExerciseName}
                  style={[
                    styles.inputFixed,
                    {
                      backgroundColor: theme.colors.background,
                      color: theme.colors.onSurface,
                      borderColor: theme.colors.outline,
                    },
                  ]}
                  placeholderTextColor={theme.colors.onSurfaceVariant}
                  returnKeyType="next"
                  autoCapitalize="words"
                  autoFocus={visible}
                  onSubmitEditing={() => {
                    imageInputRef.current?.focus();
                  }}
                />

                {/* Tipo do Exercício */}
                <Text style={[styles.labelFixed, { color: theme.colors.onSurface, marginTop: 16 }]}>
                  Tipo do Exercício
                </Text>
                <View style={[
                  styles.segmentContainerFixed,
                  {
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.outline,
                  }
                ]}>
                  {(["weightlifting", "calisthenics", "cardio"] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.segmentBtnFixed,
                        exerciseType === type
                          ? { backgroundColor: theme.colors.primary }
                          : { backgroundColor: "transparent" },
                      ]}
                      onPress={() => setExerciseType(type)}
                    >
                      <Text style={[
                        styles.segmentTxtFixed,
                        exerciseType === type
                          ? { color: theme.colors.onPrimary, fontWeight: "700" }
                          : { color: theme.colors.onSurfaceVariant }
                      ]}>
                        {t(type, { ns: "workouts" })}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* URL da Imagem */}
                <Text style={[styles.labelFixed, { color: theme.colors.onSurface, marginTop: 16 }]}>
                  URL da Imagem (Opcional)
                </Text>
                <TextInput
                  ref={imageInputRef}
                  placeholder="https://exemplo.com/imagem.jpg"
                  value={imageUrl}
                  onChangeText={setImageUrl}
                  style={[
                    styles.inputFixed,
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
                  <View style={styles.imagePreviewContainerFixed}>
                    <Text style={[styles.labelFixed, { color: theme.colors.onSurface }]}>
                      Pré-visualização da Imagem:
                    </Text>
                    <Image
                      source={{ uri: imageUrl }}
                      style={styles.imagePreviewFixed}
                      resizeMode="cover"
                    />
                  </View>
                )}
              </ScrollView>

              {/* Botões */}
              <View style={styles.modalButtonsFixed}>
                <TouchableOpacity
                  style={[
                    styles.cancelButtonFixed,
                    { 
                      borderColor: theme.colors.outline,
                      backgroundColor: theme.colors.surface,
                    }
                  ]}
                  onPress={onClose}
                  disabled={isLoading}
                >
                  <Text style={[styles.cancelButtonTextFixed, { color: theme.colors.onSurface }]}>
                    Cancelar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.addButtonFixed,
                    { 
                      backgroundColor: theme.colors.primary,
                      opacity: (!exerciseName.trim() || isLoading) ? 0.7 : 1,
                    }
                  ]}
                  onPress={handleAddExercise}
                  disabled={!exerciseName.trim() || isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color={theme.colors.onPrimary} size="small" />
                  ) : (
                    <Text style={[styles.addButtonTextFixed, { color: theme.colors.onPrimary }]}>
                      Adicionar
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
});

// Adiciona display name para o componente
AddExerciseModal.displayName = 'AddExerciseModal';

export default function AddWorkout() {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation();

  const [workoutName, setWorkoutName] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([defaultExercise()]);
  const [loading, setLoading] = useState(false);

  // Estados para os exercícios do banco de dados
  const [databaseExercises, setDatabaseExercises] = useState<DatabaseExercise[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState<number | null>(null);

  // APENAS controle de visibilidade do modal
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);

  // Buscar exercícios do banco de dados
  useEffect(() => {
    fetchDatabaseExercises();
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

  // Função para selecionar exercício do banco de dados
  const selectExerciseFromDatabase = (
    exercise: DatabaseExercise,
    index: number,
  ) => {
    if (selectedExerciseIndex !== null) {
      const exerciseId = exercises[selectedExerciseIndex].id;

      // Mapear o tipo do exercício
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
    fetchDatabaseExercises(); // Atualiza a lista quando um exercício é adicionado
  }, []);

  const ExerciseSelectionModal = () => (
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
                borderColor: theme.colors.outline,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[styles.modalTitle, { color: theme.colors.onSurface }]}
              >
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
                    { backgroundColor: theme.colors.secondary },
                  ]}
                >
                  <Text
                    style={[
                      styles.addToDbButtonText,
                      { color: theme.colors.onSecondary },
                    ]}
                  >
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
                  <Text style={{ color: theme.colors.primary, fontSize: 24 }}>
                    ×
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {loadingExercises ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text
                  style={{
                    color: theme.colors.onSurfaceVariant,
                    marginTop: 10,
                  }}
                >
                  Carregando exercícios...
                </Text>
              </View>
            ) : databaseExercises.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text
                  style={{
                    color: theme.colors.onSurfaceVariant,
                    marginBottom: 20,
                  }}
                >
                  Nenhum exercício encontrado no banco de dados.
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowExerciseModal(false);
                    setShowAddExerciseModal(true);
                  }}
                  style={[
                    styles.emptyAddButton,
                    { backgroundColor: theme.colors.primary },
                  ]}
                >
                  <Text
                    style={{
                      color: theme.colors.onPrimary,
                      fontWeight: "600",
                    }}
                  >
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
                    onPress={() =>
                      selectExerciseFromDatabase(item, selectedExerciseIndex!)
                    }
                  >
                    <View style={styles.exerciseListItemContent}>
                      {item.exercise_img ? (
                        <Image
                          source={{ uri: item.exercise_img }}
                          style={styles.exerciseImage}
                          defaultSource={require("../../assets/images/favicon.png")}
                        />
                      ) : (
                        <View
                          style={[
                            styles.exerciseImage,
                            { backgroundColor: theme.colors.surfaceVariant },
                          ]}
                        >
                          <Text style={{ color: theme.colors.onSurfaceVariant }}>
                            📷
                          </Text>
                        </View>
                      )}
                      <View style={styles.exerciseListInfo}>
                        <Text
                          style={[
                            styles.exerciseListName,
                            { color: theme.colors.onSurface },
                          ]}
                        >
                          {item.exercise_name}
                        </Text>
                        {item.exercise_type && (
                          <Text
                            style={[
                              styles.exerciseListType,
                              { color: theme.colors.onSurfaceVariant },
                            ]}
                          >
                            {item.exercise_type}
                          </Text>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() =>
                        selectExerciseFromDatabase(item, selectedExerciseIndex!)
                      }
                      style={[
                        styles.selectExerciseButton,
                        { backgroundColor: theme.colors.primary + "20" },
                      ]}
                    >
                      <Text
                        style={{
                          color: theme.colors.primary,
                          fontWeight: "600",
                        }}
                      >
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
                      { backgroundColor: theme.colors.surfaceVariant },
                    ]}
                  >
                    <Text
                      style={{
                        color: theme.colors.onSurfaceVariant,
                        fontWeight: "600",
                      }}
                    >
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

  const validate = () => {
    if (!workoutName.trim()) {
      Alert.alert("Please enter a workout name");
      return false;
    }
    const hasNamed = exercises.some((e) => e.name && e.name.trim().length > 0);
    if (!hasNamed) {
      Alert.alert("Add at least one exercise with a name");
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

    Alert.alert("Save workout", "Do you want to save this workout online?", [
      {
        text: "No",
        style: "cancel",
        onPress: () => saveWorkout(newWorkout, false),
      },
      {
        text: "Yes",
        onPress: () => saveWorkout(newWorkout, true),
      },
    ]);
  };

  const saveWorkout = async (workout: Workout, saveOnline: boolean) => {
    setLoading(true);

    try {
      // ☁️ Save online ONLY if user agreed
      if (saveOnline) {
        const userResp = await supabase.auth.getUser();
        const userId = userResp.data.user?.id;

        if (userId) {
          await insertWorkout(workout, userId);
        }

        console.log("Create workout id= ", workout.createdAt);
      }

      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const list: Workout[] = raw ? JSON.parse(raw) : [];

      list.unshift(workout);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));

      router.back();
    } catch (err) {
      console.error("Save workout error", err);
      Alert.alert(t("error"), t("couldNotSave", { ns: "common" }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={[styles.container]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.header, { color: theme.colors.onBackground }]}>
          {t("createWorkout", { ns: "workouts" })}
        </Text>

        {/* Workout Name Card */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
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
                borderColor: theme.colors.outline,
              },
            ]}
            placeholderTextColor={
              theme.colors.onSurfaceVariant ?? theme.colors.onSurface
            }
          />
        </View>

        {/* Exercises */}
        {exercises.map((ex, idx) => (
          <View
            key={ex.id}
            style={[styles.card, { backgroundColor: theme.colors.surface }]}
          >
            {/* Exercise Header */}
            <View style={styles.rowBetween}>
              <Text
                style={[styles.cardTitle, { color: theme.colors.onSurface }]}
              >
                {t("exerciseNumber", { ns: "workouts", number: idx + 1 })}
              </Text>
              <TouchableOpacity
                onPress={() => removeExercise(ex.id)}
                disabled={exercises.length === 1}
              >
                <Text
                  style={[
                    styles.removeBtn,
                    { color: theme.colors.error },
                    exercises.length === 1 && { opacity: 0.4 },
                  ]}
                >
                  {t("remove", { ns: "common" })}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Exercise Name with Database Search */}
            <View style={styles.rowBetween}>
              <Text style={[styles.label, { color: theme.colors.onSurface }]}>
                {t("name", { ns: "common" })}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setSelectedExerciseIndex(idx);
                  setShowExerciseModal(true);
                }}
                style={[
                  styles.databaseButton,
                  { backgroundColor: theme.colors.primary + "20" },
                ]}
              >
                <Svg
                  width={20}
                  height={30}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={theme.colors.onSurface}
                  strokeWidth={1.5}
                >
                  <Path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M 28 6 L 4 6 M 28 16 L 4 16 M 28 26 L 4 26 M 24 3 L 24 9 M 8 13 L 8 19 M 20 23 L 20 29"
                  />
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
                  borderColor: theme.colors.outline,
                },
              ]}
              placeholderTextColor={
                theme.colors.onSurfaceVariant ?? theme.colors.onSurface
              }
              value={ex.name}
              onChangeText={(t) => updateExercise(ex.id, "name", t)}
            />

            {/* Sets and Reps */}
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
                      borderColor: theme.colors.outline,
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
                      borderColor: theme.colors.outline,
                    },
                  ]}
                  keyboardType="number-pad"
                  placeholder={t("optional", { ns: "common" })}
                  placeholderTextColor={
                    theme.colors.onSurfaceVariant ?? theme.colors.onSurface
                  }
                  value={ex.reps != null ? String(ex.reps) : ""}
                  onChangeText={(t) =>
                    updateExercise(ex.id, "reps", t ? Number(t) : undefined)
                  }
                />
              </View>
            </View>

            {/* Weight and Duration */}
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
                      borderColor: theme.colors.outline,
                    },
                  ]}
                  keyboardType="numeric"
                  placeholder={t("optional", { ns: "common" })}
                  placeholderTextColor={
                    theme.colors.onSurfaceVariant ?? theme.colors.onSurface
                  }
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
                      borderColor: theme.colors.outline,
                    },
                  ]}
                  keyboardType="numeric"
                  placeholder={t("optional", { ns: "common" })}
                  placeholderTextColor={
                    theme.colors.onSurfaceVariant ?? theme.colors.onSurface
                  }
                  value={ex.minutes != null ? String(ex.minutes) : ""}
                  onChangeText={(t) =>
                    updateExercise(ex.id, "minutes", t ? Number(t) : undefined)
                  }
                />
              </View>
            </View>

            {/* Exercise Type Segment */}
            <Text
              style={[
                styles.label,
                { color: theme.colors.onSurface, marginTop: 12 },
              ]}
            >
              {t("type", { ns: "workouts" })}
            </Text>
            <View
              style={[
                styles.segmentContainer,
                {
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.outline,
                },
              ]}
            >
              {(["weightlifting", "calisthenics", "cardio"] as const).map(
                (type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.segmentBtn,
                      ex.type === type
                        ? {
                            backgroundColor: theme.colors.primary,
                            shadowColor: theme.colors.primary,
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.3,
                            shadowRadius: 4,
                            elevation: 3,
                          }
                        : {
                            backgroundColor: "transparent",
                          },
                    ]}
                    onPress={() => updateExercise(ex.id, "type", type)}
                  >
                    <Text
                      style={[
                        styles.segmentTxt,
                        ex.type === type
                          ? {
                              color: theme.colors.onPrimary,
                              fontWeight: "700",
                            }
                          : {
                              color: theme.colors.onSurfaceVariant,
                            },
                      ]}
                    >
                      {t(type, { ns: "workouts" })}
                    </Text>
                  </TouchableOpacity>
                ),
              )}
            </View>

            {/* Toggle Switches */}
            <View style={styles.switchRow}>
              <View style={styles.switchItem}>
                <Text
                  style={[
                    styles.switchLabel,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  {t("warmup", { ns: "workouts" })}
                </Text>
                <Switch
                  value={ex.warmup}
                  onValueChange={(v) => updateExercise(ex.id, "warmup", v)}
                  trackColor={{
                    false: theme.colors.surfaceVariant,
                    true: theme.colors.primaryContainer,
                  }}
                  thumbColor={
                    ex.warmup ? theme.colors.primary : theme.colors.outline
                  }
                />
              </View>
              <View style={styles.switchItem}>
                <Text
                  style={[
                    styles.switchLabel,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  {t("dropset", { ns: "workouts" })}
                </Text>
                <Switch
                  value={ex.dropset}
                  onValueChange={(v) => updateExercise(ex.id, "dropset", v)}
                  trackColor={{
                    false: theme.colors.surfaceVariant,
                    true: theme.colors.primaryContainer,
                  }}
                  thumbColor={
                    ex.dropset ? theme.colors.primary : theme.colors.outline
                  }
                />
              </View>
              <View style={styles.switchItem}>
                <Text
                  style={[
                    styles.switchLabel,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  {t("failure", { ns: "workouts" })}
                </Text>
                <Switch
                  value={ex.failure}
                  onValueChange={(v) => updateExercise(ex.id, "failure", v)}
                  trackColor={{
                    false: theme.colors.surfaceVariant,
                    true: theme.colors.primaryContainer,
                  }}
                  thumbColor={
                    ex.failure ? theme.colors.primary : theme.colors.outline
                  }
                />
              </View>
            </View>
          </View>
        ))}

        {/* Footer Buttons */}
        <View style={styles.footerRow}>
          <TouchableOpacity
            style={[
              styles.secondaryBtn,
              {
                borderColor: theme.colors.outline,
                backgroundColor: theme.colors.surface,
              },
            ]}
            onPress={addExercise}
          >
            <Text
              style={[
                styles.secondaryBtnTxt,
                { color: theme.colors.onSurface },
              ]}
            >
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
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.onPrimary} size="small" />
            ) : (
              <Text
                style={[
                  styles.primaryBtnTxt,
                  { color: theme.colors.onPrimary },
                ]}
              >
                {t("saveWorkout", { ns: "workouts" })}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Modais */}
        <ExerciseSelectionModal />
        
        {/* ✅ MODAL ISOLADO - NÃO CAUSA RE-RENDERS NO PAI */}
        <AddExerciseModal 
          visible={showAddExerciseModal}
          onClose={() => setShowAddExerciseModal(false)}
          onExerciseAdded={handleExerciseAdded}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
  },
  header: {
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 24,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: Platform.OS === "ios" ? 4 : 2,
    },
    shadowOpacity: Platform.OS === "ios" ? 0.1 : 0.08,
    shadowRadius: Platform.OS === "ios" ? 12 : 4,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 8,
  },
  input: {
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    minHeight: Platform.OS === "ios" ? 50 : 46,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  half: {
    flex: 1,
  },
  removeBtn: {
    fontWeight: "600",
    fontSize: 14,
  },
  segmentContainer: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    marginTop: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    alignItems: "center",
    borderRadius: 10,
    marginHorizontal: 2,
  },
  segmentTxt: {
    fontSize: 14,
    fontWeight: "500",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingHorizontal: 0,
    gap: 4,
  },
  switchItem: {
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    flex: 1,
    justifyContent: "center",
    minWidth: 70,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: "500",
    flex: 1,
    textAlign: "center",
    includeFontPadding: false,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 24,
    marginBottom: 40,
  },
  primaryBtn: {
    paddingVertical: Platform.OS === "ios" ? 16 : 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: "center",
    flex: 1,
    minHeight: Platform.OS === "ios" ? 56 : 52,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnTxt: {
    fontWeight: "700",
    fontSize: 16,
  },
  secondaryBtn: {
    borderRadius: 14,
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
  // Estilos para os modais
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalOverlayFixed: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainerFixed: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 20,
    paddingTop: 10,
    maxHeight: Platform.OS === "ios" ? "85%" : "90%",
  },
  modalHeaderFixed: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
    paddingTop: 10,
  },
  modalTitleFixed: {
    fontSize: 20,
    fontWeight: "bold",
    flex: 1,
  },
  closeButtonFixed: {
    padding: 5,
    marginLeft: 10,
  },
  modalScrollFixed: {
    flex: 1,
  },
  modalContentFixed: {
    paddingBottom: 20,
  },
  labelFixed: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 8,
  },
  inputFixed: {
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    minHeight: Platform.OS === "ios" ? 50 : 46,
    marginBottom: 16,
  },
  segmentContainerFixed: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    marginTop: 4,
    marginBottom: 16,
  },
  segmentBtnFixed: {
    flex: 1,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    alignItems: "center",
    borderRadius: 10,
    marginHorizontal: 2,
  },
  segmentTxtFixed: {
    fontSize: 14,
    fontWeight: "500",
  },
  imagePreviewContainerFixed: {
    marginTop: 15,
    marginBottom: 15,
  },
  imagePreviewFixed: {
    width: "100%",
    height: 150,
    borderRadius: 8,
    marginTop: 8,
    backgroundColor: "#f0f0f0",
  },
  modalButtonsFixed: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  cancelButtonFixed: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonTextFixed: {
    fontWeight: "600",
    fontSize: 16,
  },
  addButtonFixed: {
    flex: 2,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonTextFixed: {
    fontWeight: "700",
    fontSize: 16,
  },
  // Estilos existentes para o outro modal
  exerciseModalContainer: {
    width: "100%",
    maxHeight: "80%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  modalHeaderButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    flex: 1,
  },
  closeButton: {
    padding: 5,
    marginLeft: 10,
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  exerciseListItemContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  exerciseImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
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
    fontSize: 12,
    opacity: 0.7,
  },
  selectExerciseButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  databaseButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addToDbButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 10,
  },
  addToDbButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  emptyAddButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addMoreButton: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 10,
  },
});