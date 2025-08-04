class DataProcessor {
  constructor() {
    this.dataBuffer = new Map();
    this.dataHistory = new Map();
    this.maxHistorySize = 1000;
  }

  // ROS2 토픽 데이터 처리
  processROS2Topic(topicName, data) {
    const processedData = {
      topic: topicName,
      data: this.validateAndTransform(data),
      timestamp: new Date().toISOString(),
      sequence: this.getNextSequence(topicName)
    };

    this.storeData(topicName, processedData);
    return processedData;
  }

  // 센서 데이터 처리
  processSensorData(sensorType, rawData) {
    let processedData;

    switch (sensorType) {
      case 'weight':
        processedData = this.processWeightData(rawData);
        break;
      case 'concentration':
        processedData = this.processConcentrationData(rawData);
        break;
      case 'temperature':
        processedData = this.processTemperatureData(rawData);
        break;
      default:
        processedData = this.processGenericSensorData(rawData);
    }

    this.storeData(`sensor_${sensorType}`, processedData);
    return processedData;
  }

  // 로봇 상태 데이터 처리
  processRobotStatus(statusData) {
    const processedStatus = {
      robot_id: statusData.robot_id || 'unknown',
      joint_positions: this.validateJointPositions(statusData.joint_positions),
      joint_velocities: this.validateJointVelocities(statusData.joint_velocities),
      tcp_position: this.validateTcpPosition(statusData.tcp_position),
      robot_mode: statusData.robot_mode || 'unknown',
      safety_status: statusData.safety_status || 'unknown',
      timestamp: new Date().toISOString()
    };

    this.storeData('robot_status', processedStatus);
    return processedStatus;
  }

  // 무게 센서 데이터 처리
  processWeightData(rawData) {
    const unit = rawData.unit || 'kg';
    let weight = parseFloat(rawData.weight || 0);

    // g → kg 변환
    if (unit === 'g') {
      weight = weight / 1000;
    }

    return {
      weight: this.filterNoiseAndCalibrate(weight),
      unit: unit,
      calibrated: true,
      quality: this.assessDataQuality(weight * (unit === 'g' ? 1000 : 1)),
      timestamp: rawData.timestamp || new Date().toISOString()
    };
  }


  // 농도 센서 데이터 처리
  processConcentrationData(rawData) {
    const concentration = Math.max(0, Math.min(100, rawData.concentration || 0));
    
    return {
      concentration: concentration,
      unit: '%',
      target_concentration: rawData.target || 75.0,
      deviation: Math.abs(concentration - (rawData.target || 75.0)),
      quality: this.assessDataQuality(rawData.concentration),
      timestamp: new Date().toISOString()
    };
  }

  // 온도 센서 데이터 처리
  processTemperatureData(rawData) {
    return {
      temperature: rawData.temperature || 25.0,
      unit: '°C',
      quality: this.assessDataQuality(rawData.temperature),
      timestamp: new Date().toISOString()
    };
  }

  // 일반 센서 데이터 처리
  processGenericSensorData(rawData) {
    return {
      value: rawData.value || 0,
      unit: rawData.unit || '',
      quality: this.assessDataQuality(rawData.value),
      timestamp: new Date().toISOString()
    };
  }

  // 관절 위치 검증
  validateJointPositions(positions) {
    if (!Array.isArray(positions) || positions.length !== 6) {
      return [0, 0, 0, 0, 0, 0];
    }
    
    return positions.map(pos => {
      const angle = parseFloat(pos) || 0;
      return Math.max(-Math.PI, Math.min(Math.PI, angle));
    });
  }

  // 관절 속도 검증
  validateJointVelocities(velocities) {
    if (!Array.isArray(velocities) || velocities.length !== 6) {
      return [0, 0, 0, 0, 0, 0];
    }
    
    return velocities.map(vel => {
      const velocity = parseFloat(vel) || 0;
      return Math.max(-3.0, Math.min(3.0, velocity)); // 속도 제한
    });
  }

  // TCP 위치 검증
  validateTcpPosition(tcpPos) {
    if (!tcpPos || typeof tcpPos !== 'object') {
      return { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };
    }

    return {
      x: parseFloat(tcpPos.x) || 0,
      y: parseFloat(tcpPos.y) || 0,
      z: parseFloat(tcpPos.z) || 0,
      rx: parseFloat(tcpPos.rx) || 0,
      ry: parseFloat(tcpPos.ry) || 0,
      rz: parseFloat(tcpPos.rz) || 0
    };
  }

  // 데이터 검증 및 변환
  validateAndTransform(data) {
    if (typeof data !== 'object' || data === null) {
      return {};
    }

    // 기본적인 데이터 정제
    const cleaned = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== null && value !== undefined) {
        cleaned[key] = value;
      }
    }

    return cleaned;
  }

  // 노이즈 필터링 및 캘리브레이션
  filterNoiseAndCalibrate(value) {
    const numValue = parseFloat(value) || 0;
    
    // 간단한 노이즈 필터링 (실제로는 더 복잡한 필터링 적용)
    const filtered = Math.round(numValue * 100) / 100;
    
    return filtered;
  }

  // 데이터 품질 평가
  assessDataQuality(value) {
    if (value === null || value === undefined || isNaN(value)) {
      return 'poor';
    }

    const absValue = Math.abs(value);

    // → g 단위로 평가
    if (absValue > 50000) return 'poor';
    if (absValue > 20000) return 'fair';
    return 'good';
  }


  // 데이터 저장
  storeData(key, data) {
    // 현재 데이터 버퍼에 저장
    this.dataBuffer.set(key, data);

    // 히스토리에 추가
    if (!this.dataHistory.has(key)) {
      this.dataHistory.set(key, []);
    }

    const history = this.dataHistory.get(key);
    history.push(data);

    // 히스토리 크기 제한
    if (history.length > this.maxHistorySize) {
      history.shift();
    }
  }

  // 시퀀스 번호 생성
  getNextSequence(key) {
    const history = this.dataHistory.get(key) || [];
    return history.length;
  }

  // 현재 데이터 조회
  getCurrentData(key) {
    return this.dataBuffer.get(key);
  }

  // 히스토리 데이터 조회
  getHistoryData(key, limit = 100) {
    const history = this.dataHistory.get(key) || [];
    return history.slice(-limit);
  }

  // 모든 현재 데이터 조회
  getAllCurrentData() {
    const result = {};
    for (const [key, value] of this.dataBuffer.entries()) {
      result[key] = value;
    }
    return result;
  }
}

module.exports = DataProcessor;
