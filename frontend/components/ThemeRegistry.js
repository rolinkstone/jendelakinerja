// components/ThemeRegistry.js
// Sinkronisasi MUI theme dengan dark mode Tailwind (class "dark" di <html>)

import { useState, useEffect, useMemo } from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';

export default function ThemeRegistry({ children }) {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Baca theme dari localStorage / class di <html>
    const checkTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setDarkMode(isDark);
    };

    checkTheme();

    // Observer perubahan class di <html> (dari DashboardLayout toggle)
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: darkMode ? 'dark' : 'light',
          // Palet mengikuti warna Badan POM: biru (primary) + hijau (secondary).
          primary: { main: '#0f6cb8' },
          secondary: { main: '#1fa65f' },
          ...(darkMode && {
            background: {
              default: '#060a12',
              paper: '#0e1a2b',
            },
            text: {
              primary: '#e6ebf4',
              secondary: '#94a3b8',
            },
            divider: 'rgba(255,255,255,0.10)',
          }),
        },
        typography: {
          // Samakan font MUI (CssBaseline) dengan font brand — tanpa ini
          // CssBaseline memaksa Roboto dan mengalahkan font Tailwind.
          fontFamily: '"Plus Jakarta Sans", Inter, system-ui, sans-serif',
          button: { textTransform: 'none', fontWeight: 600 },
        },
        components: {
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
              },
            },
          },
          MuiTableHead: {
            styleOverrides: {
              root: {
                '& .MuiTableCell-head': {
                  fontWeight: 600,
                },
              },
            },
          },
        },
      }),
    [darkMode],
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
