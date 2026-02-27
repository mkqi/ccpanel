import { useEffect, useRef } from 'react';
import { WebSocketClient } from '../lib/ws';
import { useWsStore } from '../stores/wsStore';
import { useDataStore } from '../stores/dataStore';
import { useAuthStore } from '../stores/authStore';
import type { Node, Instance } from '../lib/api';

interface MonitorMessage {
    type: 'node_metrics' | 'instance_status' | 'full_sync';
    data: {
        nodes?: Node[];
        instances?: Instance[];
        node_id?: string;
        instance_id?: string;
    } & Partial<Node> & Partial<Instance>;
}

export function useMonitorWs() {
    const wsRef = useRef<WebSocketClient | null>(null);
    const isAuth = useAuthStore((s) => s.isAuthenticated);
    const setMonitorStatus = useWsStore((s) => s.setMonitorStatus);
    const { setNodes, setInstances, updateNodeMetrics, updateInstanceStatus } = useDataStore();

    useEffect(() => {
        if (!isAuth) return;

        const ws = new WebSocketClient('monitor');
        wsRef.current = ws;

        ws.onStatusChange((status) => {
            setMonitorStatus(status as 'connecting' | 'connected' | 'reconnecting' | 'disconnected');
        });

        ws.onMessage((msg) => {
            const m = msg as unknown as MonitorMessage;
            switch (m.type) {
                case 'full_sync':
                    if (m.data.nodes) {
                        setNodes(m.data.nodes);
                    }
                    if (m.data.instances) {
                        setInstances(m.data.instances);
                    }
                    break;
                case 'node_metrics':
                    if (m.data.node_id) {
                        updateNodeMetrics(m.data.node_id, m.data);
                    }
                    break;
                case 'instance_status':
                    if (m.data.instance_id) {
                        updateInstanceStatus(m.data.instance_id, m.data);
                    }
                    break;
            }
        });

        ws.connect();

        return () => {
            ws.disconnect();
        };
    }, [isAuth, setMonitorStatus, setNodes, setInstances, updateNodeMetrics, updateInstanceStatus]);

    return wsRef;
}
