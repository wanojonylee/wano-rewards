import React, { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { getToken, setToken } from './lib/api';
import { ToastProvider } from './components/ui';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Overview } from './pages/Overview';
import { Payouts } from './pages/Payouts';
import { Reconciliation } from './pages/Reconciliation';
import { Redemptions } from './pages/Redemptions';
import { Campaigns } from './pages/Campaigns';
import { Rewards } from './pages/Rewards';
import { Machines } from './pages/Machines';
import { Deposits } from './pages/Deposits';

export default function App() {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [userName, setUserName] = useState(() => localStorage.getItem('wano.admin.name') ?? 'Operador WANO');

  const handleLogin = (nextToken: string, name: string) => {
    setTokenState(nextToken);
    setUserName(name);
  };

  const handleLogout = () => {
    setToken(null);
    setTokenState(null);
    localStorage.removeItem('wano.admin.name');
  };

  const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

  if (!token) {
    return (
      <BrowserRouter basename={basename}>
        <Routes>
          <Route path="*" element={<Login onLogin={handleLogin} />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter basename={basename}>
      <ToastProvider>
        <Routes>
          <Route element={<Layout userName={userName} onLogout={handleLogout} />}>
            <Route index element={<Overview />} />
            <Route path="payouts" element={<Payouts />} />
            <Route path="reconciliation" element={<Reconciliation />} />
            <Route path="redemptions" element={<Redemptions />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="rewards" element={<Rewards />} />
            <Route path="machines" element={<Machines />} />
            <Route path="deposits" element={<Deposits />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
