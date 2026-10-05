import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { usePublicQueue, usePublicTenant } from '@/lib/queries';
import { useLiveQueue } from '@/lib/useLiveQueue';
import { ticketLabel } from '@/lib/format';

/** Full-screen "Now Serving" board for a TV in the waiting area, in the style of a ticket machine display. */
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
  const [latest, ...others] = serving;
  const upNext = (state?.entries ?? []).filter((e) => e.status === 'WAITING').slice(0, 5);
  const timeZone = tenant?.timezone ?? 'Asia/Manila';

  return (
    <div className="flex min-h-screen flex-col bg-[#0E0D0A] text-[#EDE9DF]">
      <header className="flex items-center justify-between border-b border-white/10 px-[4vw] py-[2.5vh]">
        <h1 className="text-[clamp(1.25rem,2.2vw,2.25rem)] font-semibold tracking-[-0.01em]">
          {tenant?.name ?? 'QueueUp'}
        </h1>
        <div className="flex items-center gap-6">
          <span
            className={`flex items-center gap-2 font-mono text-sm ${connected ? 'text-[#8FC7A3]' : 'text-marigold-300'}`}
          >
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${connected ? 'bg-[#8FC7A3]' : 'bg-marigold-300'}`}
            />
            {connected ? 'LIVE' : 'RECONNECTING'}
          </span>
          <p className="font-mono text-[clamp(1.25rem,2.4vw,2.5rem)] tabular-nums">
            {new Intl.DateTimeFormat('en-PH', { timeZone, hour: 'numeric', minute: '2-digit' }).format(now)}
          </p>
        </div>
      </header>

      <main className="grid flex-1 lg:grid-cols-[1.6fr,1fr]">
        <section
          aria-labelledby="serving-heading"
          className="flex flex-col border-white/10 px-[4vw] py-[4vh] lg:border-r"
        >
          <h2
            id="serving-heading"
            className="font-mono text-[clamp(0.9rem,1.3vw,1.25rem)] uppercase tracking-[0.2em] text-white/50"
          >
            Now serving
          </h2>
          <div aria-live="polite" className="flex flex-1 flex-col justify-center">
            {latest ? (
              <>
                <p className="font-mono text-[clamp(6rem,17vw,16rem)] font-semibold leading-[0.9] tracking-[-0.04em] text-marigold-400 tabular-nums">
                  {ticketLabel(latest.ticketNumber)}
                </p>
                <p className="mt-[2vh] text-[clamp(1.25rem,2.4vw,2.25rem)] text-white/80">
                  {latest.status === 'CALLED' ? 'Please come to the counter' : 'Being served'}
                  {latest.serviceName && <span className="text-white/40"> · {latest.serviceName}</span>}
                </p>
              </>
            ) : (
              <p className="text-[clamp(1.5rem,3vw,3rem)] text-white/50">Please wait for your number</p>
            )}
          </div>
          {others.length > 0 && (
            <div className="flex flex-wrap gap-x-[3vw] gap-y-2 border-t border-white/10 pt-[2.5vh]">
              <span className="self-center font-mono text-sm uppercase tracking-[0.2em] text-white/40">
                Also at counter
              </span>
              {others.map((entry) => (
                <span
                  key={entry.id}
                  className="font-mono text-[clamp(1.75rem,3.5vw,3.5rem)] tabular-nums text-white/80"
                >
                  {ticketLabel(entry.ticketNumber)}
                </span>
              ))}
            </div>
          )}
        </section>

        <section
          aria-labelledby="next-heading"
          className="border-t border-white/10 px-[4vw] py-[4vh] lg:border-t-0"
        >
          <div className="flex items-baseline justify-between">
            <h2
              id="next-heading"
              className="font-mono text-[clamp(0.9rem,1.3vw,1.25rem)] uppercase tracking-[0.2em] text-white/50"
            >
              Up next
            </h2>
            <p className="font-mono text-white/40">{state?.waitingCount ?? 0} waiting</p>
          </div>
          <ol className="mt-[2vh]">
            {upNext.length === 0 ? (
              <li className="py-4 text-[clamp(1.25rem,2vw,2rem)] text-white/40">No one waiting</li>
            ) : (
              upNext.map((entry, index) => (
                <li
                  key={entry.id}
                  className="flex items-baseline justify-between gap-4 border-b border-white/10 py-[1.6vh]"
                >
                  <span
                    className={`font-mono text-[clamp(2rem,4.2vw,4.5rem)] font-medium tabular-nums ${
                      index === 0 ? 'text-white' : 'text-white/60'
                    }`}
                  >
                    {ticketLabel(entry.ticketNumber)}
                  </span>
                  <span className="truncate text-right text-[clamp(0.9rem,1.3vw,1.25rem)] text-white/40">
                    {entry.serviceName ?? ''}
                  </span>
                </li>
              ))
            )}
          </ol>
        </section>
      </main>

      <footer className="border-t border-white/10 px-[4vw] py-[2vh] font-mono text-sm text-white/40">
        Take a number on your phone: {window.location.host}/b/{slug}/queue
      </footer>
    </div>
  );
}
