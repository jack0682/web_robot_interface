/**
 * 스크롤 테스트용 페이지
 * 긴 콘텐츠를 생성해서 스크롤이 제대로 작동하는지 확인
 */
import React from 'react';

const ScrollTestPage: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
        스크롤 테스트 페이지
      </h1>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4">테스트 콘텐츠</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          이 페이지는 스크롤 기능이 제대로 작동하는지 테스트하기 위한 페이지입니다.
          아래로 스크롤해서 모든 콘텐츠가 보이는지 확인하세요.
        </p>
      </div>

      {/* 긴 콘텐츠 생성 */}
      {Array.from({ length: 50 }, (_, index) => (
        <div 
          key={index}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700"
        >
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
            테스트 카드 #{index + 1}
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-3">
            이것은 테스트용 카드입니다. 스크롤이 제대로 작동한다면 이 텍스트를 읽을 수 있어야 합니다.
            현재 카드 번호는 {index + 1}번입니다.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                파라미터 A: {Math.random().toFixed(2)}
              </span>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded">
              <span className="text-green-600 dark:text-green-400 font-medium">
                파라미터 B: {Math.random().toFixed(2)}
              </span>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded">
              <span className="text-purple-600 dark:text-purple-400 font-medium">
                파라미터 C: {Math.random().toFixed(2)}
              </span>
            </div>
          </div>
          
          {/* 프로그레스 바 */}
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-1">
              <span>진행률</span>
              <span>{((index + 1) / 50 * 100).toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full" 
                style={{ width: `${(index + 1) / 50 * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      ))}

      {/* 마지막 카드 */}
      <div className="bg-gradient-to-r from-green-400 to-blue-500 rounded-lg shadow-lg p-6 text-white">
        <h3 className="text-xl font-bold mb-3">
          🎉 축하합니다!
        </h3>
        <p className="text-lg">
          여기까지 스크롤하셨다면 스크롤 기능이 정상적으로 작동하고 있습니다.
        </p>
        <div className="mt-4 flex items-center justify-center">
          <button 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="bg-white text-blue-600 px-6 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors"
          >
            맨 위로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScrollTestPage;