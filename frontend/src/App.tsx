/**
 * React 기반 로봇 웹 대시보드 메인 컴포넌트
 * MQTT + HTTP API 통합 실시간 로봇 제어 인터페이스
 */
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// 컨텍스트 및 훅
import { WebSocketProvider } from './contexts/WebSocketContext';
import { RobotStateProvider } from './contexts/RobotStateContext';
import { MqttProvider } from './contexts/MqttContext';
import { ThemeProvider } from './contexts/ThemeContext';

// 레이아웃 컴포넌트
import MainLayout from './components/layout/MainLayout';
import LoadingScreen from './components/common/LoadingScreen';
import ErrorBoundary from './components/common/ErrorBoundary';

// 페이지 컴포넌트
import Dashboard from './pages/Dashboard';
import RobotControl from './pages/RobotControl';
import SensorMonitoring from './pages/SensorMonitoring';
import DataVisualization from './pages/DataVisualization';
import Settings from './pages/Settings';
import ScrollTestPage from './components/debug/ScrollTestPage';

// 스타일
import './styles/globals.css';
import './styles/components.css';
import './styles/dashboard.css';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [systemReady, setSystemReady] = useState(false);

  // 시스템 초기화 확인
  useEffect(() => {
    const initializeSystem = async () => {
      try {
        // 백엔드 헬스체크
        const response = await fetch('/health');
        const healthData = await response.json();
        
        if (healthData.status === 'healthy') {
          setSystemReady(true);
        } else {
          console.warn('System not fully ready:', healthData);
          setSystemReady(false);
        }
      } catch (error) {
        console.error('Failed to initialize system:', error);
        setSystemReady(false);
      } finally {
        setIsLoading(false);
      }
    };

    initializeSystem();
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <RobotStateProvider>
          <MqttProvider>
            <WebSocketProvider>
              <Router>
                <div className="App flex-1 bg-gray-50 dark:bg-gray-900 transition-colors flex flex-col">
                  {/* 전역 알림 */}
                  <Toaster
                    position="top-right"
                    toastOptions={{
                      duration: 4000,
                      style: {
                        background: '#363636',
                        color: '#fff',
                      },
                      success: {
                        duration: 3000,
                        iconTheme: {
                          primary: '#10b981',
                          secondary: '#fff',
                        },
                      },
                      error: {
                        duration: 5000,
                        iconTheme: {
                          primary: '#ef4444',
                          secondary: '#fff',
                        },
                      },
                    }}
                  />

                  {/* 시스템 상태 알림 */}
                  {!systemReady && (
                    <div className="bg-yellow-500 text-white text-center py-2 text-sm z-50 flex-shrink-0">
                      ⚠️ 시스템이 완전히 준비되지 않았습니다. 일부 기능이 제한될 수 있습니다.
                    </div>
                  )}

                  <div className="flex-1 flex flex-col min-h-0">
                    <Routes>
                      <Route path="/" element={<MainLayout />}>
                        {/* 메인 대시보드 */}
                        <Route index element={<Dashboard />} />
                        
                        {/* 로봇 제어 */}
                        <Route path="robot" element={<RobotControl />} />
                        
                        {/* 센서 모니터링 */}
                        <Route path="sensors" element={<SensorMonitoring />} />
                        
                        {/* 데이터 시각화 */}
                        <Route path="data" element={<DataVisualization />} />
                        
                        {/* 설정 */}
                        <Route path="settings" element={<Settings />} />
                        
                        {/* 스크롤 테스트 */}
                        <Route path="scroll-test" element={<ScrollTestPage />} />
                      </Route>
                    </Routes>
                  </div>
                </div>
              </Router>
            </WebSocketProvider>
          </MqttProvider>
        </RobotStateProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
