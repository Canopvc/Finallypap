import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, ViewStyle, findNodeHandle } from 'react-native';

// ─── Single animated item ─────────────────────────────────────────────────────

type ItemProps = {
  children: React.ReactNode;
  index: number;
  delay: number;
  duration: number;
  initialDelay: number;
  visible: boolean;
  style?: ViewStyle;
};

function AnimatedListItem({ children, index, delay, duration, initialDelay, visible, style }: ItemProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(28)).current;
  const animated = useRef(false);

  useEffect(() => {
    if (!visible || animated.current) return;
    animated.current = true;

    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, damping: 18, stiffness: 120, mass: 0.9, useNativeDriver: true }),
      ]).start();
    }, initialDelay + index * delay);

    return () => clearTimeout(t);
  }, [visible]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

// ─── AnimatedList ─────────────────────────────────────────────────────────────

type Props<T> = {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  delay?: number;
  duration?: number;
  initialDelay?: number;
  style?: ViewStyle;
  itemStyle?: ViewStyle;
  /**
   * Passa o Animated.Value do scroll do Animated.ScrollView pai.
   * Se não passares, todos os items animam ao montar em cascata.
   */
  scrollY?: Animated.Value;
  /** Altura do ecrã. Default: 800 */
  viewportHeight?: number;
};

export default function AnimatedList<T>({
  items,
  renderItem,
  delay = 80,
  duration = 380,
  initialDelay = 0,
  style,
  itemStyle,
  scrollY,
  viewportHeight = 800,
}: Props<T>) {
  // Se não há scrollY, tudo visível logo (cascata simples ao montar)
  const [visible, setVisible] = useState<boolean[]>(() =>
    new Array(items.length).fill(!scrollY)
  );

  // Refs para medir posição absoluta de cada item no ecrã
  const itemRefs = useRef<(View | null)[]>([]);
  // Posição Y absoluta de cada item (relativa ao ecrã)
  const itemAbsY = useRef<(number | null)[]>([]);
  // Valor atual do scroll
  const scrollValue = useRef(0);

  // Ajusta arrays quando items mudam
  useEffect(() => {
    setVisible(prev => {
      const next = Array.from({ length: items.length }, (_, i) =>
        i < prev.length ? prev[i] : !scrollY
      );
      return next;
    });
    itemRefs.current = itemRefs.current.slice(0, items.length);
    itemAbsY.current = itemAbsY.current.slice(0, items.length);
  }, [items.length]);

  // Função que verifica quais items estão no viewport e os torna visíveis
  const checkVisible = (scrollVal: number) => {
    const bottom = scrollVal + viewportHeight;
    setVisible(prev => {
      let changed = false;
      const next = prev.map((v, i) => {
        if (v) return true;
        const absY = itemAbsY.current[i];
        // absY é a posição do item no ecrã. Para saber se está no viewport:
        // posição absoluta na página = absY + scrollVal
        // revela quando essa posição é menor que bottom + 80px de antecipação
        if (absY !== null && absY !== undefined) {
          const pageY = absY + scrollVal;
          if (pageY < bottom + 80) {
            changed = true;
            return true;
          }
        }
        return false;
      });
      return changed ? next : prev;
    });
  };

  // Listener do scrollY
  useEffect(() => {
    if (!scrollY) return;

    checkVisible(0);

    const id = scrollY.addListener(({ value }) => {
      scrollValue.current = value;
      checkVisible(value);
    });

    return () => scrollY.removeListener(id);
  }, [scrollY, viewportHeight, items.length]);

  // Mede a posição absoluta de um item no ecrã após render
  const measureItem = (index: number) => {
    const ref = itemRefs.current[index];
    if (!ref) return;

    ref.measureInWindow((x, y, width, height) => {
      itemAbsY.current[index] = y;
      // Verifica imediatamente se já está visível
      if (scrollY) {
        checkVisible(scrollValue.current);
      }
    });
  };

  return (
    <View style={style}>
      {items.map((item, index) => (
        <View
          key={index}
          ref={r => { itemRefs.current[index] = r; }}
          onLayout={() => {
            // Pequeno delay para garantir que o layout está committed
            setTimeout(() => measureItem(index), 50);
          }}
        >
          <AnimatedListItem
            index={index}
            delay={delay}
            duration={duration}
            initialDelay={initialDelay}
            visible={visible[index]}
            style={itemStyle}
          >
            {renderItem(item, index)}
          </AnimatedListItem>
        </View>
      ))}
    </View>
  );
}