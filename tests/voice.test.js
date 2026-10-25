import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand, parseShortAnswer, parseChoiceAnswer } from '../src/voice/rules.js';

test('rules: credit entry, digits', () => {
  const r = parseCommand('gupta ji 400 ka samaan liya khaate me add karo');
  assert.equal(r.intent, 'add_credit');
  assert.equal(r.amountRupees, 400);
  assert.equal(r.customerName, 'gupta');
});

test('rules: payment with comma number', () => {
  const r = parseCommand('gupta ne 20,000 bheje');
  assert.equal(r.intent, 'record_payment');
  assert.equal(r.amountRupees, 20000);
  assert.equal(r.customerName, 'gupta');
});

test('rules: payment in Devanagari with number words', () => {
  const r = parseCommand('गुप्ता जी ने दो हज़ार भेजे');
  assert.equal(r.intent, 'record_payment');
  assert.equal(r.amountRupees, 2000);
  assert.equal(r.customerName, 'गुप्ता');
  assert.equal(r.customerNameRoman, 'gupta');
});

test('rules: compound number words', () => {
  assert.equal(parseCommand('patil ji ka do hajar paanch sau ka samaan liya').amountRupees, 2500);
  assert.equal(parseCommand('khan bhai ne pandrah hazaar bheje').amountRupees, 15000);
  assert.equal(parseCommand('mehta ji ne ek lakh diya').amountRupees, 100000);
  assert.equal(parseCommand('iyer ji ne chaar sau bheje').amountRupees, 400);
});

test('rules: sat vs sath (7 vs 60) do not collide', () => {
  assert.equal(parseCommand('iyer ji ne saat sau bheje').amountRupees, 700);
  assert.equal(parseCommand('khan ne saath hazaar bheje').amountRupees, 60000);
});

test('rules: k / lakh / crore suffixes and rupee symbol', () => {
  assert.equal(parseCommand('naik ne 20k bheje').amountRupees, 20000);
  assert.equal(parseCommand('desai ne 1.5 lakh bheje').amountRupees, 150000);
  assert.equal(parseCommand('singh ne ₹20,000 bheje').amountRupees, 20000);
});

test('rules: outstanding question', () => {
  const r = parseCommand('gupta ji ka kitna baaki hai');
  assert.equal(r.intent, 'outstanding');
  assert.equal(r.customerName, 'gupta');
});

test('rules: outstanding question in Devanagari', () => {
  const r = parseCommand('गुप्ता जी का कितना बाकी है');
  assert.equal(r.intent, 'outstanding');
});

test('rules: add customer', () => {
  const r = parseCommand('naya customer add karo Ravi Verma');
  assert.equal(r.intent, 'add_customer');
  assert.ok(/Ravi Verma/.test(r.customerName));
});

test('rules: reminder intent', () => {
  const r = parseCommand('gupta ji ko payment ka reminder bhejo');
  assert.equal(r.intent, 'reminder');
  assert.equal(r.customerName, 'gupta');
});

test('rules: payment method hint', () => {
  assert.equal(parseCommand('patil ne 5000 upi se bheje').paymentMethod, 'upi');
  assert.equal(parseCommand('patil ne 5000 cash diye').paymentMethod, 'cash');
});

test('rules: bare amount defaults to a khata credit entry', () => {
  const r = parseCommand('khan ji 350');
  assert.equal(r.intent, 'add_credit');
  assert.equal(r.amountRupees, 350);
  assert.equal(r.customerName, 'khan');
});

test('rules: gibberish returns null', () => {
  assert.equal(parseCommand('aaj mausam kaisa hai'), null);
  assert.equal(parseCommand(''), null);
});

test('rules: multi-item bill — items, labels, name, summed total', () => {
  const r = parseCommand('sharma ji ne 110 ki sabji, 90 ka tel, 150 ka raashan le liya');
  assert.equal(r.intent, 'add_credit');
  assert.equal(r.customerName, 'sharma');
  assert.equal(r.amountRupees, 350);
  assert.deepEqual(r.items.map((i) => i.label), ['Sabji', 'Tel', 'Raashan']);
  assert.deepEqual(r.items.map((i) => i.amountRupees), [110, 90, 150]);
});

test('rules: multi-item bill without commas', () => {
  const r = parseCommand('gupta ne 40 ka atta 60 ka chawal liya');
  assert.equal(r.amountRupees, 100);
  assert.deepEqual(r.items.map((i) => i.label), ['Atta', 'Chawal']);
});

test('rules: single generic samaan becomes the default bill line', () => {
  const r = parseCommand('ramesh ji 1000 ka samaan legaye');
  assert.equal(r.intent, 'add_credit');
  assert.equal(r.customerName, 'ramesh');
  assert.equal(r.amountRupees, 1000);
  assert.deepEqual(r.items, [{ label: 'Kiryana samaan', amountRupees: 1000 }]);
});

test('rules: word-amount items in Devanagari', () => {
  const r = parseCommand('शर्मा जी ने दो सौ की सब्जी, नब्बे का तेल लिए');
  assert.equal(r.amountRupees, 290);
  assert.equal(r.items.length, 2);
  assert.deepEqual(r.items.map((i) => i.amountRupees), [200, 90]);
  assert.equal(r.customerName, 'शर्मा');
});

test('rules: payments and bare entries stay item-less', () => {
  assert.equal(parseCommand('patil ne 5000 upi se bheje').items, null);
  assert.equal(parseCommand('khan ji 350').items, null);
});

test('short answers: yes / no / other', () => {
  assert.equal(parseShortAnswer('haan'), 'yes');
  assert.equal(parseShortAnswer('haan ji kar do'), 'yes');
  assert.equal(parseShortAnswer('ji haan'), 'yes');
  assert.equal(parseShortAnswer('theek hai kardo'), 'yes');
  assert.equal(parseShortAnswer('हाँ जी'), 'yes');
  assert.equal(parseShortAnswer('ok'), 'yes');
  assert.equal(parseShortAnswer('nahi'), 'no');
  assert.equal(parseShortAnswer('haan nahi'), 'no');
  assert.equal(parseShortAnswer('नहीं'), 'no');
  assert.equal(parseShortAnswer('rehne do'), 'no');
  assert.equal(parseShortAnswer('cancel karo'), 'no');
  assert.equal(parseShortAnswer('ji'), 'other'); // bare "ji" is not a yes
  assert.equal(parseShortAnswer('wahi 500 ka tha'), 'other');
  assert.equal(parseShortAnswer(''), 'other');
});

test('short answers: choice ordinals', () => {
  assert.deepEqual(parseChoiceAnswer('pehla wala'), { index: 0, wantsNew: false });
  assert.deepEqual(parseChoiceAnswer('doosra'), { index: 1, wantsNew: false });
  assert.deepEqual(parseChoiceAnswer('2'), { index: 1, wantsNew: false });
  assert.deepEqual(parseChoiceAnswer('दूसरा'), { index: 1, wantsNew: false });
  assert.deepEqual(parseChoiceAnswer('naya hai'), { index: null, wantsNew: true });
  assert.deepEqual(parseChoiceAnswer('ramesh wala'), { index: null, wantsNew: false });
});
