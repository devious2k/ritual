import { NavLink } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import LodgeSwitcher from './LodgeSwitcher';
import {
  Building2,
  Calendar,
  ChevronsLeft,
  ChevronsRight,
  Coins,
  Landmark,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Settings,
  Users,
  UtensilsCrossed,
} from 'lucide-react';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles?: string[];
}

const navItems: NavItem[] = [
  { label: 'Overview', path: '/', icon: <LayoutDashboard size={20} /> },
  { label: 'Meetings', path: '/meetings', icon: <Calendar size={20} /> },
  { label: 'Ceremonies', path: '/ceremonies', icon: <Landmark size={20} /> },
  { label: 'Dining', path: '/dining', icon: <UtensilsCrossed size={20} /> },
  { label: 'Members', path: '/members', icon: <Users size={20} /> },
  { label: 'Events', path: '/events', icon: <Megaphone size={20} /> },
  { label: 'Treasurer', path: '/finance', icon: <Coins size={20} /> },
  { label: 'Lodges', path: '/lodges', icon: <Building2 size={20} />, roles: ['SUPER_ADMIN'] },
  { label: 'Settings', path: '/settings', icon: <Settings size={20} /> },
];

export default function Sidebar() {
  const { sidebarOpen, sidebarCollapsed, toggleSidebar, toggleSidebarCollapsed } = useUIStore();
  const { user, logout } = useAuthStore();

  const userInitials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() ||
      user.email[0].toUpperCase()
    : '?';

  const canView = (item: NavItem) => {
    if (!item.roles) return true;
    return user?.role ? item.roles.includes(user.role) : false;
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 flex flex-col border-r border-white/10 bg-[linear-gradient(180deg,rgba(10,17,29,0.98),rgba(16,28,46,0.96))] text-white shadow-[0_20px_60px_rgba(3,8,20,0.45)] backdrop-blur transition-all duration-300 ${
        sidebarCollapsed ? 'w-20' : 'w-64'
      } ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
    >
      <LodgeSwitcher collapsed={sidebarCollapsed} />

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {!sidebarCollapsed ? (
          <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">
            Core Workflow
          </p>
        ) : null}

        <ul className="space-y-1.5">
          {navItems.filter(canView).map((item) => (
            <li key={item.path + item.label}>
              <NavLink
                to={item.path}
                end={item.path === '/'}
                onClick={() => {
                  if (window.innerWidth < 1024) toggleSidebar();
                }}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all ${
                    isActive
                      ? 'border border-[var(--border-strong)] bg-[linear-gradient(135deg,rgba(201,168,76,0.18),rgba(201,168,76,0.05))] text-[var(--gold-soft)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                      : 'text-white/72 hover:bg-white/5 hover:text-white'
                  } ${sidebarCollapsed ? 'justify-center' : ''}`
                }
                title={sidebarCollapsed ? item.label : undefined}
              >
                <span className="transition-transform group-hover:scale-105">{item.icon}</span>
                {!sidebarCollapsed ? <span>{item.label}</span> : null}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <button
        onClick={toggleSidebarCollapsed}
        className="hidden border-t border-white/10 p-4 text-white/45 transition-colors hover:text-white lg:flex lg:items-center lg:justify-center"
      >
        {sidebarCollapsed ? <ChevronsRight size={20} /> : <ChevronsLeft size={20} />}
      </button>

      <div className="border-t border-white/10 p-3">
        <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'justify-center' : ''}`}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-white/5 text-sm font-semibold text-[var(--gold-soft)]">
            {userInitials}
          </div>
          {!sidebarCollapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {user?.firstName && user?.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user?.email ?? 'User'}
              </p>
              <p className="truncate text-xs uppercase tracking-[0.18em] text-white/40">
                {user?.role?.replace(/_/g, ' ') ?? 'Member'}
              </p>
            </div>
          ) : null}
          {!sidebarCollapsed ? (
            <button
              onClick={logout}
              className="shrink-0 rounded-xl p-2 text-white/45 transition-colors hover:bg-white/5 hover:text-white"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
