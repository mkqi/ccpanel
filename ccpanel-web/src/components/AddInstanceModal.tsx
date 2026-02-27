import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Rocket, Server, ChevronDown, Globe, Gamepad2, Puzzle, AlertTriangle, ArrowRight, Minimize2, CheckCircle, Terminal, Cpu } from 'lucide-react';
import { clsx } from 'clsx';
import { instanceApi } from '../lib/api';

interface Node {
  id: number;
  name: string;
  ip: string;
  status?: string;
}

interface AddInstanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: any[]; // Using any[] to match the mock data structure from Dashboard
}

export default function AddInstanceModal({ isOpen, onClose, nodes }: AddInstanceModalProps) {
  const [step, setStep] = useState(1);
  const [isDeploying, setIsDeploying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    node_id: nodes[0]?.id || '',
    spec: '2c4g',
    port: 2456,
    world_name: '',
    password: '',
    visibility: 'public',
    crossplay: true,
    server_type: 'vanilla',
    // World Modifiers
    resource_rate: 1,
    raid_rate: 1,
    portal_items: true,
    no_build_cost: false
  });

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setIsDeploying(false);
      setProgress(0);
      setLogs([]);
    }
  }, [isOpen]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleDeploy = async () => {
    setIsDeploying(true);
    setLogs(['[INFO] Preparing deployment...']);

    try {
      await instanceApi.create({
        name: formData.name,
        world_name: formData.world_name,
        password: formData.password,
        node_id: formData.node_id,
        image: 'lloesche/valheim-server:latest',
        rcon_password: formData.password + 'rcon', // Autogenerate RCON pass based on game pass
      });

      // Simulate UI progress for aesthetics since backend runs async via gRPC
      const steps = [
        { p: 10, msg: '[INFO] Requested Backend API...' },
        { p: 35, msg: '[INFO] Dispatching gRPC command to Agent...' },
        { p: 60, msg: '[INFO] Instructing Docker to pull image and create...' },
        { p: 100, msg: '[SUCCESS] Instance queued! View dashboard for sync.' }
      ];

      let currentStep = 0;
      const interval = setInterval(() => {
        if (currentStep >= steps.length) {
          clearInterval(interval);
          setTimeout(() => {
            onClose();
          }, 1500);
          return;
        }
        const s = steps[currentStep];
        setProgress(s.p);
        setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} ${s.msg}`]);
        currentStep++;
      }, 500);

    } catch (err: any) {
      setLogs(prev => [...prev, `[ERROR] Failed to deploy: ${err.message || 'Unknown error'}`]);
      setProgress(100); // Stop progress visually on error (can add error styling later)
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal Content */}
          {!isDeploying ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-deep-sea w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden relative z-10 flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-viking-gold/10 rounded-lg text-viking-gold">
                    <Rocket className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Deploy New Server Instance</h2>
                </div>
                <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Stepper */}
              <div className="px-8 py-6 bg-black/20 border-b border-white/5">
                <div className="flex items-center justify-between max-w-md mx-auto relative">
                  {/* Progress Bar Background */}
                  <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/10 -translate-y-1/2 z-0"></div>
                  {/* Active Progress Bar */}
                  <div
                    className="absolute top-1/2 left-0 h-0.5 bg-viking-gold -translate-y-1/2 z-0 transition-all duration-300"
                    style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}
                  ></div>

                  {[1, 2, 3].map((s) => (
                    <div key={s} className="relative z-10 flex flex-col items-center gap-2">
                      <div className={clsx(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300",
                        step >= s
                          ? 'bg-viking-gold text-midnight shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                          : 'bg-deep-sea border border-white/10 text-gray-500'
                      )}>
                        {s}
                      </div>
                      <span className={clsx(
                        "text-[10px] font-bold uppercase tracking-wider transition-colors duration-300",
                        step >= s ? 'text-viking-gold' : 'text-gray-600'
                      )}>
                        {s === 1 ? 'Basic Info' : s === 2 ? 'Config' : 'World Modifiers'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form Content */}
              <div className="p-8 overflow-y-auto min-h-[400px]">
                <AnimatePresence mode="wait">
                  {step === 1 && (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="grid grid-cols-1 gap-6"
                    >
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Select Target Node</label>
                        <div className="relative group">
                          <Server className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-viking-gold transition-colors" />
                          <select
                            value={formData.node_id}
                            onChange={(e) => setFormData({ ...formData, node_id: e.target.value })}
                            className="w-full bg-midnight/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-viking-gold/50 focus:ring-1 focus:ring-viking-gold/50 transition-all appearance-none"
                          >
                            {nodes.map(n => (
                              <option key={n.id} value={n.id}>
                                {n.name} ({n.address || n.ip || 'No address'})
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Instance Specification</label>
                        <div className="relative group">
                          <Cpu className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-viking-gold transition-colors" />
                          <select
                            value={formData.spec}
                            onChange={(e) => setFormData({ ...formData, spec: e.target.value })}
                            className="w-full bg-midnight/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-viking-gold/50 focus:ring-1 focus:ring-viking-gold/50 transition-all appearance-none"
                          >
                            <option value="1c2g">Starter (1 vCPU / 2GB RAM)</option>
                            <option value="2c4g">Standard (2 vCPU / 4GB RAM)</option>
                            <option value="4c8g">Performance (4 vCPU / 8GB RAM)</option>
                            <option value="8c16g">Extreme (8 vCPU / 16GB RAM)</option>
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Server Name</label>
                          <input
                            className="w-full bg-midnight/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-viking-gold/50 focus:ring-1 focus:ring-viking-gold/50 transition-all placeholder-gray-600"
                            placeholder="e.g. My Epic Server"
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">World Name</label>
                          <input
                            className="w-full bg-midnight/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-viking-gold/50 focus:ring-1 focus:ring-viking-gold/50 transition-all placeholder-gray-600"
                            placeholder="e.g. Midgard"
                            type="text"
                            value={formData.world_name}
                            onChange={(e) => setFormData({ ...formData, world_name: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Server Password</label>
                          <input
                            className="w-full bg-midnight/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-viking-gold/50 focus:ring-1 focus:ring-viking-gold/50 transition-all placeholder-gray-600"
                            placeholder="Min 5 characters"
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Network Port</label>
                          <input
                            className="w-full bg-midnight/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-viking-gold/50 focus:ring-1 focus:ring-viking-gold/50 transition-all placeholder-gray-600"
                            placeholder="2456"
                            type="number"
                            value={formData.port}
                            onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {step === 2 && (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="grid grid-cols-1 gap-6"
                    >
                      <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Server Type</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {[
                            { id: 'vanilla', name: 'Vanilla', desc: 'Official Valheim' },
                            { id: 'plus', name: 'Valheim Plus', desc: 'Community Mod' },
                            { id: 'bepinex', name: 'BepInEx', desc: 'Mod Loader' }
                          ].map((type) => (
                            <div
                              key={type.id}
                              onClick={() => setFormData({ ...formData, server_type: type.id })}
                              className={clsx(
                                "cursor-pointer rounded-xl border p-4 transition-all",
                                formData.server_type === type.id
                                  ? "bg-viking-gold/10 border-viking-gold"
                                  : "bg-white/5 border-white/5 hover:border-white/10"
                              )}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className={clsx(
                                  "font-bold text-sm",
                                  formData.server_type === type.id ? "text-viking-gold" : "text-white"
                                )}>{type.name}</span>
                                {formData.server_type === type.id && <CheckCircle className="w-4 h-4 text-viking-gold" />}
                              </div>
                              <p className="text-xs text-gray-500">{type.desc}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                        <div className="flex gap-4">
                          <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 h-fit">
                            <Globe className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">Public Server</p>
                            <p className="text-xs text-gray-500 mt-0.5">List this server on the community browser</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={formData.visibility === 'public'}
                            onChange={(e) => setFormData({ ...formData, visibility: e.target.checked ? 'public' : 'private' })}
                          />
                          <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-viking-gold"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                        <div className="flex gap-4">
                          <div className="p-2 bg-green-500/10 rounded-lg text-green-400 h-fit">
                            <Gamepad2 className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">Crossplay</p>
                            <p className="text-xs text-gray-500 mt-0.5">Enable crossplay for Xbox/Gamepass players</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={formData.crossplay}
                            onChange={(e) => setFormData({ ...formData, crossplay: e.target.checked })}
                          />
                          <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-viking-gold"></div>
                        </label>
                      </div>
                    </motion.div>
                  )}

                  {step === 3 && (
                    <motion.div
                      key="step3"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="grid grid-cols-1 gap-6"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Resource Rate (x{formData.resource_rate})</label>
                          <div className="bg-midnight/50 border border-white/10 rounded-xl px-4 py-3">
                            <input
                              type="range"
                              min="0.5"
                              max="3"
                              step="0.5"
                              value={formData.resource_rate}
                              onChange={(e) => setFormData({ ...formData, resource_rate: parseFloat(e.target.value) })}
                              className="w-full accent-viking-gold"
                            />
                            <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-mono">
                              <span>0.5x</span>
                              <span>1x</span>
                              <span>2x</span>
                              <span>3x</span>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Raid Rate (x{formData.raid_rate})</label>
                          <div className="bg-midnight/50 border border-white/10 rounded-xl px-4 py-3">
                            <input
                              type="range"
                              min="0"
                              max="3"
                              step="0.5"
                              value={formData.raid_rate}
                              onChange={(e) => setFormData({ ...formData, raid_rate: parseFloat(e.target.value) })}
                              className="w-full accent-viking-gold"
                            />
                            <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-mono">
                              <span>None</span>
                              <span>1x</span>
                              <span>2x</span>
                              <span>3x</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                        <div className="flex gap-4">
                          <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400 h-fit">
                            <Puzzle className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">Portal Items</p>
                            <p className="text-xs text-gray-500 mt-0.5">Allow metals to be teleported through portals</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={formData.portal_items}
                            onChange={(e) => setFormData({ ...formData, portal_items: e.target.checked })}
                          />
                          <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-viking-gold"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                        <div className="flex gap-4">
                          <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400 h-fit">
                            <AlertTriangle className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">No Build Cost</p>
                            <p className="text-xs text-gray-500 mt-0.5">Building structures requires no resources</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={formData.no_build_cost}
                            onChange={(e) => setFormData({ ...formData, no_build_cost: e.target.checked })}
                          />
                          <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-viking-gold"></div>
                        </label>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer Actions */}
              <div className="px-8 py-6 border-t border-white/5 bg-black/20 flex items-center justify-between">
                <button
                  onClick={onClose}
                  className="px-6 py-2 text-sm font-bold text-gray-500 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <div className="flex gap-3">
                  {step > 1 && (
                    <button
                      onClick={() => setStep(step - 1)}
                      className="px-6 py-2.5 rounded-lg text-sm font-bold border border-white/10 text-gray-300 hover:bg-white/5 transition-all"
                    >
                      Back
                    </button>
                  )}
                  <button
                    onClick={() => step < 3 ? setStep(step + 1) : handleDeploy()}
                    className="bg-gradient-to-r from-viking-gold to-orange-600 hover:from-viking-gold-dim hover:to-orange-700 text-white px-8 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-orange-900/20 transition-all flex items-center gap-2 active:scale-95"
                  >
                    {step === 3 ? 'Deploy Now' : 'Next Step'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            /* Deployment Progress View */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-deep-sea w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden relative z-10"
            >
              <div className="p-8 flex flex-col items-center">
                <div className="relative w-32 h-32 mb-8">
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    <circle className="text-white/5 stroke-current" strokeWidth="8" cx="50" cy="50" r="40" fill="transparent"></circle>
                    <circle
                      className="text-viking-gold stroke-current transition-all duration-500 ease-out"
                      strokeWidth="8"
                      strokeLinecap="round"
                      cx="50" cy="50" r="40"
                      fill="transparent"
                      strokeDasharray="251.2"
                      strokeDashoffset={251.2 - (251.2 * progress) / 100}
                      transform="rotate(-90 50 50)"
                    ></circle>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-3xl font-bold text-white font-mono">{progress}%</span>
                  </div>
                </div>

                <h2 className="text-xl font-bold text-white mb-2">Deploying Instance...</h2>
                <p className="text-gray-500 text-sm mb-8">Target: {formData.name} • Node: {nodes.find(n => n.id == formData.node_id)?.name || 'Unknown'}</p>

                <div className="w-full bg-black/40 rounded-xl border border-white/10 p-4 font-mono text-xs space-y-1 h-48 overflow-y-auto custom-scrollbar">
                  <div className="flex items-center justify-between mb-2 border-b border-white/10 pb-2">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500/50"></div>
                    </div>
                    <div className="flex items-center gap-2 text-green-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-[10px] font-bold uppercase">Live Log</span>
                    </div>
                  </div>
                  {logs.map((log, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="text-gray-500 shrink-0">{log.split(' ')[0]}</span>
                      <span className={log.includes('[INFO]') ? 'text-blue-400' : log.includes('[SUCCESS]') ? 'text-green-400' : 'text-gray-300'}>
                        {log.split(' ').slice(1).join(' ')}
                      </span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>

                <button
                  onClick={onClose}
                  className="mt-8 w-full flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 rounded-lg font-bold text-sm text-gray-300 hover:text-white transition-all"
                >
                  <Minimize2 className="w-4 h-4" />
                  Minimize to Background
                </button>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </AnimatePresence>
  );
}
