import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  feeBps,
  quoteBooking,
  quoteShift,
  settleBooking,
  settleCancellation,
  shiftMinutes,
} from '../supabase/functions/_shared/pricing.ts';

test('fee is 25% first time, 12% repeat, plus 7.5% when urgent', () => {
  assert.equal(feeBps({ isRepeat: false, hoursUntilStart: 48 }), 2500);
  assert.equal(feeBps({ isRepeat: true, hoursUntilStart: 48 }), 1200);
  assert.equal(feeBps({ isRepeat: false, hoursUntilStart: 5 }), 3250);
  assert.equal(feeBps({ isRepeat: true, hoursUntilStart: 5 }), 1950);
});

test('8h at $15/h, first booking: employer pays $150, worker gets $120', () => {
  const q = quoteBooking({ hourlyRateCents: 1500, minutes: 480, isRepeat: false, hoursUntilStart: 72 });
  assert.deepEqual(q, { minutes: 480, wageCents: 12000, feeBps: 2500, feeCents: 3000, totalCents: 15000 });
});

test('shift quote multiplies by workers needed', () => {
  const now = new Date('2026-10-01T08:00:00Z');
  const q = quoteShift({
    hourlyRateCents: 1500,
    startsAt: '2026-10-05T10:00:00Z',
    endsAt: '2026-10-05T18:00:00Z',
    workersNeeded: 3,
    now,
  });
  assert.equal(q.totalCents, 45000);
  assert.equal(q.wageCents, 36000);
  assert.equal(q.perWorker.totalCents, 15000);
});

test('shiftMinutes', () => {
  assert.equal(shiftMinutes('2026-10-05T10:00:00Z', '2026-10-05T14:30:00Z'), 270);
});

test('settlement refunds unworked hours and never overpays', () => {
  const full = settleBooking({ chargedWageCents: 12000, chargedFeeCents: 3000, hourlyRateCents: 1500, confirmedMinutes: 480 });
  assert.deepEqual(full, { payoutCents: 12000, keptFeeCents: 3000, refundCents: 0 });

  const short = settleBooking({ chargedWageCents: 12000, chargedFeeCents: 3000, hourlyRateCents: 1500, confirmedMinutes: 240 });
  assert.deepEqual(short, { payoutCents: 6000, keptFeeCents: 1500, refundCents: 7500 });

  const over = settleBooking({ chargedWageCents: 12000, chargedFeeCents: 3000, hourlyRateCents: 1500, confirmedMinutes: 600 });
  assert.equal(over.payoutCents, 12000);
  assert.equal(over.refundCents, 0);
});

test('late employer cancellation pays the worker half', () => {
  const s = settleCancellation({ by: 'employer', hoursBeforeStart: 3, chargedWageCents: 12000, chargedFeeCents: 3000 });
  assert.deepEqual(s, { payoutCents: 6000, keptFeeCents: 1500, refundCents: 7500, late: true });
});

test('early cancellation and worker cancellation fully refund the employer', () => {
  assert.equal(settleCancellation({ by: 'employer', hoursBeforeStart: 48, chargedWageCents: 12000, chargedFeeCents: 3000 }).refundCents, 15000);
  const w = settleCancellation({ by: 'worker', hoursBeforeStart: 2, chargedWageCents: 12000, chargedFeeCents: 3000 });
  assert.equal(w.refundCents, 15000);
  assert.equal(w.late, true);
});
