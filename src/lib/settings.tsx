import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Settings } from '../../electron/shared/types';

const DEFAULT_SETTINGS: Settings = {
  pharmacy_name: 'My Pharmacy',
  pharmacy_address: '',
  pharmacy_phone: '',
  pharmacy_email: '',
  pharmacy_logo_path: '',
  currency_symbol: '₹',
  low_stock_default_threshold: '10',
  near_expiry_days: '90',
  receipt_footer_note: '',
  invoice_prefix: 'INV',
};

interface SettingsContextValue {
  settings: Settings;
  loading: boolean;
  refresh: () => Promise<void>;
  update: (values: Partial<Settings>) => Promise<void>;
  formatCurrency: (value: number) => string;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await window.api.settings.get();
      setSettings({ ...DEFAULT_SETTINGS, ...data });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const update = useCallback(async (values: Partial<Settings>) => {
    const data = await window.api.settings.update(values);
    setSettings({ ...DEFAULT_SETTINGS, ...data });
  }, []);

  const formatCurrency = useCallback(
    (value: number) => `${settings.currency_symbol}${(Number.isFinite(value) ? value : 0).toFixed(2)}`,
    [settings.currency_symbol]
  );

  return (
    <SettingsContext.Provider value={{ settings, loading, refresh, update, formatCurrency }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
