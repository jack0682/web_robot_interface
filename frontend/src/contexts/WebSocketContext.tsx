/**
 * WebSocket 컨텍스트 - 완전 재구축
 * 새로운 통합 타입 시스템과 완벽하게 호환
 */
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { 
  MqttMessage, 
  ConnectionStatus, 
  Timestamp,
  WebSocketConfig 
} from '../types/robotTypes';
import config from '../config';

interface WebSocketContextType {
  // 연결 상태
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  connectionAttempts: number;
  
  // 메시지
  lastMessage: MqttMessage | null;
  messageCount: number;
  
  // 구독 상태
  subscriptions: string[];
  
  // 통계
  uptime: number;
  lastActivity: Timestamp | null;
  errorCount: number;
  
  // 제어 함수
  sendMessage: (message: any) => Promise<boolean>;
  subscribeToTopic: (topic: string) => void;
  unsubscribeFromTopic: (topic: string) => void;
  reconnect: () => void;
  
  // 유틸리티
  getConnectionInfo: () => {
    url: string;
    readyState: number;
    uptime: number;
    messageCount: number;
  };
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const useWebSocket = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
};

interface Props {
  children: React.ReactNode;
}

export const WebSocketProvider: React.FC<Props> = ({ children }) => {
  // 연결 상태
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  
  // 메시지 상태
  const [lastMessage, setLastMessage] = useState<MqttMessage | null>(null);
  const [messageCount, setMessageCount] = useState(0);
  
  // 구독 및 통계
  const [subscriptions, setSubscriptions] = useState<string[]>([]);
  const [lastActivity, setLastActivity] = useState<Timestamp | null>(null);
  const [errorCount, setErrorCount] = useState(0);
  
  // 내부 상태
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subscriptionsRef = useRef<Set<string>>(new Set());
  const startTimeRef = useRef<number>(Date.now());
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 설정 (타입 안전성 확보)
  const wsConfig: WebSocketConfig = config.websocket;

  // 메시지 업데이트 헬퍼
  const updateActivity = useCallback(() => {
    const now = new Date().toISOString();
    setLastActivity(now);
    setMessageCount(prev => prev + 1);
  }, []);

  // WebSocket 연결 함수
  const connect = useCallback(() => {
    try {
      // 이미 연결되어 있으면 스킵
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log('⚠️  WebSocket 이미 연결됨 - 스킵');
        return;
      }
      
      // 연결 시도 중이면 스킵
      if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
        console.log('⚠️  WebSocket 연결 시도 중 - 스킵');
        return;
      }

      // 기존 연결이 있으면 정리
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      console.log('🔌 WebSocket 연결 시도:', wsConfig.url);
      setConnectionStatus('connecting');
      
      const ws = new WebSocket(wsConfig.url);
      
      ws.onopen = () => {
        console.log('✅ WebSocket 연결 성공');
        setIsConnected(true);
        setConnectionStatus('connected');
        setConnectionAttempts(0);
        setErrorCount(0);
        updateActivity();
        
        toast.success('실시간 연결 성공');

        // 연결 확인 메시지 전송 (지연 후)
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            const connectionMessage = {
              type: 'connection',
              clientId: `dashboard_${Date.now()}`,
              timestamp: new Date().toISOString(),
              userAgent: navigator.userAgent
            };
            
            ws.send(JSON.stringify(connectionMessage));
          }
        }, 100); // 100ms 지연

        // 기존 구독 재설정
        subscriptionsRef.current.forEach(topic => {
          ws.send(JSON.stringify({
            type: 'subscribe',
            topic: topic,
            timestamp: new Date().toISOString()
          }));
        });

        // 핑 인터벌 시작
        startPingInterval();
      };

      ws.onmessage = (event) => {
        try {
          const rawMessage = JSON.parse(event.data);
          const message: MqttMessage = {
            type: rawMessage.type || 'message',
            topic: rawMessage.topic,
            data: rawMessage.data || rawMessage,
            timestamp: rawMessage.timestamp || new Date().toISOString(),
            qos: rawMessage.qos || 0
          };
          
          setLastMessage(message);
          updateActivity();
          
          console.log('📨 WebSocket 메시지 수신:', {
            type: message.type,
            topic: message.topic,
            timestamp: message.timestamp
          });

          // 특별한 메시지 타입 처리
          handleSpecialMessages(message);
          
        } catch (error) {
          console.error('❌ WebSocket 메시지 파싱 실패:', error);
          setErrorCount(prev => prev + 1);
        }
      };

      ws.onerror = (error) => {
        console.error('🚨 WebSocket 오류:', error);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        setErrorCount(prev => prev + 1);
        toast.error('WebSocket 연결 오류 발생');
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket 연결 해제:', event.code, event.reason);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        stopPingInterval();
        
        // 예상되지 않은 종료인 경우에만 재연결 시도
        // 1000 = 정상 종료, 1001 = going away, 1006 = abnormal closure
        if (event.code !== 1000 && event.code !== 1001 && event.code !== 1005) {
          // 재연결 시도 제한
          if (connectionAttempts < wsConfig.maxReconnectAttempts) {
            scheduleReconnect();
          } else {
            console.log('⚠️  최대 재연결 시도 횟수 초과');
          }
        }
      };

      wsRef.current = ws;
      
    } catch (error) {
      console.error('❌ WebSocket 연결 실패:', error);
      setIsConnected(false);
      setConnectionStatus('disconnected');
      setErrorCount(prev => prev + 1);
      scheduleReconnect();
    }
  }, [wsConfig.url, updateActivity]);

  // 특별한 메시지 처리
  const handleSpecialMessages = useCallback((message: MqttMessage) => {
    switch (message.type) {
      case 'error':
        toast.error(`오류: ${message.data?.message || '알 수 없는 오류'}`, {
          duration: 5000,
          icon: '❌'
        });
        break;
        
      case 'emergency':
        toast.error('🚨 비상 상황 발생!', { 
          duration: 10000,
          icon: '🚨'
        });
        break;
        
      case 'connection':
        console.log('🔗 연결 확인:', message.data);
        break;
        
      case 'pong':
        console.log('🏓 Pong 수신');
        break;
        
      case 'subscription_confirmed':
        console.log('📡 구독 확인:', message.topic);
        if (message.topic) {
          setSubscriptions(prev => [...new Set([...prev, message.topic!])]);
        }
        break;
        
      default:
        // 일반 메시지는 별도 처리 없음
        break;
    }
  }, []);

  // 핑 인터벌 시작
  const startPingInterval = useCallback(() => {
    if (pingIntervalRef.current) return;
    
    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'ping',
          timestamp: new Date().toISOString()
        }));
      }
    }, wsConfig.pingInterval || 30000);
  }, [wsConfig.pingInterval]);

  // 핑 인터벌 중지
  const stopPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  // 재연결 스케줄링
  const scheduleReconnect = useCallback(() => {
    // 이미 연결되어 있으면 스킵
    if (isConnected) {
      console.log('⚠️  이미 연결됨 - 재연결 스킵');
      return;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    setConnectionAttempts(prev => {
      const newAttempts = prev + 1;
      
      if (newAttempts <= wsConfig.maxReconnectAttempts) {
        const delay = Math.min(wsConfig.reconnectDelay * Math.pow(1.5, newAttempts - 1), 15000); // 지수 백오프 감소
        
        console.log(`🔄 ${delay}ms 후 재연결 시도 (${newAttempts}/${wsConfig.maxReconnectAttempts})`);
        setConnectionStatus('connecting');
        
        reconnectTimeoutRef.current = setTimeout(() => {
          // 재연결 시도 전 상태 재확인
          if (!isConnected) {
            connect();
          }
        }, delay);
        
        if (newAttempts === 1) {
          toast.error('연결이 끊어졌습니다. 재연결 시도 중...');
        }
      } else {
        toast.error('재연결에 실패했습니다. 페이지를 새로고침하세요.', {
          duration: 10000
        });
        setConnectionStatus('disconnected');
      }
      
      return newAttempts;
    });
  }, [connect, wsConfig.maxReconnectAttempts, wsConfig.reconnectDelay, isConnected]);

  // 메시지 전송
  const sendMessage = useCallback(async (message: any): Promise<boolean> => {
    return new Promise((resolve) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          const fullMessage = {
            ...message,
            timestamp: new Date().toISOString(),
            clientId: `dashboard_${Date.now()}`
          };
          
          wsRef.current.send(JSON.stringify(fullMessage));
          updateActivity();
          console.log('📤 WebSocket 메시지 전송:', fullMessage.type);
          resolve(true);
        } catch (error) {
          console.error('❌ 메시지 전송 실패:', error);
          setErrorCount(prev => prev + 1);
          resolve(false);
        }
      } else {
        console.warn('⚠️ WebSocket 연결되지 않음. 메시지 전송 불가:', message);
        toast('⚠️ 연결이 끊어져 메시지를 전송할 수 없습니다.', {
          icon: '⚠️',
          style: {
            background: '#FEF3CD',
            color: '#92400E',
          },
        });
        resolve(false);
      }
    });
  }, [updateActivity]);

  // 토픽 구독
  const subscribeToTopic = useCallback((topic: string) => {
    subscriptionsRef.current.add(topic);
    
    sendMessage({
      type: 'subscribe',
      topic: topic
    });
    
    console.log('📡 토픽 구독:', topic);
  }, [sendMessage]);

  // 토픽 구독 해제
  const unsubscribeFromTopic = useCallback((topic: string) => {
    subscriptionsRef.current.delete(topic);
    
    sendMessage({
      type: 'unsubscribe',
      topic: topic
    });
    
    setSubscriptions(prev => prev.filter(t => t !== topic));
    console.log('📡 토픽 구독 해제:', topic);
  }, [sendMessage]);

  // 수동 재연결
  const reconnect = useCallback(() => {
    console.log('🔄 수동 재연결 시도');
    setConnectionAttempts(0);
    setErrorCount(0);
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    connect();
  }, [connect]);

  // 연결 정보 조회
  const getConnectionInfo = useCallback(() => {
    return {
      url: wsConfig.url,
      readyState: wsRef.current?.readyState || WebSocket.CLOSED,
      uptime: Date.now() - startTimeRef.current,
      messageCount: messageCount
    };
  }, [wsConfig.url, messageCount]);

  // 업타임 계산
  const uptime = isConnected ? Date.now() - startTimeRef.current : 0;

  // 초기 연결 및 정리
  useEffect(() => {
    // 중복 연결 방지를 위한 플래그
    let isInitialized = false;
    
    const initializeConnection = () => {
      if (!isInitialized) {
        isInitialized = true;
        console.log('🚀 WebSocket 초기화 시작');
        connect();
      }
    };
    
    // 약간의 지연 후 연결 (React StrictMode 대응)
    const initTimer = setTimeout(initializeConnection, 250);

    return () => {
      isInitialized = false;
      clearTimeout(initTimer);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (wsRef.current) {
        console.log('🔌 WebSocket 정리 중...');
        wsRef.current.close(1000); // 정상 종료 코드
      }
    };
  }, []); // 빈 의존성 배열로 한 번만 실행

  // 브라우저 가시성 API 활용
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && !isConnected) {
        console.log('🔍 탭 활성화됨, 연결 확인...');
        reconnect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isConnected, reconnect]);

  // 온라인/오프라인 감지
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 네트워크 복원');
      if (!isConnected) {
        reconnect();
      }
    };

    const handleOffline = () => {
      console.log('📴 네트워크 오프라인');
      toast('📴 네트워크 연결이 끊어졌습니다.', {
        icon: '📴',
        style: {
          background: '#FEF3CD',
          color: '#92400E',
        },
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isConnected, reconnect]);

  const contextValue: WebSocketContextType = {
    // 연결 상태
    isConnected,
    connectionStatus,
    connectionAttempts,
    
    // 메시지
    lastMessage,
    messageCount,
    
    // 구독 상태
    subscriptions,
    
    // 통계
    uptime,
    lastActivity,
    errorCount,
    
    // 제어 함수
    sendMessage,
    subscribeToTopic,
    unsubscribeFromTopic,
    reconnect,
    
    // 유틸리티
    getConnectionInfo
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

export default WebSocketProvider;