import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check } from './icons';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'ink';

const variants: Record<Variant, string> = {
  primary: 'bg-pine-600 text-white hover:bg-pine-700 active:bg-pine-800',
  ink: 'bg-ink text-paper hover:bg-ink-2 active:bg-ink',
  secondary:
    'bg-surface text-ink border border-line-strong hover:border-ink-faint hover:bg-paper active:bg-line/50',
  danger:
    'bg-surface text-brick-600 border border-line-strong hover:border-brick-500 hover:bg-brick-50 active:bg-brick-50',
  ghost: 'text-ink-2 hover:bg-ink/[0.06] hover:text-ink active:bg-ink/10',
};

const sizes = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-[15px]',
};

/** Shared look for anything that acts like a button, including router links styled as buttons. */
export function buttonClass(variant: Variant = 'primary', size: keyof typeof sizes = 'md', extra = '') {
  return `inline-flex shrink-0 select-none items-center justify-center gap-2 rounded-md font-medium transition-[background-color,border-color,color,transform] duration-150 ease-out active:translate-y-px disabled:pointer-events-none disabled:opacity-45 ${variants[variant]} ${sizes[size]} ${extra}`;
}

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
      className={buttonClass(variant, size, `${loading ? 'cursor-progress' : ''} ${className}`)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
});

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="group -ml-1 inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-sm text-ink-muted transition-colors hover:text-ink"
    >
      <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-150 group-hover:-translate-x-0.5" />
      {children}
    </Link>
  );
}

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
  'block w-full rounded-md border bg-surface px-3 text-[15px] text-ink placeholder:text-ink-faint transition-[border-color,box-shadow] duration-150 hover:border-ink-faint focus:border-pine-600 focus:outline-none focus:ring-[3px] focus:ring-pine-600/15 disabled:bg-paper disabled:text-ink-muted';

function controlBorder(error?: string) {
  return error ? 'border-brick-500 hover:border-brick-500' : 'border-line-strong';
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
        <p id={`${id}-error`} className="mt-1.5 animate-fade-in text-[13px] text-brick-600">
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
        className={`${controlBase} ${controlBorder(error)} h-10 cursor-pointer pr-8`}
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

/** On/off control for settings that take effect as a whole (deposits, a service being bookable). */
export const Switch = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: ReactNode; description?: ReactNode }
>(function Switch({ label, description, className = '', id, ...props }, ref) {
  const inputId = id ?? props.name;
  return (
    <label htmlFor={inputId} className={`group flex cursor-pointer items-start gap-3 ${className}`}>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input ref={ref} id={inputId} type="checkbox" role="switch" className="peer sr-only" {...props} />
        <span className="h-5 w-9 rounded-full bg-line-strong transition-colors duration-200 group-hover:bg-ink-faint peer-checked:bg-pine-600 peer-checked:group-hover:bg-pine-700 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-pine-600 peer-disabled:opacity-50" />
        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(23,22,15,0.25)] transition-transform duration-200 ease-out peer-checked:translate-x-4" />
      </span>
      <span className="text-sm">
        <span className="font-medium text-ink">{label}</span>
        {description && <span className="block text-ink-muted">{description}</span>}
      </span>
    </label>
  );
});

/** Checkbox with a drawn box, used for picking several things from a list. */
export const Checkbox = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: ReactNode }
>(function Checkbox({ label, className = '', ...props }, ref) {
  return (
    <label className={`group flex cursor-pointer items-center gap-2.5 rounded-md py-1 text-sm ${className}`}>
      <span className="relative inline-flex shrink-0">
        <input ref={ref} type="checkbox" className="peer sr-only" {...props} />
        <span className="grid h-[18px] w-[18px] place-items-center rounded border border-line-strong bg-surface transition-colors duration-150 group-hover:border-ink-faint peer-checked:border-pine-600 peer-checked:bg-pine-600 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-pine-600" />
        <Check className="pointer-events-none absolute left-[3px] top-[3px] h-3 w-3 scale-50 text-white opacity-0 transition-[opacity,transform] duration-150 peer-checked:scale-100 peer-checked:opacity-100" />
      </span>
      {label}
    </label>
  );
});

/** Initials in a circle, so a list of people can be scanned without reading every name. */
export function Avatar({ name, className = 'h-8 w-8 text-xs' }: { name: string; className?: string }) {
  const initials = name
    .replace(/["“”].*?["“”]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .filter((part) => !/^(dr|dra|mr|ms|mrs)\.?$/i.test(part))
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full bg-line font-medium text-ink-2 ${className}`}
    >
      {initials}
    </span>
  );
}

/** A bordered surface. No drop shadows on resting content: hairlines carry the structure. */
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

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong px-6 py-8 text-center">
      <p className="text-sm font-medium text-ink-2">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-sm text-[13px] text-ink-muted">{children}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brick-500/40 bg-brick-50 px-4 py-3 text-sm text-brick-700"
    >
      <p>{message}</p>
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
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
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.01em] text-ink">{title}</h1>
        {description && <div className="mt-1 text-sm text-ink-muted">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** A row of figures separated by hairlines, instead of a grid of floating KPI cards. */
export function StatStrip({ items }: { items: { label: string; value: ReactNode; note?: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-surface lg:grid-cols-4">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={`px-5 py-4 ${index % 2 === 1 ? 'border-l border-line' : ''} ${
            index >= 2 ? 'border-t border-line lg:border-t-0' : ''
          } ${index === 2 ? 'lg:border-l' : ''}`}
        >
          <dt className="caption">{item.label}</dt>
          <dd className="num mt-1.5 text-[24px] font-medium leading-none text-ink">{item.value}</dd>
          {item.note && <div className="mt-2 text-xs text-ink-muted">{item.note}</div>}
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
          className={`h-7 rounded px-3 text-[13px] font-medium transition-colors duration-150 ${
            option.value === value ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-paper hover:text-ink'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
