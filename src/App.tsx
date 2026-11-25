import React from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { PublicPortfolioPage } from './pages/PublicPortfolioPage';
import { useCloudMediaSync } from './utils/assetUrl';

// Normalize direct /admin path hits onto HashRouter `#/admin` so reloads & static hosting never 404
if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin') && !window.location.hash) {
  window.history.replaceState(null, '', `/#${window.location.pathname}${window.location.search}`);
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Error inesperado al renderizar la página.',
    };
  }

  componentDidCatch(error: unknown) {
    console.error('Portfolio Studio render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F8F6FC] text-[#2E1065] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-purple-200 rounded-2xl p-6 space-y-4 shadow-lg text-center">
            <h1 className="text-lg font-bold">No se pudo mostrar el portafolio</h1>
            <p className="text-xs text-purple-900/75 break-words">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-xs font-semibold bg-[#6D28D9] text-white rounded-full cursor-pointer"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  useCloudMediaSync();
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<PublicPortfolioPage />} />
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/*" element={<AdminDashboardPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </AppErrorBoundary>
  );
}
