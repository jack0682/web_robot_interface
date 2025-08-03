/**
 * 간단한 Footer 컴포넌트  
 */
import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
      <div className="text-center text-sm text-gray-600 dark:text-gray-400">
        © 2024 Robot Control System. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;