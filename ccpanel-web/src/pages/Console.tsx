import React, { useState, useEffect, useRef } from 'react';
import { Send, Save, UserX, Radio } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { instanceApi } from '../lib/api';
import { WebSocketClient } from '../lib/ws';

export default function Console() {
  const { id } = useParams();
  const [logs, setLogs] = useState<{ type: string; time: string; message: string }[]>([]);
  const [command, setCommand] = useState('');
  const [wsStatus, setWsStatus] = useState('disconnected');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    let ws: WebSocketClient;

    const startStreaming = async () => {
      try {
        await instanceApi.startLogs(id);
        ws = new WebSocketClient(`logs/${id}` as any);

        ws.onStatusChange(setWsStatus);

        ws.onMessage((msg) => {
          if (msg.type === 'log_chunk') {
            const data = msg.data as any;

            // Basic parsing of log type
            let type = 'INFO';
            const content = data.content as string;
            if (content.toLowerCase().includes('error') || content.toLowerCase().includes('failed') || content.toLowerCase().includes('exception')) {
              type = 'ERROR';
            } else if (content.toLowerCase().includes('warn')) {
              type = 'WARN';
            }

            setLogs(prev => {
              const newLogs = [...prev, {
                type,
                time: new Date(msg.ts || Date.now()).toLocaleTimeString(),
                message: content
              }];
              // keep max 1000 lines
              return newLogs.slice(-1000);
            });
          }
        });

        ws.connect();
      } catch (err) {
        console.error("Failed to start logs:", err);
      }
    };

    startStreaming();

    return () => {
      if (ws) ws.disconnect();
      if (id) {
        instanceApi.stopLogs(id).catch(console.error);
      }
    };
  }, [id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || !id) return;

    const currentCmd = command.trim();
    setLogs(prev => [...prev.slice(-999), { type: 'CMD', time: new Date().toLocaleTimeString(), message: `> ${currentCmd}` }]);
    setCommand('');

    try {
      const res = await instanceApi.rcon(id, currentCmd);
      if (res.result) {
        setLogs(prev => [...prev.slice(-999), { type: 'INFO', time: new Date().toLocaleTimeString(), message: res.result }]);
      } else {
        setLogs(prev => [...prev.slice(-999), { type: 'INFO', time: new Date().toLocaleTimeString(), message: 'Ok.' }]);
      }
    } catch (err: any) {
      setLogs(prev => [...prev.slice(-999), { type: 'ERROR', time: new Date().toLocaleTimeString(), message: err.message || 'RCON Failed' }]);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[600px]">
      {/* Terminal Window */}
      <div className="lg:col-span-3 bg-black rounded-xl border border-white/10 flex flex-col overflow-hidden shadow-2xl font-mono text-sm">
        <div className="bg-gray-900/50 px-4 py-2 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
            </div>
            <span className="text-xs text-gray-500 ml-2">valheim_server.x86_64</span>
          </div>
          <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${wsStatus === 'connected' ? 'bg-green-500/10 text-green-400 border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)] animate-pulse' :
            wsStatus === 'reconnecting' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20 animate-pulse' :
              'bg-gray-500/10 text-gray-400 border-gray-500/20'
            }`}>
            WS: {wsStatus}
          </span>
        </div>

        <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-1">
          {logs.map((log, i) => (
            <div key={i} className="flex gap-3 hover:bg-white/5 p-0.5 rounded px-2 transition-colors">
              <span className="text-gray-600 shrink-0">[{log.time}]</span>
              <span className={`shrink-0 font-bold w-16 ${log.type === 'INFO' ? 'text-green-400' :
                log.type === 'WARN' ? 'text-yellow-400' :
                  log.type === 'ERROR' ? 'text-red-400' : 'text-blue-400'
                }`}>
                [{log.type}]
              </span>
              <span className="text-gray-300 break-all">{log.message}</span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSend} className="p-4 bg-gray-900/50 border-t border-white/5 flex gap-2">
          <span className="text-viking-gold font-bold py-2">sh {'>'}</span>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            className="flex-1 bg-transparent border-none text-white focus:ring-0 placeholder-gray-600 font-mono"
            placeholder="Type a command..."
            autoFocus
          />
          <button type="submit" className="text-gray-400 hover:text-white transition-colors">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Command Presets */}
      <div className="space-y-4">
        <div className="bg-deep-sea/30 border border-white/5 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">Quick Commands</h3>
          <div className="space-y-2">
            <button onClick={() => setCommand('save')} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-white/5 hover:bg-viking-gold/10 hover:text-viking-gold border border-white/5 hover:border-viking-gold/30 transition-all text-left text-sm text-gray-300 group">
              <Save className="w-4 h-4 text-gray-500 group-hover:text-viking-gold transition-colors" />
              Save World
            </button>
            <button onClick={() => setCommand('kick all')} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-white/5 hover:bg-red-500/10 hover:text-red-400 border border-white/5 hover:border-red-500/30 transition-all text-left text-sm text-gray-300 group">
              <UserX className="w-4 h-4 text-gray-500 group-hover:text-red-400 transition-colors" />
              Kick All Players
            </button>
            <button onClick={() => setCommand('say Server restarting in 5m')} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-white/5 hover:bg-blue-500/10 hover:text-blue-400 border border-white/5 hover:border-blue-500/30 transition-all text-left text-sm text-gray-300 group">
              <Radio className="w-4 h-4 text-gray-500 group-hover:text-blue-400 transition-colors" />
              Broadcast Restart
            </button>
          </div>
        </div>

        <div className="bg-deep-sea/30 border border-white/5 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">Server Status</h3>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-gray-500">PID</span>
              <span className="text-gray-300 font-mono">48291</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-gray-500">Version</span>
              <span className="text-gray-300 font-mono">0.217.22</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-gray-500">Region</span>
              <span className="text-gray-300 font-mono">us-east-1</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
