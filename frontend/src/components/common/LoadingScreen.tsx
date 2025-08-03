/**
 * 공통 로딩 스크린 컴포넌트
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Bot, Loader2 } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message = '시스템을 초기화하고 있습니다...' 
}) => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <motion.div 
        className="text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          className="mb-8"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Bot className="w-16 h-16 text-blue-500 mx-auto" />
        </motion.div>
        
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
          로봇 제어 시스템
        </h2>
        
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {message}
        </p>
        
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin mr-2" />
          <span className="text-blue-500">로딩 중...</span>
        </div>
      </motion.div>
    </div>
  );
};

export default LoadingScreen;
