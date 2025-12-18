import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import GoogleFit from 'react-native-google-fit';

export default function StepCounterScreen() {
  const [steps, setSteps] = useState(0);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Autorizar Google Fit
  const authorizeGoogleFit = async () => {
    try {
      console.log('Iniciando autorização...'); 
      
      const options = {
        scopes: [
          'https://www.googleapis.com/auth/fitness.activity.read',
          'https://www.googleapis.com/auth/fitness.activity.write'
        ],
      };

      // @ts-ignore
      const authResult = await GoogleFit.authorize(options);
      
      console.log('Resultado da autorização:', authResult);
      
      if (authResult.success) {
        setIsAuthorized(true);
        getSteps();
        Alert.alert('Sucesso', 'Conectado ao Google Fit!');
      } else {
        Alert.alert('Erro', 'Autorização negada ou cancelada');
        console.log('Autorização falhou:', authResult);
      }
    } catch (error) {
      console.log('Erro na autorização:', error);
      Alert.alert('Erro', 'Falha na conexão com Google Fit');
    }
  };

  // Buscar passos do dia
  const getSteps = async () => {
    try {
      setIsLoading(true);
      console.log('Buscando passos...');
      
      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      
      // @ts-ignore
      const result = await GoogleFit.getDailyStepCountSamples({
        startDate: startOfDay.toISOString(),
        endDate: today.toISOString(),
      });
      
      console.log('Resultado dos passos:', result);
      
      if (result && result.length > 0 && result[0].steps) {
        const totalSteps = result[0].steps.reduce((sum: number, step: any) => sum + step.value, 0);
        setSteps(totalSteps);
        console.log('Total de passos:', totalSteps);
      } else {
        console.log('Nenhum dado de passos encontrado');
        setSteps(0);
      }
    } catch (error) {
      console.log('Erro ao buscar passos:', error);
      Alert.alert('Erro', 'Falha ao buscar dados de passos');
    } finally {
      setIsLoading(false);
    }
  };

  // Verificar autorização ao iniciar
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // @ts-ignore
      GoogleFit.checkIsAuthorized().then((authorized: boolean) => {
        console.log('Status de autorização:', authorized);
        setIsAuthorized(authorized);
        if (authorized) {
          getSteps();
        }
      }).catch((error: any) => {
        console.log('Erro ao verificar autorização:', error);
      });
    } catch (error) {
      console.log('Erro no checkAuthStatus:', error);
    }
  };

  // Atualizar a cada minuto quando autorizado
  useEffect(() => {
    if (isAuthorized) {
      const interval = setInterval(() => {
        getSteps();
      }, 60000);

      return () => clearInterval(interval);
    }
  }, [isAuthorized]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>👟 PASSOS DO DIA</Text>
      
      <View style={styles.circle}>
        <Text style={styles.stepCount}>{steps}</Text>
        <Text style={styles.stepLabel}>PASSOS HOJE</Text>
      </View>

      {!isAuthorized ? (
        <View style={styles.authSection}>
          <TouchableOpacity 
            style={styles.authButton} 
            onPress={authorizeGoogleFit}
            disabled={isLoading}
          >
            <Text style={styles.authButtonText}>
              {isLoading ? 'CONECTANDO...' : 'CONECTAR GOOGLE FIT'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.instructions}>
            Para ver seus passos, conecte com sua conta Google
          </Text>
        </View>
      ) : (
        <View style={styles.controls}>
          <TouchableOpacity 
            style={styles.refreshButton} 
            onPress={getSteps} 
            disabled={isLoading}
          >
            <Text style={styles.refreshButtonText}>
              {isLoading ? 'ATUALIZANDO...' : 'ATUALIZAR AGORA'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.successText}>
            ✅ Conectado ao Google Fit{'\n'}
            Atualizando automaticamente
          </Text>
        </View>
      )}

      <View style={styles.debugInfo}>
        <Text style={styles.debugText}>
          Status: {isAuthorized ? 'AUTORIZADO' : 'NÃO AUTORIZADO'}
        </Text>
        <Text style={styles.debugText}>
          Carregando: {isLoading ? 'SIM' : 'NÃO'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 40,
    textAlign: 'center',
  },
  circle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  stepCount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
  },
  stepLabel: {
    fontSize: 14,
    color: 'white',
    marginTop: 8,
    fontWeight: '600',
  },
  authSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  authButton: {
    backgroundColor: '#4285F4',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    marginBottom: 15,
  },
  authButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  instructions: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  controls: {
    alignItems: 'center',
    marginBottom: 20,
  },
  refreshButton: {
    backgroundColor: '#34A853',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 20,
    marginBottom: 15,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  successText: {
    fontSize: 14,
    color: '#34A853',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },
  debugInfo: {
    marginTop: 30,
    padding: 15,
    backgroundColor: '#e9ecef',
    borderRadius: 10,
    width: '100%',
  },
  debugText: {
    fontSize: 12,
    color: '#495057',
    textAlign: 'center',
    marginBottom: 5,
  },
});