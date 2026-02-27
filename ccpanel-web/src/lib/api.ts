const BASE_URL = import.meta.env.VITE_API_URL || '';

class ApiClient {
    private token: string | null = null;

    setToken(token: string | null) {
        this.token = token;
        if (token) {
            localStorage.setItem('ccpanel_token', token);
        } else {
            localStorage.removeItem('ccpanel_token');
        }
    }

    getToken(): string | null {
        if (!this.token) {
            this.token = localStorage.getItem('ccpanel_token');
        }
        return this.token;
    }

    private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...((options.headers as Record<string, string>) || {}),
        };
        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // Timeout after 10s to prevent indefinite hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10_000);

        let res: Response;
        try {
            res = await fetch(`${BASE_URL}${path}`, {
                ...options,
                headers,
                signal: controller.signal,
            });
        } catch (err) {
            clearTimeout(timeoutId);
            if ((err as Error).name === 'AbortError') {
                throw new Error('Request timed out (10s). Check if the backend is reachable.');
            }
            throw new Error(`Network error: ${(err as Error).message}`);
        } finally {
            clearTimeout(timeoutId);
        }

        if (res.status === 401) {
            // Clear token but do NOT force-redirect here.
            // Dispatch event to let React (App.tsx) handle the state change and redirect.
            this.setToken(null);
            window.dispatchEvent(new Event('auth:unauthorized'));
            throw new Error('Session expired. Please login again.');
        }

        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `Request failed: ${res.status}`);
        }

        if (res.status === 204) return {} as T;
        return res.json();
    }

    get<T>(path: string) {
        return this.request<T>(path);
    }

    post<T>(path: string, body?: unknown) {
        return this.request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
    }

    put<T>(path: string, body?: unknown) {
        return this.request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined });
    }

    delete<T>(path: string) {
        return this.request<T>(path, { method: 'DELETE' });
    }
}

export const api = new ApiClient();

// ---- Type definitions ----

export interface LoginRequest {
    username: string;
    password: string;
}

export interface LoginResponse {
    token: string;
    expires_at: string;
}

export interface Node {
    id: string;
    name: string;
    address: string;
    status: 'online' | 'offline';
    cpu_usage: number;
    mem_usage: number;
    disk_free: number;
    disk_total: number;
    instance_count: number;
    os_info?: string;
    kernel_version?: string;
    docker_version?: string;
    hostname?: string;
    uptime_secs?: number;
    last_heartbeat: string;
    created_at: string;
}

export interface Instance {
    id: string;
    node_id: string;
    node_name?: string;
    name: string;
    world_name: string;
    password: string;
    game_port: number;
    status_port: number;
    rcon_port: number;
    status: 'running' | 'stopped' | 'starting' | 'stopping' | 'error' | 'creating';
    docker_id: string;
    image: string;
    connect_address?: string;
    cpu_percent: number;
    mem_bytes: number;
    uptime_secs: number;
    player_count: number;
    max_players: number;
    game_version?: string;
    world_time?: string;
    docker_status?: string;
    env_vars?: Record<string, string>;
    created_at: string;
    updated_at: string;
}

export interface CreateInstanceRequest {
    name: string;
    world_name: string;
    password: string;
    node_id: string;
    image?: string;
    rcon_password?: string;
    extra_env?: Record<string, string>;
}

export interface Backup {
    id: string;
    instance_id: string;
    type: 'manual' | 'auto' | 'pre-stop';
    file_path: string;
    size_bytes: number;
    created_at: string;
    note: string;
}

export interface OperationLog {
    id: string;
    instance_id: string;
    node_id: string;
    action: string;
    detail: string;
    result: 'success' | 'failed';
    created_at: string;
    instance_name?: string;
    node_name?: string;
}

// ---- API functions ----

export const authApi = {
    login: (data: LoginRequest) => api.post<LoginResponse>('/api/v1/auth/login', data),
};

export const nodeApi = {
    list: () => api.get<Node[]>('/api/v1/nodes'),
    get: (id: string) => api.get<Node>(`/api/v1/nodes/${id}`),
    create: (data: { name: string; address: string }) => api.post<Node>('/api/v1/nodes', data),
    delete: (id: string) => api.delete(`/api/v1/nodes/${id}`),
    stopAll: (id: string) => api.post(`/api/v1/nodes/${id}/stop-all`),
    startAll: (id: string) => api.post(`/api/v1/nodes/${id}/start-all`),
};

export const instanceApi = {
    list: (nodeId?: string) => api.get<Instance[]>(`/api/v1/instances${nodeId ? `?node_id=${nodeId}` : ''}`),
    get: (id: string) => api.get<Instance>(`/api/v1/instances/${id}`),
    create: (data: CreateInstanceRequest) => api.post<Instance>('/api/v1/instances', data),
    update: (id: string, data: Partial<CreateInstanceRequest>) => api.put<Instance>(`/api/v1/instances/${id}`, data),
    delete: (id: string, keepData = false) => api.delete(`/api/v1/instances/${id}?keep_data=${keepData}`),
    start: (id: string) => api.post(`/api/v1/instances/${id}/start`),
    stop: (id: string) => api.post(`/api/v1/instances/${id}/stop`),
    restart: (id: string) => api.post(`/api/v1/instances/${id}/restart`),
    kill: (id: string) => api.post(`/api/v1/instances/${id}/kill`),
    rcon: (id: string, command: string) => api.post<{ message: string, result: string }>(`/api/v1/instances/${id}/rcon`, { command }),
    startLogs: (id: string) => api.post(`/api/v1/instances/${id}/logs/start`),
    stopLogs: (id: string) => api.post(`/api/v1/instances/${id}/logs/stop`),
};

export const backupApi = {
    list: (instanceId: string) => api.get<Backup[]>(`/api/v1/instances/${instanceId}/backups`),
    create: (instanceId: string, note?: string) => api.post<Backup>(`/api/v1/instances/${instanceId}/backups`, { note }),
    restore: (instanceId: string, backupId: string) => api.post(`/api/v1/instances/${instanceId}/backups/${backupId}/restore`),
    delete: (instanceId: string, backupId: string) => api.delete(`/api/v1/instances/${instanceId}/backups/${backupId}`),
};

export const logApi = {
    list: (params?: { instance_id?: string; limit?: number; offset?: number }) => {
        const query = new URLSearchParams();
        if (params?.instance_id) query.set('instance_id', params.instance_id);
        if (params?.limit) query.set('limit', String(params.limit));
        if (params?.offset) query.set('offset', String(params.offset));
        return api.get<OperationLog[]>(`/api/v1/logs?${query}`);
    },
};
