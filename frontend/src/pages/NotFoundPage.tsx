import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 sm:px-6">
      <p className="num text-sm text-ink-muted">404</p>
      <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.015em]">
        This page isn&apos;t on the schedule.
      </h1>
      <p className="mt-2 text-ink-2">The link may be old, or the business may have changed its address.</p>
      <Link to="/" className="mt-6 inline-block font-medium text-ink underline underline-offset-4">
        Back to the home page
      </Link>
    </div>
  );
}
