/**
 * 간단한 Sidebar 컴포넌트
 */
import React from 'react';

interface SidebarProps {
  children?: React.ReactNode;
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ children, isOpen = true, onClose }) => {
  return (
    <>
      {/* 모바일 오버레이 */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        fixed md:relative md:translate-x-0 z-50 md:z-auto
        w-64 h-full bg-white dark:bg-gray-800 
        border-r border-gray-200 dark:border-gray-700
        transition-transform duration-300 ease-in-out
        flex flex-col
      `}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Navigation</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </>
  );
};

export default Sidebar;