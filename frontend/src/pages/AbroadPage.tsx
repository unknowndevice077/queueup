import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, ApiError } from '@/lib/api';
import { Button, Field, Select, buttonClass } from '@/components/ui';
import { FormError } from '@/components/AuthShell';
import { Check } from '@/components/icons';

/**
 * Demand test for "QueueUp for families abroad": OFWs book and prepay relatives' visits at their local clinic and get
 * proof the visit happened. The page only collects a waitlist; ?src= (or utm_source) records which post or group
 * the visitor came from.
 */

const COUNTRIES = [
  'Saudi Arabia',
  'United Arab Emirates',
  'Qatar',
  'Kuwait',
  'Oman',
  'Bahrain',
  'Hong Kong',
  'Singapore',
  'Taiwan',
  'Japan',
  'South Korea',
  'Malaysia',
  'United States',
  'Canada',
  'United Kingdom',
  'Italy',
  'Australia',
  'New Zealand',
  'Working at sea',
  'Other',
];
const RELATIONS = ['A parent', 'A grandparent', 'My spouse', 'My child', 'A sibling', 'Someone else'];
const SERVICES = ['Dental', 'Check-up', 'Lab tests', 'Eye check', 'Prenatal', 'Therapy'];
const FREQUENCIES = ['Just once', 'Every few months', 'Every month'];
const FEE = '₱150';

const familySchema = z.object({
  fullName: z.string().trim().min(1, 'Enter your name').max(120),
  email: z.string().trim().email('Enter a valid email'),
  phone: z
    .string()
    .trim()
    .max(32)
    .regex(/^[0-9+()\-\s]*$/, 'Use digits, spaces, + or -'),
  country: z.string().min(1, 'Choose where you work'),
  familyLocation: z.string().trim().min(2, 'Enter their town or city').max(160),
  relation: z.string().min(1, 'Choose who you would book for'),
  services: z.array(z.string()).default([]),
  frequency: z.string().optional(),
  consent: z.literal(true, { errorMap: () => ({ message: 'Please agree so we can contact you' }) }),
});
type FamilyForm = z.infer<typeof familySchema>;

const clinicSchema = z.object({
  clinicName: z.string().trim().min(1, 'Enter the clinic name').max(160),
  fullName: z.string().trim().min(1, 'Enter your name').max(120),
  email: z.string().trim().email('Enter a valid email'),
  phone: z
    .string()
    .trim()
    .max(32)
    .regex(/^[0-9+()\-\s]*$/, 'Use digits, spaces, + or -'),
  familyLocation: z.string().trim().min(2, 'Enter the town or city').max(160),
  consent: z.literal(true, { errorMap: () => ({ message: 'Please agree so we can contact you' }) }),
});
type ClinicForm = z.infer<typeof clinicSchema>;

interface Position {
  position: number;
  total: number;
}

function useSource() {
  const [params] = useSearchParams();
  return (params.get('src') ?? params.get('utm_source') ?? '').slice(0, 120) || undefined;
}

export function AbroadPage() {
  return (
    <div>
      <Hero />
      <HowItWorks />
      <Pricing />
      <FamilySignup />
      <ClinicSignup />
      <Faq />
    </div>
  );
}

function Hero() {
  return (
    <section className="border-b border-line">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr,1fr] lg:items-center lg:py-20">
        <div>
          <p className="text-sm font-medium text-pine-600">For OFWs and families abroad</p>
          <h1 className="mt-3 max-w-xl text-[38px] font-semibold leading-[1.06] tracking-[-0.025em] sm:text-[52px]">
            Book Mama&apos;s check-up from abroad. Know she actually went.
          </h1>
          <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-ink-2">
            Choose the clinic back home and pay by card. We text her the reminder, even on a basic phone. When
            the clinic marks the visit done, you get the check-in time, the receipt and the doctor&apos;s
            note.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a href="#join" className={buttonClass('primary', 'lg')}>
              Join the early list
            </a>
            <span className="text-sm text-ink-muted">Free to join. Starting in Ormoc and Leyte.</span>
          </div>
        </div>
        <ProofVisual />
      </div>
    </section>
  );
}

