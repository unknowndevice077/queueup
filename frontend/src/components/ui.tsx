import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'ink';

const variants: Record<Variant, string> = {
  primary: 'bg-pine-600 text-white hover:bg-pine-700 active:bg-pine-800',
  ink: 'bg-ink text-paper hover:bg-ink-2',
  secondary: 'bg-surface text-ink border border-line-strong hover:border-ink-faint hover:bg-paper',
  danger: 'bg-surface text-brick-600 border border-line-strong hover:border-brick-500 hover:bg-brick-50',
  ghost: 'text-ink-2 hover:bg-ink/5',
};

const sizes = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-[15px]',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: keyof typeof sizes;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    className = '',
    children,
    disabled,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
});

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function PageSpinner({ label }: { label: string }) {
  return (
    <div
      className="flex min-h-[40vh] items-center justify-center gap-2.5 text-sm text-ink-muted"
      role="status"
    >
      <Spinner />
      <span>{label}…</span>
    </div>
  );
}

const controlBase =
  'block w-full rounded-md border bg-surface px-3 text-[15px] text-ink placeholder:text-ink-faint transition-colors focus:border-pine-600 focus:outline-none focus:ring-[3px] focus:ring-pine-600/15 disabled:bg-paper disabled:text-ink-muted';

function controlBorder(error?: string) {
  return error ? 'border-brick-500' : 'border-line-strong';
}

function FieldShell({
  id,
  label,
  hint,
  error,
  className = '',
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-[13px] text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-[13px] text-brick-600">
          {error}
        </p>
      )}
    </div>
  );
}

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, id, className = '', ...props },
  ref,
) {
  const inputId = id ?? props.name ?? label;
  return (
    <FieldShell id={inputId} label={label} hint={hint} error={error} className={className}>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={`${controlBase} ${controlBorder(error)} h-10`}
        {...props}
      />
    </FieldShell>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, id, className = '', children, ...props },
  ref,
) {
  const selectId = id ?? props.name ?? label;
  return (
    <FieldShell id={selectId} label={label} hint={hint} error={error} className={className}>
      <select
        ref={ref}
        id={selectId}
        aria-invalid={error ? true : undefined}
        className={`${controlBase} ${controlBorder(error)} h-10 pr-8`}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
});

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, hint, id, className = '', ...props },
  ref,
) {
  const areaId = id ?? props.name ?? label;
  return (
    <FieldShell id={areaId} label={label} hint={hint} className={className}>
      <textarea ref={ref} id={areaId} className={`${controlBase} border-line-strong py-2`} {...props} />
    </FieldShell>
  );
});

/** A bordered surface. No drop shadows anywhere in the app: hairlines carry the structure. */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-line bg-surface p-5 ${className}`}>{children}</div>;
}

export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-line/70 ${className}`} aria-hidden="true" />;
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div
      className="divide-y divide-line rounded-lg border border-line bg-surface"
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong px-6 py-8 text-center">
      <p className="text-sm font-medium text-ink-2">{title}</p>
      {children && <div className="mt-1 text-[13px] text-ink-muted">{children}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <div
      role="alert"
      className="rounded-lg border border-brick-500/40 bg-brick-50 px-4 py-3 text-sm text-brick-700"
    >
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-1 font-medium underline underline-offset-2">
          Try again
        </button>
      )}
    </div>
  );
}

const statusDot: Record<string, string> = {
  CONFIRMED: 'bg-pine-500',
  COMPLETED: 'bg-ink-faint',
  CANCELLED: 'bg-brick-500',
  NO_SHOW: 'bg-marigold-400',
  PENDING_PAYMENT: 'bg-slateblue-600',
  WAITING: 'bg-ink-faint',
  CALLED: 'bg-marigold-400',
  SERVING: 'bg-pine-500',
  DONE: 'bg-line-strong',
  SKIPPED: 'bg-brick-500',
  OWNER: 'bg-ink',
  STAFF: 'bg-ink-faint',
};

const defaultLabels: Record<string, string> = {
  PENDING_PAYMENT: 'Awaiting deposit',
  NO_SHOW: 'No-show',
};

/** Status shown as a coloured dot and plain text, the way a printed schedule would mark it. */
export function Badge({ value, label }: { value: string; label?: string }) {
  const text =
    label ?? defaultLabels[value] ?? value.charAt(0) + value.slice(1).toLowerCase().replace('_', ' ');
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-ink-2">
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${statusDot[value] ?? 'bg-ink-faint'}`} />
      {text}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string;
  description?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.01em] text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** A row of figures separated by hairlines, instead of a grid of floating KPI cards. */
export function StatStrip({ items }: { items: { label: string; value: ReactNode; note?: string }[] }) {
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-surface lg:grid-cols-4">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={`px-5 py-4 ${index % 2 === 1 ? 'border-l border-line' : ''} ${
            index >= 2 ? 'border-t border-line lg:border-t-0' : ''
          } ${index === 2 ? 'lg:border-l' : ''}`}
        >
          <dt className="eyebrow">{item.label}</dt>
          <dd className="num mt-2 text-[24px] font-medium leading-none text-ink">{item.value}</dd>
          {item.note && <p className="mt-2 text-xs text-ink-muted">{item.note}</p>}
        </div>
      ))}
    </dl>
  );
}

/** Segmented control for small mutually exclusive choices (view, range). */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange(value: T): void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-md border border-line-strong bg-surface p-0.5"
    >
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={`h-7 rounded px-3 text-[13px] font-medium transition-colors ${
            option.value === value ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-paper'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
