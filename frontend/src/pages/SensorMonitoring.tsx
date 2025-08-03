/**
 * 센서 모니터링 페이지
 * 실시간 센서 데이터를 모니터링하고 분석하는 인터페이스
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Download, 
  Filter, 
  RefreshCw,
  AlertCircle,
  Thermometer,
  Weight,
  Gauge
} from 'lucide-react';

// 컴포넌트
import SensorDataGrid from '../components/visualization/SensorDataGrid';
import RealtimeChart from '../components/visualization/RealtimeChart';
import SensorHistoryChart from '../components/visualization/SensorHistoryChart';
import SensorAlerts from '../components/monitoring/SensorAlerts';
import DataExportPanel from '../components/monitoring/DataExportPanel';

// 훅
import { useMqttData } from '../hooks/useMqttData';
import { useRealtimeChart } from '../hooks/useRealtimeChart';

// 유틸리티 함수들
const getWeightValue = (data: any): number => {
  if (typeof data === 'number') return data;
  if (data && typeof data.weight === 'number') return data.weight;
  if (data && typeof data.value === 'number') return data.value;
  return 0;
};

const getConcentrationValue = (data: any): number => {
  if (typeof data === 'number') return data;
  if (data && typeof data.targetValue === 'number') return data.targetValue;
  if (data && typeof data.value === 'number') return data.value;
  return 0;
};

const getTemperatureValue = (data: any): number => {
  if (typeof data === 'number') return data;
  if (data && typeof data.temperature === 'number') return data.temperature;
  return 20;
};

const SensorMonitoring: React.FC = () => {
  const { sensorData, connectionStatus, lastUpdate } = useMqttData();
  const { data: chartData, isLoading: chartLoading } = useRealtimeChart();
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('1h');
  const [showExportPanel, setShowExportPanel] = useState(false);

  const timeRanges = [
    { value: '1h', label: '1시간' },
    { value: '6h', label: '6시간' },
    { value: '24h', label: '24시간' },
    { value: '7d', label: '7일' },
  ];

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleExport = () => {
    setShowExportPanel(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 헤더 */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                센서 모니터링
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                실시간 센서 데이터를 모니터링하고 분석합니다
              </p>
            </div>

            <div className="flex items-center space-x-3">
              {/* 시간 범위 선택 */}
              <select
                value={selectedTimeRange}
                onChange={(e) => setSelectedTimeRange(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {timeRanges.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              {/* 새로고침 버튼 */}
              <button
                onClick={handleRefresh}
                className="flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                새로고침
              </button>

              {/* 데이터 내보내기 */}
              <button
                onClick={handleExport}
                className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                내보내기
              </button>
            </div>
          </div>
        </div>

        {/* 연결 상태 */}
        <div className="mb-6">
          <div className={`flex items-center px-4 py-3 rounded-lg ${
            connectionStatus === 'connected'
              ? 'bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800'
          }`}>
            <div className={`w-3 h-3 rounded-full mr-3 ${
              connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <span className={connectionStatus === 'connected' 
              ? 'text-green-800 dark:text-green-200' 
              : 'text-red-800 dark:text-red-200'
            }>
              센서 데이터 연결: {connectionStatus === 'connected' ? '정상' : '끊어짐'}
            </span>
            {lastUpdate && (
              <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
                마지막 업데이트: {new Date(lastUpdate).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* 센서 알림 */}
        <div className="mb-6">
          <SensorAlerts />
        </div>

        {/* 현재 센서 값 */}
        <div className="mb-6">
          <SensorDataGrid />
        </div>

        {/* 차트 섹션 */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          {/* 실시간 차트 */}
          <div>
            <RealtimeChart />
          </div>

          {/* 히스토리 차트 */}
          <div>
            <SensorHistoryChart timeRange={selectedTimeRange} />
          </div>
        </div>

        {/* 상세 분석 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 무게 센서 상세 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6"
          >
            <div className="flex items-center mb-4">
              <Weight className="w-6 h-6 text-blue-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                무게 센서
              </h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">현재 값</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {getWeightValue(sensorData.weight).toFixed(2) || '--'} kg
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">최대 값</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {Math.max(...(chartData?.map(d => d.weight || 0) || [0])).toFixed(2)} kg
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">평균 값</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {(chartData?.reduce((sum, d) => sum + (d.weight || 0), 0) / (chartData?.length || 1)).toFixed(2)} kg
                </span>
              </div>
            </div>
          </motion.div>

          {/* 농도 센서 상세 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6"
          >
            <div className="flex items-center mb-4">
              <Gauge className="w-6 h-6 text-green-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                농도 센서
              </h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">현재 값</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {getConcentrationValue(sensorData.concentration).toFixed(2) || '--'} ppm
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">최대 값</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {Math.max(...(chartData?.map(d => d.concentration || 0) || [0])).toFixed(2)} ppm
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">경고 임계값</span>
                <span className="font-semibold text-red-600 dark:text-red-400">
                  1000 ppm
                </span>
              </div>
            </div>
          </motion.div>

          {/* 온도 센서 상세 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6"
          >
            <div className="flex items-center mb-4">
              <Thermometer className="w-6 h-6 text-orange-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                온도 센서
              </h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">현재 값</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {getTemperatureValue(sensorData.temperature).toFixed(1) || '--'} °C
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">최대 값</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {Math.max(...(chartData?.map(d => d.temperature || 0) || [0])).toFixed(1)} °C
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">권장 범위</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  20-25 °C
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* 데이터 내보내기 패널 */}
      {showExportPanel && (
        <DataExportPanel 
          onClose={() => setShowExportPanel(false)}
          timeRange={selectedTimeRange}
        />
      )}
    </div>
  );
};

export default SensorMonitoring;