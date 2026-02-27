import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Server, Activity, Cpu, HardDrive, Clock, MoreVertical, Terminal, RefreshCw, Power, Trash2, Container, Box, ChevronDown, Network, FileText, Settings, Shield, AlertCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import AddNodeModal from '../components/AddNodeModal';
import { clsx } from 'clsx';
import { useDataStore } from '../stores/dataStore';
import { formatUptime } from '../lib/format';

export default function NodeManagement() {
  const [isAddNodeModalOpen, setIsAddNodeModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'console'>('overview');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const nodes = useDataStore((s) => s.nodes);
  const nodeHistory = useDataStore((s) => s.nodeHistory);

  const [selectedNodeId, setSelectedNodeId] = useState<string>('');

  useEffect(() => {
    if (!selectedNodeId && nodes.length > 0) {
      setSelectedNodeId(nodes[0].id);
    }
  }, [nodes, selectedNodeId]);

  if (nodes.length === 0) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Node Management</h1>
            <p className="text-gray-400 text-sm mt-1">Monitor and manage your compute infrastructure</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center h-80 gap-6">
          <Server className="w-12 h-12 text-gray-600" />
          <div className="text-center">
            <p className="text-gray-300 font-medium">No nodes registered yet</p>
            <p className="text-gray-500 text-sm mt-1">Add a node to start managing your infrastructure.</p>
          </div>
          <button
            onClick={() => setIsAddNodeModalOpen(true)}
            className="px-6 py-2.5 bg-gradient-to-r from-viking-gold to-orange-600 text-white font-medium rounded-xl text-sm hover:from-viking-gold-dim hover:to-orange-700 transition-all"
          >
            + Add First Node
          </button>
        </div>
        <AddNodeModal isOpen={isAddNodeModalOpen} onClose={() => setIsAddNodeModalOpen(false)} />
      </div>
    );
  }

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || nodes[0];
  const history = nodeHistory[selectedNode.id] || { cpu: [], ram: [] };

  const cpuData = history.cpu.length > 0 ? history.cpu : [{ time: '00:00', value: 0 }];
  const ramData = history.ram.length > 0 ? history.ram : [{ time: '00:00', value: 0 }];

  const diskUsedBytes = (selectedNode.disk_total || 0) - (selectedNode.disk_free || 0);
  const diskTotalGB = ((selectedNode.disk_total || 0) / 1024 / 1024 / 1024).toFixed(1);
  const diskUsedGB = (diskUsedBytes / 1024 / 1024 / 1024).toFixed(1);
  const diskPct = selectedNode.disk_total ? Math.round((diskUsedBytes / selectedNode.disk_total) * 100) : 0;

  return (
    <div className="space-y-6">
      <AddNodeModal
        isOpen={isAddNodeModalOpen}
        onClose={() => setIsAddNodeModalOpen(false)}
      />

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Node Management</h1>
          <p className="text-gray-400 text-sm mt-1">Monitor and manage your compute infrastructure</p>
        </div>

        {/* Node Selector & Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${selectedNode.status === 'online' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
              {selectedNode.status}
            </span>
            <span className="text-xs text-gray-500 font-mono hidden md:inline-block">
              Uptime: {formatUptime(selectedNode.uptime_secs || 0)}
            </span>
          </div>

          <div className="h-8 w-px bg-white/10 hidden md:block"></div>

          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-3 px-4 py-2.5 bg-deep-sea border border-white/10 rounded-xl hover:bg-white/5 transition-all min-w-[240px]"
            >
              <div className={`p-1.5 rounded-lg ${selectedNode.status === 'online' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                <Server className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-bold text-white">{selectedNode.name}</div>
                <div className="text-[10px] text-gray-400 font-mono">{selectedNode.address}</div>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
                <div className="absolute top-full right-0 mt-2 w-full min-w-[280px] bg-deep-sea border border-white/10 rounded-xl shadow-2xl overflow-hidden z-20 py-1">
                  {nodes.map(node => (
                    <button
                      key={node.id}
                      onClick={() => {
                        setSelectedNodeId(node.id);
                        setIsDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                    >
                      <div className={`w-2 h-2 rounded-full ${node.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                      <div>
                        <div className="text-sm font-medium text-white">{node.name}</div>
                        <div className="text-[10px] text-gray-500 font-mono">{node.address}</div>
                      </div>
                      {selectedNodeId === node.id && <div className="ml-auto text-viking-gold text-xs">Active</div>}
                    </button>
                  ))}
                  <div className="border-t border-white/5 mt-1 pt-1">
                    <button
                      onClick={() => {
                        setIsAddNodeModalOpen(true);
                        setIsDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-3 text-xs font-bold text-viking-gold hover:bg-viking-gold/10 transition-colors"
                    >
                      <Server className="w-3 h-3" />
                      Connect New Node
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 gap-4 md:gap-0">
        <div className="flex gap-6 overflow-x-auto no-scrollbar">
          {[
            { id: 'overview', label: 'Overview', icon: Activity },
            { id: 'logs', label: 'System Logs', icon: FileText },
            { id: 'console', label: 'Web Console', icon: Terminal },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={clsx(
                "pb-4 text-sm font-medium flex items-center gap-2 transition-all relative whitespace-nowrap",
                activeTab === tab.id ? "text-viking-gold" : "text-gray-400 hover:text-white"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 w-full h-0.5 bg-viking-gold"
                />
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 pb-2 md:pb-3">
          <button className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-2">
            <Power className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reboot</span>
          </button>
          <button className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg text-xs font-medium transition-colors flex items-center gap-2">
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[500px]">
        {activeTab === 'overview' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-deep-sea/30 border border-white/5 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <span className="text-sm text-gray-400">CPU Usage</span>
                </div>
                <div className="text-2xl font-bold text-white font-mono">{Math.round(selectedNode.cpu_usage || 0)}%</div>
                <div className="mt-2 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${selectedNode.cpu_usage || 0}%` }} />
                </div>
              </div>

              <div className="bg-deep-sea/30 border border-white/5 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                    <HardDrive className="w-4 h-4" />
                  </div>
                  <span className="text-sm text-gray-400">RAM Usage</span>
                </div>
                <div className="text-2xl font-bold text-white font-mono">{Math.round(selectedNode.mem_usage || 0)}%</div>
                <div className="mt-2 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 transition-all duration-500" style={{ width: `${selectedNode.mem_usage || 0}%` }} />
                </div>
              </div>

              <div className="bg-deep-sea/30 border border-white/5 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-orange-500/10 rounded-lg text-orange-400">
                    <HardDrive className="w-4 h-4" />
                  </div>
                  <span className="text-sm text-gray-400">Disk Usage</span>
                </div>
                <div className="text-2xl font-bold text-white font-mono">{diskUsedGB} <span className="text-sm text-gray-500">/ {diskTotalGB} GB</span></div>
                <div className="mt-2 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 transition-all duration-500" style={{ width: `${diskPct}%` }} />
                </div>
              </div>
            </div>

            {/* Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-deep-sea/30 border border-white/5 rounded-xl p-6 h-80">
                <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-viking-gold" />
                  CPU History
                </h3>
                <ResponsiveContainer width="100%" height="85%">
                  <AreaChart data={cpuData}>
                    <defs>
                      <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis dataKey="time" stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Area type="monotone" dataKey="value" stroke="#3B82F6" fillOpacity={1} fill="url(#colorCpu)" animationDuration={300} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-deep-sea/30 border border-white/5 rounded-xl p-6 h-80">
                <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-viking-gold" />
                  Memory History
                </h3>
                <ResponsiveContainer width="100%" height="85%">
                  <AreaChart data={ramData}>
                    <defs>
                      <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#A855F7" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#A855F7" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis dataKey="time" stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Area type="monotone" dataKey="value" stroke="#A855F7" fillOpacity={1} fill="url(#colorRam)" animationDuration={300} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* System Info */}
            <div className="bg-deep-sea/30 border border-white/5 rounded-xl p-6">
              <h3 className="text-sm font-bold text-white mb-4">System Information</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Operating System</div>
                  <div className="text-sm text-white font-mono">{selectedNode.os_info || 'Unknown OS'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Kernel Version</div>
                  <div className="text-sm text-white font-mono">{selectedNode.kernel_version || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Docker Version</div>
                  <div className="text-sm text-white font-mono">{selectedNode.docker_version || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Hostname</div>
                  <div className="text-sm text-white font-mono">{selectedNode.hostname || 'Unknown'}</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Deferred implementation as requested by user / MVP limitations */}
        {(activeTab === 'logs' || activeTab === 'console') && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-80 gap-4 bg-deep-sea/30 border border-white/5 rounded-xl p-6 text-center"
          >
            <AlertCircle className="w-12 h-12 text-gray-600" />
            <div>
              <p className="text-gray-300 font-medium">Coming Soon in Phase 2</p>
              <p className="text-gray-500 text-sm mt-1 max-w-md">
                Direct Host Terminal and Syslog trailing are advanced features planned for the next major release (Phase 2). For now, please use standard SSH to access host telemetry.
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
