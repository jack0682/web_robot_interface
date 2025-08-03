/**
 * 간단한 Sidebar 컴포넌트
 */
import React from 'react';

interface SidebarProps {
  children?: React.ReactNode;
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ children }) => {
  return (
    <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Navigation</h2>
      </div>
      {children}
    </div>
  );
};

export default Sidebar;