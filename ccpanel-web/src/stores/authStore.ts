import { create } from 'zustand';
import { api, authApi, type LoginRequest } from '../lib/api';

interface AuthState {
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    login: (data: LoginRequest) => Promise<void>;
    logout: () => void;
    checkAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    token: localStorage.getItem('ccpanel_token'),
    isAuthenticated: !!localStorage.getItem('ccpanel_token'),
    isLoading: false,
    error: null,

    login: async (data) => {
        set({ isLoading: true, error: null });
        try {
            const res = await authApi.login(data);
            api.setToken(res.token);
            set({ token: res.token, isAuthenticated: true, isLoading: false });
        } catch (err) {
            set({ error: (err as Error).message, isLoading: false });
        }
    },

    logout: () => {
        api.setToken(null);
        set({ token: null, isAuthenticated: false });
    },

    checkAuth: () => {
        const token = localStorage.getItem('ccpanel_token');
        set({ token, isAuthenticated: !!token });
    },
}));