/** The product in one picture: the text Nanay receives, and the proof that reaches her child abroad. */
function ProofVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:mx-0" aria-hidden="true">
      <div className="mr-10 rounded-2xl rounded-bl-sm bg-line/80 px-4 py-3 text-[15px] leading-snug text-ink">
        <p className="mb-1 text-xs text-ink-muted">Text to Nanay Lorna, Ormoc</p>
        Nay, may dental cleaning ka bukas, Okt 15, 9:00 AM sa Sanare Dental. Bayad na po ni Maricel. Reply 1
        kung makakapunta.
      </div>
      <div className="ml-auto mt-2 w-fit rounded-2xl rounded-br-sm bg-pine-600 px-4 py-2 text-[15px] text-white">
        1
      </div>

      <div className="ticket ml-6 mt-6 rounded-md">
        <div className="flex items-center justify-between px-5 pt-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-pine-600">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-pine-600 text-white">
              <Check className="h-3 w-3" />
            </span>
            Visit completed
          </p>
          <p className="num text-xs text-ink-muted">Oct 15, 9:42 AM</p>
        </div>
        <dl className="grid grid-cols-[88px,1fr] gap-y-1.5 px-5 pb-4 pt-3 text-sm">
          <dt className="text-ink-muted">Patient</dt>
          <dd>Lorna Santos (Mama)</dd>
          <dt className="text-ink-muted">Clinic</dt>
          <dd>Sanare Dental, Ormoc</dd>
          <dt className="text-ink-muted">Visit</dt>
          <dd>Dental cleaning</dd>
          <dt className="text-ink-muted">Paid</dt>
          <dd className="num">₱1,500.00</dd>
        </dl>
        <div className="ticket-tear" />
        <p className="px-5 py-3 text-sm text-ink-2">
          <span className="font-medium text-ink">Dra. Bea:</span> Healthy gums. Next cleaning in 6 months.
        </p>
      </div>
      <p className="ml-6 mt-2 text-xs text-ink-muted">Sent to Maricel in Riyadh at 4:42 AM her time</p>
    </div>
  );
}

const STEPS = [
  {
    title: 'Choose the clinic and time',
    body: 'Book at the dentist or doctor your family already trusts, at the clinic’s own prices.',
  },
  {
    title: 'Pay from wherever you are',
    body: 'One card payment. It goes to the clinic for that visit, not into an envelope for “later”.',
  },
  {
    title: 'We remind them by text',
    body: 'Plain SMS that works on any phone. A sibling nearby can get the reminders too.',
  },
  {
    title: 'You get proof',
    body: 'Check-in time, official receipt and the doctor’s note, the moment the visit is done.',
  },
];

