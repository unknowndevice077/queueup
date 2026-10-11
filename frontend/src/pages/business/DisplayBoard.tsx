import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { usePublicQueue, usePublicTenant } from '@/lib/queries';
import { useLiveQueue } from '@/lib/useLiveQueue';
import { ticketLabel } from '@/lib/format';
import { Speaker } from '@/components/icons';

/** Two-note chime played through Web Audio, so the board needs no sound file. */
function chime(context: AudioContext) {
  [659.25, 523.25].forEach((frequency, index) => {
    const start = context.currentTime + index * 0.32;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 1);
  });
}

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

  // Browsers only allow audio after a click, so sound starts off and the staff turns it on once per TV.
  const audio = useRef<AudioContext | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const lastCalled = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (
      latest &&
      latest.id !== lastCalled.current &&
      lastCalled.current !== undefined &&
      soundOn &&
      audio.current
    ) {
      chime(audio.current);
    }
    lastCalled.current = latest?.id ?? '';
  }, [latest, soundOn]);

  const toggleSound = () => {
    if (!soundOn) {
      audio.current ??= new AudioContext();
      void audio.current.resume();
      chime(audio.current);
    }
    setSoundOn(!soundOn);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#0E0D0A] text-[#EDE9DF]">
      <header className="flex items-center justify-between border-b border-white/10 px-[4vw] py-[2.5vh]">
        <h1 className="text-[clamp(1.25rem,2.2vw,2.25rem)] font-semibold tracking-[-0.01em]">
          {tenant?.name ?? 'QueueUp'}
        </h1>
        <div className="flex items-center gap-6">
          <span
            className={`flex items-center gap-2 text-sm ${connected ? 'text-[#8FC7A3]' : 'text-marigold-300'}`}
          >
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${connected ? 'bg-[#8FC7A3]' : 'bg-marigold-300'}`}
            />
            {connected ? 'Live' : 'Reconnecting…'}
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
          <h2 id="serving-heading" className="text-[clamp(1rem,1.6vw,1.5rem)] font-medium text-white/50">
            Now serving
          </h2>
          <div aria-live="polite" className="flex flex-1 flex-col justify-center">
            {latest ? (
              <>
                <p
                  key={latest.id}
                  className="animate-number-in font-mono text-[clamp(6rem,17vw,16rem)] font-semibold leading-[0.9] tracking-[-0.04em] text-marigold-400 tabular-nums"
                >
                  {ticketLabel(latest.ticketNumber)}
                </p>
                <p className="mt-[2vh] text-[clamp(1.25rem,2.4vw,2.25rem)] text-white/80">
                  {latest.status === 'CALLED' ? 'Please come to the counter' : 'Being served'}
                  {latest.serviceName && <span className="block text-white/40">{latest.serviceName}</span>}
                </p>
              </>
            ) : (
              <p className="text-[clamp(1.5rem,3vw,3rem)] text-white/50">Please wait for your number</p>
            )}
          </div>
          {others.length > 0 && (
            <div className="flex flex-wrap gap-x-[3vw] gap-y-2 border-t border-white/10 pt-[2.5vh]">
              <span className="self-center text-[clamp(0.9rem,1.3vw,1.25rem)] text-white/40">
                Also at the counter
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
            <h2 id="next-heading" className="text-[clamp(1rem,1.6vw,1.5rem)] font-medium text-white/50">
              Up next
            </h2>
            <p className="text-[clamp(0.9rem,1.3vw,1.25rem)] text-white/40">
              <span className="font-mono tabular-nums">{state?.waitingCount ?? 0}</span> waiting
            </p>
          </div>
          <ol className="mt-[2vh]">
            {upNext.length === 0 ? (
              <li className="py-4 text-[clamp(1.25rem,2vw,2rem)] text-white/40">No one waiting</li>
            ) : (
              upNext.map((entry, index) => (
                <li
                  key={entry.id}
                  className="flex animate-fade-in items-baseline justify-between gap-4 border-b border-white/10 py-[1.6vh]"
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

      <footer className="flex items-center justify-between gap-4 border-t border-white/10 px-[4vw] py-[2vh] text-[clamp(0.9rem,1.2vw,1.15rem)] text-white/50">
        <span>
          Take a number on your phone at{' '}
          <span className="font-mono text-white/80">
            {window.location.host}/b/{slug}/queue
          </span>
        </span>
        <button
          type="button"
          onClick={toggleSound}
          aria-pressed={soundOn}
          className="flex shrink-0 items-center gap-2 rounded-md border border-white/15 px-3 py-1.5 text-sm text-white/60 transition-colors hover:border-white/30 hover:text-white"
        >
          <Speaker on={soundOn} />
          {soundOn ? 'Chime on' : 'Turn on chime'}
        </button>
      </footer>
    </div>
  );
}
