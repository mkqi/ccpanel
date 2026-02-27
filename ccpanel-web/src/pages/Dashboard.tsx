import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Server, Cpu, HardDrive, Activity, Clock, RefreshCw, Terminal, Power, Trash2, Database, Loader2, AlertCircle, Wifi } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDataStore } from '../stores/dataStore';
import { useWsStore } from '../stores/wsStore';
import { nodeApi, instanceApi } from '../lib/api';
import type { Node, Instance } from '../lib/api';
import AddInstanceModal from '../components/AddInstanceModal';
import AddNodeModal from '../components/AddNodeModal';

// Helper: format bytes to GB
function formatGB(bytes: number): string {
  return (bytes / (1024 * 1024 * 1024)).toFixed(1);
}

// Helper: format uptime seconds to human-readable
function formatUptime(lastHeartbeat: string): string {
  if (!lastHeartbeat) return 'N/A';
  const diff = Date.now() - new Date(lastHeartbeat).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${mins}m`;
}

import { formatMemBytes } from '../lib/format';

export default function Dashboard() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddNodeModalOpen, setIsAddNodeModalOpen] = useState(false);
  // Read from Zustand store (populated by useDataBootstrap or WebSocket full_sync)
  const storeNodes = useDataStore((s) => s.nodes);
  const storeInstances = useDataStore((s) => s.instances);
  const isLoading = useDataStore((s) => s.isLoading);
  const wsStatus = useWsStore((s) => s.monitorStatus);
  const [error, setError] = useState<string | null>(null);

  // When WS pushes data, store updates automatically → storeNodes/storeInstances re-render
  // So once WS is connected, data stays fresh without polling

  // Derived metrics
  const stats = useMemo(() => {
    const totalInstances = storeInstances.length;
    const runningInstances = storeInstances.filter((i) => i.status === 'running').length;
    const totalPlayers = storeInstances.reduce((sum, i) => sum + (i.player_count || 0), 0);
    const avgCpu = storeNodes.length > 0
      ? storeNodes.reduce((sum, n) => sum + (n.cpu_usage || 0), 0) / storeNodes.length
      : 0;
    const onlineNodes = storeNodes.filter((n) => n.status === 'online').length;
    return { totalInstances, runningInstances, totalPlayers, avgCpu, onlineNodes, totalNodes: storeNodes.length };
  }, [storeNodes, storeInstances]);

  // Loading state
  if (isLoading && storeNodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="w-8 h-8 text-viking-gold animate-spin" />
        <p className="text-gray-400 text-sm">Loading fleet data...</p>
      </div>
    );
  }

  // Error state
  if (error && storeNodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-red-400 text-sm">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-xs font-medium transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Empty state
  if (storeNodes.length === 0 && storeInstances.length === 0) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Fleet Overview</h1>
            <p className="text-gray-400 text-sm mt-1">Manage your Valheim server cluster</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center h-80 gap-6">
          <Server className="w-12 h-12 text-gray-600" />
          <div className="text-center">
            <p className="text-gray-300 font-medium">No nodes registered yet</p>
            <p className="text-gray-500 text-sm mt-1">Add a node to start managing your Valheim servers.</p>
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

  return (
    <div className="space-y-8">
      <AddInstanceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        nodes={storeNodes}
      />
      <AddNodeModal
        isOpen={isAddNodeModalOpen}
        onClose={() => setIsAddNodeModalOpen(false)}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Fleet Overview</h1>
          <p className="text-gray-400 text-sm mt-1">Manage your Valheim server cluster</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-deep-sea/50 rounded-full border border-white/5 text-xs text-gray-400">
            <span className={`w-2 h-2 rounded-full ${wsStatus === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
            {wsStatus === 'connected' ? 'System Healthy' : 'Connecting...'}
          </div>
        </div>
      </div>

      {/* Admin Overview — computed from real data */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-deep-sea/30 backdrop-blur-sm border border-white/5 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-viking-gold/10 text-viking-gold">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Total Instances</p>
            <h3 className="text-2xl font-bold text-white">{stats.totalInstances}</h3>
          </div>
        </div>
        <div className="bg-deep-sea/30 backdrop-blur-sm border border-white/5 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-green-500/10 text-green-400">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Active Players</p>
            <h3 className="text-2xl font-bold text-white">{stats.totalPlayers}</h3>
          </div>
        </div>
        <div className="bg-deep-sea/30 backdrop-blur-sm border border-white/5 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Cluster CPU</p>
            <h3 className="text-2xl font-bold text-white">{stats.avgCpu.toFixed(0)}%</h3>
          </div>
        </div>
        <div className="bg-deep-sea/30 backdrop-blur-sm border border-white/5 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-cyan-500/10 text-cyan-400">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Nodes Online</p>
            <h3 className="text-2xl font-bold text-white">{stats.onlineNodes} <span className="text-sm text-gray-500 font-normal">/ {stats.totalNodes}</span></h3>
          </div>
        </div>
      </section>

      {/* Nodes Section — from store */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-viking-gold" />
            Active Nodes
          </h2>
          <button
            onClick={() => setIsAddNodeModalOpen(true)}
            className="text-xs font-medium text-viking-gold hover:text-white transition-colors"
          >
            + Add Node
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {storeNodes.map((node) => {
            const instancesOnNode = storeInstances.filter((i) => i.node_id === node.id);
            const diskUsedGB = formatGB(node.disk_total - node.disk_free);
            const diskTotalGB = formatGB(node.disk_total);
            const diskPercent = node.disk_total > 0 ? ((node.disk_total - node.disk_free) / node.disk_total) * 100 : 0;

            return (
              <motion.div
                key={node.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-deep-sea/30 backdrop-blur-sm border ${node.status === 'offline' ? 'border-red-500/20' : 'border-white/5'} rounded-xl overflow-hidden transition-all hover:border-white/10`}
              >
                {/* Node Header */}
                <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${node.status === 'online' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                      <Server className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-white font-bold text-lg">{node.name}</h3>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${node.status === 'online' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {node.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 font-mono">
                        <span>{node.address}</span>
                        <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                        <span>{node.hostname || 'Unknown Host'}</span>
                        <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                        <span title={node.id}>ID: {node.id.slice(0, 8)}...</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Refresh">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Terminal">
                      <Terminal className="w-4 h-4" />
                    </button>
                    <div className="h-6 w-px bg-white/10 mx-1"></div>
                    <button className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Remove Node">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Node Body */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-8">
                  {/* Resources */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Resources</h4>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400 flex items-center gap-2">
                          <Cpu className="w-3 h-3" /> CPU Load
                        </span>
                        <span className="text-white font-mono">{node.cpu_usage.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(node.cpu_usage, 100)}%` }}></div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400 flex items-center gap-2">
                          <HardDrive className="w-3 h-3" /> RAM Usage
                        </span>
                        <span className="text-white font-mono">{node.mem_usage.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(node.mem_usage, 100)}%` }}></div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400 flex items-center gap-2">
                          <Database className="w-3 h-3" /> Disk Usage
                        </span>
                        <span className="text-white font-mono">{diskUsedGB} / {diskTotalGB} GB</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${diskPercent}%` }}></div>
                      </div>
                    </div>
                  </div>

                  {/* Capacity */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Capacity</h4>

                    <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-400">Active Instances</span>
                        <span className="text-lg font-bold text-white">{instancesOnNode.filter(i => i.status === 'running').length} <span className="text-xs text-gray-600 font-normal">/ {instancesOnNode.length || 1}</span></span>
                      </div>
                      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-viking-gold to-orange-600 rounded-full transition-all duration-500"
                          style={{ width: `${instancesOnNode.length > 0 ? (instancesOnNode.filter(i => i.status === 'running').length / instancesOnNode.length) * 100 : 0}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-500 mt-2">
                        Running vs Total Instances on this node
                      </p>
                    </div>
                  </div>

                  {/* Environment */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Environment</h4>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-gray-400 text-xs">
                          <Wifi className="w-3 h-3" />
                          <span>Last Heartbeat</span>
                        </div>
                        <span className="text-white font-mono text-xs">{formatUptime(node.last_heartbeat)} ago</span>
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400">OS</span>
                        <span className="text-white font-mono truncate max-w-[150px] text-right" title={node.os_info || 'Unknown'}>
                          {node.os_info || 'Unknown'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400">Docker</span>
                        <span className="text-white font-mono">{node.docker_version || 'N/A'}</span>
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400">Host Uptime</span>
                        <span className="text-white font-mono">
                          {node.uptime_secs ? `${Math.floor(node.uptime_secs / 86400)}d ${Math.floor((node.uptime_secs % 86400) / 3600)}h` : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col justify-center gap-2 border-l border-white/5 pl-8">
                    <button className="w-full py-2 px-4 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2">
                      <Activity className="w-3 h-3" />
                      View Metrics
                    </button>
                    <button className="w-full py-2 px-4 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2">
                      <Terminal className="w-3 h-3" />
                      System Logs
                    </button>
                    <button className="w-full py-2 px-4 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2">
                      <Power className="w-3 h-3" />
                      Reboot Node
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Global Instances Table — from store */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-viking-gold" />
            Global Instances
          </h2>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="text-xs font-medium text-viking-gold hover:text-white transition-colors"
          >
            + Add Instance
          </button>
        </div>

        {storeInstances.length === 0 ? (
          <div className="bg-deep-sea/30 backdrop-blur-sm border border-white/5 rounded-xl p-12 text-center">
            <HardDrive className="w-8 h-8 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No instances created yet.</p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="mt-4 px-4 py-2 bg-viking-gold/10 text-viking-gold text-xs font-medium rounded-lg hover:bg-viking-gold/20 transition-colors"
            >
              + Create First Instance
            </button>
          </div>
        ) : (
          <div className="bg-deep-sea/30 backdrop-blur-sm border border-white/5 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-white/5 bg-white/5 text-xs uppercase tracking-wider">
                  <th className="py-4 px-6 font-medium text-gray-400">Instance & World</th>
                  <th className="py-4 px-6 font-medium text-gray-400">Connection</th>
                  <th className="py-4 px-6 font-medium text-gray-400">Node</th>
                  <th className="py-4 px-6 font-medium text-gray-400">CPU / RAM</th>
                  <th className="py-4 px-6 font-medium text-gray-400">Players</th>
                  <th className="py-4 px-6 font-medium text-gray-400">Created</th>
                  <th className="py-4 px-6 font-medium text-gray-400">Status</th>
                  <th className="py-4 px-6 font-medium text-gray-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {storeInstances.map((instance) => {
                  const nodeName = storeNodes.find((n) => n.id === instance.node_id)?.name || instance.node_name || 'Unknown';
                  const nodeAddress = storeNodes.find((n) => n.id === instance.node_id)?.address || '';
                  const connectionStr = instance.connect_address || (nodeAddress ? `${nodeAddress}:${instance.game_port}` : `Port ${instance.game_port}`);

                  const createdAt = instance.created_at ? new Date(instance.created_at) : null;
                  const createdAgo = createdAt ? (() => {
                    const diff = Math.floor((Date.now() - createdAt.getTime()) / 1000);
                    if (diff < 60) return `${diff}s ago`;
                    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
                    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
                    return `${Math.floor(diff / 86400)}d ago`;
                  })() : 'N/A';

                  const dockerStatus = instance.docker_status || instance.status;
                  const isUp = instance.status === 'running';

                  return (
                    <tr key={instance.id} className="hover:bg-white/5 transition-colors group">
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="font-medium text-white">{instance.name}</span>
                          <span className="text-xs text-gray-500 font-mono">{instance.world_name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-gray-400 font-mono text-xs bg-black/20 px-2 py-1 rounded border border-white/5">
                          {connectionStr}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-gray-300 text-xs">{nodeName}</span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="text-gray-300 text-xs">{instance.cpu_percent.toFixed(1)}%</span>
                          <span className="text-[10px] text-gray-500">{formatMemBytes(instance.mem_bytes)}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-gray-300 font-mono text-xs">{instance.player_count}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-gray-400 font-mono text-xs" title={instance.created_at}>{createdAgo}</span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${isUp ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`}></span>
                          <span className={`text-xs font-mono ${isUp ? 'text-green-400' : 'text-red-400'}`}>{dockerStatus}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Link to={`/instance/${instance.id}`} className="inline-flex items-center justify-center px-4 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-all">
                          Manage
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
