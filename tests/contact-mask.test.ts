import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MASK, maskContactInfo } from '../supabase/functions/_shared/contact-mask.ts';

const hidden = (s: string) => maskContactInfo(s);

test('masks phone numbers in common formats', () => {
  for (const msg of [
    'call 555 123 4567',
    'my num +995 599 12 34 56',
    '(555) 123-4567',
    '5551234567',
    '555.123.4567',
  ]) {
    const r = hidden(msg);
    assert.ok(r.reasons.includes('phone'), msg);
    assert.ok(!/\d{3}/.test(r.text.replace(/\+?995/, '')), `${msg} -> ${r.text}`);
  }
});

test('masks numbers spelled out as words', () => {
  const r = hidden('its five five five one two three four');
  assert.ok(r.reasons.includes('phone'));
  assert.equal(r.text, `its ${MASK}`);
});

test('masks mixed digits and words', () => {
  const r = hidden('555 one two 3 4 five 6');
  assert.ok(r.reasons.includes('phone'));
});

test('masks emails, including obfuscated ones', () => {
  for (const msg of ['mail me john.doe@gmail.com', 'john (at) gmail (dot) com', 'john at gmail dot com']) {
    const r = hidden(msg);
    assert.ok(r.reasons.includes('email'), `${msg} -> ${JSON.stringify(r)}`);
    assert.ok(!r.text.includes('gmail'), r.text);
  }
});

test('masks links and social handles', () => {
  assert.ok(hidden('wa.me/5551234').masked);
  assert.ok(hidden('see https://instagram.com/john').reasons.includes('url'));
  assert.ok(hidden('follow @john_doe').reasons.includes('handle'));
});

test('masks off-app keywords', () => {
  for (const msg of ['add me on WhatsApp', 'message me on telegram', 'my number is below', 'text me later', 'insta?']) {
    assert.ok(hidden(msg).reasons.includes('off_app_keyword'), msg);
  }
});

test('leaves normal shift chat alone', () => {
  for (const msg of [
    "I'm at the gate, see you at 10:30",
    'Bring black shoes and a white shirt',
    'We need one more person for 8 hours',
    'Shift is at 27/09 from 18:00 to 23:00',
    'Pay is $15.50 per hour, 2 breaks',
    'Room 204, floor 3',
  ]) {
    const r = hidden(msg);
    assert.equal(r.masked, false, `${msg} -> ${JSON.stringify(r)}`);
    assert.equal(r.text, msg);
  }
});

test('masks numbers spelled out in Georgian and Russian', () => {
  const ka = hidden('ჩაიწერე: ხუთი ხუთი ცხრა ერთი ორი სამი ოთხი ხუთი ექვსი');
  assert.ok(ka.reasons.includes('phone'), JSON.stringify(ka));
  assert.ok(hidden('пять пять девять один два три четыре').reasons.includes('phone'));
  assert.ok(hidden('599 თორმეტი ოცი 45').reasons.includes('phone'));
});

test('masks Georgian and Russian messenger names with suffixes', () => {
  for (const msg of ['მომწერე ვოცაპში', 'ვაიბერზე დამიკავშირდი', 'დამირეკე ხვალ', 'ჩემი ნომერია', 'напиши в ватсап', 'телеграме']) {
    assert.ok(hidden(msg).reasons.includes('off_app_keyword'), msg);
  }
});

test('leaves normal Georgian shift chat alone', () => {
  for (const msg of [
    'ათ საათზე მოვალ, შესასვლელთან დაგელოდებით',
    'ინსტრუქცია მივიღე, შავი ფეხსაცმელი მოვიტან',
    'სამი საათის შემდეგ შესვენება გვაქვს',
    'მაგიდა ნომერი 12, მეორე სართული',
  ]) {
    const r = hidden(msg);
    assert.equal(r.masked, false, `${msg} -> ${JSON.stringify(r)}`);
  }
});
