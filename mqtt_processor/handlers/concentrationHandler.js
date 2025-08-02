/**
 * 농도 제어 핸들러
 * 웹에서 오는 목표 농도 설정 처리
 */
class ConcentrationHandler {
  constructor(logger, dataBuffer) {
    this.logger = logger;
    this.dataBuffer = dataBuffer;
    this.currentTarget = 75.0;
    this.concentrationHistory = [];
    this.maxHistorySize = 50;
    
    // 농도 제어 설정
    this.config = {
      minConcentration: 0,
      maxConcentration: 100,
      defaultTarget: 75.0,
      tolerance: 2.0,
      alarmDeviation: 10.0,
      unit: '%',
      decimalPlaces: 1
    };
  }

  /**
   * 목표 농도 설정 처리
   */
  handle(data) {
    try {
      const targetValue = this.extractTargetValue(data);
      const processedTarget = this.processTarget(targetValue, data);
      
      // 히스토리 업데이트
      this.updateHistory(processedTarget);
      
      const result = {
        original: data,
        target: processedTarget.value,
        unit: this.config.unit,
        source: processedTarget.source,
        status: processedTarget.status,
        valid: processedTarget.valid,
        timestamp: new Date().toISOString(),
        processing_info: {
          raw_input: targetValue,
          clamped: processedTarget.clamped,
          previous_target: this.currentTarget
        }
      };

      // 현재 목표값 업데이트
      this.currentTarget = processedTarget.value;
      
      this.logger.info(`🎯 Target concentration: ${processedTarget.value}% (source: ${processedTarget.source})`);
      
      if (processedTarget.clamped) {
        this.logger.warn(`⚠️  Target clamped from ${targetValue} to ${processedTarget.value}`);
      }

      return result;
      
    } catch (error) {
      this.logger.error('❌ Error processing concentration target:', error);
      return {
        error: error.message,
        original: data,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 데이터에서 목표값 추출
   */
  extractTargetValue(data) {
    let targetValue = this.config.defaultTarget;

    if (typeof data === 'number') {
      targetValue = data;
    } else if (typeof data === 'string') {
      targetValue = parseFloat(data) || this.config.defaultTarget;
    } else if (typeof data === 'object' && data !== null) {
      if (data.target !== undefined) {
        targetValue = parseFloat(data.target) || this.config.defaultTarget;
      } else if (data.value !== undefined) {
        targetValue = parseFloat(data.value) || this.config.defaultTarget;
      } else if (data.concentration !== undefined) {
        targetValue = parseFloat(data.concentration) || this.config.defaultTarget;
      } else if (data.setpoint !== undefined) {
        targetValue = parseFloat(data.setpoint) || this.config.defaultTarget;
      }
    }

    return targetValue;
  }

  /**
   * 목표값 처리 및 검증
   */
  processTarget(rawValue, originalData) {
    let processed = rawValue;
    let status = 'valid';
    let source = 'unknown';
    let clamped = false;

    // 소스 정보 추출
    if (typeof originalData === 'object' && originalData !== null) {
      source = originalData.source || originalData.sender || originalData.client || 'web_dashboard';
    } else {
      source = 'direct_value';
    }

    // 범위 검증 및 클램핑
    const originalValue = processed;
    processed = Math.max(this.config.minConcentration, Math.min(this.config.maxConcentration, processed));
    
    if (processed !== originalValue) {
      clamped = true;
      status = 'clamped';
    }

    // 소수점 자릿수 제한
    processed = Math.round(processed * Math.pow(10, this.config.decimalPlaces)) / Math.pow(10, this.config.decimalPlaces);

    // 상태 분류
    if (processed === this.currentTarget) {
      status = 'unchanged';
    } else if (Math.abs(processed - this.currentTarget) > this.config.alarmDeviation) {
      status = 'major_change';
    } else if (Math.abs(processed - this.currentTarget) > this.config.tolerance) {
      status = 'minor_change';
    }

    return {
      value: processed,
      status,
      source,
      valid: !clamped,
      clamped
    };
  }

  /**
   * 농도 히스토리 업데이트
   */
  updateHistory(processedTarget) {
    this.concentrationHistory.push({
      target: processedTarget.value,
      source: processedTarget.source,
      timestamp: new Date().toISOString()
    });
    
    if (this.concentrationHistory.length > this.maxHistorySize) {
      this.concentrationHistory.shift();
    }
  }

  /**
   * 농도 제어 명령 생성
   */
  generateControlCommand(targetValue, source = 'mqtt_processor') {
    const command = {
      command: 'set_target_concentration',
      target: targetValue,
      unit: this.config.unit,
      tolerance: this.config.tolerance,
      source: source,
      timestamp: new Date().toISOString(),
      parameters: {
        alarm_deviation: this.config.alarmDeviation,
        decimal_places: this.config.decimalPlaces
      }
    };

    this.logger.info(`📤 Generated concentration control command: ${targetValue}%`);
    return command;
  }

  /**
   * 농도 제어 응답 생성
   */
  generateResponse(success, target, message = '') {
    const response = {
      success: success,
      target: target,
      unit: this.config.unit,
      message: message || (success ? `Target concentration set to ${target}%` : 'Failed to set target concentration'),
      timestamp: new Date().toISOString(),
      current_settings: {
        target: this.currentTarget,
        tolerance: this.config.tolerance,
        alarm_deviation: this.config.alarmDeviation
      }
    };

    return response;
  }

  /**
   * 현재 농도와 목표값 비교
   */
  compareWithCurrent(currentConcentration) {
    const deviation = Math.abs(currentConcentration - this.currentTarget);
    const percentDeviation = (deviation / this.currentTarget) * 100;
    
    let status = 'normal';
    if (deviation > this.config.alarmDeviation) {
      status = 'alarm';
    } else if (deviation > this.config.tolerance) {
      status = 'warning';
    }

    return {
      current: currentConcentration,
      target: this.currentTarget,
      deviation: Math.round(deviation * 100) / 100,
      percent_deviation: Math.round(percentDeviation * 100) / 100,
      status: status,
      within_tolerance: deviation <= this.config.tolerance
    };
  }

  /**
   * 통계 정보 반환
   */
  getStats() {
    const recentChanges = this.concentrationHistory.slice(-10);
    const sources = [...new Set(recentChanges.map(h => h.source))];
    
    return {
      current_target: this.currentTarget,
      unit: this.config.unit,
      tolerance: this.config.tolerance,
      alarm_deviation: this.config.alarmDeviation,
      recent_changes: recentChanges.length,
      active_sources: sources,
      last_update: this.concentrationHistory.length > 0 
        ? this.concentrationHistory[this.concentrationHistory.length - 1].timestamp 
        : null
    };
  }

  /**
   * 농도 히스토리 조회
   */
  getHistory(count = 10) {
    return this.concentrationHistory.slice(-count);
  }

  /**
   * 설정 업데이트
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('🎯 Concentration handler configuration updated');
  }

  /**
   * 목표값 직접 설정
   */
  setTarget(value, source = 'manual') {
    const data = {
      target: value,
      source: source
    };
    
    return this.handle(data);
  }

  /**
   * 현재 목표값 조회
   */
  getCurrentTarget() {
    return {
      target: this.currentTarget,
      unit: this.config.unit,
      tolerance: this.config.tolerance,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = ConcentrationHandler;
