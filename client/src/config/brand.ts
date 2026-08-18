export const brand = {
  appName: (import.meta.env.VITE_APP_NAME as string) || 'Greenlight',
  copyrightHolder: (import.meta.env.VITE_COPYRIGHT_HOLDER as string) || 'Greenlight',
  logoPath: (import.meta.env.VITE_LOGO_PATH as string) || '/logo.svg',
  apiTitle: (import.meta.env.VITE_API_TITLE as string) || 'API Reference',
  apiVersion: (import.meta.env.VITE_API_VERSION as string) || 'v1.0',
  primaryColor: (import.meta.env.VITE_PRIMARY_COLOR as string) || '#00d9b4',
  accentColor: (import.meta.env.VITE_ACCENT_COLOR as string) || '#00d9b4',
} as const;
