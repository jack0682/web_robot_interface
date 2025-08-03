/**
 * 데이터 시각화 페이지
 * 고급 차트와 분석 도구를 제공하는 페이지
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  LineChart, 
  PieChart, 
  TrendingUp,
  Calendar,
  Download,
  Settings
} from 'lucide-react';

// 컴포넌트
import AdvancedChart from '../components/visualization/AdvancedChart';
import DataAnalytics from '../components/visualization/DataAnalytics';
import CustomChartBuilder from '../components/visualization/CustomChartBuilder';

const DataVisualization: React.FC = () => {
  const [activeView, setActiveView] = useState<'charts' | 'analytics' | 'custom'>('charts');

  const views = [
    { id: 'charts', label: '차트', icon: BarChart3 },
    { id: 'analytics', label: '분석', icon: TrendingUp },
    { id: 'custom', label: '사용자 정의', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 헤더 */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                데이터 시각화
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                고급 차트와 분석 도구로 데이터를 시각화합니다
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <button className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                <Download className="w-4 h-4 mr-2" />
                리포트 생성
              </button>
            </div>
          </div>
        </div>

        {/* 뷰 탭 */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="-mb-px flex space-x-8">
            {views.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveView(id as any)}
                className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeView === id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* 뷰 콘텐츠 */}
        <motion.div
          key={activeView}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          {activeView === 'charts' && <AdvancedChart />}
          {activeView === 'analytics' && <DataAnalytics />}
          {activeView === 'custom' && <CustomChartBuilder />}
        </motion.div>
      </div>
    </div>
  );
};

export default DataVisualization;