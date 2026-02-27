import React, { useState } from 'react';
import { useParams, Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Play, Square, RotateCw, Cpu, HardDrive, Users, Terminal, FileText, Settings, Globe, Trash2, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useDataStore } from '../stores/dataStore';
import { instanceApi } from '../lib/api';
import { formatMemBytes } from '../lib/format';

const COLORS = {
  gold: ['#D4AF37', '#1A222D'],
  blue: ['#60A5FA', '#1A222D'],
  green: ['#4ADE80', '#1A222D']
};

const CircularGauge = ({ data, colors, icon: Icon, label, value, unit }: any) => (
  <div className="bg-deep-sea/30 border border-white/5 rounded-xl p-5 relative overflow-hidden group flex items-center justify-between">
    <div className="z-10">
      <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1 flex items-center gap-2">
        <Icon className="w-4 h-4" style={{ color: colors[0] }} />
        {label}
      </h3>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold text-white font-mono">{value}</span>
        <span className="text-sm text-gray-500">{unit}</span>
      </div>
    </div>

    <div className="h-20 w-20 relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={25}
            outerRadius={35}
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry: any, index: number) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-12 h-12 rounded-full blur-xl opacity-20" style={{ backgroundColor: colors[0] }}></div>
      </div>
    </div>
  </div>
);

export default function InstanceHub() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isConsole = location.pathname.includes('/console');

  const instances = useDataStore((s) => s.instances);
  const nodes = useDataStore((s) => s.nodes);
  const isLoading = useDataStore((s) => s.isLoading);

  const instance = instances.find(i => i.id === id);
  const node = nodes.find(n => n.id === instance?.node_id);

  if (isLoading && !instance) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <Loader2 className="w-8 h-8 text-viking-gold animate-spin" />
        <p className="text-gray-400 text-sm">Initializing instance session...</p>
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-6 bg-deep-sea/10 rounded-xl border border-white/5 m-6">
        <div className="text-center">
          <h2 className="text-white font-bold text-lg">Instance Not Found</h2>
          <p className="text-gray-500 text-sm mt-1">Direct access failed. The server might be restricted or moved.</p>
        </div>
        <Link to="/" className="px-6 py-2 bg-white/5 hover:bg-white/10 text-viking-gold border border-viking-gold/20 rounded-lg text-sm font-medium transition-all">
          Go To Dashboard
        </Link>
      </div>
    );
  }

  // Real data for gauges
  const cpuUsed = instance.cpu_percent || 0;
  const cpuData = [{ name: 'Used', value: cpuUsed }, { name: 'Free', value: Math.max(0, 100 - cpuUsed) }];

  // Assume a 2GB default limit if we don't know the exact limit, or use a pseudo limit. 
  // For now we just show raw usage in the gauge value, but chart needs a limit. We'll use 4GB as a demo limit.
  const ramLimitBytes = 4 * 1024 * 1024 * 1024;
  const ramUsed = instance.mem_bytes || 0;
  const ramData = [{ name: 'Used', value: ramUsed }, { name: 'Free', value: Math.max(0, ramLimitBytes - ramUsed) }];

  // Player limit is usually 10 for Valheim
  const playersData = [{ name: 'Used', value: instance.player_count }, { name: 'Free', value: Math.max(0, 10 - instance.player_count) }];

  const handleAction = async (action: 'start' | 'stop' | 'restart' | 'delete') => {
    if (!id) return;
    try {
      if (action === 'delete') {
        if (!confirm('Are you sure you want to delete this server and its data?')) return;
        await instanceApi.delete(id);
        navigate('/');
      } else {
        await instanceApi[action](id);
      }
    } catch (err: any) {
      alert(`Action ${action} failed: ${err.message}`);
    }
  };

  const isUp = instance.status === 'running';

  return (
    <div className="space-y-6">
      {/* Top Status Banner */}
      <div className="bg-deep-sea/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-gray-800 to-black border border-white/10 flex items-center justify-center shadow-inner relative overflow-hidden group">
            <div className="absolute inset-0 bg-viking-gold/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <span className="text-2xl font-bold text-viking-gold">{(instance.name || 'Server').charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-white tracking-tight">{instance.name || 'Unknown Server'}</h1>
              <span className={clsx(
                "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
                isUp ? "bg-green-500/10 text-green-400 border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.2)]" : "bg-red-500/10 text-red-400 border-red-500/20"
              )}>
                {instance.docker_status || instance.status}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-400 font-mono">
              <span>{instance.connect_address || `${node?.address || 'Node'}:${instance.game_port}`}</span>
              <span className="w-1 h-1 rounded-full bg-gray-600"></span>
              <span>Uptime: {instance.uptime_secs ? `${Math.floor(instance.uptime_secs / 3600)}h ${Math.floor((instance.uptime_secs % 3600) / 60)}m` : '0h 0m'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => handleAction('start')} disabled={isUp} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600/10 text-green-400 border border-green-600/20 hover:bg-green-600/20 disabled:opacity-50 transition-all text-sm font-medium">
            <Play className="w-4 h-4 fill-current" />
            Start
          </button>
          <button onClick={() => handleAction('stop')} disabled={!isUp} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-600/10 text-yellow-400 border border-yellow-600/20 hover:bg-yellow-600/20 disabled:opacity-50 transition-all text-sm font-medium">
            <Square className="w-4 h-4 fill-current" />
            Stop
          </button>
          <button onClick={() => handleAction('restart')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-viking-gold/10 text-viking-gold border border-viking-gold/20 hover:bg-viking-gold/20 transition-all text-sm font-medium">
            <RotateCw className="w-4 h-4" />
            Restart
          </button>
          <button onClick={() => handleAction('delete')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600/10 text-red-400 border border-red-600/20 hover:bg-red-600/20 transition-all text-sm font-medium ml-4">
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Telemetry Cards with Circular Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <CircularGauge
          data={cpuData}
          colors={COLORS.gold}
          icon={Cpu}
          label="CPU Usage"
          value={cpuUsed.toFixed(1)}
          unit="%"
        />
        <CircularGauge
          data={ramData}
          colors={COLORS.blue}
          icon={HardDrive}
          label="RAM Usage"
          value={formatMemBytes(ramUsed).replace(/[^0-9.]/g, '')}
          unit={formatMemBytes(ramUsed).replace(/[0-9.]/g, '')}
        />
        <CircularGauge
          data={playersData}
          colors={COLORS.green}
          icon={Users}
          label="Active Players"
          value={instance.player_count}
          unit="/ 10"
        />
      </div>

      {/* Sub Navigation */}
      <div className="border-b border-white/5">
        <nav className="flex gap-6">
          {[
            { name: 'Overview', path: '', icon: Globe },
            { name: 'Console', path: 'console', icon: Terminal },
            { name: 'Files', path: 'files', icon: FileText },
            { name: 'Settings', path: 'settings', icon: Settings },
          ].map((item) => {
            const isActive = isConsole ? item.path === 'console' : (item.path === '' && location.pathname.endsWith(id!)) || location.pathname.endsWith(item.path);
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                to={item.path}
                className={clsx(
                  'flex items-center gap-2 pb-4 text-sm font-medium border-b-2 transition-all',
                  isActive
                    ? 'border-viking-gold text-viking-gold'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-700'
                )}
              >
                <Icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Content Area */}
      <div className="min-h-[400px]">
        <Outlet />
      </div>
    </div>
  );
}
