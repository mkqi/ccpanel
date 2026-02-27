import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { FileText, Search, Filter, Download, User, Clock, Activity, Shield, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { logApi, OperationLog } from '../lib/api';

export default function AuditLogs() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterModule, setFilterModule] = useState('All');
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchLogs() {
      try {
        setIsLoading(true);
        const data = await logApi.list({ limit: 100 });
        if (!cancelled) {
          setLogs(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchLogs();
    return () => { cancelled = true; };
  }, []);

  const filteredLogs = logs.filter(log => {
    const targetName = log.instance_name || log.node_name || 'System';
    const matchesSearch = log.detail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      targetName.toLowerCase().includes(searchTerm.toLowerCase());

    let module = 'System';
    if (log.instance_id) module = 'Instance';
    else if (log.node_id) module = 'Node';

    const matchesFilter = filterModule === 'All' || module === filterModule;
    return matchesSearch && matchesFilter;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-amber-400" />;
      case 'failed':
      case 'error': return <XCircle className="w-4 h-4 text-red-400" />;
      default: return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'warning': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'failed':
      case 'error': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleString();
  };

  if (isLoading && logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="w-8 h-8 text-viking-gold animate-spin" />
        <p className="text-gray-400 text-sm">Loading audit logs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Audit Logs</h1>
          <p className="text-gray-400 text-sm mt-1">Track system activities and security events</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 border border-white/5">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-deep-sea/30 backdrop-blur-sm border border-white/5 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-viking-gold/50 transition-all placeholder-gray-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar">
          <Filter className="w-4 h-4 text-gray-500 mr-2" />
          {['All', 'Instance', 'Node', 'System'].map(module => (
            <button
              key={module}
              onClick={() => setFilterModule(module)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${filterModule === module
                  ? 'bg-viking-gold text-midnight font-bold'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                }`}
            >
              {module}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-deep-sea/30 backdrop-blur-sm border border-white/5 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-white/5 bg-white/5 text-xs uppercase tracking-wider">
                <th className="py-4 px-6 font-medium text-gray-400">Timestamp</th>
                <th className="py-4 px-6 font-medium text-gray-400">User</th>
                <th className="py-4 px-6 font-medium text-gray-400">Action</th>
                <th className="py-4 px-6 font-medium text-gray-400">Target</th>
                <th className="py-4 px-6 font-medium text-gray-400 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredLogs.map((log) => (
                <motion.tr
                  key={log.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-white/5 transition-colors group"
                >
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2 text-gray-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="font-mono text-xs">{formatDate(log.created_at)}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs">
                        A
                      </div>
                      <span className="text-white font-medium">admin</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex flex-col">
                      <span className="text-white font-medium">{log.action || 'Unknown'}</span>
                      <span className="text-xs text-gray-500">{log.detail}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-gray-300 font-mono text-xs bg-black/20 px-2 py-1 rounded border border-white/5">
                      {log.instance_name || log.node_name || 'System'}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${getStatusStyles(log.result)}`}>
                      {getStatusIcon(log.result)}
                      <span className="capitalize">{log.result || 'success'}</span>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredLogs.length === 0 && (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-600" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">No logs found</h3>
            <p className="text-gray-500 text-sm">Try adjusting your search or filters</p>
          </div>
        )}

        <div className="px-6 py-4 border-t border-white/5 bg-white/5 flex items-center justify-between text-xs text-gray-500">
          <span>Showing {filteredLogs.length} events</span>
          <div className="flex gap-2">
            <button className="px-3 py-1 rounded hover:bg-white/10 disabled:opacity-50" disabled>Previous</button>
            <button className="px-3 py-1 rounded hover:bg-white/10" disabled>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
