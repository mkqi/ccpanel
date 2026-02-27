import { useEffect, useRef } from 'react';
import { nodeApi, instanceApi } from '../lib/api';
import { useDataStore } from '../stores/dataStore';
import { useAuthStore } from '../stores/authStore';

export function useDataBootstrap() {
    const isAuth = useAuthStore((s) => s.isAuthenticated);
    const { setNodes, setInstances, setIsLoading, nodes, instances } = useDataStore();
    const fetchedRef = useRef(false);

    useEffect(() => {
        if (!isAuth || fetchedRef.current) return;

        // Only fetch if store is basically empty (initial load or refresh)
        if (nodes.length === 0 || instances.length === 0) {
            const fetchData = async () => {
                try {
                    setIsLoading(true);
                    const [nodesData, instancesData] = await Promise.all([
                        nodeApi.list(),
                        instanceApi.list(),
                    ]);
                    setNodes(nodesData);
                    setInstances(instancesData);
                    fetchedRef.current = true;
                } catch (err) {
                    console.error('Failed to bootstrap data:', err);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchData();
        } else {
            setIsLoading(false);
            fetchedRef.current = true;
        }
    }, [isAuth, nodes.length, instances.length, setNodes, setInstances, setIsLoading]);
}
