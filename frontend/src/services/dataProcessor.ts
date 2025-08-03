/**
 * 데이터 처리 서비스 - 완전 재구축
 * MQTT로 수신된 원시 데이터를 UI에서 사용 가능한 형태로 변환
 */
import { 
  MqttMessage, 
  ROS2TopicListMessage, 
  WeightSensorMessage, 
  ConcentrationMessage,
  RobotControlMessage 
} from '../types/mqttTypes';
import { 
  RobotState, 
  WeightSensorData, 
  ConcentrationSensorData,
  Timestamp 
} from '../types/robotTypes';

class DataProcessorService {
  private dataHistory: Map<string, any[]> = new Map();
  private maxHistorySize = 1000;
  private validationRules = {
    weight: { min: -10, max: 200 },
    concentration: { min: 0, max: 100 },
    temperature: { min: -50, max: 150 },
    pressure: { min: 0, max: 10 }
  };

  /**
   * ROS2 토픽 리스트 데이터 처리
   */
  public processROS2TopicList(message: MqttMessage): ROS2TopicListMessage | null {
    try {
      if (message.topic !== 'ros2_topic_list' || !message.data) {
        return null;
      }

      const data = message.data;
      
      // 데이터 구조 검증
      if (!data.categorized || !data.analysis) {
        console.warn('⚠️ Invalid ROS2 topic list structure');
        return null;
      }

      const processed: ROS2TopicListMessage = {
        total: data.total || 0,
        categories: {
          robotControl: this.ensureArray(data.categorized.robotControl),
          robotStatus: this.ensureArray(data.categorized.robotStatus),
          navigation: this.ensureArray(data.categorized.navigation),
          diagnostics: this.ensureArray(data.categorized.diagnostics),
          system: this.ensureArray(data.categorized.system),
          other: this.ensureArray(data.categorized.other)
        },
        changes: {
          added: this.ensureArray(data.changes?.added),
          removed: this.ensureArray(data.changes?.removed)
        },
        health: {
          status: this.normalizeHealthStatus(data.analysis?.status),
          issues: this.ensureArray(data.analysis?.issues),
          recommendations: this.ensureArray(data.analysis?.recommendations)
        },
        timestamp: message.timestamp
      };

      this.addToHistory('ros2_topics', processed);
      return processed;

    } catch (error) {
      console.error('❌ ROS2 토픽 리스트 처리 오류:', error);
      return null;
    }
  }

  /**
   * 무게센서 데이터 처리
   */
  public processWeightSensorData(message: MqttMessage): WeightSensorData | null {
    try {
      if (message.topic !== 'topic' || !message.data) {
        return null;
      }

      const data = message.data;
      const processed = data.processed || data;

      const weightData: WeightSensorData = {
        id: 'weight_sensor_01',
        name: 'Arduino Weight Sensor',
        type: 'weight',
        value: this.safeNumber(processed.weight || processed.value || 0),
        unit: 'kg',
        quality: this.normalizeQuality(processed.quality || 'good'),
        timestamp: message.timestamp,
        status: this.normalizeStatus(processed.status, 'normal') as 'normal' | 'warning' | 'error',
        connected: true,
        lastUpdate: message.timestamp,
        weight: this.safeNumber(processed.weight || processed.value || 0),
        rawValue: this.safeNumber(data.original || processed.weight || 0),
        calibrated: true,
        config: {
          minValue: -1.0,
          maxValue: 100.0,
          precision: 2,
          calibrationOffset: 0,
          noiseThreshold: 0.01
        }
      };

      // 통계 계산
      const history = this.getHistory('weight_sensor');
      if (history.length > 10) {
        const values = history.slice(-10).map(h => h.weight);
        (weightData as any).stats = this.calculateStats(values);
      }

      this.addToHistory('weight_sensor', weightData);
      return weightData;

    } catch (error) {
      console.error('❌ 무게센서 데이터 처리 오류:', error);
      return null;
    }
  }

