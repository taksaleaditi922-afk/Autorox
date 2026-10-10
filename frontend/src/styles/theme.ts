import { createTheme, responsiveFontSizes } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    accent: Palette['primary'];
  }
  interface PaletteOptions {
    accent?: PaletteOptions['primary'];
  }
  interface TypeBackground {
    subtle: string;
  }
  interface TypeText {
    muted: string;
  }
}

let theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0f172a',
      light: '#1e293b',
      dark: '#0f172a',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#1e293b',
      light: '#3b82f6',
      dark: '#1e293b',
      contrastText: '#ffffff',
    },
    accent: {
      main: '#f59e0b',
      light: '#fbbf24',
      dark: '#d97706',
      contrastText: '#000000',
    },
    success: { main: '#10b981', light: '#dcfce7', dark: '#059669' },
    warning: { main: '#f59e0b', light: '#fef3c7', dark: '#d97706' },
    error: { main: '#ef4444', light: '#fee2e2', dark: '#dc2626' },
    info: { main: '#3b82f6', light: '#dbeafe', dark: '#2563eb' },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
      subtle: '#f1f5f9',
    },
    text: {
      primary: '#0f172a',
      secondary: '#64748b',
      muted: '#94a3b8',
    },
    divider: '#e2e8f0',
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
    h1: { fontWeight: 800, letterSpacing: '-0.025em', fontSize: '2.25rem' },
    h2: { fontWeight: 700, letterSpacing: '-0.02em', fontSize: '1.75rem' },
    h3: { fontWeight: 700, letterSpacing: '-0.01em', fontSize: '1.5rem' },
    h4: { fontWeight: 700, fontSize: '1.25rem' },
    h5: { fontWeight: 600, fontSize: '1.125rem' },
    h6: { fontWeight: 600, letterSpacing: '0.01em', fontSize: '0.9375rem' },
    subtitle1: { fontWeight: 600, fontSize: '0.9375rem', lineHeight: 1.6 },
    subtitle2: { fontWeight: 600, fontSize: '0.8125rem', lineHeight: 1.55 },
    body1: { lineHeight: 1.65, fontSize: '0.875rem' },
    body2: { lineHeight: 1.55, fontSize: '0.8125rem' },
    caption: { lineHeight: 1.45, fontSize: '0.75rem' },
    overline: { fontWeight: 700, fontSize: '0.625rem', letterSpacing: '0.1em' },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: '0.01em' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarWidth: 'thin',
          scrollbarColor: '#cbd5e1 transparent',
        },
      },
    },
    MuiButton: {
      defaultProps: { size: 'medium', disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 10,
          paddingTop: 8,
          paddingBottom: 8,
          paddingLeft: 20,
          paddingRight: 20,
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          fontWeight: 600,
          '&:hover': { transform: 'translateY(-1px)' },
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          '&:hover': { background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', boxShadow: '0 4px 16px rgba(15,23,42,0.2)' },
        },
        containedSecondary: {
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          '&:hover': { background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)', boxShadow: '0 4px 16px rgba(245,158,11,0.2)' },
        },
        outlined: { borderWidth: 1.5, borderRadius: 10 },
        text: { padding: '6px 14px' },
        sizeSmall: { paddingTop: 5, paddingBottom: 5, paddingLeft: 14, paddingRight: 14, fontSize: '0.8125rem' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)',
          border: '1px solid #e2e8f0',
          transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
          '&:hover': {
            boxShadow: '0 4px 16px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.03)',
          },
        },

      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, borderRadius: 8, padding: '2px 10px', height: 'auto', fontSize: '0.75rem' },
        sizeSmall: { height: 24, fontSize: '0.6875rem' },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            fontSize: '0.875rem',
            transition: 'all 0.2s ease',
            '&:hover': { boxShadow: '0 0 0 2px rgba(15,23,42,0.06)' },
            '&.Mui-focused': { boxShadow: '0 0 0 2px rgba(15,23,42,0.12)' },
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 16, boxShadow: '0 24px 48px rgba(0,0,0,0.15)' },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: { borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: '#ffffff',
          color: '#0f172a',
          boxShadow: '0 1px 0 #e2e8f0',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid #e2e8f0',
          boxShadow: 'none',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { padding: '10px 16px', borderBottom: '1px solid #f1f5f9', fontSize: '0.8125rem' },
        head: {
          fontWeight: 700,
          backgroundColor: '#f8fafc',
          color: '#64748b',
          fontSize: '0.6875rem',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          borderBottom: '1px solid #e2e8f0',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background-color 0.15s ease',
          '&:hover': { backgroundColor: '#f8fafc !important' },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { borderRadius: 8, fontSize: '0.75rem', padding: '4px 10px' },
      },
    },
    MuiSvgIcon: {
      styleOverrides: {
        root: { fontSize: '20px' },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, fontSize: '0.875rem' },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: { height: 3, borderRadius: '3px 3px 0 0' },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 10, fontSize: '0.8125rem' },
      },
    },
  },
});

theme = responsiveFontSizes(theme);
export default theme;
