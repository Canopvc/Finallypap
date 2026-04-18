// components/Area_chart.tsx
import React from 'react';
import { View, Text, Dimensions } from 'react-native';
import { getAppTheme } from '../lib/theme';
import { useColorScheme } from 'react-native';
import { useTranslation } from '../hooks/useTranslation';

const { width } = Dimensions.get('window');

interface AreaChartProps {
  data: Array<{
    date: string;
    weight: number;
    fullDate: string;
  }>;
}

const AreaChartComponent: React.FC<AreaChartProps> = ({ data }) => {
  const colorScheme = useColorScheme();
  const theme = getAppTheme(colorScheme);
  const { t } = useTranslation();

  console.log('Tentei');
  
  return (
    <View>
      <Text>{t('weightProgress', { ns: 'common' })}</Text>
    </View>
  );
}

export default AreaChartComponent;