// components/Area_chart.tsx
import React from 'react';
import { View, Text, Dimensions } from 'react-native';
import { getAppTheme } from '../lib/theme';
import { useColorScheme } from 'react-native';

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

  console.log('Tentei');
  
  return (
    <View>
      <Text>Area Chart Component</Text>
    </View>
  );
}

export default AreaChartComponent;