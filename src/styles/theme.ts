// Apple Design System dark theme for CARF
export const theme = {
  colors: {
    // Base colors - Apple dark mode
    bg: {
      primary: '#000000',      // Pure black (Apple style)
      secondary: '#1c1c1e',    // System gray 6
      tertiary: '#2c2c2e',     // System gray 5
      hover: '#3a3a3c',        // System gray 4
      active: '#0a84ff',       // System blue
      selection: 'rgba(10, 132, 255, 0.2)',
      card: '#1c1c1e',
      input: '#1c1c1e',
      elevated: '#2c2c2e',
    },
    // Text colors - Apple
    text: {
      primary: '#ffffff',
      secondary: '#ebebf5',    // 60% opacity
      muted: '#8e8e93',        // System gray
      accent: '#0a84ff',       // System blue
      error: '#ff453a',        // System red
      success: '#30d158',      // System green
      warning: '#ff9f0a',      // System orange
    },
    // Border colors
    border: {
      primary: '#38383a',      // Separator
      secondary: '#48484a',
      focus: '#0a84ff',
    },
    // Accent colors - Apple Blue
    accent: {
      primary: '#0a84ff',      // System blue
      secondary: '#0071e3',    // Apple blue
      hover: '#409cff',
      muted: 'rgba(10, 132, 255, 0.2)',
    },
    // Status colors - Apple system colors
    status: {
      error: '#ff453a',        // System red
      errorBg: 'rgba(255, 69, 58, 0.15)',
      warning: '#ff9f0a',      // System orange
      warningBg: 'rgba(255, 159, 10, 0.15)',
      info: '#0a84ff',         // System blue
      infoBg: 'rgba(10, 132, 255, 0.15)',
      success: '#30d158',      // System green
      successBg: 'rgba(48, 209, 88, 0.15)',
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
