import { create } from 'zustand';
import type { Node, Instance } from '../lib/api';

export interface DataPoint {
    time: string;
    value: number;
}

export interface NodeMetricsHistory {
    cpu: DataPoint[];
    ram: DataPoint[];
}

interface DataState {
    nodes: Node[];
    instances: Instance[];
    selectedInstanceId: string | null;
    activeTab: string;
    isLoading: boolean;
    nodeHistory: Record<string, NodeMetricsHistory>;

    setNodes: (nodes: Node[]) => void;
    setInstances: (instances: Instance[]) => void;
    setIsLoading: (loading: boolean) => void;
    updateNodeMetrics: (nodeId: string, data: Partial<Node>) => void;
    updateInstanceStatus: (instanceId: string, data: Partial<Instance>) => void;
    setSelectedInstance: (id: string | null) => void;
    setActiveTab: (tab: string) => void;
}

const MAX_HISTORY_POINTS = 20;

const appendToHistory = (
    history: Record<string, NodeMetricsHistory>,
    nodeId: string,
    cpuVal: number,
    ramVal: number
) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const current = history[nodeId] || { cpu: [], ram: [] };

    const newCpu = [...current.cpu, { time: timeStr, value: Math.round(cpuVal) }].slice(-MAX_HISTORY_POINTS);
    const newRam = [...current.ram, { time: timeStr, value: Math.round(ramVal) }].slice(-MAX_HISTORY_POINTS);

    return {
        ...history,
        [nodeId]: { cpu: newCpu, ram: newRam }
    };
};

export const useDataStore = create<DataState>((set) => ({
    nodes: [],
    instances: [],
    selectedInstanceId: null,
    activeTab: 'overview',
    isLoading: true,
    nodeHistory: {},

    setIsLoading: (isLoading) => set({ isLoading }),
    setNodes: (nodes) => set((state) => {
        let newHistory = { ...state.nodeHistory };
        nodes.forEach(n => {
            const ramPct = n.mem_usage;
            newHistory = appendToHistory(newHistory, n.id, n.cpu_usage || 0, ramPct || 0);
        });
        return { nodes, nodeHistory: newHistory };
    }),

    setInstances: (newInstances) => set((state) => {
        if (state.instances.length === 0) {
            return { instances: newInstances };
        }

        const instanceMap = new Map(state.instances.map(i => [i.id, i]));
        const merged = newInstances.map(newInst => {
            const existing = instanceMap.get(newInst.id);
            if (existing) {
                return { ...existing, ...newInst };
            }
            return newInst;
        });

        return { instances: merged };
    }),

    updateNodeMetrics: (nodeId, data) =>
        set((state) => {
            const newNodes = state.nodes.map((n) =>
                n.id === nodeId ? { ...n, ...data } : n
            );

            const n = newNodes.find(n => n.id === nodeId);
            let newHistory = state.nodeHistory;
            if (n) {
                newHistory = appendToHistory(state.nodeHistory, nodeId, n.cpu_usage || 0, n.mem_usage || 0);
            }

            return { nodes: newNodes, nodeHistory: newHistory };
        }),

    updateInstanceStatus: (instanceId, data) =>
        set((state) => ({
            instances: state.instances.map((i) =>
                i.id === instanceId ? { ...i, ...data } : i
            ),
        })),

    setSelectedInstance: (id) => set({ selectedInstanceId: id }),
    setActiveTab: (tab) => set({ activeTab: tab }),
}));

