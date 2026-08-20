import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { AdminInfo, logout } from '../lib/auth';
import {
  LayoutDashboard, Users, Key, CreditCard, Ticket, HelpCircle,
  ScrollText, Activity, Settings as SettingsIcon, Shield, LogOut, Bot, MessageSquare, Smartphone,
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/access-keys', label: 'Access Keys', icon: Key },
  { to: '/payments', label: 'Payments', icon: CreditCard },
  { to: '/tickets', label: 'Tickets', icon: Ticket },
  { to: '/messages', label: 'Messages', icon: MessageSquare },
  { to: '/whatsapp-connect', label: 'WhatsApp Connect', icon: Smartphone },
  { to: '/faq', label: 'FAQ', icon: HelpCircle },
  { to: '/admins', label: 'Admins', icon: Shield },
  { to: '/audit-logs', label: 'Audit Logs', icon: ScrollText },
  { to: '/system-health', label: 'System Health', icon: Activity },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export default function Layout({ admin, onLogout }: { admin: AdminInfo; onLogout: () => void }) {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    onLogout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-surface-950">
      {/* Sidebar */}
      <aside className={`w-64 bg-surface-900 border-r border-slate-800 flex flex-col transition-transform ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:static h-full z-50`}>
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="font-bold text-white text-sm">AA MD BOT</div>
              <div className="text-xs text-slate-500">Support Dashboard</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => isActive ? 'active' : ''}
            >
              <span className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-surface-800 hover:text-white transition-colors">
                <item.icon className="w-5 h-5" />
                {item.label}
              </span>
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-semibold">
              {admin.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white truncate">{admin.name}</div>
              <div className="text-xs text-slate-500 truncate">{admin.role}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="btn-secondary w-full flex items-center justify-center gap-2">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-surface-900 border-b border-slate-800 px-5 py-3 md:hidden flex items-center justify-between">
          <div className="font-bold text-white">AA MD BOT</div>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="text-slate-400">
            <LayoutDashboard className="w-6 h-6" />
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
