import { create } from 'zustand';

type WsStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

interface WsState {
    monitorStatus: WsStatus;
    logStatus: WsStatus;
    rconStatus: WsStatus;
    setMonitorStatus: (s: WsStatus) => void;
    setLogStatus: (s: WsStatus) => void;
    setRconStatus: (s: WsStatus) => void;
}

export const useWsStore = create<WsState>((set) => ({
    monitorStatus: 'disconnected',
    logStatus: 'disconnected',
    rconStatus: 'disconnected',
    setMonitorStatus: (s) => set({ monitorStatus: s }),
    setLogStatus: (s) => set({ logStatus: s }),
    setRconStatus: (s) => set({ rconStatus: s }),
}));
