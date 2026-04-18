import { useTranslation } from "../hooks/useTranslation";
import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Animated,
  StatusBar,
  SafeAreaView,
} from "react-native";
import Modal from "react-native-modal";

const { width, height } = Dimensions.get("window");

// ── Types ──────────────────────────────────────────────────────────────────────

interface SlideItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  emoji: string;
  accent: string;
  features?: string[];
}

// ── Data ───────────────────────────────────────────────────────────────────────

const SLIDES: SlideItem[] = [
  {
    id: "1",
    emoji: "🏋️",
    title: "Bem-vindo à\ntua jornada",
    subtitle: "FITNESS TRACKER",
    description:
      "Tudo o que precisas para alcançar os teus objetivos de saúde, num só lugar.",
    accent: "#C8F135",
    features: [
      "👣  Conta os teus passos",
      "⚖️  Regista o teu peso",
      "🔥  Monitoriza calorias",
      "💓  Frequência cardíaca",
      "🏃  Histórico de treinos",
    ],
  },
  {
    id: "2",
    emoji: "🤖",
    title: "O teu coach\npessoal de IA",
    subtitle: "INTELIGÊNCIA ARTIFICIAL",
    description:
      "Cria treinos personalizados e planos alimentares adaptados exclusivamente a ti.",
    accent: "#35C8F1",
    features: [
      "💬  Chat disponível 24/7",
      "🥗  Planos de dieta à medida",
      "💪  Programas de treino únicos",
      "📈  Adaptação ao teu progresso",
    ],
  },
];

// ── Dot indicator ──────────────────────────────────────────────────────────────

interface DotsProps {
  total: number;
  current: number;
  accent: string;
}

function Dots({ total, current, accent }: DotsProps) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === current
              ? { width: 24, backgroundColor: accent }
              : { backgroundColor: "#444" },
          ]}
        />
      ))}
    </View>
  );
}

// ── Single slide ───────────────────────────────────────────────────────────────

interface SlideProps {
  item: SlideItem;
}

function Slide({ item }: SlideProps) {
  return (
    <View style={[styles.slide, { width }]}>
      {/* Emoji hero */}
      <View style={[styles.emojiCircle, { borderColor: item.accent + "33" }]}>
        <Text style={styles.emoji}>{item.emoji}</Text>
      </View>

      {/* Badge */}
      <Text style={[styles.badge, { color: item.accent }]}>{item.subtitle}</Text>

      {/* Title */}
      <Text style={styles.title}>{item.title}</Text>

      {/* Description */}
      <Text style={styles.description}>{item.description}</Text>

      {/* Feature list */}
      {item.features && (
        <View style={styles.featureBox}>
          {item.features.map((f, i) => (
            <Text key={i} style={styles.featureItem}>
              {f}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface OnboardingScreenProps {
  isVisible?: boolean;
  onDone?: () => void;
}

export default function OnboardingScreen({
  isVisible = true,
  onDone,
}: OnboardingScreenProps) {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<SlideItem>>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const slide = SLIDES[currentIndex];
  const isLast = currentIndex === SLIDES.length - 1;

  // Animate out → scroll → animate in
  const goToSlide = (next: number) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(() => {
      flatListRef.current?.scrollToIndex({ index: next, animated: false });
      setCurrentIndex(next);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleNext = () => {
    if (isLast) {
      onDone?.();
    } else {
      goToSlide(currentIndex + 1);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) goToSlide(currentIndex - 1);
  };

  return (
    <Modal
      isVisible={isVisible}
      style={styles.modal}
      animationIn="fadeIn"
      animationOut="fadeOut"
      backdropOpacity={1}
      backdropColor="#0A0A0A"
      useNativeDriver
    >
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />
      <SafeAreaView style={styles.safeArea}>
        {/* Decorative glow blob */}
        <Animated.View
          style={[
            styles.glowBlob,
            { backgroundColor: slide.accent + "18", opacity: fadeAnim },
          ]}
        />

        {/* Skip button */}
        {!isLast && (
          <TouchableOpacity style={styles.skipBtn} onPress={onDone}>
            <Text style={styles.skipText}>{t('skip', { ns: 'common' })}</Text>
          </TouchableOpacity>
        )}

        {/* Slides */}
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <FlatList
            ref={flatListRef}
            data={SLIDES}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            scrollEnabled={false}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => <Slide item={item} />}
          />
        </Animated.View>

        {/* Bottom bar */}
        <View style={styles.bottomBar}>
          {/* Back */}
          <TouchableOpacity
            style={[styles.backBtn, currentIndex === 0 && { opacity: 0 }]}
            onPress={handleBack}
            disabled={currentIndex === 0}
          >
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>

          {/* Dots */}
          <Dots
            total={SLIDES.length}
            current={currentIndex}
            accent={slide.accent}
          />

          {/* Next / Done */}
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: slide.accent }]}
            onPress={handleNext}
            activeOpacity={0.8}
          >
            <Text style={styles.nextText}>{isLast ? t('start', { ns: 'common' }) : "→"}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: "flex-end",
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },

  // Glow
  glowBlob: {
    position: "absolute",
    top: -60,
    left: -60,
    width: 320,
    height: 320,
    borderRadius: 160,
  },

  // Skip
  skipBtn: {
    alignSelf: "flex-end",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  skipText: {
    color: "#666",
    fontSize: 14,
    fontWeight: "500",
    letterSpacing: 0.5,
  },

  // Slide
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 20,
  },
  emojiCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
    backgroundColor: "#141414",
  },
  emoji: {
    fontSize: 52,
  },
  badge: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 3,
    marginBottom: 12,
  },
  title: {
    fontSize: 36,
    fontWeight: "800",
    color: "#F5F5F5",
    textAlign: "center",
    lineHeight: 44,
    marginBottom: 16,
  },
  description: {
    fontSize: 15,
    color: "#888",
    textAlign: "center",
    lineHeight: 23,
    marginBottom: 32,
  },
  featureBox: {
    alignSelf: "stretch",
    backgroundColor: "#141414",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 12,
  },
  featureItem: {
    fontSize: 14,
    color: "#CCCCCC",
    lineHeight: 20,
  },

  // Bottom
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 12,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    color: "#AAA",
    fontSize: 20,
  },
  nextBtn: {
    minWidth: 64,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  nextText: {
    color: "#0A0A0A",
    fontSize: 18,
    fontWeight: "800",
  },
});