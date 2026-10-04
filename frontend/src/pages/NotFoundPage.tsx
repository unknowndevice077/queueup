import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="text-5xl font-bold text-brand-600">404</p>
      <h1 className="mt-4 text-xl font-semibold">We couldn&apos;t find that page</h1>
      <Link to="/" className="mt-6 inline-block font-medium text-brand-600 underline">
        Back to home
      </Link>
    </div>
  );
}
