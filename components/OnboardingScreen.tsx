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
    title: "O teu coach\npessoal",
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
              ? { width: 32, backgroundColor: accent }
              : { backgroundColor: "#333" },
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
      {/* Emoji hero - mais orgânico */}
      <View style={[styles.emojiCircle, { borderColor: item.accent + "20" }]}>
        <Text style={styles.emoji}>{item.emoji}</Text>
      </View>

      {/* Badge - tipografia mais humana */}
      <Text style={[styles.badge, { color: item.accent }]}>{item.subtitle}</Text>

      {/* Title - sem peso sintético */}
      <Text style={styles.title}>{item.title}</Text>

      {/* Description */}
      <Text style={styles.description}>{item.description}</Text>

      {/* Feature list - mais orgânica */}
      {item.features && (
        <View style={styles.featureBox}>
          {item.features.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Text style={styles.featureEmoji}>{f.split(' ')[0]}</Text>
              <Text style={styles.featureText}>
                {f.substring(f.indexOf(' ') + 1)}
              </Text>
            </View>
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<SlideItem>>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const slide = SLIDES[currentIndex];
  const isLast = currentIndex === SLIDES.length - 1;

  const goToSlide = (next: number) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      flatListRef.current?.scrollToIndex({ index: next, animated: false });
      setCurrentIndex(next);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
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
      backdropColor="#0D0D0D"
      useNativeDriver
    >
      <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />
      <SafeAreaView style={styles.safeArea}>
        {/* Glow mais suave e orgânico */}
        <Animated.View
          style={[
            styles.glowBlob,
            { backgroundColor: slide.accent + "10", opacity: fadeAnim },
          ]}
        />

        {/* Skip - mais discreto */}
        {!isLast && (
          <TouchableOpacity style={styles.skipBtn} onPress={onDone}>
            <Text style={styles.skipText}>Skip</Text>
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

        {/* Bottom bar - mais tátil */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.backBtn, currentIndex === 0 && { opacity: 0 }]}
            onPress={handleBack}
            disabled={currentIndex === 0}
            activeOpacity={0.7}
          >
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>

          <Dots
            total={SLIDES.length}
            current={currentIndex}
            accent={slide.accent}
          />

          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: slide.accent }]}
            onPress={handleNext}
            activeOpacity={0.7}
          >
            <Text style={styles.nextText}>
              {isLast ? "Vamos lá" : "→"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ── Styles - Mais orgânico e menos "AI" ────────────────────────────────────────

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: "flex-end",
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#0D0D0D",
  },

  // Glow - mais difuso
  glowBlob: {
    position: "absolute",
    top: -80,
    right: -40,
    width: 280,
    height: 280,
    borderRadius: 140,
  },

  // Skip
  skipBtn: {
    alignSelf: "flex-end",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  skipText: {
    color: "#777",
    fontSize: 14,
    fontWeight: "400",
    textDecorationLine: "underline",
    textDecorationColor: "#444",
  },

  // Slide
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  emojiCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 40,
    backgroundColor: "#151515",
  },
  emoji: {
    fontSize: 56,
  },
  badge: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 4,
    marginBottom: 16,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 38,
    fontWeight: "600",
    color: "#F0F0F0",
    textAlign: "center",
    lineHeight: 46,
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 15,
    color: "#999",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 36,
    paddingHorizontal: 8,
  },
  featureBox: {
    alignSelf: "stretch",
    backgroundColor: "#151515",
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 24,
    gap: 16,
    borderWidth: 0.5,
    borderColor: "#2A2A2A",
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureEmoji: {
    fontSize: 20,
    width: 28,
    textAlign: "center",
  },
  featureText: {
    fontSize: 14,
    color: "#BBBBBB",
    lineHeight: 22,
    flex: 1,
  },

  // Bottom
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 28,
    paddingBottom: 34,
    paddingTop: 16,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    height: 6,
    borderRadius: 4,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1C1C1C",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: "#333",
  },
  backText: {
    color: "#999",
    fontSize: 22,
    fontWeight: "300",
  },
  nextBtn: {
    minWidth: 72,
    height: 48,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  nextText: {
    color: "#0D0D0D",
    fontSize: 16,
    fontWeight: "600",
  },
});