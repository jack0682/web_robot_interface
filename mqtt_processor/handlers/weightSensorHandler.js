/**
 * 무게센서 핸들러
 * 아두이노에서 오는 무게센서 데이터 처리
 */
class WeightSensorHandler {
  constructor(logger, dataBuffer) {
    this.logger = logger;
    this.dataBuffer = dataBuffer;
    this.lastWeight = 0;
    this.weightHistory = [];
    this.maxHistorySize = 100;
    
    // 무게센서 설정
    this.config = {
      minWeight: -1.0,
      maxWeight: 100.0,
      noiseThreshold: 0.01,
      stabilityThreshold: 0.05,
      calibrationOffset: 0.0,
      unit: 'kg'
    };
  }

  /**
   * 무게센서 데이터 처리
   */
  handle(data) {
    try {
      const weightValue = this.extractWeightValue(data);
      const processedWeight = this.processWeight(weightValue);
      
      // 히스토리 업데이트
      this.updateHistory(processedWeight);
      
      const result = {
        original: data,
        weight: processedWeight.value,
        unit: this.config.unit,
        status: processedWeight.status,
        quality: processedWeight.quality,
        stability: this.calculateStability(),
        timestamp: new Date().toISOString(),
        processing_info: {
          raw_input: weightValue,
          filtered: processedWeight.filtered,
          calibrated: processedWeight.calibrated
        }
      };

      this.lastWeight = processedWeight.value;
      
      this.logger.debug(`⚖️  Weight: ${processedWeight.value}${this.config.unit} (${processedWeight.status})`);
      
      return result;
      
    } catch (error) {
      this.logger.error('❌ Error processing weight data:', error);
      return {
        error: error.message,
        original: data,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 데이터에서 무게 값 추출
   */
  extractWeightValue(data) {
    let weightValue = 0;

    if (typeof data === 'number') {
      weightValue = data;
    } else if (typeof data === 'string') {
      // 문자열에서 숫자 추출
      const numMatch = data.match(/[\d.-]+/);
      if (numMatch) {
        weightValue = parseFloat(numMatch[0]) || 0;
      }
    } else if (typeof data === 'object' && data !== null) {
      // 객체에서 무게 값 찾기
      if (data.weight !== undefined) {
        weightValue = parseFloat(data.weight) || 0;
      } else if (data.value !== undefined) {
        weightValue = parseFloat(data.value) || 0;
      } else if (data.data !== undefined) {
        weightValue = parseFloat(data.data) || 0;
      } else if (data.payload !== undefined) {
        weightValue = parseFloat(data.payload) || 0;
      } else if (data.kg !== undefined) {
        weightValue = parseFloat(data.kg) || 0;
      }
    }

    return weightValue;
  }

  /**
   * 무게 데이터 처리 및 필터링
   */
  processWeight(rawValue) {
    let processed = rawValue;
    let status = 'normal';
    let quality = 'good';
    let filtered = false;
    let calibrated = false;

    // 캘리브레이션 적용
    processed += this.config.calibrationOffset;
    if (this.config.calibrationOffset !== 0) {
      calibrated = true;
    }

    // 범위 검증
    if (processed < this.config.minWeight || processed > this.config.maxWeight) {
      this.logger.warn(`⚠️  Weight ${processed} out of range [${this.config.minWeight}, ${this.config.maxWeight}]`);
      processed = Math.max(this.config.minWeight, Math.min(this.config.maxWeight, processed));
      quality = 'clamped';
      filtered = true;
    }

    // 노이즈 필터링 (라운딩)
    const rounded = Math.round(processed * 100) / 100;
    if (Math.abs(rounded - processed) > this.config.noiseThreshold) {
      filtered = true;
    }
    processed = rounded;

    // 상태 분류
    if (processed < 0.1) {
      status = 'empty';
    } else if (processed > 50) {
      status = 'heavy';
    } else if (processed > 30) {
      status = 'loaded';
    } else {
      status = 'light';
    }

    // 품질 평가
    if (quality === 'good') {
      const stability = this.calculateStability();
      if (stability < 0.5) {
        quality = 'unstable';
      } else if (Math.abs(processed - this.lastWeight) > 5.0) {
        quality = 'sudden_change';
      }
    }

    return {
      value: processed,
      status,
      quality,
      filtered,
      calibrated
    };
  }

  /**
   * 무게 안정성 계산
   */
  calculateStability() {
    if (this.weightHistory.length < 5) {
      return 1.0; // 데이터가 부족하면 안정적이라고 가정
    }

    const recent = this.weightHistory.slice(-5);
    const mean = recent.reduce((sum, w) => sum + w, 0) / recent.length;
    const variance = recent.reduce((sum, w) => sum + Math.pow(w - mean, 2), 0) / recent.length;
    const stdDev = Math.sqrt(variance);

    // 표준편차가 작을수록 안정적
    const stability = Math.max(0, 1 - (stdDev / this.config.stabilityThreshold));
    return Math.round(stability * 100) / 100;
  }

  /**
   * 무게 히스토리 업데이트
   */
  updateHistory(processedWeight) {
    this.weightHistory.push(processedWeight.value);
    
    if (this.weightHistory.length > this.maxHistorySize) {
      this.weightHistory.shift();
    }
  }

  /**
   * 캘리브레이션 설정
   */
  setCalibration(offset) {
    this.config.calibrationOffset = parseFloat(offset) || 0;
    this.logger.info(`⚖️  Weight calibration set to ${this.config.calibrationOffset}kg`);
  }

  /**
   * 영점 조정 (현재 무게를 0으로 설정)
   */
  zeroCalibration() {
    this.config.calibrationOffset = -this.lastWeight;
    this.logger.info(`⚖️  Zero calibration applied: offset = ${this.config.calibrationOffset}kg`);
  }

  /**
   * 통계 정보 반환
   */
  getStats() {
    const stability = this.calculateStability();
    const avgWeight = this.weightHistory.length > 0 
      ? this.weightHistory.reduce((sum, w) => sum + w, 0) / this.weightHistory.length 
      : 0;

    return {
      current_weight: this.lastWeight,
      average_weight: Math.round(avgWeight * 100) / 100,
      stability: stability,
      data_points: this.weightHistory.length,
      calibration_offset: this.config.calibrationOffset,
      last_update: new Date().toISOString()
    };
  }

  /**
   * 무게 히스토리 조회
   */
  getHistory(count = 10) {
    return this.weightHistory.slice(-count).map((weight, index) => ({
      value: weight,
      timestamp: new Date(Date.now() - (count - index - 1) * 1000).toISOString()
    }));
  }

  /**
   * 설정 업데이트
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('⚖️  Weight sensor configuration updated');
  }
}

module.exports = WeightSensorHandler;
