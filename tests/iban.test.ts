import assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalizeIban } from '../src/lib/iban.ts';

test('accepts valid Georgian IBANs with spaces and lowercase', () => {
  assert.equal(normalizeIban('ge29 nb00 0000 0101 9049 17'), 'GE29NB0000000101904917');
});

test('rejects a wrong check digit, wrong length or other countries', () => {
  assert.equal(normalizeIban('GE29NB0000000101904918'), null);
  assert.equal(normalizeIban('GE29NB000000010190491'), null);
  assert.equal(normalizeIban('DE89370400440532013000'), null);
});
