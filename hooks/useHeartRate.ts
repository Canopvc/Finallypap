import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform, Alert, PermissionsAndroid } from 'react-native';

let BleManagerClass: any = null;

try {
  const ble = require('react-native-ble-plx');
  BleManagerClass = ble.BleManager;
} catch {
  console.warn('react-native-ble-plx não disponível neste ambiente');
}

const HR_SERVICE_UUID = '180D';
const HR_MEASUREMENT_UUID = '2A37';

interface HeartRateReading {
  bpm: number;
  timestamp: number;
}

interface HeartRateStats {
  avg: number;
  max: number;
  min: number;
  calories: number;
}

export default function useHeartRate() {
  const [bpm, setBpm] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [deviceName, setDeviceName] = useState<string>('');
  const [hrData, setHrData] = useState<HeartRateReading[]>([]);
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [stats, setStats] = useState<HeartRateStats>({ avg: 0, max: 0, min: 0, calories: 0 });

  const bleManagerRef = useRef<any | null>(null);
  const deviceRef = useRef<any | null>(null);
  const allReadings = useRef<HeartRateReading[]>([]);

  // Inicializar BLE Manager de forma segura
  useEffect(() => {
    if (!BleManagerClass) {
      setIsAvailable(false);
      return;
    }

    try {
      bleManagerRef.current = new BleManagerClass();
      setIsAvailable(true);
    } catch (e) {
      console.warn('Falha ao inicializar BLE Manager:', e);
      setIsAvailable(false);
    }

    return () => {
      if (deviceRef.current) {
        deviceRef.current.cancelConnection().catch(() => {});
      }
      bleManagerRef.current?.destroy();
    };
  }, []);

  const parseHeartRate = (value: string): number => {
    try {
      const data = Buffer.from(value, 'base64');
      const flags = data.readUInt8(0);
      const is16Bit = (flags & 0x01) !== 0;
      return is16Bit ? data.readUInt16LE(1) : data.readUInt8(1);
    } catch (error) {
      console.error('Error parsing heart rate:', error);
      return 0;
    }
  };

  const updateStats = useCallback((readings: HeartRateReading[]) => {
    if (readings.length === 0) return;

    const bpms = readings.map(r => r.bpm);
    const avg = Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length);
    const max = Math.max(...bpms);
    const min = Math.min(...bpms);
    const durationMin = (Date.now() - readings[0].timestamp) / 60000;
    const calories = Math.max(0, Math.round((durationMin * (avg * 0.6309 - 30.0427)) / 4.184));

    setStats({ avg, max, min, calories });
  }, []);

  const connect = useCallback(async () => {
    if (!isAvailable || !bleManagerRef.current) {
      Alert.alert(
        'Bluetooth não disponível',
        'O monitor cardíaco Bluetooth não está disponível neste dispositivo ou ambiente.'
      );
      return;
    }

    setIsConnecting(true);

    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Permissão de Localização',
            message: 'O scanning Bluetooth requer permissão de localização',
            buttonNeutral: 'Perguntar Depois',
            buttonNegative: 'Cancelar',
            buttonPositive: 'OK',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          throw new Error('Permissão de localização negada');
        }
      }

      const devices: any[] = await new Promise((resolve, reject) => {
        const scannedDevices: any[] = [];
        let resolved = false;

        const timeout = setTimeout(() => {
          bleManagerRef.current?.stopDeviceScan();
          if (!resolved) {
            resolved = true;
            resolve(scannedDevices);
          }
        }, 5000);

        bleManagerRef.current.startDeviceScan(
          [HR_SERVICE_UUID],
          null,
          (error: any, device: any) => {
            if (error) {
              clearTimeout(timeout);
              bleManagerRef.current?.stopDeviceScan();
              if (!resolved) {
                resolved = true;
                reject(error);
              }
              return;
            }

            if (device?.name) {
              scannedDevices.push(device);
            }
          }
        );
      });

      if (devices.length === 0) {
        throw new Error('Nenhum monitor cardíaco encontrado. Certifica-te que o dispositivo está ligado e próximo.');
      }

      const device = devices[0];
      deviceRef.current = device;
      setDeviceName(device.name || 'Monitor Cardíaco');

      const connectedDevice = await device.connect();
      await connectedDevice.discoverAllServicesAndCharacteristics();

      connectedDevice.onDisconnected(() => {
        setIsConnected(false);
        setBpm(0);
        deviceRef.current = null;
        Alert.alert('Desconectado', 'Monitor cardíaco desconectado');
      });

      await connectedDevice.monitorCharacteristicForService(
        HR_SERVICE_UUID,
        HR_MEASUREMENT_UUID,
        (error: any, characteristic: any) => {
          if (error) {
            console.error('Monitor error:', error);
            return;
          }

          if (characteristic?.value) {
            const heartRate = parseHeartRate(characteristic.value);
            const timestamp = Date.now();

            setBpm(heartRate);
            allReadings.current.push({ bpm: heartRate, timestamp });

            const recentData = allReadings.current.slice(-300);
            setHrData([...recentData]);
            updateStats(allReadings.current);
          }
        }
      );

      allReadings.current = [];
      setHrData([]);
      setStats({ avg: 0, max: 0, min: 0, calories: 0 });
      setSessionStart(Date.now());
      setIsConnected(true);

    } catch (error: any) {
      console.error('Erro ao conectar:', error);
      Alert.alert('Erro de Conexão', error?.message || 'Falha ao conectar ao monitor cardíaco');
    } finally {
      setIsConnecting(false);
    }
  }, [isAvailable, updateStats]);

  const disconnect = useCallback(async () => {
    if (deviceRef.current) {
      try {
        await deviceRef.current.cancelConnection();
      } catch (error) {
        console.error('Erro ao desconectar:', error);
      }
    }
    deviceRef.current = null;
    setIsConnected(false);
    setBpm(0);
  }, []);

  const getSessionData = useCallback(() => {
    return {
      readings: [...allReadings.current],
      stats: { ...stats },
      sessionStart,
      deviceName,
      duration: sessionStart ? Math.floor((Date.now() - sessionStart) / 1000) : 0
    };
  }, [stats, sessionStart, deviceName]);

  const resetSession = useCallback(() => {
    allReadings.current = [];
    setHrData([]);
    setStats({ avg: 0, max: 0, min: 0, calories: 0 });
    setSessionStart(Date.now());
  }, []);

  return {
    bpm,
    isConnected,
    isConnecting,
    isAvailable,
    deviceName,
    hrData,
    stats,
    sessionStart,
    connect,
    disconnect,
    getSessionData,
    resetSession
  };
}
