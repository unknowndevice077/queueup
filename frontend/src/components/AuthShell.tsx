import type { ReactNode } from 'react';

/** Narrow, left-aligned layout for sign-in style forms, with an optional aside on wide screens. */
export function AuthShell({
  title,
  intro,
  children,
  aside,
}: {
  title: string;
  intro: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,420px),1fr] lg:gap-16 lg:py-20">
      <div>
        <h1 className="text-[28px] font-semibold tracking-[-0.015em]">{title}</h1>
        <p className="mt-1.5 text-sm text-ink-muted">{intro}</p>
        <div className="mt-8">{children}</div>
      </div>
      {aside && <aside className="lg:border-l lg:border-line lg:pl-16">{aside}</aside>}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <p role="alert" className="border-l-2 border-brick-500 bg-brick-50 px-3 py-2 text-sm text-brick-700">
      {message}
    </p>
  );
}
