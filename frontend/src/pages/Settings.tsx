/**
 * 설정 페이지
 * 시스템 설정과 환경 구성을 관리하는 페이지
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings as SettingsIcon,
  Wifi,
  Bot,
  Bell,
  Palette,
  Shield,
  Database,
  Save,
  RotateCcw
} from 'lucide-react';
import toast from 'react-hot-toast';

// 컴포넌트
import ConnectionSettings from '../components/settings/ConnectionSettings';
import RobotSettings from '../components/settings/RobotSettings';
import NotificationSettings from '../components/settings/NotificationSettings';
import ThemeSettings from '../components/settings/ThemeSettings';
import SecuritySettings from '../components/settings/SecuritySettings';
import DataSettings from '../components/settings/DataSettings';

const Settings: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('connection');
  const [hasChanges, setHasChanges] = useState(false);

  const sections = [
    { id: 'connection', label: '연결 설정', icon: Wifi },
    { id: 'robot', label: '로봇 설정', icon: Bot },
    { id: 'notifications', label: '알림 설정', icon: Bell },
    { id: 'theme', label: '테마 설정', icon: Palette },
    { id: 'security', label: '보안 설정', icon: Shield },
    { id: 'data', label: '데이터 설정', icon: Database },
  ];

  const handleSave = async () => {
    try {
      // 설정 저장 로직
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('설정이 저장되었습니다');
      setHasChanges(false);
    } catch (error) {
      toast.error('설정 저장에 실패했습니다');
    }
  };

  const handleReset = () => {
    if (window.window.window.window.confirm('모든 설정을 초기값으로 되돌리시겠습니까?')) {
      toast.success('설정이 초기화되었습니다');
      setHasChanges(false);
    }
  };

  const renderSettingsContent = () => {
    switch (activeSection) {
      case 'connection':
        return <ConnectionSettings onChange={() => setHasChanges(true)} />;
      case 'robot':
        return <RobotSettings onChange={() => setHasChanges(true)} />;
      case 'notifications':
        return <NotificationSettings onChange={() => setHasChanges(true)} />;
      case 'theme':
        return <ThemeSettings onChange={() => setHasChanges(true)} />;
      case 'security':
        return <SecuritySettings onChange={() => setHasChanges(true)} />;
      case 'data':
        return <DataSettings onChange={() => setHasChanges(true)} />;
      default:
        return <ConnectionSettings onChange={() => setHasChanges(true)} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 헤더 */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                설정
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                시스템 설정과 환경을 구성합니다
              </p>
            </div>

            <div className="flex items-center space-x-3">
              {hasChanges && (
                <span className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
                  저장되지 않은 변경사항이 있습니다
                </span>
              )}
              
              <button
                onClick={handleReset}
                className="flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                초기화
              </button>

              <button
                onClick={handleSave}
                disabled={!hasChanges}
                className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
              >
                <Save className="w-4 h-4 mr-2" />
                저장
              </button>
            </div>
          </div>
        </div>

        {/* 메인 레이아웃 */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 사이드바 */}
          <div className="lg:col-span-1">
            <nav className="space-y-2">
              {sections.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                    activeSection === id
                      ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {label}
                </button>
              ))}
            </nav>
          </div>

          {/* 설정 콘텐츠 */}
          <div className="lg:col-span-3">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-lg"
            >
              {renderSettingsContent()}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;