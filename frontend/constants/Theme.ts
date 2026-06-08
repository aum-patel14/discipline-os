import { Platform } from 'react-native';

export const COLORS = {
  background: '#080809',
  card: '#0c0c0f',
  border: '#161620',
  text: '#ffffff',
  textSecondary: '#8e8e93',
  
  // Accents
  green: '#00ff88',
  cyan: '#22d3ee',
  yellow: '#ffd60a',
  red: '#f43f5e',
  purple: '#e879f9',
  
  // Opacities
  cardBorder: '#1c1c27',
  disabled: '#1f1f2e',
};

export const TYPOGRAPHY = {
  heading: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: 'bold' as const,
  },
  body: {
    fontFamily: SystemSansSerifFont(),
    fontWeight: 'normal' as const,
  },
};

function SystemSansSerifFont() {
  return Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'sans-serif',
  });
}
