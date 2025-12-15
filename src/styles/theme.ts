// Apple Design System inspired dark theme for CARF
export const theme = {
  colors: {
    // Base colors - Slate palette
    bg: {
      primary: '#0f172a',      // slate-900
      secondary: '#1e293b',    // slate-800
      tertiary: '#334155',     // slate-700
      hover: '#475569',        // slate-600
      active: '#6366f1',       // indigo-500
      selection: 'rgba(99, 102, 241, 0.2)', // indigo with opacity
      card: '#1e293b',
      input: '#0f172a',
    },
    // Text colors
    text: {
      primary: '#f8fafc',      // slate-50
      secondary: '#cbd5e1',    // slate-300
      muted: '#64748b',        // slate-500
      accent: '#a78bfa',       // violet-400
      error: '#f87171',        // red-400
      success: '#4ade80',      // green-400
      warning: '#fbbf24',      // amber-400
    },
    // Border colors
    border: {
      primary: '#334155',      // slate-700
      secondary: '#475569',    // slate-600
      focus: '#8b5cf6',        // violet-500
    },
    // Accent colors - Purple/Violet
    accent: {
      primary: '#8b5cf6',      // violet-500
      secondary: '#7c3aed',    // violet-600
      hover: '#a78bfa',        // violet-400
      muted: 'rgba(139, 92, 246, 0.3)',
    },
    // Status colors
    status: {
      error: '#ef4444',        // red-500
      errorBg: 'rgba(239, 68, 68, 0.1)',
      warning: '#f59e0b',      // amber-500
      warningBg: 'rgba(245, 158, 11, 0.1)',
      info: '#3b82f6',         // blue-500
      infoBg: 'rgba(59, 130, 246, 0.1)',
      success: '#22c55e',      // green-500
      successBg: 'rgba(34, 197, 94, 0.1)',
    },
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    xxl: '32px',
  },
  fontSize: {
    xs: '11px',
    sm: '12px',
    md: '13px',
    lg: '14px',
    xl: '16px',
    xxl: '20px',
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  borderRadius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
    full: '9999px',
  },
  sidebar: {
    width: '48px',
    panelWidth: '320px',
  },
  toolbar: {
    height: '48px',
  },
  statusBar: {
    height: '28px',
  },
  transition: {
    fast: '0.1s ease',
    normal: '0.2s ease',
    slow: '0.3s ease',
  },
  shadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
  },
} as const;

export type Theme = typeof theme;
