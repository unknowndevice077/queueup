import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Close } from './icons';

type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  success(message: string): void;
  error(message: string | unknown): void;
  info(message: string): void;
}

const ToastContext = createContext<ToastApi | null>(null);

const accent: Record<ToastKind, string> = {
  success: 'bg-pine-500',
  error: 'bg-brick-500',
  info: 'bg-marigold-400',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current.slice(-2), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4500);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push('success', message),
      info: (message) => push('info', message),
      error: (error) => push('error', error instanceof Error ? error.message : String(error)),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-start"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.kind === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-sm animate-fade-in items-stretch overflow-hidden rounded-md bg-ink text-[14px] text-paper shadow-[0_12px_32px_-12px_rgba(23,22,15,0.5)]"
          >
            <span aria-hidden="true" className={`w-1 shrink-0 ${accent[toast.kind]}`} />
            <p className="flex-1 px-3.5 py-3">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="grid w-10 place-items-center text-paper/50 transition-colors hover:bg-paper/10 hover:text-paper"
              aria-label="Dismiss"
            >
              <Close className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return context;
}