function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-[260px,1fr]">
        <h2 className="text-2xl font-semibold tracking-[-0.01em]">
          No more &ldquo;natuloy ba si Mama?&rdquo;
        </h2>
        <ol className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
          {STEPS.map((step, index) => (
            <li key={step.title} className="bg-surface p-5">
              <span className="num text-sm text-ink-faint">{index + 1}</span>
              <h3 className="mt-1 font-semibold">{step.title}</h3>
              <p className="mt-1 text-[15px] text-ink-2">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">Simple pricing</h2>
          <p className="mt-1 text-[15px] text-ink-2">
            You pay the clinic&apos;s own price, plus <span className="num font-medium text-ink">{FEE}</span>{' '}
            per visit. Families on the early list get their first 3 visits with no fee.
          </p>
        </div>
        <p className="shrink-0 rounded-md bg-marigold-100 px-3 py-1.5 text-sm font-medium text-marigold-600">
          Early list: 3 visits free of fee
        </p>
      </div>
    </section>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement>;

const ChipCheckbox = forwardRef<HTMLInputElement, { label: string } & InputProps>(function ChipCheckbox(
  { label, ...props },
  ref,
) {
  return (
    <label className="cursor-pointer">
      <input ref={ref} type="checkbox" className="peer sr-only" {...props} />
      <span className="inline-flex h-10 items-center rounded-full border border-line-strong bg-surface px-4 text-sm transition-colors duration-150 hover:border-ink-faint peer-checked:border-pine-600 peer-checked:bg-pine-600 peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-pine-600">
        {label}
      </span>
    </label>
  );
});

const ChipRadio = forwardRef<HTMLInputElement, { label: string } & InputProps>(function ChipRadio(
  { label, ...props },
  ref,
) {
  return (
    <label className="cursor-pointer">
      <input ref={ref} type="radio" className="peer sr-only" {...props} />
      <span className="inline-flex h-10 items-center rounded-full border border-line-strong bg-surface px-4 text-sm transition-colors duration-150 hover:border-ink-faint peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-pine-600">
        {label}
      </span>
    </label>
  );
});

const Consent = forwardRef<HTMLInputElement, { error?: string } & InputProps>(function Consent(
  { error, ...props },
  ref,
) {
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3 text-sm text-ink-2">
        <input ref={ref} type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[#1F5C3E]" {...props} />
        <span>
          I agree to be contacted about QueueUp, and to these details being kept for that purpose under the
          Data Privacy Act of 2012. I can ask for them to be deleted at any time.
        </span>
      </label>
      {error && <p className="mt-1.5 animate-fade-in text-[13px] text-brick-600">{error}</p>}
    </div>
  );
});

function FamilySignup() {
  const source = useSource();
  const [joined, setJoined] = useState<(Position & { place: string }) | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FamilyForm>({
    resolver: zodResolver(familySchema),
    defaultValues: { services: [], phone: '', country: '', relation: '' },
  });

  const onSubmit = async (values: FamilyForm) => {
    setFormError(null);
    try {
      const position = await api.post<Position>(
        '/api/public/waitlist',
        { ...values, kind: 'FAMILY', phone: values.phone || undefined, source },
        { auth: false },
      );
      setJoined({ ...position, place: values.familyLocation });
    } catch (error) {
      if (error instanceof ApiError) {
        Object.entries(error.fieldErrors()).forEach(([field, message]) =>
          setError(field as keyof FamilyForm, { message }),
        );
      }
      setFormError(error instanceof Error ? error.message : 'Could not join. Please try again.');
    }
  };

  return (
    <section id="join" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-[260px,1fr]">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.01em]">Get early access</h2>
          <p className="mt-2 text-[15px] text-ink-2">
            We&apos;ll email you when booking opens in your family&apos;s town. Nothing to pay now.
          </p>
        </div>
        {joined ? (
          <Joined joined={joined} />
        ) : (
          <form
            aria-label="Early list for families"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="space-y-6 rounded-lg border border-line bg-surface p-5 sm:p-6"
          >
            <FormError message={formError} />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Your name"
                autoComplete="name"
                {...register('fullName')}
                error={errors.fullName?.message}
              />
              <Field
                label="Email"
                type="email"
                autoComplete="email"
                {...register('email')}
                error={errors.email?.message}
              />
              <Select label="Where do you work now?" {...register('country')} error={errors.country?.message}>
                <option value="" disabled>
                  Choose a country
                </option>
                {COUNTRIES.map((country) => (
                  <option key={country}>{country}</option>
                ))}
              </Select>
              <Field
                label="WhatsApp or Viber number (optional)"
                type="tel"
                autoComplete="tel"
                {...register('phone')}
                error={errors.phone?.message}
              />
              <Field
                label="Where does your family live?"
                placeholder="e.g. Ormoc City, Leyte"
                {...register('familyLocation')}
                error={errors.familyLocation?.message}
              />
              <Select
                label="Who would you book for?"
                {...register('relation')}
                error={errors.relation?.message}
              >
                <option value="" disabled>
                  Choose one
                </option>
                {RELATIONS.map((relation) => (
                  <option key={relation}>{relation}</option>
                ))}
              </Select>
            </div>

            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-ink-2">What kind of visits?</legend>
              <div className="flex flex-wrap gap-2">
                {SERVICES.map((service) => (
                  <ChipCheckbox key={service} label={service} value={service} {...register('services')} />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-ink-2">How often?</legend>
              <div className="flex flex-wrap gap-2">
                {FREQUENCIES.map((frequency) => (
                  <ChipRadio key={frequency} label={frequency} value={frequency} {...register('frequency')} />
                ))}
              </div>
            </fieldset>

            <Consent {...register('consent')} error={errors.consent?.message} />
            <Button type="submit" size="lg" loading={isSubmitting} className="w-full sm:w-auto">
              Join the early list
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}

function Joined({ joined }: { joined: Position & { place: string } }) {
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}/abroad?src=share`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="ticket animate-ticket-print rounded-md" role="status">
      <div className="px-6 py-6">
        <p className="text-sm text-ink-muted">You&apos;re on the early list</p>
        <p className="num mt-2 text-[56px] font-semibold leading-none tracking-[-0.03em]">
          #{joined.position}
        </p>
        <p className="mt-3 text-[15px] text-ink-2">
          We&apos;ll email you when booking opens near {joined.place}. Your first 3 visits will have no fee.
        </p>
      </div>
      <div className="ticket-tear" />
      <div className="px-6 py-5">
        <p className="font-medium">Know other OFWs who send money for check-ups?</p>
        <p className="mt-0.5 text-sm text-ink-muted">
          The more families from one town, the sooner we open there.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
            target="_blank"
            rel="noreferrer"
            className={buttonClass('primary', 'md')}
          >
            Share on Facebook
          </a>
          <Button variant="secondary" onClick={copy}>
            {copied ? 'Link copied' : 'Copy link'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ClinicSignup() {
  const source = useSource();
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ClinicForm>({ resolver: zodResolver(clinicSchema), defaultValues: { phone: '' } });

  const onSubmit = async (values: ClinicForm) => {
    setFormError(null);
    try {
      await api.post<Position>(
        '/api/public/waitlist',
        { ...values, kind: 'CLINIC', phone: values.phone || undefined, source },
        { auth: false },
      );
      setDone(true);
    } catch (error) {
      if (error instanceof ApiError) {
        Object.entries(error.fieldErrors()).forEach(([field, message]) =>
          setError(field as keyof ClinicForm, { message }),
        );
      }
      setFormError(error instanceof Error ? error.message : 'Could not send. Please try again.');
    }
  };

  return (
    <section className="bg-ink text-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr,1.1fr]">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.01em]">Run a clinic or dental office?</h2>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-paper/75">
            Families abroad book and pay before the visit, so the patient who walks in is already paid for and
            expected. You set your own prices, and your secretary confirms visits in one tap.
          </p>
          <ul className="mt-5 space-y-2 text-[15px] text-paper/85">
            {[
              'Prepaid patients, so no surprise no-shows',
              'Reminders sent for you by text',
              'Paid out to your account',
            ].map((item) => (
              <li key={item} className="flex gap-2.5">
                <Check className="mt-1 h-4 w-4 text-marigold-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        {done ? (
          <div role="status" className="animate-fade-in self-start rounded-lg border border-paper/15 p-6">
            <p className="text-lg font-semibold">Thank you.</p>
            <p className="mt-1 text-paper/75">We&apos;ll get in touch soon to set up your clinic.</p>
          </div>
        ) : (
          <form
            aria-label="Partner clinic request"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="grid gap-4 rounded-lg bg-surface p-5 text-ink sm:grid-cols-2 sm:p-6"
          >
            <div className="sm:col-span-2">
              <FormError message={formError} />
            </div>
            <Field
              label="Clinic name"
              id="clinic-name"
              {...register('clinicName')}
              error={errors.clinicName?.message}
            />
            <Field
              label="Town or city"
              id="clinic-location"
              placeholder="e.g. Ormoc City"
              {...register('familyLocation')}
              error={errors.familyLocation?.message}
            />
            <Field
              label="Your name"
              id="clinic-person"
              {...register('fullName')}
              error={errors.fullName?.message}
            />
            <Field
              label="Mobile number (optional)"
              id="clinic-phone"
              type="tel"
              {...register('phone')}
              error={errors.phone?.message}
            />
            <Field
              label="Email"
              id="clinic-email"
              type="email"
              className="sm:col-span-2"
              {...register('email')}
              error={errors.email?.message}
            />
            <div className="sm:col-span-2">
              <Consent {...register('consent')} error={errors.consent?.message} />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" variant="ink" loading={isSubmitting}>
                Ask to be a partner clinic
              </Button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

const FAQ = [
  {
    q: 'Can I book now?',
    a: 'Not yet. We are signing up the first partner clinics in Ormoc and Leyte. Join the early list and we will email you as soon as your family’s town opens.',
  },
  {
    q: 'Which clinics can I book?',
    a: 'Partner clinics that use QueueUp. If your family already has a dentist or doctor they trust, put their town on the list and tell us the clinic when we email you, and we will invite them.',
  },
  {
    q: 'What if Mama cannot make it that day?',
    a: 'You will be able to move the visit online up to the clinic’s cut-off time, the same way any patient can.',
  },
  {
    q: 'Can my brother or sister back home get the reminders too?',
    a: 'Yes. You will be able to add a family member nearby so they get the same texts and can bring your parent.',
  },
  {
    q: 'What do you do with my details?',
    a: 'We only use them to contact you about QueueUp. The early list does not ask for any medical information, and you can ask us to delete your details at any time.',
  },
];

function Faq() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h2 className="text-2xl font-semibold tracking-[-0.01em]">Questions</h2>
      <div className="mt-6 divide-y divide-line border-y border-line">
        {FAQ.map((item) => (
          <details key={item.q} className="group py-1">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded py-3 font-medium transition-colors hover:text-pine-600 [&::-webkit-details-marker]:hidden">
              {item.q}
              <span
                aria-hidden="true"
                className="text-xl leading-none text-ink-faint transition-transform duration-200 group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="animate-fade-in pb-4 text-[15px] text-ink-2">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
