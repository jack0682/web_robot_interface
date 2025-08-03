import React from 'react';
import { 
  Menu, 
  Settings, 
  Wifi, 
  WifiOff, 
  Bell,
  User,
  Power
} from 'lucide-react';
import { useMqttConnection } from '../../hooks/useMqttConnection';
import { useNotifications } from '../../hooks/useNotifications';
import ConnectionIndicator from '../visualization/indicators/ConnectionIndicator';

interface HeaderProps {
  onMenuClick: () => void;
  sidebarOpen: boolean;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, sidebarOpen }) => {
  const { isConnected, connectionStatus } = useMqttConnection();
  const { notifications, unreadCount } = useNotifications();

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between h-16 px-4">
        {/* Left Section */}
        <div className="flex items-center space-x-4">
          {/* Menu Button */}
          <button
            onClick={onMenuClick}
            className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Toggle Menu"
          >
            <Menu size={24} />
          </button>

          {/* Logo and Title */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                Robot Dashboard
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Doosan M0609 Control System
              </p>
            </div>
          </div>
        </div>

        {/* Center Section - Status Indicators */}
        <div className="flex items-center space-x-6">
          <ConnectionIndicator 
            isConnected={isConnected}
            status={connectionStatus}
          />
          
          {/* Robot Status */}
          <div className="hidden md:flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600 dark:text-gray-300">
              Robot Online
            </span>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <button className="relative p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Settings */}
          <button className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
            <Settings size={20} />
          </button>

          {/* User Menu */}
          <div className="relative">
            <button className="flex items-center space-x-2 p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
              <User size={20} />
              <span className="hidden md:block text-sm">Admin</span>
            </button>
          </div>

          {/* Emergency Stop */}
          <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md flex items-center space-x-2 transition-colors">
            <Power size={16} />
            <span className="hidden md:block text-sm font-medium">
              비상정지
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
