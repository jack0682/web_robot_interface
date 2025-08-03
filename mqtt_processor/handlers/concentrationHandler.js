/**
 * 농도 제어 핸들러
 * 웹에서 설정한 목표 농도 처리
 */
class ConcentrationHandler {
  constructor(logger, dataBuffer) {
    this.logger = logger;
    this.dataBuffer = dataBuffer;
    this.stats = {
      totalProcessed: 0,
      currentTarget: 0,
      lastUpdate: null,
      setBy: null
    };
    this.history = [];
  }

  handle(data) {
    try {
      this.stats.totalProcessed++;
      this.stats.lastUpdate = new Date().toISOString();

      let target = 0;
      let source = 'unknown';

      // 데이터 파싱
      if (typeof data === 'number') {
        target = data;
      } else if (typeof data === 'string') {
        target = parseFloat(data);
      } else if (data && typeof data === 'object') {
        target = parseFloat(data.target || data.concentration || data.value || 0);
        source = data.source || 'web';
      }

      // 유효성 검사
      if (isNaN(target) || target < 0 || target > 100) {
        throw new Error(`Invalid concentration target: ${target}`);
      }

      // 목표값 업데이트
      this.stats.currentTarget = target;
      this.stats.setBy = source;

      // 히스토리 저장
      this.history.push({
        target,
        source,
        timestamp: new Date().toISOString()
      });
      if (this.history.length > 50) {
        this.history.shift();
      }

      this.logger.info(`🎯 Concentration target set to ${target}% by ${source}`);

      return {
        success: true,
        target: target,
        source: source,
        unit: 'percent'
      };
    } catch (error) {
      this.logger.error('❌ Concentration handler error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  setTarget(value, source = 'api') {
    return this.handle({ target: value, source: source });
  }

  getCurrentTarget() {
    return {
      target: this.stats.currentTarget,
      setBy: this.stats.setBy,
      lastUpdate: this.stats.lastUpdate
    };
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
      currentTarget: 0,
      lastUpdate: null,
      setBy: null
    };
    this.history = [];
  }
}

module.exports = ConcentrationHandler;