import { create } from 'zustand';

export type AlertType = 'info' | 'success' | 'warning' | 'error';

export type Alert = {
  id: string;
  type: AlertType;
  title: string;
  message?: string;
  duration?: number; // ms, default 5000
  createdAt: number;
};

type AlertStore = {
  alerts: Alert[];
  addAlert: (alert: Omit<Alert, 'id' | 'createdAt'>) => string;
  removeAlert: (id: string) => void;
  clearAlerts: () => void;
};

let alertIdCounter = 0;

export const useAlertStore = create<AlertStore>((set) => ({
  alerts: [],

  addAlert: (alert) => {
    const id = `alert-${++alertIdCounter}-${Date.now()}`;
    const newAlert: Alert = {
      ...alert,
      id,
      createdAt: Date.now(),
      duration: alert.duration ?? 5000,
    };

    set((state) => ({
      alerts: [...state.alerts, newAlert],
    }));

    // Auto-remove after duration
    if (newAlert.duration && newAlert.duration > 0) {
      setTimeout(() => {
        set((state) => ({
          alerts: state.alerts.filter((a) => a.id !== id),
        }));
      }, newAlert.duration);
    }

    return id;
  },

  removeAlert: (id) => {
    set((state) => ({
      alerts: state.alerts.filter((a) => a.id !== id),
    }));
  },

  clearAlerts: () => {
    set({ alerts: [] });
  },
}));

// Helper functions for common alert types
export const showAlert = {
  info: (title: string, message?: string, duration?: number) =>
    useAlertStore.getState().addAlert({ type: 'info', title, message, duration }),
  success: (title: string, message?: string, duration?: number) =>
    useAlertStore.getState().addAlert({ type: 'success', title, message, duration }),
  warning: (title: string, message?: string, duration?: number) =>
    useAlertStore.getState().addAlert({ type: 'warning', title, message, duration }),
  error: (title: string, message?: string, duration?: number) =>
    useAlertStore.getState().addAlert({ type: 'error', title, message, duration: duration ?? 8000 }),
};
