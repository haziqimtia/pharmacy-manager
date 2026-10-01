import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { SettingsProvider } from './lib/settings';
import { ToastProvider } from './lib/toast';
import { AppLayout } from './components/layout/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Medicines from './pages/Medicines';
import Purchases from './pages/Purchases';
import Sales from './pages/Sales';
import StockLedger from './pages/StockLedger';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

function Protected({ title, children }: { title: string; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout title={title}>{children}</AppLayout>;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/"
        element={
          <Protected title="Dashboard">
            <Dashboard />
          </Protected>
        }
      />
      <Route
        path="/medicines"
        element={
          <Protected title="Medicines & Inventory">
            <Medicines />
          </Protected>
        }
      />
      <Route
        path="/purchases"
        element={
          <Protected title="Purchases">
            <Purchases />
          </Protected>
        }
      />
      <Route
        path="/sales"
        element={
          <Protected title="Sales / POS">
            <Sales />
          </Protected>
        }
      />
      <Route
        path="/stock"
        element={
          <Protected title="Stock Ledger & Alerts">
            <StockLedger />
          </Protected>
        }
      />
      <Route
        path="/reports"
        element={
          <Protected title="Reports">
            <Reports />
          </Protected>
        }
      />
      <Route
        path="/settings"
        element={
          <Protected title="Settings">
            <Settings />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ToastProvider>
    </SettingsProvider>
  );
}
