/**
 * 실시간 차트 데이터 훅 - 완전 재구축
 * 새로운 통합 타입 시스템과 완벽하게 호환
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useMqttData } from './useMqttData';
import {
  ChartDataPoint,
  RealtimeChartHookReturn,
  Quality,
  Timestamp,
  WeightSensorMessage,
  ConcentrationMessage
} from '../types/robotTypes';

interface RealtimeChartConfig {
  maxDataPoints?: number;
  updateInterval?: number;
  timeWindow?: number; // seconds
  enableSmoothing?: boolean;
  smoothingFactor?: number;
  enableOutlierFilter?: boolean;
  outlierThreshold?: number;
}

const defaultConfig: RealtimeChartConfig = {
  maxDataPoints: 100,
  updateInterval: 1000,
  timeWindow: 300, // 5분
  enableSmoothing: true,
  smoothingFactor: 0.2,
  enableOutlierFilter: true,
  outlierThreshold: 3.0, // 표준편차 배수
};

export const useRealtimeChart = (
  initialConfig: Partial<RealtimeChartConfig> = {}
): RealtimeChartHookReturn => {
  // 설정 상태
  const [config, setConfig] = useState<RealtimeChartConfig>({
    ...defaultConfig,
    ...initialConfig
  });

  // 차트 데이터 상태
  const [weightData, setWeightData] = useState<ChartDataPoint[]>([]);
  const [concentrationData, setConcentrationData] = useState<ChartDataPoint[]>([]);
  const [temperatureData, setTemperatureData] = useState<ChartDataPoint[]>([]);
  const [customData, setCustomData] = useState<Map<string, ChartDataPoint[]>>(new Map());
  
  // 상태 관리
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Timestamp | null>(null);
  
  // 통계 상태
  const [weightStats, setWeightStats] = useState<{ min: number; max: number; avg: number; current: number } | null>(null);
  const [concentrationStats, setConcentrationStats] = useState<{ min: number; max: number; avg: number; current: number } | null>(null);
  
  // MQTT 데이터 훅
  const { weightSensor, concentration, isConnected, error: mqttError } = useMqttData();
  
  // 마지막 값들 (스무딩용)
  const lastWeightValue = useRef<number | null>(null);
  const lastConcentrationValue = useRef<number | null>(null);
  const lastTemperatureValue = useRef<number | null>(null);
  
  // 통계 계산용 버퍼
  const weightBuffer = useRef<number[]>([]);
  const concentrationBuffer = useRef<number[]>([]);

  // 전체 데이터 병합 (에러 해결용)
  const data = [...weightData, ...concentrationData, ...temperatureData];

  // 데이터 포인트 생성 헬퍼
  const createDataPoint = useCallback((
    value: number, 
    quality?: Quality,
    label?: string
  ): ChartDataPoint => {
    return {
      timestamp: Date.now(),
      value: Number(value) || 0,
      quality: quality || 'good',
      label: label || undefined
    };
  }, []);

  // 아웃라이어 감지
  const isOutlier = useCallback((value: number, buffer: number[]): boolean => {
    if (!config.enableOutlierFilter || buffer.length < 10) return false;
    
    const mean = buffer.reduce((sum, val) => sum + val, 0) / buffer.length;
    const variance = buffer.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / buffer.length;
    const stdDev = Math.sqrt(variance);
    
    return Math.abs(value - mean) > (stdDev * config.outlierThreshold!);
  }, [config.enableOutlierFilter, config.outlierThreshold]);

  // 스무딩 함수
  const smoothValue = useCallback((newValue: number, lastValue: number | null): number => {
    if (!config.enableSmoothing || lastValue === null) {
      return newValue;
    }
    
    return lastValue + (newValue - lastValue) * config.smoothingFactor!;
  }, [config.enableSmoothing, config.smoothingFactor]);

  // 데이터 제한 함수
  const limitDataPoints = useCallback((data: ChartDataPoint[]): ChartDataPoint[] => {
    const now = Date.now();
    const timeLimit = now - (config.timeWindow! * 1000);
    
    // 시간 범위로 필터링
    let filtered = data.filter(point => point.timestamp > timeLimit);
    
    // 개수 제한
    if (filtered.length > config.maxDataPoints!) {
      filtered = filtered.slice(-config.maxDataPoints!);
    }
    
    return filtered;
  }, [config.maxDataPoints, config.timeWindow]);

  // 통계 계산
  const calculateStats = useCallback((data: ChartDataPoint[]) => {
    if (data.length === 0) return null;
    
    const values = data.map(d => d.value).filter(v => !isNaN(v));
    if (values.length === 0) return null;
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const avg = sum / values.length;
    const current = values[values.length - 1];
    
    return {
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      avg: Math.round(avg * 100) / 100,
      current: Math.round(current * 100) / 100
    };
  }, []);

  // 무게센서 데이터 업데이트
  useEffect(() => {
    if (!weightSensor || !weightSensor.weight) return;
    
    setIsUpdating(true);
    
    try {
      const rawValue = weightSensor.processed?.weight ?? weightSensor.weight ?? weightSensor.value;
      if (isNaN(rawValue)) {
        console.warn('Invalid weight value received:', rawValue);
        return;
      }

      // 아웃라이어 체크
      if (isOutlier(rawValue, weightBuffer.current)) {
        console.warn('Weight outlier detected, skipping:', rawValue);
        return;
      }

      // 스무딩 적용
      const smoothedValue = smoothValue(rawValue, lastWeightValue.current);
      lastWeightValue.current = smoothedValue;
      
      // 버퍼 업데이트
      weightBuffer.current.push(smoothedValue);
      if (weightBuffer.current.length > 50) {
        weightBuffer.current = weightBuffer.current.slice(-50);
      }
      
      const newPoint = createDataPoint(
        smoothedValue,
        weightSensor.quality,
        `${smoothedValue.toFixed(2)} ${weightSensor.unit}`
      );
      
      setWeightData(prev => {
        const updated = [...prev, newPoint];
        return limitDataPoints(updated);
      });
      
      setLastUpdate(new Date().toISOString());
      setError(null);
      
    } catch (error) {
      console.error('❌ Weight chart update error:', error);
      setError('무게 센서 차트 업데이트 실패');
    } finally {
      setIsUpdating(false);
    }
  }, [weightSensor, smoothValue, createDataPoint, limitDataPoints, isOutlier]);

  // 농도센서 데이터 업데이트
  useEffect(() => {
    if (!concentration || !concentration.targetValue) return;
    
    setIsUpdating(true);
    
    try {
      const rawValue = concentration.processed?.target ?? concentration.targetValue ?? concentration.value;
      if (isNaN(rawValue)) {
        console.warn('Invalid concentration value received:', rawValue);
        return;
      }

      // 아웃라이어 체크
      if (isOutlier(rawValue, concentrationBuffer.current)) {
        console.warn('Concentration outlier detected, skipping:', rawValue);
        return;
      }

      // 스무딩 적용
      const smoothedValue = smoothValue(rawValue, lastConcentrationValue.current);
      lastConcentrationValue.current = smoothedValue;
      
      // 버퍼 업데이트
      concentrationBuffer.current.push(smoothedValue);
      if (concentrationBuffer.current.length > 50) {
        concentrationBuffer.current = concentrationBuffer.current.slice(-50);
      }
      
      const newPoint = createDataPoint(
        smoothedValue,
        concentration.quality,
        `${smoothedValue.toFixed(1)} ${concentration.unit}`
      );
      
      setConcentrationData(prev => {
        const updated = [...prev, newPoint];
        return limitDataPoints(updated);
      });
      
      setLastUpdate(new Date().toISOString());
      setError(null);
      
    } catch (error) {
      console.error('❌ Concentration chart update error:', error);
      setError('농도 센서 차트 업데이트 실패');
    } finally {
      setIsUpdating(false);
    }
  }, [concentration, smoothValue, createDataPoint, limitDataPoints, isOutlier]);

  // 통계 자동 업데이트
  useEffect(() => {
    setWeightStats(calculateStats(weightData));
  }, [weightData, calculateStats]);

  useEffect(() => {
    setConcentrationStats(calculateStats(concentrationData));
  }, [concentrationData, calculateStats]);

  // MQTT 에러 처리
  useEffect(() => {
    if (mqttError) {
      setError(`MQTT 연결 오류: ${mqttError}`);
    }
  }, [mqttError]);

  // 연결 상태 변화 처리
  useEffect(() => {
    setIsLoading(!isConnected);
    if (!isConnected) {
      setIsUpdating(false);
    }
  }, [isConnected]);

  // 커스텀 데이터 포인트 추가
  const addCustomDataPoint = useCallback((key: string, point: ChartDataPoint) => {
    setCustomData(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(key) || [];
      const updated = [...existing, point];
      const limited = limitDataPoints(updated);
      newMap.set(key, limited);
      return newMap;
    });
  }, [limitDataPoints]);

  // 데이터 클리어
  const clearData = useCallback((dataKey?: string) => {
    if (dataKey) {
      switch (dataKey) {
        case 'weight':
          setWeightData([]);
          lastWeightValue.current = null;
          weightBuffer.current = [];
          break;
        case 'concentration':
          setConcentrationData([]);
          lastConcentrationValue.current = null;
          concentrationBuffer.current = [];
          break;
        case 'temperature':
          setTemperatureData([]);
          lastTemperatureValue.current = null;
          break;
        default:
          setCustomData(prev => {
            const newMap = new Map(prev);
            newMap.delete(dataKey);
            return newMap;
          });
      }
    } else {
      // 모든 데이터 클리어
      setWeightData([]);
      setConcentrationData([]);
      setTemperatureData([]);
      setCustomData(new Map());
      lastWeightValue.current = null;
      lastConcentrationValue.current = null;
      lastTemperatureValue.current = null;
      weightBuffer.current = [];
      concentrationBuffer.current = [];
    }
    
    setLastUpdate(new Date().toISOString());
  }, []);

  // 데이터 내보내기
  const exportData = useCallback((dataKey: string, format: 'json' | 'csv'): string => {
    let targetData: ChartDataPoint[] = [];
    
    switch (dataKey) {
      case 'weight':
        targetData = weightData;
        break;
      case 'concentration':
        targetData = concentrationData;
        break;
      case 'temperature':
        targetData = temperatureData;
        break;
      default:
        targetData = customData.get(dataKey) || [];
    }

    if (format === 'json') {
      return JSON.stringify({
        dataKey,
        exportTime: new Date().toISOString(),
        dataPoints: targetData,
        statistics: calculateStats(targetData)
      }, null, 2);
    } else if (format === 'csv') {
      const headers = 'timestamp,value,quality,label\n';
      const rows = targetData.map(point => 
        `${new Date(point.timestamp).toISOString()},${point.value},${point.quality || ''},${point.label || ''}`
      ).join('\n');
      return headers + rows;
    }
    
    return '';
  }, [weightData, concentrationData, temperatureData, customData, calculateStats]);

  // 설정 업데이트
  const updateConfig = useCallback((newConfig: Partial<RealtimeChartConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
    setLastUpdate(new Date().toISOString());
  }, []);

  return {
    // 차트 데이터
    weightData,
    concentrationData,
    temperatureData,
    customData,
    
    // 통합 데이터 (에러 해결용)
    data,
    
    // 상태
    isLoading,
    isUpdating,
    error,
    lastUpdate,
    
    // 통계
    weightStats,
    concentrationStats,
    
    // 제어 함수
    addCustomDataPoint,
    clearData,
    exportData,
    updateConfig,
  };
};

export default useRealtimeChart;
