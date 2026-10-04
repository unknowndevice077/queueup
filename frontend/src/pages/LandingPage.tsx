import { Link } from 'react-router-dom';

const features = [
  {
    title: 'Online booking that never double-books',
    body: 'Customers pick a service, a barber or dentist, and an open slot from their phone. Lunch breaks, buffers and days off are handled for you.',
  },
  {
    title: 'A walk-in queue on every phone',
    body: 'Walk-ins scan a QR code, get a ticket number and see their place in line live. No more crowded waiting areas.',
  },
  {
    title: 'A "Now Serving" board for your TV',
    body: 'Open the display page on any smart TV. It updates the moment staff call the next ticket.',
  },
  {
    title: 'Deposits through GCash, Maya and cards',
    body: 'Cut no-shows by asking for a small deposit, collected securely through PayMongo.',
  },
  {
    title: 'Reminders that customers actually read',
    body: 'Confirmation, cancellation and 24-hour reminder emails go out automatically.',
  },
  {
    title: 'Numbers you can run a business on',
    body: 'Bookings per day, revenue, no-show rate, busiest hours and a CSV export for your accountant.',
  },
];

export function LandingPage() {
  return (
    <div>
      <section className="bg-gradient-to-b from-brand-50 to-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
            For clinics, barbershops and salons
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Stop the pila. Let customers book and queue from their phones.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-700">
            QueueUp gives Philippine small businesses online booking, a live walk-in queue and a dashboard,
            set up in minutes and priced in pesos.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/b/kanto-cuts"
              className="rounded-lg bg-brand-600 px-5 py-3 font-semibold text-white shadow hover:bg-brand-700"
            >
              Try the demo
            </Link>
            <Link
              to="/login"
              className="rounded-lg bg-white px-5 py-3 font-semibold text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50"
            >
              Open the owner dashboard
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-600">
            Demo businesses:{' '}
            <Link className="underline" to="/b/kanto-cuts">
              Kanto Cuts Barbershop
            </Link>{' '}
            ·{' '}
            <Link className="underline" to="/b/sanare-dental">
              Sanare Dental Clinic
            </Link>{' '}
            ·{' '}
            <Link className="underline" to="/b/kanto-cuts/display">
              Now Serving board
            </Link>
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-bold">Everything a busy counter needs</h2>
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <li key={feature.title} className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h3 className="font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{feature.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
