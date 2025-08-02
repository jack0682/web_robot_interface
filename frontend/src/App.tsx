import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { MqttProvider } from '@/contexts/MqttContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import MainLayout from '@/components/layout/MainLayout';
import Dashboard from '@/components/dashboard/Dashboard';
import Settings from '@/components/settings/SettingsModal';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import '@/styles/globals.css';

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <NotificationProvider>
          <MqttProvider>
            <Router>
              <div className="App">
                <Routes>
                  <Route path="/" element={<MainLayout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="settings" element={<Settings />} />
                  </Route>
                </Routes>
              </div>
            </Router>
          </MqttProvider>
        </NotificationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
