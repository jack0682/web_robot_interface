/**
 * 무게 센서 핸들러
 * 아두이노 무게센서 데이터 처리
 */
class WeightSensorHandler {
  constructor(logger, dataBuffer) {
    this.logger = logger;
    this.dataBuffer = dataBuffer;
    this.stats = {
      totalProcessed: 0,
      averageWeight: 0,
      minWeight: null,
      maxWeight: null,
      calibrationOffset: 0,
      lastUpdate: null
    };
    this.history = [];
  }

  handle(data) {
    try {
      this.stats.totalProcessed++;
      this.stats.lastUpdate = new Date().toISOString();

      let weight = 0;
      
      // 데이터 파싱
      if (typeof data === 'number') {
        weight = data;
      } else if (typeof data === 'string') {
        weight = parseFloat(data);
      } else if (data && typeof data === 'object' && data.weight !== undefined) {
        weight = parseFloat(data.weight);
      }

      // 캘리브레이션 적용
      weight += this.stats.calibrationOffset;

      // 통계 업데이트
      this.updateStats(weight);

      // 히스토리 저장 (최대 100개)
      this.history.push({
        weight,
        timestamp: new Date().toISOString()
      });
      if (this.history.length > 100) {
        this.history.shift();
      }

      this.logger.debug(`⚖️  Weight sensor: ${weight.toFixed(2)}g`);

      return {
        success: true,
        weight: weight,
        calibrated: true,
        unit: 'grams'
      };
    } catch (error) {
      this.logger.error('❌ Weight sensor handler error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  updateStats(weight) {
    // 평균 계산
    if (this.stats.totalProcessed === 1) {
      this.stats.averageWeight = weight;
      this.stats.minWeight = weight;
      this.stats.maxWeight = weight;
    } else {
      this.stats.averageWeight = 
        (this.stats.averageWeight * (this.stats.totalProcessed - 1) + weight) / this.stats.totalProcessed;
      this.stats.minWeight = Math.min(this.stats.minWeight, weight);
      this.stats.maxWeight = Math.max(this.stats.maxWeight, weight);
    }
  }

  setCalibration(offset) {
    this.stats.calibrationOffset = offset;
    this.logger.info(`⚖️  Weight sensor calibration set to ${offset}g`);
  }

  zeroCalibration() {
    if (this.history.length > 0) {
      const lastWeight = this.history[this.history.length - 1].weight;
      this.stats.calibrationOffset = -lastWeight;
      this.logger.info(`⚖️  Weight sensor zeroed (offset: ${this.stats.calibrationOffset}g)`);
    }
  }

  getStats() {
    return this.stats;
  }

  getHistory(count = 10) {
    return this.history.slice(-count);
  }

  reset() {
    this.stats = {
      totalProcessed: 0,
      averageWeight: 0,
      minWeight: null,
      maxWeight: null,
      calibrationOffset: 0,
      lastUpdate: null
    };
    this.history = [];
  }
}

module.exports = WeightSensorHandler;