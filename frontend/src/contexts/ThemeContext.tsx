/**
 * 테마 컨텍스트
 * 다크/라이트 모드와 색상 테마를 관리
 */
import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark';
type AccentColor = 'blue' | 'green' | 'purple' | 'orange';

interface ThemeContextType {
  theme: Theme;
  accentColor: AccentColor;
  setTheme: (theme: Theme) => void;
  setAccentColor: (color: AccentColor) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>('light');
  const [accentColor, setAccentColor] = useState<AccentColor>('blue');

  // 로컬 스토리지에서 테마 설정 로드
  useEffect(() => {
    const savedTheme = localStorage.getItem('dashboard-theme') as Theme;
    const savedAccentColor = localStorage.getItem('dashboard-accent-color') as AccentColor;
    
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      // 시스템 선호도 확인
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    }
    
    if (savedAccentColor) {
      setAccentColor(savedAccentColor);
    }
  }, []);

  // 테마 변경 시 DOM과 로컬 스토리지 업데이트
  useEffect(() => {
    const root = document.documentElement;
    
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    localStorage.setItem('dashboard-theme', theme);
  }, [theme]);

  // 액센트 컬러 변경 시 CSS 변수 업데이트
  useEffect(() => {
    const root = document.documentElement;
    
    const colorMaps = {
      blue: {
        primary: '#3B82F6',
        primaryDark: '#1D4ED8',
        secondary: '#EFF6FF',
        accent: '#60A5FA',
      },
      green: {
        primary: '#10B981',
        primaryDark: '#047857',
        secondary: '#ECFDF5',
        accent: '#34D399',
      },
      purple: {
        primary: '#8B5CF6',
        primaryDark: '#7C3AED',
        secondary: '#F3E8FF',
        accent: '#A78BFA',
      },
      orange: {
        primary: '#F59E0B',
        primaryDark: '#D97706',
        secondary: '#FFFBEB',
        accent: '#FBBF24',
      },
    };
    
    const colors = colorMaps[accentColor];
    root.style.setProperty('--color-primary', colors.primary);
    root.style.setProperty('--color-primary-dark', colors.primaryDark);
    root.style.setProperty('--color-secondary', colors.secondary);
    root.style.setProperty('--color-accent', colors.accent);
    
    localStorage.setItem('dashboard-accent-color', accentColor);
  }, [accentColor]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{
      theme,
      accentColor,
      setTheme,
      setAccentColor,
      toggleTheme,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};