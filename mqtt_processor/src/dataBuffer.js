const EventEmitter = require('events');

class DataBuffer extends EventEmitter {
  constructor(maxSize = 1000) {
    super();
    this.buffers = new Map();
    this.maxSize = maxSize;
    this.timestamps = new Map();
  }

  addData(topic, data) {
    // 토픽별 버퍼 초기화
    if (!this.buffers.has(topic)) {
      this.buffers.set(topic, []);
      this.timestamps.set(topic, []);
    }

    const buffer = this.buffers.get(topic);
    const timestamps = this.timestamps.get(topic);

    // 데이터 추가
    buffer.push(data);
    timestamps.push(Date.now());

    // 버퍼 크기 제한
    if (buffer.length > this.maxSize) {
      buffer.shift();
      timestamps.shift();
    }

    // 이벤트 발생
    this.emit('data', topic, data);
    this.emit(`data:${topic}`, data);
  }

  getData(topic, count = 1) {
    const buffer = this.buffers.get(topic);
    if (!buffer || buffer.length === 0) {
      return [];
    }

    return buffer.slice(-count);
  }

  getLatestData(topic) {
    const buffer = this.buffers.get(topic);
    if (!buffer || buffer.length === 0) {
      return null;
    }

    return buffer[buffer.length - 1];
  }

  getAllTopics() {
    return Array.from(this.buffers.keys());
  }

  getTopicStats(topic) {
    const buffer = this.buffers.get(topic);
    const timestamps = this.timestamps.get(topic);

    if (!buffer || buffer.length === 0) {
      return {
        count: 0,
        firstTimestamp: null,
        lastTimestamp: null,
        dataRate: 0
      };
    }

    const now = Date.now();
    const firstTimestamp = timestamps[0];
    const lastTimestamp = timestamps[timestamps.length - 1];
    const timeSpan = lastTimestamp - firstTimestamp;
    const dataRate = timeSpan > 0 ? (buffer.length / (timeSpan / 1000)) : 0;

    return {
      count: buffer.length,
      firstTimestamp: new Date(firstTimestamp).toISOString(),
      lastTimestamp: new Date(lastTimestamp).toISOString(),
      dataRate: Math.round(dataRate * 100) / 100 // Hz
    };
  }

  clearTopic(topic) {
    this.buffers.delete(topic);
    this.timestamps.delete(topic);
  }

  clearAll() {
    this.buffers.clear();
    this.timestamps.clear();
  }

  // 실시간 데이터 스트림을 위한 메서드
  getRealtimeStream(topic, callback) {
    const handler = (data) => callback(data);
    this.on(`data:${topic}`, handler);
    
    // 구독 해제를 위한 함수 반환
    return () => {
      this.off(`data:${topic}`, handler);
    };
  }

  // 데이터 필터링
  getFilteredData(topic, filter) {
    const buffer = this.buffers.get(topic);
    if (!buffer) {
      return [];
    }

    return buffer.filter(filter);
  }

  // 시간 범위로 데이터 조회
  getDataByTimeRange(topic, startTime, endTime) {
    const buffer = this.buffers.get(topic);
    const timestamps = this.timestamps.get(topic);

    if (!buffer || !timestamps) {
      return [];
    }

    const result = [];
    for (let i = 0; i < buffer.length; i++) {
      if (timestamps[i] >= startTime && timestamps[i] <= endTime) {
        result.push(buffer[i]);
      }
    }

    return result;
  }
}

module.exports = DataBuffer;
