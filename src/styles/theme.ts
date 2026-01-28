// Base theme structure (shared between dark and light)
const baseTheme = {
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
} as const;

// Dark theme colors (Apple Design System)
export const darkTheme = {
  ...baseTheme,
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
  shadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
  },
} as const;

// Light theme colors (Apple Design System)
export const lightTheme = {
  ...baseTheme,
  colors: {
    // Base colors - Apple light mode
    bg: {
      primary: '#ffffff',      // Pure white
      secondary: '#f5f5f7',    // System gray 7
      tertiary: '#e5e5e5',     // System gray 6
      hover: '#d1d1d6',        // System gray 5
      active: '#007aff',       // System blue
      selection: 'rgba(0, 122, 255, 0.15)',
      card: '#ffffff',
      input: '#ffffff',
      elevated: '#ffffff',
    },
    // Text colors - Apple light
    text: {
      primary: '#1d1d1f',      // System label
      secondary: '#3c3c43',    // Secondary label (60%)
      muted: '#8e8e93',        // System gray
      accent: '#007aff',       // System blue
      error: '#ff3b30',        // System red
      success: '#34c759',      // System green
      warning: '#ff9500',      // System orange
    },
    // Border colors
    border: {
      primary: '#d1d1d6',      // Separator
      secondary: '#c7c7cc',
      focus: '#007aff',
    },
    // Accent colors - Apple Blue
    accent: {
      primary: '#007aff',      // System blue
      secondary: '#0071e3',    // Apple blue
      hover: '#0056b3',
      muted: 'rgba(0, 122, 255, 0.15)',
    },
    // Status colors - Apple system colors (light mode)
    status: {
      error: '#ff3b30',        // System red
      errorBg: 'rgba(255, 59, 48, 0.12)',
      warning: '#ff9500',      // System orange
      warningBg: 'rgba(255, 149, 0, 0.12)',
      info: '#007aff',         // System blue
      infoBg: 'rgba(0, 122, 255, 0.12)',
      success: '#34c759',      // System green
      successBg: 'rgba(52, 199, 89, 0.12)',
    },
  },
  shadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.08)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.12)',
  },
} as const;

// Export default theme (dark)
export const theme = darkTheme;

// Type definitions - use interface to allow both themes to be compatible
export interface ThemeColors {
  bg: {
    primary: string;
    secondary: string;
    tertiary: string;
    hover: string;
    active: string;
    selection: string;
    card: string;
    input: string;
    elevated: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    accent: string;
    error: string;
    success: string;
    warning: string;
  };
  border: {
    primary: string;
    secondary: string;
    focus: string;
  };
  accent: {
    primary: string;
    secondary: string;
    hover: string;
    muted: string;
  };
  status: {
    error: string;
    errorBg: string;
    warning: string;
    warningBg: string;
    info: string;
    infoBg: string;
    success: string;
    successBg: string;
  };
}

export interface Theme {
  spacing: typeof baseTheme.spacing;
  fontSize: typeof baseTheme.fontSize;
  fontWeight: typeof baseTheme.fontWeight;
  borderRadius: typeof baseTheme.borderRadius;
  sidebar: typeof baseTheme.sidebar;
  toolbar: typeof baseTheme.toolbar;
  statusBar: typeof baseTheme.statusBar;
  transition: typeof baseTheme.transition;
  colors: ThemeColors;
  shadow: {
    sm: string;
    md: string;
    lg: string;
  };
}
