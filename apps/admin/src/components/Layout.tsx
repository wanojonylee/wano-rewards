import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Cpu,
  Download,
  Gift,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Scale,
  Ticket,
  Wallet,
} from 'lucide-react';
import { setToken } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Badge } from './ui';

const nav = [
  { to: '/', labelKey: 'nav.overview', icon: LayoutDashboard, end: true },
  { to: '/payouts', labelKey: 'nav.payouts', icon: Wallet },
  { to: '/reconciliation', labelKey: 'nav.reconciliation', icon: Scale },
  { to: '/redemptions', labelKey: 'nav.redemptions', icon: Ticket },
  { to: '/campaigns', labelKey: 'nav.campaigns', icon: Megaphone },
  { to: '/rewards', labelKey: 'nav.rewards', icon: Gift },
  { to: '/machines', labelKey: 'nav.machines', icon: Cpu },
  { to: '/deposits', labelKey: 'nav.deposits', icon: Download },
];

export function Layout({ userName, onLogout }: { userName: string; onLogout: () => void }) {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const current = nav.find((item) => (item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)));
  const title = current ? t(current.labelKey) : t('layout.fallbackTitle');

  const logout = () => {
    setToken(null);
    onLogout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__logo">
          <img src="/wano-logo-light.png" alt="WANO" />
        </div>
        <div className="sidebar__tag">{t('layout.tag')}</div>
        <nav className="nav">
          <div className="nav__label">{t('nav.operation')}</div>
          {nav.slice(0, 5).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav__item ${isActive ? 'nav__item--active' : ''}`}
            >
              <item.icon />
              {t(item.labelKey)}
            </NavLink>
          ))}
          <div className="nav__label">{t('nav.catalog')}</div>
          {nav.slice(5).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav__item ${isActive ? 'nav__item--active' : ''}`}
            >
              <item.icon />
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__footer">
          WANO Intelligent Technology
          <br />
          {t('layout.footer')}
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar__crumbs">WANO Rewards / {title}</div>
          <div className="topbar__user">
            <LanguageSwitcher />
            <Badge tone="green" dot>
              {t('layout.badge')}
            </Badge>
            <span className="avatar">{userName.slice(0, 2).toUpperCase()}</span>
            <span>{userName}</span>
            <button className="btn btn--ghost btn--sm" onClick={logout} title={t('layout.logout')}>
              <LogOut size={15} />
              {t('layout.logout')}
            </button>
          </div>
        </header>
        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
