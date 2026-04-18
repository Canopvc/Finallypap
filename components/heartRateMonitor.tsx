import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { Heart, Activity, Bluetooth, Zap, BluetoothOff } from 'lucide-react-native';
import useHeartRate from '../hooks/useHeartRate';
import { LineChart } from 'react-native-chart-kit';
import { useTranslation } from '../hooks/useTranslation';

interface HeartRateMonitorProps {
  onHeartRateData?: (bpm: number) => void;
  showStats?: boolean;
  showChart?: boolean;
}

export default function HeartRateMonitor({
  onHeartRateData,
  showStats = true,
  showChart = true
}: HeartRateMonitorProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const {
    bpm,
    isConnected,
    isConnecting,
    isAvailable,
    deviceName,
    hrData,
    stats,
    connect,
    disconnect,
    resetSession
  } = useHeartRate();

  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (onHeartRateData && bpm > 0) {
      onHeartRateData(bpm);
    }
  }, [bpm, onHeartRateData]);

  const chartData = {
    labels: hrData.slice(-10).map((_, i) => `${i}s`),
    datasets: [{
      data: hrData.slice(-10).length > 0 ? hrData.slice(-10).map(d => d.bpm) : [0]
    }]
  };

  const getHeartRateZone = () => {
    if (bpm < 60) return { zone: 'Repouso', color: '#3b82f6' };
    if (bpm < 100) return { zone: 'Aquecimento', color: '#22c55e' };
    if (bpm < 140) return { zone: 'Queima de Gordura', color: '#eab308' };
    if (bpm < 170) return { zone: 'Aeróbico', color: '#f97316' };
    return { zone: 'Anaeróbico', color: '#ef4444' };
  };

  const heartZone = getHeartRateZone();

  // Bluetooth não disponível neste ambiente
  if (!isAvailable) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.unavailableContainer}>
          <BluetoothOff size={40} color={theme.colors.onSurfaceVariant} />
          <Text style={[styles.unavailableTitle, { color: theme.colors.onSurface }]}>
            Monitor Cardíaco Indisponível
          </Text>
          <Text style={[styles.unavailableText, { color: theme.colors.onSurfaceVariant }]}>
            O Bluetooth não está disponível neste ambiente. Para usar o monitor cardíaco, é necessário um build nativo da aplicação.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Heart size={24} color={theme.colors.primary} />
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>
            Monitor Cardíaco
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setShowDetails(!showDetails)}
          style={styles.detailsToggle}
        >
          <Activity size={20} color={theme.colors.onSurfaceVariant} />
        </TouchableOpacity>
      </View>

      {/* Status e Conexão */}
      <View style={styles.statusContainer}>
        <View style={styles.statusLeft}>
          <Bluetooth size={16} color={isConnected ? '#22c55e' : theme.colors.error} />
          <Text style={[
            styles.statusText,
            { color: isConnected ? '#22c55e' : theme.colors.error }
          ]}>
            {isConnected ? 'Conectado' : 'Desconectado'}
          </Text>
          {isConnected && deviceName && (
            <Text style={[styles.deviceName, { color: theme.colors.onSurfaceVariant }]}>
              • {deviceName}
            </Text>
          )}
        </View>

        {!isConnected && !isConnecting && (
          <TouchableOpacity
            onPress={connect}
            style={[styles.connectButton, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={styles.connectButtonText}>{t('connect', { ns: 'common' })}</Text>
          </TouchableOpacity>
        )}

        {isConnecting && (
          <View style={[styles.connectingBadge, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>{t('loading', { ns: 'common' })}</Text>
          </View>
        )}

        {isConnected && (
          <TouchableOpacity
            onPress={disconnect}
            style={[styles.disconnectButton, { borderColor: theme.colors.error }]}
          >
            <Text style={[styles.disconnectText, { color: theme.colors.error }]}>
              Desconectar
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Nenhuma leitura ainda */}
      {isConnected && bpm === 0 && (
        <View style={[styles.noDataContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Activity size={24} color={theme.colors.onSurfaceVariant} />
          <Text style={[styles.noDataText, { color: theme.colors.onSurfaceVariant }]}>
            À espera de leituras...
          </Text>
        </View>
      )}

      {/* Leitura Atual */}
      {isConnected && bpm > 0 && (
        <View style={styles.currentReading}>
          <View style={[styles.bpmCircle, { borderColor: heartZone.color }]}>
            <Text style={[styles.bpmValue, { color: theme.colors.onSurface }]}>
              {bpm}
            </Text>
            <Text style={[styles.bpmLabel, { color: theme.colors.onSurfaceVariant }]}>
              BPM
            </Text>
          </View>

          <View style={[styles.zoneBadge, { backgroundColor: heartZone.color + '20' }]}>
            <Zap size={16} color={heartZone.color} />
            <Text style={[styles.zoneText, { color: heartZone.color }]}>
              {heartZone.zone}
            </Text>
          </View>
        </View>
      )}

      {/* Não conectado — mensagem informativa */}
      {!isConnected && !isConnecting && (
        <View style={[styles.noDataContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Bluetooth size={24} color={theme.colors.onSurfaceVariant} />
          <Text style={[styles.noDataText, { color: theme.colors.onSurfaceVariant }]}>
            Sem dispositivo conectado. Liga o teu monitor cardíaco e clica em Conectar.
          </Text>
        </View>
      )}

      {/* Detalhes Expandidos */}
      {showDetails && isConnected && (
        <ScrollView style={styles.detailsContainer}>
          {showChart && hrData.length > 1 && (
            <View style={styles.chartContainer}>
              <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                Histórico (últimos 10s)
              </Text>
              <LineChart
                data={chartData}
                width={Dimensions.get('window').width - 64}
                height={180}
                chartConfig={{
                  backgroundColor: theme.colors.surface,
                  backgroundGradientFrom: theme.colors.surface,
                  backgroundGradientTo: theme.colors.surface,
                  decimalPlaces: 0,
                  color: (_opacity = 1) => theme.colors.primary,
                  style: { borderRadius: 16 }
                }}
                bezier
                style={styles.chart}
              />
            </View>
          )}

          {showStats && stats.avg > 0 && (
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: theme.colors.surfaceVariant }]}>
                <Activity size={20} color={theme.colors.primary} />
                <Text style={[styles.statValue, { color: theme.colors.onSurface }]}>{stats.avg}</Text>
                <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>{t('average', { ns: 'common' })}</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: theme.colors.surfaceVariant }]}>
                <Heart size={20} color="#ef4444" />
                <Text style={[styles.statValue, { color: theme.colors.onSurface }]}>{stats.max}</Text>
                <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>{t('max', { ns: 'common' })}</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: theme.colors.surfaceVariant }]}>
                <Heart size={20} color="#22c55e" />
                <Text style={[styles.statValue, { color: theme.colors.onSurface }]}>{stats.min}</Text>
                <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>{t('min', { ns: 'common' })}</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: theme.colors.surfaceVariant }]}>
                <Zap size={20} color="#eab308" />
                <Text style={[styles.statValue, { color: theme.colors.onSurface }]}>{stats.calories}</Text>
                <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>{t('caloriesTab', { ns: 'common' })}</Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            onPress={resetSession}
            style={[styles.resetButton, { borderColor: theme.colors.primary }]}
          >
            <Text style={[styles.resetText, { color: theme.colors.primary }]}>
              Nova Sessão
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  unavailableContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  unavailableTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  unavailableText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  noDataContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 12,
    marginVertical: 8,
  },
  noDataText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontWeight: '600' },
  detailsToggle: { padding: 8 },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  statusText: { fontSize: 14, fontWeight: '500' },
  deviceName: { fontSize: 14, marginLeft: 4 },
  connectButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  connectButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
  connectingBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  disconnectButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  disconnectText: { fontSize: 12, fontWeight: '600' },
  currentReading: { alignItems: 'center', marginVertical: 16 },
  bpmCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  bpmValue: { fontSize: 48, fontWeight: '700' },
  bpmLabel: { fontSize: 16, fontWeight: '500' },
  zoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  zoneText: { fontSize: 16, fontWeight: '600' },
  detailsContainer: { maxHeight: 400 },
  chartContainer: { marginVertical: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  chart: { marginVertical: 8, borderRadius: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 16 },
  statCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 12, fontWeight: '500' },
  resetButton: { alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 1, marginTop: 8 },
  resetText: { fontSize: 14, fontWeight: '600' },
});