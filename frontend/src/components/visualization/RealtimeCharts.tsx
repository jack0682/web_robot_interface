/**
 * 실시간 데이터 차트 컴포넌트 - Recharts 기반 시계열 데이터 시각화
 */
import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar
} from 'recharts';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useMqttData } from '../../hooks/useMqttData';

interface ChartProps {
  data: any[];
  height?: number;
  title?: string;
  className?: string;
}

// 공통 차트 색상 팔레트
const COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', 
  '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'
];

// 시간 포맷터
const timeFormatter = (timestamp: number) => {
  return format(new Date(timestamp), 'HH:mm:ss', { locale: ko });
};

// 각도 포맷터 (도 단위)
const angleFormatter = (value: number) => `${value.toFixed(1)}°`;

// 속도 포맷터
const velocityFormatter = (value: number) => `${value.toFixed(2)} rad/s`;

// 토크 포맷터
const torqueFormatter = (value: number) => `${value.toFixed(2)} Nm`;

// 커스텀 툴팁
const CustomTooltip = ({ active, payload, label, labelFormatter, valueFormatter }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            <span className="font-medium">{entry.dataKey}:</span>{' '}
            <span className="font-mono">
              {valueFormatter ? valueFormatter(entry.value) : entry.value}
            </span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// 조인트 위치 차트
export const JointPositionChart: React.FC<ChartProps> = ({ 
  data, 
  height = 300, 
  title = "조인트 위치", 
  className = "" 
}) => {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={timeFormatter}
            stroke="#6b7280"
          />
          <YAxis 
            tickFormatter={angleFormatter}
            stroke="#6b7280"
          />
          <Tooltip 
            content={<CustomTooltip labelFormatter={timeFormatter} valueFormatter={angleFormatter} />}
          />
          <Legend />
          {Array.from({ length: 6 }, (_, i) => (
            <Line
              key={i}
              type="monotone"
              dataKey={`joint${i + 1}`}
              stroke={COLORS[i]}
              strokeWidth={2}
              dot={false}
              name={`Joint ${i + 1}`}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// 조인트 속도 차트
export const JointVelocityChart: React.FC<ChartProps> = ({ 
  data, 
  height = 300, 
  title = "조인트 속도", 
  className = "" 
}) => {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={timeFormatter}
            stroke="#6b7280"
          />
          <YAxis 
            tickFormatter={velocityFormatter}
            stroke="#6b7280"
          />
          <Tooltip 
            content={<CustomTooltip labelFormatter={timeFormatter} valueFormatter={velocityFormatter} />}
          />
          <Legend />
          {Array.from({ length: 6 }, (_, i) => (
            <Area
              key={i}
              type="monotone"
              dataKey={`joint${i + 1}_velocity`}
              stackId="1"
              stroke={COLORS[i]}
              fill={COLORS[i]}
              fillOpacity={0.3}
              name={`Joint ${i + 1} Velocity`}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// 토크 차트
export const TorqueChart: React.FC<ChartProps> = ({ 
  data, 
  height = 300, 
  title = "조인트 토크", 
  className = "" 
}) => {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={timeFormatter}
            stroke="#6b7280"
          />
          <YAxis 
            tickFormatter={torqueFormatter}
            stroke="#6b7280"
          />
          <Tooltip 
            content={<CustomTooltip labelFormatter={timeFormatter} valueFormatter={torqueFormatter} />}
          />
          <Legend />
          {Array.from({ length: 6 }, (_, i) => (
            <Bar
              key={i}
              dataKey={`joint${i + 1}_torque`}
              fill={COLORS[i]}
              name={`Joint ${i + 1} Torque`}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// 로봇 상태 파이 차트
export const RobotStatusPieChart: React.FC<{ statusData: any }> = ({ statusData }) => {
  const data = [
    { name: '정상', value: statusData.normal || 0, color: '#10b981' },
    { name: '경고', value: statusData.warning || 0, color: '#f59e0b' },
    { name: '오류', value: statusData.error || 0, color: '#ef4444' },
    { name: '정지', value: statusData.stopped || 0, color: '#6b7280' }
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        시스템 상태 분포
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

// 원형 게이지 차트 (로봇 성능 지표)
export const PerformanceRadialChart: React.FC<{ performanceData: any }> = ({ performanceData }) => {
  const data = [
    { name: 'CPU', value: performanceData.cpu || 0, fill: '#3b82f6' },
    { name: 'Memory', value: performanceData.memory || 0, fill: '#10b981' },
    { name: 'Network', value: performanceData.network || 0, fill: '#f59e0b' },
    { name: 'Storage', value: performanceData.storage || 0, fill: '#ef4444' }
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        시스템 성능
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="90%" data={data}>
          <RadialBar
            startAngle={15}
            label={{ position: 'insideStart', fill: '#fff' }}
            background
            dataKey="value"
          />
          <Legend iconSize={10} layout="vertical" verticalAlign="middle" align="right" />
          <Tooltip formatter={(value) => [`${value}%`, '사용률']} />
        </RadialBarChart>
      </ResponsiveContainer>
    </div>
  );
};

// 실시간 다중 라인 차트
export const RealtimeMultiChart: React.FC = () => {
  const mqttData = useMqttData();
  const { sensorData } = mqttData;
  const jointData = (mqttData as any).jointData || [];
  const [selectedMetrics, setSelectedMetrics] = useState(['joint1', 'joint2', 'joint3']);
  
  const chartData = useMemo(() => {
    // 실시간 데이터를 차트 형식으로 변환
    return jointData.slice(-50).map((item: any, index: number) => ({
      timestamp: Date.now() - (50 - index) * 1000,
      joint1: item.positions?.[0] || 0,
      joint2: item.positions?.[1] || 0,
      joint3: item.positions?.[2] || 0,
      joint4: item.positions?.[3] || 0,
      joint5: item.positions?.[4] || 0,
      joint6: item.positions?.[5] || 0,
      temperature: ((sensorData as any)[index])?.temperature || 20,
      vibration: ((sensorData as any)[index])?.vibration || 0
    }));
  }, [jointData, sensorData]);

  const toggleMetric = (metric: string) => {
    setSelectedMetrics(prev => 
      prev.includes(metric) 
        ? prev.filter(m => m !== metric)
        : [...prev, metric]
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          실시간 멀티 메트릭
        </h3>
        <div className="flex flex-wrap gap-2">
          {['joint1', 'joint2', 'joint3', 'joint4', 'joint5', 'joint6', 'temperature', 'vibration'].map((metric) => (
            <button
              key={metric}
              onClick={() => toggleMetric(metric)}
              className={`px-3 py-1 text-xs rounded ${
                selectedMetrics.includes(metric)
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {metric}
            </button>
          ))}
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={timeFormatter}
            stroke="#6b7280"
          />
          <YAxis stroke="#6b7280" />
          <Tooltip 
            content={<CustomTooltip labelFormatter={timeFormatter} />}
          />
          <Legend />
          
          {selectedMetrics.map((metric, index) => (
            <Line
              key={metric}
              type="monotone"
              dataKey={metric}
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={2}
              dot={false}
              name={metric.toUpperCase()}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default {
  JointPositionChart,
  JointVelocityChart,
  TorqueChart,
  RobotStatusPieChart,
  PerformanceRadialChart,
  RealtimeMultiChart
};