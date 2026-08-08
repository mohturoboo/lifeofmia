'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ui/icons';

/**
 * Notifications ephemeres.
 * La region est annoncee par les lecteurs d'ecran (`role="status"`,
 * `aria-live="polite"`) sans voler le focus a l'utilisateur.
 */

type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastValue {
  toast: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

const STYLES: Record<ToastKind, { icon: IconName; color: string }> = {
  success: { icon: 'checkCircle', color: '#7ba083' },
  error: { icon: 'close', color: '#c97f63' },
  info: { icon: 'sparkles', color: '#8592ad' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, kind, message }]);
    setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 4000);
  }, []);

  const value = useMemo<ToastValue>(
    () => ({
      toast,
      success: (message) => toast(message, 'success'),
      error: (message) => toast(message, 'error'),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6"
      >
        <AnimatePresence initial={false}>
          {toasts.map((item) => {
            const style = STYLES[item.kind];
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ type: 'spring', damping: 24, stiffness: 350 }}
                className="pointer-events-auto flex max-w-md items-center gap-2.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] py-3 ps-3.5 pe-4 shadow-xl"
              >
                <span style={{ color: style.color }}>
                  <Icon name={style.icon} size={17} />
                </span>
                <span className="text-sm text-[var(--text)]">{item.message}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast doit etre utilise a l\'interieur de <ToastProvider>.');
  return context;
}
