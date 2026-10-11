import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from './ui';

/**
 * Modal built on the native <dialog> element, so focus trapping, Escape and the top layer come from the browser.
 * Clicking the backdrop closes it like Escape does.
 */
export function Dialog({
  open,
  onClose,
  labelledBy,
  children,
}: {
  open: boolean;
  onClose(): void;
  labelledBy: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    }
  }, [open]);

  return (
    // Escape is handled natively through onCancel; the click handler only adds "click outside to close".
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) {
          onClose();
        }
      }}
      className="m-auto w-[calc(100%-32px)] max-w-md rounded-lg border border-line bg-surface p-0 text-ink shadow-[0_24px_60px_-12px_rgba(23,22,15,0.35)] backdrop:bg-ink/40 open:animate-dialog-in"
    >
      {open && children}
    </dialog>
  );
}

interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/** Provides useConfirm(): an awaitable replacement for window.confirm that matches the rest of the app. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<(ConfirmOptions & { resolve(ok: boolean): void }) | null>(null);

  const confirm = useCallback<Confirm>(
    (options) => new Promise<boolean>((resolve) => setRequest({ ...options, resolve })),
    [],
  );

  const settle = (ok: boolean) => {
    request?.resolve(ok);
    setRequest(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={request !== null} onClose={() => settle(false)} labelledBy="confirm-title">
        {request && (
          <div className="p-5">
            <h2 id="confirm-title" className="text-lg font-semibold leading-snug">
              {request.title}
            </h2>
            {request.body && <div className="mt-1.5 text-sm text-ink-2">{request.body}</div>}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => settle(false)}>
                {request.cancelLabel ?? 'Keep it'}
              </Button>
              <Button
                variant={request.danger ? 'danger' : 'primary'}
                className={
                  request.danger ? '!border-brick-600 !bg-brick-600 !text-white hover:!bg-brick-700' : ''
                }
                onClick={() => settle(true)}
              >
                {request.confirmLabel}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): Confirm {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used inside <ConfirmProvider>');
  }
  return context;
}
