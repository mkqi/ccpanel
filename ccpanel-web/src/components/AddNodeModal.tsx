import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Server, Terminal, Copy, Check, Shield } from 'lucide-react';

interface AddNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddNodeModal({ isOpen, onClose }: AddNodeModalProps) {
  const [copied, setCopied] = useState(false);

  // Generate a random token for the demo
  const installCommand = `curl -sfL https://get.ccpanel.io/agent | sudo sh -s -- --token og_live_7x82k92m10z --server https://panel.ccpanel.io`;

  const handleCopy = () => {
    navigator.clipboard.writeText(installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

          {/* Modal Container */}
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
                  <Server className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">Connect New Node</h2>
              </div>
              <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Body */}
            <div className="p-8 overflow-y-auto space-y-8">
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white">Install Agent</h3>
                <p className="text-sm text-gray-400">
                  Run this command on your server to install the CCPanel agent. The node will automatically appear in the dashboard once connected.
                </p>
                
                <div className="bg-black/40 border border-white/10 rounded-xl overflow-hidden group">
                  <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-gray-500" />
                      <span className="text-xs font-mono text-gray-400">bash</span>
                    </div>
                    <button 
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-white transition-colors"
                    >
                      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'Copied!' : 'Copy Command'}
                    </button>
                  </div>
                  <div className="p-4 font-mono text-sm text-green-400 break-all selection:bg-green-500/30 selection:text-green-200">
                    {installCommand}
                  </div>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-3">
                <Shield className="w-5 h-5 text-blue-400 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-blue-400">System Requirements</h4>
                  <ul className="text-xs text-blue-200/70 mt-1 space-y-1 list-disc list-inside">
                    <li>Ubuntu 20.04+ / Debian 11+</li>
                    <li>2 vCPU, 4GB RAM minimum</li>
                    <li>Docker & Docker Compose installed</li>
                    <li>Ports 2456-2458 UDP open</li>
                  </ul>
                </div>
              </div>

              <div className="flex items-center justify-center py-4">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full border-2 border-white/10 border-t-viking-gold animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Server className="w-5 h-5 text-gray-600" />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-white font-medium">Waiting for connection...</h4>
                    <p className="text-xs text-gray-500 mt-1">Listening for agent registration signal</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-6 border-t border-white/5 bg-black/20 flex items-center justify-end">
              <button 
                onClick={onClose}
                className="bg-white/10 hover:bg-white/20 text-white px-8 py-2.5 rounded-lg text-sm font-bold transition-all"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
