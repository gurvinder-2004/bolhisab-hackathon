import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDemoData } from '../src/data/index.js';
import { resolveCustomer, describeCandidates, pickByOrdinal, transliterate } from '../src/domain/match.js';

const { customers } = buildDemoData();
const names = (r) => r.candidates.map((c) => c.customer.name).sort();

test('transliterate: Devanagari names', () => {
  assert.equal(transliterate('गुप्ता जी'), 'gupta ji');
  assert.equal(transliterate('शर्मा'), 'sharma');
  assert.equal(transliterate('रमेश'), 'ramesh');
  assert.equal(transliterate('कुलकर्णी'), 'kulakarni');
  assert.equal(transliterate('Gupta'), 'Gupta');
});

test('"gupta ji" is ambiguous between the two Guptas (Latin, Devanagari, spelling variants)', () => {
  for (const spoken of ['gupta ji', 'Gupta', 'गुप्ता जी', 'guptaa ji', 'gupta seth']) {
    const r = resolveCustomer(spoken, customers);
    assert.equal(r.status, 'ambiguous', spoken);
    assert.deepEqual(names(r), ['Ramesh Gupta', 'Suresh Gupta'], spoken);
  }
});

test('narrowing to one customer', () => {
  assert.equal(resolveCustomer('Ramesh Gupta', customers).candidates[0].customer.name, 'Ramesh Gupta');
  assert.equal(resolveCustomer('Ramesh Gupta', customers).status, 'unique');
  assert.equal(resolveCustomer('Pimpri wale Gupta ji', customers).candidates[0].customer.name, 'Ramesh Gupta');
  assert.equal(resolveCustomer('हडपसर वाले गुप्ता', customers).status, 'none'); // Marathi/Hindi place names need the LLM to romanise
  assert.equal(resolveCustomer('Hadapsar wale Gupta', customers).candidates[0].customer.name, 'Suresh Gupta');
  assert.equal(resolveCustomer('Gupta Hardware', customers).candidates[0].customer.name, 'Suresh Gupta');
});

test('answering the follow-up question from the candidate list only', () => {
  const first = resolveCustomer('gupta ji', customers).candidates.map((c) => c.customer);
  assert.equal(resolveCustomer('Ramesh wale', first).candidates[0].customer.name, 'Ramesh Gupta');
  assert.equal(resolveCustomer('रमेश', first).status, 'unique');
  assert.equal(pickByOrdinal('doosre wale', 2), 1);
  assert.equal(pickByOrdinal('pehla', 2), 0);
  assert.equal(pickByOrdinal('ramesh', 2), null);
});

test('unique, misheard and unknown names', () => {
  assert.equal(resolveCustomer('Patil ji', customers).status, 'unique');
  assert.equal(resolveCustomer('पाटील', customers).status, 'unique');
  assert.equal(resolveCustomer('Kulkarni pharma', customers).candidates[0].customer.name, 'Sanjay Kulkarni');
  assert.equal(resolveCustomer('Desai', customers).status, 'unique');
  assert.equal(resolveCustomer('Verma ji', customers).status, 'none');
  assert.equal(resolveCustomer('', customers).status, 'none');
  const fuzzy = resolveCustomer('Mehata ji', customers); // close but not exact -> ask to confirm
  assert.equal(fuzzy.candidates[0].customer.name, 'Mahesh Mehta');
});

test('describeCandidates shows name plus what differs', () => {
  const two = customers.filter((c) => c.name.endsWith('Gupta'));
  const labels = describeCandidates(two).map((l) => l.label);
  assert.deepEqual(labels, ['Ramesh Gupta · Pimpri', 'Suresh Gupta · Hadapsar']);
  const same = describeCandidates([{ id: 1, name: 'A Gupta', area: 'X', city: 'Pune', phone: '9000000001' }, { id: 2, name: 'A Gupta', area: 'X', city: 'Pune', phone: '9000000002' }]);
  assert.notEqual(same[0].label, same[1].label); // falls back to the phone digits
});