  /**
   * 농도센서 데이터 처리
   */
  public processConcentrationData(message: MqttMessage): ConcentrationSensorData | null {
    try {
      if (message.topic !== 'web/target_concentration' || !message.data) {
        return null;
      }

      const data = message.data;
      const processed = data.processed || data;

      const concentrationData: ConcentrationSensorData = {
        id: 'concentration_sensor_01',
        name: 'Concentration Controller',
        type: 'concentration',
        value: this.safeNumber(processed.target || processed.value || 75.0),
        unit: '%',
        quality: this.normalizeQuality(processed.quality || 'good'),
        timestamp: message.timestamp,
        status: this.normalizeStatus(processed.status, 'normal') as 'normal' | 'warning' | 'error',
        connected: true,
        lastUpdate: message.timestamp,
        currentValue: this.safeNumber(processed.current || 75.0),
        targetValue: this.safeNumber(processed.target || processed.value || 75.0),
        tolerance: 2.0,
        config: {
          minValue: 0,
          maxValue: 100,
          precision: 1,
          responseTime: 30,
          controlEnabled: true
        }
      };

      // 제어 히스토리 추가
      if (processed.source) {
        this.updateControlHistory('concentration', {
          timestamp: message.timestamp,
          targetValue: concentrationData.targetValue,
          actualValue: concentrationData.currentValue || 0,
          adjustment: Math.abs(concentrationData.targetValue - (concentrationData.currentValue || 0)),
          source: processed.source
        });
      }

      this.addToHistory('concentration', concentrationData);
      return concentrationData;

    } catch (error) {
      console.error('❌ 농도센서 데이터 처리 오류:', error);
      return null;
    }
  }

  /**
   * 로봇 제어 명령 데이터 처리
   */
  public processRobotControlData(message: MqttMessage): RobotControlMessage | null {
    try {
      if (!message.topic?.includes('robot/control/') || !message.data) {
        return null;
      }

      const data = message.data;
      
      const controlMessage: RobotControlMessage = {
        topic: message.topic,
        command_type: this.normalizeCommandType(data.command_type) as any,
        original: data.original || data,
        validation: {
          status: (this.normalizeStatus(data.validation?.status, 'unknown') === 'unknown' ? 'rejected' : this.normalizeStatus(data.validation?.status, 'unknown')) as 'accepted' | 'rejected',
          reason: data.validation?.reason,
          validated_data: data.validation?.validated_data,
          safety_checks: this.ensureArray(data.validation?.safety_checks),
          warnings: this.ensureArray(data.validation?.warnings)
        },
        timestamp: message.timestamp,
        safety_level: this.normalizeSafetyLevel(data.safety_level)
      };

      this.addToHistory('robot_commands', controlMessage);
      return controlMessage;

    } catch (error) {
      console.error('❌ 로봇 제어 데이터 처리 오류:', error);
      return null;
    }
  }

  /**
   * 로봇 상태 데이터 구성 (ROS2 토픽에서)
   */
  public buildRobotState(ros2Data: ROS2TopicListMessage): Partial<RobotState> {
    try {
      const robotState: Partial<RobotState> = {
        status: this.inferRobotStatus(ros2Data),
        lastUpdate: ros2Data.timestamp,
        connectionQuality: this.inferConnectionQuality(ros2Data),
        isConnected: ros2Data.total > 0
      };

      // 가용 토픽에 따른 상태 추론
      if (ros2Data.categories.robotStatus.some(topic => topic.includes('joint_states'))) {
        robotState.isMoving = false; // 기본값
      }

      if (ros2Data.categories.diagnostics.length > 0) {
        robotState.errorCodes = ros2Data.health.issues;
      }

      // 안전 상태 추론
      if (ros2Data.health.status === 'error' || ros2Data.health.issues.length > 0) {
        robotState.safetyStatus = 'warning';
      } else {
        robotState.safetyStatus = 'normal';
      }

      return robotState;

    } catch (error) {
      console.error('❌ 로봇 상태 구성 오류:', error);
      return {};
    }
  }

  /**
   * 센서 시스템 상태 구성
   */
  public buildSensorSystemState(sensors: any[]): any {
    const connectedSensors = sensors.filter(s => s.connected);
    const activeSensors = sensors.filter(s => s.connected && !s.errorStatus);
    const errorSensors = sensors.filter(s => s.errorStatus);

    let systemHealth: 'healthy' | 'warning' | 'error' | 'critical' = 'healthy';
    
    if (errorSensors.length > 0) {
      systemHealth = 'error';
    } else if (connectedSensors.length < sensors.length) {
      systemHealth = 'warning';
    }

    return {
      sensors: new Map(sensors.map(s => [s.id, s])),
      totalSensors: sensors.length,
      connectedSensors: connectedSensors.length,
      activeSensors: activeSensors.length,
      errorSensors: errorSensors.length,
      lastUpdate: new Date().toISOString(),
      systemHealth
    };
  }

