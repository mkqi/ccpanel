import React from 'react';
import { Map, Sliders, Terminal, Activity, Copy, ExternalLink, Globe, Lock, Sun, Tag, Wifi, Archive } from 'lucide-react';
import { motion } from 'motion/react';
import { useParams } from 'react-router-dom';
import { useDataStore } from '../stores/dataStore';

import { instanceApi } from '../lib/api';

export default function InstanceOverview() {
  const { id } = useParams();
  const { instances, nodes } = useDataStore();
  const instance = instances.find(i => i.id === id);
  const node = nodes.find(n => n.id === instance?.node_id);

  if (!instance) {
    return (
      <div className="flex items-center justify-center p-12 bg-deep-sea/10 rounded-xl border border-white/5 italic text-gray-400">
        Loading instance details...
      </div>
    );
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast here
  };

  const connectAddr = instance.connect_address || `${node?.address || 'NodeIP'}:${instance.game_port} `;

  return (
    <div className="space-y-6">
      {/* Top Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* World Configuration Card */}
        <div className="lg:col-span-2 bg-deep-sea/30 border border-white/5 rounded-xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Map className="w-32 h-32 text-viking-gold" />
          </div>

          <div className="relative z-10 transition-all">
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Map className="w-5 h-5 text-viking-gold" />
              World Configuration
            </h3>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Server Name</label>
                  <div className="bg-midnight/50 border border-white/10 rounded-lg px-4 py-2 text-white font-mono text-sm">
                    {instance.env_vars?.['SERVER_NAME'] || instance.name}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">World Name</label>
                  <div className="bg-midnight/50 border border-white/10 rounded-lg px-4 py-2 text-viking-gold font-mono text-sm font-bold">{instance.world_name}</div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 space-y-3">
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-2">
                  <Sliders className="w-3 h-3" /> World Modifiers (Valheim Rules)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {[
                    { label: 'Preset', key: 'MODIFIER_PRESET', default: 'Normal' },
                    { label: 'Resources', key: 'MODIFIER_RESOURCES', default: 'Normal (1x)' },
                    { label: 'Raids', key: 'MODIFIER_RAIDS', default: 'Normal' },
                    { label: 'Portals', key: 'MODIFIER_PORTALS', default: 'Enabled' },
                    { label: 'Combat', key: 'MODIFIER_COMBAT', default: 'Normal' },
                    { label: 'Death Penalty', key: 'MODIFIER_DEATH_PENALTY', default: 'Normal' },
                    { label: 'Build Cost', key: 'MODIFIER_BUILD_COST', default: 'Normal' },
                    { label: 'Map Visibility', key: 'MODIFIER_MAP', default: 'Normal' },
                  ].map(mod => {
                    const val = instance.env_vars?.[mod.key] || mod.default;
                    return (
                      <div key={mod.key} className="flex items-center justify-between p-2.5 rounded-lg bg-black/20 border border-white/5 text-[10px] hover:border-white/10 transition-colors">
                        <span className="text-gray-400 font-medium">{mod.label}</span>
                        <span className="text-viking-gold font-mono font-bold">{val}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Connection Info */}
        <div className="bg-deep-sea/30 border border-white/5 rounded-xl p-6 flex flex-col">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-400" />
            Connection Info
          </h3>

          <div className="space-y-4 flex-1">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Server Address</label>
              <div className="flex gap-2">
                <div
                  onClick={() => copyToClipboard(connectAddr)}
                  className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm flex items-center justify-between group cursor-pointer hover:border-white/20 transition-colors"
                >
                  <span className="truncate">{connectAddr}</span>
                  <Copy className="w-3 h-3 text-gray-500 group-hover:text-white transition-colors flex-shrink-0" />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Password</label>
              <div className="flex gap-2">
                <div
                  onClick={() => copyToClipboard(instance.password || '')}
                  className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm flex items-center justify-between group cursor-pointer hover:border-white/20 transition-colors"
                >
                  <span className="truncate">{(instance.password || '').replace(/./g, '*')}</span>
                  <Copy className="w-3 h-3 text-gray-500 group-hover:text-white transition-colors flex-shrink-0" />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Security</span>
                <div className="flex items-center gap-1.5 text-green-400 font-bold">
                  <Lock className="w-3.5 h-3.5" /> Passworded
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Crossplay</span>
                <span className="text-xs font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">ENABLED</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Version</span>
                <span className="text-xs font-mono text-blue-400">{instance.game_version || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Server Mechanics / Extra Info */}
        <div className="bg-deep-sea/30 border border-white/5 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-viking-gold" />
              Server Mechanics
            </h3>
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-viking-gold/5 border border-viking-gold/10">
                <div className="text-sm font-bold text-viking-gold mb-1">Dedicated Server Mode</div>
                <div className="text-xs text-viking-gold/70 leading-relaxed">
                  Running on Linux container with optimized memory management. Automatic world saves are triggered every 30 minutes.
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center justify-between text-xs px-2">
                  <span className="text-gray-400">Public Visibility</span>
                  <span className="text-blue-400 font-bold">{instance.env_vars?.['SERVER_PUBLIC'] === '0' ? 'Private' : 'Public'}</span>
                </div>
                <div className="flex items-center justify-between text-xs px-2">
                  <span className="text-gray-400">Backup Retention</span>
                  <span className="text-gray-300 font-bold">20 Snapshots</span>
                </div>
                <div className="flex items-center justify-between text-xs px-2">
                  <span className="text-gray-400">Last Sync</span>
                  <span className="text-gray-500 font-mono text-[10px]">
                    {instance.updated_at ? new Date(instance.updated_at).toLocaleTimeString() : 'Never'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-white/5">
            <button className="w-full py-2.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-xs font-bold hover:bg-white/10 hover:text-white transition-all uppercase tracking-widest">
              Update Instance Config
            </button>
          </div>
        </div>

        {/* Quick Command */}
        <div className="bg-deep-sea/30 border border-white/5 rounded-xl p-6 flex flex-col">
          <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-green-400" />
            Quick Command
          </h3>
          <p className="text-xs text-gray-500 mb-6">Dispatch RCON instructions directly to the instance.</p>

          <div className="mt-auto space-y-3">
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const input = form.elements.namedItem('command') as HTMLInputElement;
                const val = input.value.trim();
                if (!val || !id) return;

                try {
                  input.disabled = true;
                  const res = await instanceApi.rcon(id, val);
                  alert(`Success: ${res?.result || 'Command sent'} `);
                  input.value = '';
                } catch (err: any) {
                  alert(`Failed: ${err.message} `);
                } finally {
                  input.disabled = false;
                  input.focus();
                }
              }}
            >
              <input
                type="text"
                name="command"
                placeholder="e.g. /save, /kick <player>"
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white font-mono text-sm focus:outline-none focus:border-viking-gold/50 transition-colors"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-viking-gold/10 text-viking-gold border border-viking-gold/20 hover:bg-viking-gold/20 rounded-lg transition-all font-bold text-sm"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
