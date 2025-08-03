// Jest 테스트 설정
export {};

// Mock WebSocket
(global as any).WebSocket = class WebSocket {
  static CLOSED = 3;
  static CLOSING = 2;
  static CONNECTING = 0;
  static OPEN = 1;
  
  constructor() {
    this.readyState = 0;
  }
  
  readyState: number;
  
  close() {}
  send() {}
  addEventListener() {}
  removeEventListener() {}
} as any;

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: (() => {}) as any,
    setItem: (() => {}) as any,
    removeItem: (() => {}) as any,
    clear: (() => {}) as any,
  },
  writable: true,
});
