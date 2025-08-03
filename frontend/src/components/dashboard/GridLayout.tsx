import React from 'react';

interface GridLayoutProps {
  children: React.ReactNode;
  robotStatus?: any;
  jointStates?: any;
  sensorData?: any;
}

const GridLayout: React.FC<GridLayoutProps> = ({ children }) => {
  return <div className="grid gap-4">{children}</div>;
};

export default GridLayout;