  /**
   * 실시간 차트 데이터 포맷
   */
  public formatChartData(sensorId: string, timeRange: number = 300): any[] {
    const history = this.getHistory(sensorId);
    const now = Date.now();
    const cutoff = now - (timeRange * 1000); // timeRange in seconds

    return history
      .filter(item => {
        const timestamp = new Date(item.timestamp || item.lastUpdate).getTime();
        return timestamp > cutoff;
      })
      .map(item => ({
        timestamp: new Date(item.timestamp || item.lastUpdate).getTime(),
        value: item.value || item.weight || item.targetValue || 0,
        quality: item.quality || 'good',
        label: `${item.value || item.weight || item.targetValue || 0} ${item.unit || ''}`
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * 데이터 검증
   */
  public validateSensorData(data: any, sensorType: string): boolean {
    try {
      switch (sensorType) {
        case 'weight':
          return this.validateValue(data.value || data.weight, 'weight');
        
        case 'concentration':
          return this.validateValue(data.targetValue || data.value, 'concentration');
        
        case 'temperature':
          return this.validateValue(data.value, 'temperature');
        
        case 'pressure':
          return this.validateValue(data.value, 'pressure');
        
        default:
          return true;
      }
    } catch (error) {
      console.error('❌ 센서 데이터 검증 오류:', error);
      return false;
    }
  }

  /**
   * 배치 데이터 처리
   */
  public processBatchMessages(messages: MqttMessage[]): {
    ros2Topics: ROS2TopicListMessage[];
    weightSensors: WeightSensorData[];
    concentrations: ConcentrationSensorData[];
    robotCommands: RobotControlMessage[];
  } {
    const results = {
      ros2Topics: [] as ROS2TopicListMessage[],
      weightSensors: [] as WeightSensorData[],
      concentrations: [] as ConcentrationSensorData[],
      robotCommands: [] as RobotControlMessage[]
    };

    for (const message of messages) {
      try {
        // 메시지 타입에 따른 처리
        if (message.topic === 'ros2_topic_list') {
          const processed = this.processROS2TopicList(message);
          if (processed) results.ros2Topics.push(processed);
        }
        else if (message.topic === 'topic') {
          const processed = this.processWeightSensorData(message);
          if (processed) results.weightSensors.push(processed);
        }
        else if (message.topic === 'web/target_concentration') {
          const processed = this.processConcentrationData(message);
          if (processed) results.concentrations.push(processed);
        }
        else if (message.topic?.includes('robot/control/')) {
          const processed = this.processRobotControlData(message);
          if (processed) results.robotCommands.push(processed);
        }
      } catch (error) {
        console.error('❌ 배치 메시지 처리 오류:', message.topic, error);
      }
    }

    console.log('📦 배치 처리 완료:', {
      ros2Topics: results.ros2Topics.length,
      weightSensors: results.weightSensors.length,
      concentrations: results.concentrations.length,
      robotCommands: results.robotCommands.length
    });

    return results;
  }

  /**
   * 유틸리티 메서드들
   */
  private ensureArray(value: any): string[] {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return [value];
    return [];
  }

  private extractNumericValue(obj: any, keys: string[], defaultValue: number = 0): number {
    for (const key of keys) {
      const value = obj?.[key];
      if (typeof value === 'number' && !isNaN(value)) {
        return value;
      }
    }
    return defaultValue;
  }

  private validateValue(value: number, type: keyof typeof this.validationRules): boolean {
    const rules = this.validationRules[type];
    if (!rules) return true;
    return typeof value === 'number' && 
           !isNaN(value) && 
           value >= rules.min && 
           value <= rules.max;
  }

  private normalizeQuality(quality: any): 'excellent' | 'good' | 'fair' | 'poor' | 'error' {
    const qualityMap: { [key: string]: 'excellent' | 'good' | 'fair' | 'poor' | 'error' } = {
      'excellent': 'excellent',
      'good': 'good',
      'fair': 'fair',
      'filtered': 'fair',
      'poor': 'poor',
      'warning': 'poor',
      'error': 'error'
    };
    return qualityMap[String(quality).toLowerCase()] || 'good';
  }

  private normalizeUnit(unit: any, defaultUnit: string): string {
    return typeof unit === 'string' ? unit : defaultUnit;
  }

  private normalizeStatus(status: any, defaultStatus: string): string {
    return typeof status === 'string' ? status : defaultStatus;
  }

  private normalizeHealthStatus(status: any): 'healthy' | 'warning' | 'error' {
    const statusMap: { [key: string]: 'healthy' | 'warning' | 'error' } = {
      'healthy': 'healthy',
      'good': 'healthy',
      'ok': 'healthy',
      'warning': 'warning',
      'warn': 'warning',
      'error': 'error',
      'critical': 'error',
      'fail': 'error'
    };
    return statusMap[String(status).toLowerCase()] || 'warning';
  }

  private normalizeCommandType(commandType: any): string {
    const typeMap: { [key: string]: string } = {
      'move_joint': 'move_joint',
      'move_linear': 'move_linear',
      'move_circular': 'move_circular',
      'stop': 'stop',
      'emergency_stop': 'emergency_stop',
      'home': 'home',
      'set_speed': 'set_speed',
      'set_mode': 'set_mode',
      'calibrate': 'calibrate'
    };
    return typeMap[String(commandType).toLowerCase()] || 'unknown';
  }

  private normalizeSafetyLevel(level: any): 'critical' | 'normal' | 'safe' | 'low' | 'blocked' | 'unknown' {
    const levelMap: { [key: string]: 'critical' | 'normal' | 'safe' | 'low' | 'blocked' | 'unknown' } = {
      'critical': 'critical',
      'high': 'critical',
      'normal': 'normal',
      'medium': 'normal',
      'safe': 'safe',
      'low': 'low',
      'blocked': 'blocked',
      'unknown': 'unknown'
    };
    return levelMap[String(level).toLowerCase()] || 'unknown';
  }

  private safeNumber(value: any): number {
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  }

  private inferRobotStatus(ros2Data: ROS2TopicListMessage): 'idle' | 'moving' | 'error' | 'disconnected' {
    if (ros2Data.health.status === 'error' || ros2Data.health.issues.length > 0) {
      return 'error';
    }
    
    if (ros2Data.total === 0) {
      return 'disconnected';
    }
    
    if (ros2Data.categories.robotControl.length > 0) {
      return 'idle'; // 제어 토픽이 있으면 준비 상태
    }
    
    return 'idle';
  }

  private inferConnectionQuality(ros2Data: ROS2TopicListMessage): 'excellent' | 'good' | 'poor' | 'disconnected' {
    if (ros2Data.total === 0) return 'disconnected';
    if (ros2Data.total > 10 && ros2Data.health.status === 'healthy') return 'excellent';
    if (ros2Data.total > 5) return 'good';
    return 'poor';
  }

  private calculateStats(values: number[]) {
    if (values.length === 0) return undefined;
    
    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const average = sum / values.length;
    
    const variance = values.reduce((acc, val) => acc + Math.pow(val - average, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);

    return {
      average: Math.round(average * 100) / 100,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      standardDeviation: Math.round(standardDeviation * 100) / 100,
      sampleCount: values.length
    };
  }

  private updateControlHistory(sensorId: string, entry: any): void {
    const historyKey = `${sensorId}_control_history`;
    if (!this.dataHistory.has(historyKey)) {
      this.dataHistory.set(historyKey, []);
    }
    
    const history = this.dataHistory.get(historyKey)!;
    history.push(entry);
    
    // 최근 50개만 유지
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
  }

  private addToHistory(key: string, data: any): void {
    if (!this.dataHistory.has(key)) {
      this.dataHistory.set(key, []);
    }
    
    const history = this.dataHistory.get(key)!;
    history.push({
      ...data,
      _processedAt: new Date().toISOString()
    });
    
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize);
    }
  }

  private getHistory(key: string): any[] {
    return this.dataHistory.get(key) || [];
  }

  /**
   * 공개 API
   */
  public getDataHistory(key: string, count?: number): any[] {
    const history = this.getHistory(key);
    return count ? history.slice(-count) : history;
  }

  public clearHistory(key?: string): void {
    if (key) {
      this.dataHistory.delete(key);
      console.log('🧹 히스토리 삭제:', key);
    } else {
      this.dataHistory.clear();
      console.log('🧹 전체 히스토리 삭제');
    }
  }

  public getHistoryStats(): { [key: string]: number } {
    const stats: { [key: string]: number } = {};
    this.dataHistory.forEach((value, key) => {
      stats[key] = value.length;
    });
    return stats;
  }

  public getProcessingStats(): {
    totalProcessed: number;
    successRate: number;
    errorCount: number;
    lastProcessedAt: Timestamp;
  } {
    const totalItems = Array.from(this.dataHistory.values())
      .reduce((sum, arr) => sum + arr.length, 0);
    
    return {
      totalProcessed: totalItems,
      successRate: totalItems > 0 ? 0.95 : 0, // 임시 통계
      errorCount: 0, // 구현 필요 시 에러 카운터 추가
      lastProcessedAt: new Date().toISOString()
    };
  }

  public exportData(format: 'json' | 'csv' = 'json'): string {
    const data = {
      exportTimestamp: new Date().toISOString(),
      historyStats: this.getHistoryStats(),
      processingStats: this.getProcessingStats(),
      data: Object.fromEntries(this.dataHistory)
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else {
      // CSV 형태로 변환 (간단한 구현)
      let csv = 'Type,Count,LastUpdate\n';
      Object.entries(this.getHistoryStats()).forEach(([key, count]) => {
        csv += `${key},${count},${new Date().toISOString()}\n`;
      });
      return csv;
    }
  }
}

export default DataProcessorService;