/**
 * 연결 상태 표시 컴포넌트
 */
import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon, CheckCircle, XCircle, Clock } from 'lucide-react';

interface ConnectionStatusProps {
  title: string;
  isConnected: boolean;
  icon: LucideIcon;
  lastUpdate?: Date;
  details?: string;
  onReconnect?: () => void;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  title,
  isConnected,
  icon: Icon,
  lastUpdate,
  details,
  onReconnect
}) => {
  return (
    <motion.div
      className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6"
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Icon className="w-8 h-8 text-gray-600 dark:text-gray-400 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
        </div>
        
        <div className="flex items-center">
          {isConnected ? (
            <CheckCircle className="w-6 h-6 text-green-500" />
          ) : (
            <XCircle className="w-6 h-6 text-red-500" />
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
          isConnected 
            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
            : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
        }`}>
          <div className={`w-2 h-2 rounded-full mr-2 ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`} />
          {isConnected ? '연결됨' : '연결 안됨'}
        </div>

        {details && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {details}
          </p>
        )}

        {lastUpdate && (
          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
            <Clock className="w-3 h-3 mr-1" />
            마지막 업데이트: {lastUpdate.toLocaleTimeString()}
          </div>
        )}

        {!isConnected && onReconnect && (
          <button
            onClick={onReconnect}
            className="w-full mt-3 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors"
          >
            재연결 시도
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default ConnectionStatus;
