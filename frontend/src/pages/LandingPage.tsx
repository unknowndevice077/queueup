import { Link } from 'react-router-dom';
import { buttonClass } from '@/components/ui';

const SCHEDULE = [
  { time: '9:00', who: 'Paeng', what: 'Haircut + Hot Towel Shave', status: 'done' },
  { time: '9:45', who: 'Mark', what: 'Classic Haircut', status: 'done' },
  { time: '10:30', who: 'Paeng', what: 'Beard Trim', status: 'now' },
  { time: '11:00', who: 'Jun', what: 'Hair Color', status: 'next' },
  { time: '11:15', who: 'Mark', what: 'Classic Haircut', status: 'next' },
];

const STEPS = [
  {
    title: 'Customers book from their phone',
    body: 'They pick a service, a barber or "whoever is free", and an open time. Lunch breaks, clean-up time and days off are already taken out.',
  },
  {
    title: 'Walk-ins take a number',
    body: 'A QR code at the door gives them a ticket and shows how many people are ahead. No more crowding at the counter to ask.',
  },
  {
    title: 'Your TV calls the next ticket',
    body: 'Open the display page on any smart TV. When staff press "Call next", the board and every waiting phone update at once.',
  },
  {
    title: 'No-shows pay for themselves',
    body: 'Ask for a small deposit through GCash, Maya or card. Unpaid holds release automatically after fifteen minutes.',
  },
];

export function LandingPage() {
  return (
    <div>
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr,1fr] lg:items-center lg:py-20">
          <div>
            <h1 className="max-w-xl text-[40px] font-semibold leading-[1.08] tracking-[-0.025em] text-ink sm:text-[52px]">
              Fewer people waiting at the door. Fewer empty chairs.
            </h1>
            <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-ink-2">
              QueueUp takes appointments, runs your walk-in line and reminds customers before they forget, so
              the counter can get on with the work.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/demo" className={buttonClass('primary', 'lg')}>
                Try the demo
              </Link>
              <Link to="/register?next=/start" className={buttonClass('secondary', 'lg')}>
                Set up my business
              </Link>
            </div>
            <p className="mt-4 text-[13px] text-ink-muted">
              For barbershops, clinics and salons. No app to install for you or your customers.
            </p>
          </div>

          <div className="relative mx-auto mb-16 w-full max-w-md lg:mx-0">
            <div className="rounded-lg border border-line bg-surface">
              <div className="flex items-baseline justify-between border-b border-line px-5 py-3">
                <p className="text-sm font-medium">Kanto Cuts, today</p>
                <p className="text-xs text-ink-muted">3 barbers in</p>
              </div>
              <ol className="divide-y divide-line">
                {SCHEDULE.map((row) => (
                  <li key={row.time + row.who} className="flex items-center gap-4 px-5 py-3 text-sm">
                    <span className="num w-12 text-ink-muted">{row.time}</span>
                    <span className="flex-1 truncate">
                      <span
                        className={
                          row.status === 'done' ? 'text-ink-muted line-through decoration-ink-faint' : ''
                        }
                      >
                        {row.what}
                      </span>
                      <span className="text-ink-muted"> with {row.who}</span>
                    </span>
                    {row.status === 'now' && (
                      <span className="rounded bg-marigold-100 px-1.5 py-0.5 text-xs font-medium text-marigold-600">
                        In the chair
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
            <div
              className="ticket absolute -bottom-16 right-3 w-48 rotate-[3deg] rounded-md sm:-right-6"
              aria-hidden="true"
            >
              <div className="px-4 pb-3 pt-3">
                <p className="text-xs text-ink-muted">Walk-in ticket</p>
                <p className="num mt-1 text-[40px] font-semibold leading-none">#014</p>
              </div>
              <div className="ticket-tear" />
              <p className="px-4 py-2 text-xs text-ink-2">3 people ahead of you</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[260px,1fr]">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.01em]">Set it up once on a slow afternoon.</h2>
          </div>
          <ol className="border-t border-ink">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="grid gap-2 border-b border-line py-5 sm:grid-cols-[56px,220px,1fr] sm:gap-6"
              >
                <span className="num text-sm text-ink-muted">{String(index + 1).padStart(2, '0')}</span>
                <h3 className="font-medium text-ink">{step.title}</h3>
                <p className="text-[15px] text-ink-2">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-3">
          <div>
            <h2 className="font-semibold">Try it as a customer</h2>
            <p className="mt-2 text-[15px] text-ink-2">
              Book a haircut at{' '}
              <Link to="/b/kanto-cuts" className="font-medium text-ink underline underline-offset-4">
                Kanto Cuts
              </Link>{' '}
              or a cleaning at{' '}
              <Link to="/b/sanare-dental" className="font-medium text-ink underline underline-offset-4">
                Sanare Dental
              </Link>
              , which asks for a 20% deposit.
            </p>
          </div>
          <div>
            <h2 className="font-semibold">Try it as a walk-in</h2>
            <p className="mt-2 text-[15px] text-ink-2">
              <Link to="/b/kanto-cuts/queue" className="font-medium text-ink underline underline-offset-4">
                Take a ticket
              </Link>{' '}
              on your phone, then keep the{' '}
              <Link to="/b/kanto-cuts/display" className="font-medium text-ink underline underline-offset-4">
                TV board
              </Link>{' '}
              open in another tab.
            </p>
          </div>
          <div>
            <h2 className="font-semibold">Try it as the owner</h2>
            <p className="mt-2 text-[15px] text-ink-2">
              <Link to="/demo" className="font-medium text-ink underline underline-offset-4">
                Open the owner dashboard
              </Link>{' '}
              with two months of history, the calendar and the walk-in counter. No sign-up needed.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
