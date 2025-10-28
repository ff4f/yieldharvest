import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// Types for the store
export interface User {
  id: string;
  accountId: string;
  email?: string;
  name?: string;
  roles: string[];
  permissions: string[];
  isVerified: boolean;
}

export interface WizardState {
  currentStep: number;
  totalSteps: number;
  data: Record<string, any>;
  isCompleted: boolean;
}

export interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  notifications: Notification[];
  loading: boolean;
  error: string | null;
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

export interface AppState {
  // User & Auth
  user: User | null;
  isAuthenticated: boolean;
  
  // UI State
  ui: UIState;
  
  // Wizard State
  wizard: WizardState;
  
  // Actions
  setUser: (user: User | null) => void;
  setAuthenticated: (authenticated: boolean) => void;
  
  // UI Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Notification Actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  
  // Wizard Actions
  setWizardStep: (step: number) => void;
  setWizardData: (data: Record<string, any>) => void;
  updateWizardData: (key: string, value: any) => void;
  resetWizard: () => void;
  completeWizard: () => void;
  
  // Utility Actions
  reset: () => void;
}

const initialUIState: UIState = {
  sidebarOpen: true,
  theme: 'light',
  notifications: [],
  loading: false,
  error: null,
};

const initialWizardState: WizardState = {
  currentStep: 0,
  totalSteps: 0,
  data: {},
  isCompleted: false,
};

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        user: null,
        isAuthenticated: false,
        ui: initialUIState,
        wizard: initialWizardState,
        
        // User & Auth Actions
        setUser: (user) => set({ user }, false, 'setUser'),
        setAuthenticated: (authenticated) => set({ isAuthenticated: authenticated }, false, 'setAuthenticated'),
        
        // UI Actions
        toggleSidebar: () => set(
          (state) => ({ 
            ui: { ...state.ui, sidebarOpen: !state.ui.sidebarOpen } 
          }), 
          false, 
          'toggleSidebar'
        ),
        
        setSidebarOpen: (open) => set(
          (state) => ({ 
            ui: { ...state.ui, sidebarOpen: open } 
          }), 
          false, 
          'setSidebarOpen'
        ),
        
        setTheme: (theme) => set(
          (state) => ({ 
            ui: { ...state.ui, theme } 
          }), 
          false, 
          'setTheme'
        ),
        
        setLoading: (loading) => set(
          (state) => ({ 
            ui: { ...state.ui, loading } 
          }), 
          false, 
          'setLoading'
        ),
        
        setError: (error) => set(
          (state) => ({ 
            ui: { ...state.ui, error } 
          }), 
          false, 
          'setError'
        ),
        
        // Notification Actions
        addNotification: (notification) => {
          const newNotification: Notification = {
            ...notification,
            id: crypto.randomUUID(),
            timestamp: new Date(),
            read: false,
          };
          
          set(
            (state) => ({
              ui: {
                ...state.ui,
                notifications: [newNotification, ...state.ui.notifications],
              },
            }),
            false,
            'addNotification'
          );
        },
        
        markNotificationRead: (id) => set(
          (state) => ({
            ui: {
              ...state.ui,
              notifications: state.ui.notifications.map((n) =>
                n.id === id ? { ...n, read: true } : n
              ),
            },
          }),
          false,
          'markNotificationRead'
        ),
        
        removeNotification: (id) => set(
          (state) => ({
            ui: {
              ...state.ui,
              notifications: state.ui.notifications.filter((n) => n.id !== id),
            },
          }),
          false,
          'removeNotification'
        ),
        
        clearNotifications: () => set(
          (state) => ({
            ui: { ...state.ui, notifications: [] },
          }),
          false,
          'clearNotifications'
        ),
        
        // Wizard Actions
        setWizardStep: (step) => set(
          (state) => ({
            wizard: { ...state.wizard, currentStep: step },
          }),
          false,
          'setWizardStep'
        ),
        
        setWizardData: (data) => set(
          (state) => ({
            wizard: { ...state.wizard, data },
          }),
          false,
          'setWizardData'
        ),
        
        updateWizardData: (key, value) => set(
          (state) => ({
            wizard: {
              ...state.wizard,
              data: { ...state.wizard.data, [key]: value },
            },
          }),
          false,
          'updateWizardData'
        ),
        
        resetWizard: () => set(
          { wizard: initialWizardState },
          false,
          'resetWizard'
        ),
        
        completeWizard: () => set(
          (state) => ({
            wizard: { ...state.wizard, isCompleted: true },
          }),
          false,
          'completeWizard'
        ),
        
        // Utility Actions
        reset: () => set(
          {
            user: null,
            isAuthenticated: false,
            ui: initialUIState,
            wizard: initialWizardState,
          },
          false,
          'reset'
        ),
      }),
      {
        name: 'yieldharvest-app-store',
        partialize: (state) => ({
          user: state.user,
          isAuthenticated: state.isAuthenticated,
          ui: {
            theme: state.ui.theme,
            sidebarOpen: state.ui.sidebarOpen,
          },
        }),
      }
    ),
    {
      name: 'YieldHarvest App Store',
    }
  )
);

// Selectors for better performance
export const useUser = () => useAppStore((state) => state.user);
export const useIsAuthenticated = () => useAppStore((state) => state.isAuthenticated);
export const useUI = () => useAppStore((state) => state.ui);
export const useWizard = () => useAppStore((state) => state.wizard);
export const useNotifications = () => useAppStore((state) => state.ui.notifications);

// Action selectors
export const useAppActions = () => useAppStore((state) => ({
  setUser: state.setUser,
  setAuthenticated: state.setAuthenticated,
  toggleSidebar: state.toggleSidebar,
  setSidebarOpen: state.setSidebarOpen,
  setTheme: state.setTheme,
  setLoading: state.setLoading,
  setError: state.setError,
  addNotification: state.addNotification,
  markNotificationRead: state.markNotificationRead,
  removeNotification: state.removeNotification,
  clearNotifications: state.clearNotifications,
  setWizardStep: state.setWizardStep,
  setWizardData: state.setWizardData,
  updateWizardData: state.updateWizardData,
  resetWizard: state.resetWizard,
  completeWizard: state.completeWizard,
  reset: state.reset,
}));