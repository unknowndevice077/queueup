import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { usePublicQueue, usePublicTenant } from '@/lib/queries';
import { useLiveQueue } from '@/lib/useLiveQueue';
import { ticketLabel } from '@/lib/format';

/** Full-screen "Now Serving" board meant for a TV in the waiting area. Updates live over WebSocket. */
export default function DisplayBoard() {
  const { slug = '' } = useParams();
  const { data: tenant } = usePublicTenant(slug);
  const { data: initial } = usePublicQueue(slug);
  const { state: live, connected } = useLiveQueue(slug);
  const state = live ?? initial;
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const serving = (state?.entries ?? [])
    .filter((e) => e.status === 'CALLED' || e.status === 'SERVING')
    .sort((a, b) => (b.calledAt ?? '').localeCompare(a.calledAt ?? ''));
  const upNext = (state?.entries ?? []).filter((e) => e.status === 'WAITING').slice(0, 6);
  const timeZone = tenant?.timezone ?? 'Asia/Manila';

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 p-6 text-white sm:p-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold sm:text-4xl">{tenant?.name ?? 'QueueUp'}</h1>
        <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums sm:text-4xl">
            {new Intl.DateTimeFormat('en-PH', { timeZone, hour: 'numeric', minute: '2-digit' }).format(now)}
          </p>
          <p className={`text-sm ${connected ? 'text-emerald-400' : 'text-amber-400'}`}>
            {connected ? '● Live' : '● Reconnecting'}
          </p>
        </div>
      </header>

      <main className="mt-8 grid flex-1 gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2" aria-labelledby="serving-heading">
          <h2
            id="serving-heading"
            className="text-xl font-semibold uppercase tracking-widest text-emerald-400 sm:text-3xl"
          >
            Now serving
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2" aria-live="polite">
            {serving.length === 0 ? (
              <p className="text-3xl text-slate-400">Please wait to be called</p>
            ) : (
              serving.map((entry, index) => (
                <div
                  key={entry.id}
                  className={`rounded-3xl p-8 text-center ${index === 0 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800'}`}
                >
                  <p className="text-7xl font-black tabular-nums sm:text-9xl">
                    {ticketLabel(entry.ticketNumber)}
                  </p>
                  <p className="mt-3 text-xl font-medium sm:text-2xl">
                    {entry.status === 'CALLED' ? 'Please proceed to the counter' : 'Being served'}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
        <section aria-labelledby="next-heading">
          <h2
            id="next-heading"
            className="text-xl font-semibold uppercase tracking-widest text-slate-300 sm:text-3xl"
          >
            Up next
          </h2>
          <ol className="mt-6 space-y-3">
            {upNext.length === 0 ? (
              <li className="text-2xl text-slate-500">No one waiting</li>
            ) : (
              upNext.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between rounded-2xl bg-slate-800 px-6 py-4 text-3xl font-bold tabular-nums sm:text-5xl"
                >
                  <span>{ticketLabel(entry.ticketNumber)}</span>
                  <span className="text-base font-medium text-slate-400 sm:text-xl">
                    {entry.serviceName ?? ''}
                  </span>
                </li>
              ))
            )}
          </ol>
          <p className="mt-6 text-lg text-slate-400">{state?.waitingCount ?? 0} waiting</p>
        </section>
      </main>
      <footer className="mt-8 text-center text-slate-500">
        Join the queue from your phone at {window.location.host}/b/{slug}/queue
      </footer>
    </div>
  );
}
