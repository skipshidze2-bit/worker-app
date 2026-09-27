// Pricing rules shared by the app (quotes shown to employers) and the edge
// functions (what is actually charged). Workers always receive 100% of the
// advertised wage; the platform fee is charged on top to the employer.

export const FEES = {
  /** Markup on a first booking between this employer and worker. */
  firstBookingBps: 2500,
  /** Markup when the employer has worked with this worker before, or favorited them. */
  repeatBookingBps: 1200,
  /** Extra markup when the shift starts less than 24h after it was booked. */
  urgentSurchargeBps: 750,
  urgentWindowHours: 24,
} as const;

export const CANCELLATION = {
  /** Employer cancelling inside this window still pays the worker part of the wage. */
  lateWindowHours: 24,
  /** Share of the wage the worker receives on a late employer cancellation. */
  lateEmployerWageShareBps: 5000,
} as const;

export type Quote = {
  minutes: number;
  wageCents: number;
  feeBps: number;
  feeCents: number;
  totalCents: number;
};

export function shiftMinutes(startsAt: string | Date, endsAt: string | Date): number {
  const ms = new Date(endsAt).getTime() - new Date(startsAt).getTime();
  return Math.max(0, Math.round(ms / 60000));
}

export function feeBps(opts: { isRepeat: boolean; hoursUntilStart: number }): number {
  const base = opts.isRepeat ? FEES.repeatBookingBps : FEES.firstBookingBps;
  const urgent = opts.hoursUntilStart < FEES.urgentWindowHours ? FEES.urgentSurchargeBps : 0;
  return base + urgent;
}

export function wageCents(hourlyRateCents: number, minutes: number): number {
  return Math.round((hourlyRateCents * minutes) / 60);
}

/** Price of one worker for one shift. */
export function quoteBooking(opts: {
  hourlyRateCents: number;
  minutes: number;
  isRepeat: boolean;
  hoursUntilStart: number;
}): Quote {
  const wage = wageCents(opts.hourlyRateCents, opts.minutes);
  const bps = feeBps(opts);
  const fee = Math.round((wage * bps) / 10000);
  return { minutes: opts.minutes, wageCents: wage, feeBps: bps, feeCents: fee, totalCents: wage + fee };
}

/** Worst-case total shown before posting: every slot filled at the first-booking fee. */
export function quoteShift(opts: {
  hourlyRateCents: number;
  startsAt: string | Date;
  endsAt: string | Date;
  workersNeeded: number;
  now?: Date;
}): Quote & { perWorker: Quote; workersNeeded: number } {
  const now = opts.now ?? new Date();
  const hoursUntilStart = (new Date(opts.startsAt).getTime() - now.getTime()) / 3_600_000;
  const perWorker = quoteBooking({
    hourlyRateCents: opts.hourlyRateCents,
    minutes: shiftMinutes(opts.startsAt, opts.endsAt),
    isRepeat: false,
    hoursUntilStart,
  });
  const n = opts.workersNeeded;
  return {
    perWorker,
    workersNeeded: n,
    minutes: perWorker.minutes,
    wageCents: perWorker.wageCents * n,
    feeBps: perWorker.feeBps,
    feeCents: perWorker.feeCents * n,
    totalCents: perWorker.totalCents * n,
  };
}

/**
 * Final settlement once hours are confirmed. The employer was charged for the
 * scheduled hours; if fewer hours were worked, the difference (wage and its
 * fee) is refunded. Worked time is never paid above what was charged.
 */
export function settleBooking(opts: {
  chargedWageCents: number;
  chargedFeeCents: number;
  hourlyRateCents: number;
  confirmedMinutes: number;
}): { payoutCents: number; keptFeeCents: number; refundCents: number } {
  const payout = Math.min(opts.chargedWageCents, wageCents(opts.hourlyRateCents, opts.confirmedMinutes));
  const keptFee =
    opts.chargedWageCents === 0 ? 0 : Math.round((opts.chargedFeeCents * payout) / opts.chargedWageCents);
  const refund = opts.chargedWageCents + opts.chargedFeeCents - payout - keptFee;
  return { payoutCents: payout, keptFeeCents: keptFee, refundCents: refund };
}

/**
 * What happens to the money when a booking is cancelled.
 * - Employer cancels late: worker gets part of the wage, platform keeps the fee on that part.
 * - Otherwise: full refund to the employer, nothing paid out.
 */
export function settleCancellation(opts: {
  by: 'employer' | 'worker';
  hoursBeforeStart: number;
  chargedWageCents: number;
  chargedFeeCents: number;
}): { payoutCents: number; keptFeeCents: number; refundCents: number; late: boolean } {
  const late = opts.hoursBeforeStart < CANCELLATION.lateWindowHours;
  const total = opts.chargedWageCents + opts.chargedFeeCents;
  if (opts.by === 'employer' && late) {
    const payout = Math.round((opts.chargedWageCents * CANCELLATION.lateEmployerWageShareBps) / 10000);
    const keptFee =
      opts.chargedWageCents === 0 ? 0 : Math.round((opts.chargedFeeCents * payout) / opts.chargedWageCents);
    return { payoutCents: payout, keptFeeCents: keptFee, refundCents: total - payout - keptFee, late };
  }
  return { payoutCents: 0, keptFeeCents: 0, refundCents: total, late };
}

export function formatMoney(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
}
