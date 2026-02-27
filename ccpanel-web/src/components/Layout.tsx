import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Server, Users, FileText, Settings, LogOut, Shield, Wifi, WifiOff } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '../stores/authStore';
import { useWsStore } from '../stores/wsStore';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const wsStatus = useWsStore((s) => s.monitorStatus);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const wsColor = wsStatus === 'connected' ? 'bg-green-500' : wsStatus === 'reconnecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500';

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Nodes', path: '/nodes', icon: Server },
    { name: 'Users', path: '/users', icon: Users },
    { name: 'Audit Logs', path: '/logs', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-midnight text-gray-300 font-sans selection:bg-viking-gold selection:text-midnight flex flex-col">
      {/* Header Navigation */}
      <header className="h-16 border-b border-white/5 bg-deep-sea/50 backdrop-blur-xl sticky top-0 z-50 flex items-center px-6 gap-6">
        {/* Logo Area */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-viking-gold to-orange-600 flex items-center justify-center shadow-lg shadow-orange-900/20">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-white">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="font-bold text-lg tracking-tight text-white hidden md:block m-0 p-0 text-inherit leading-none">CCPanel</h1>
        </div>

        {/* Main Navigation */}
        <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap',
                  isActive
                    ? 'bg-viking-gold/10 text-viking-gold border border-viking-gold/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                )}
              >
                <Icon className={clsx('w-4 h-4 transition-colors', isActive ? 'text-viking-gold' : 'text-gray-500')} />
                <span className="hidden sm:inline">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-4 ml-auto">
          <div className="flex items-center gap-3 pl-4 border-l border-white/10">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-bold text-white">CCPanel Admin</div>
              <div className="text-[10px] text-viking-gold font-medium uppercase tracking-wider">Administrator</div>
            </div>
            <div className="relative group cursor-pointer">
              <div className="w-9 h-9 rounded-full bg-viking-gold p-0.5 ring-2 ring-white/10 group-hover:ring-viking-gold/50 transition-all">
                <img
                  src="https://ui-avatars.com/api/?name=CCPanel+Admin&background=1e293b&color=D4AF37"
                  alt="User"
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-midnight rounded-full"></div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 text-[10px]" title={`WebSocket: ${wsStatus}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${wsColor}`} />
            <span className="text-gray-500 uppercase tracking-wider">{wsStatus === 'connected' ? 'Live' : wsStatus}</span>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Sign Out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative overflow-x-hidden">
        {/* Background ambient glow */}
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-deep-sea/30 to-transparent pointer-events-none" />

        <div className="relative z-10 p-6 md:p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
