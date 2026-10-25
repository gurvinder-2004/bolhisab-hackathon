import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextChaseAction, todaysFollowUps, chaseScore, ladderChannel, whatsappTemplate } from '../src/domain/chase.js';

test('ladder: channel by overdue days', () => {
  assert.equal(ladderChannel(0), null);
  assert.equal(ladderChannel(3), 'whatsapp');
  assert.equal(ladderChannel(10), 'call');
  assert.equal(ladderChannel(20), 'letter');
  assert.equal(ladderChannel(45), 'letter_call');
});

test('chase: dispute always pauses, draft and paid never chased', () => {
  assert.equal(nextChaseAction({ status: 'disputed', outstandingPaise: 50000, daysOverdue: 40 }).action, null);
  assert.equal(nextChaseAction({ status: 'draft', outstandingPaise: 50000, daysOverdue: 40 }).action, null);
  assert.equal(nextChaseAction({ status: 'paid', outstandingPaise: 0, daysOverdue: 40 }).action, null);
});

test('chase: cadence suppresses too-recent reminders', () => {
  const base = { status: 'overdue', outstandingPaise: 50000, daysOverdue: 5 };
  assert.equal(nextChaseAction({ ...base, lastReminderDaysAgo: 1 }).action, null);
  assert.equal(nextChaseAction({ ...base, lastReminderDaysAgo: 4 }).action, 'whatsapp');
  // escalated to call by day 10, whatsapp cadence no longer applies
  assert.equal(nextChaseAction({ ...base, daysOverdue: 10, lastReminderDaysAgo: 4 }).action, 'call');
});

test('follow-ups: worst first, disputed excluded, grade adjusts order', () => {
  const customers = [
    { id: 'a', name: 'A Grade', grade: 'A' },
    { id: 'c', name: 'C Grade', grade: 'C' },
    { id: 'd', name: 'Disputed', grade: 'B' },
  ];
  const invoices = [
    { id: 'i1', number: 'INV/26/101', customerId: 'a', dueDate: '2026-09-01', totalPaise: 500000, status: 'overdue', outstandingPaise: 500000, daysOverdue: 40 },
    { id: 'i2', number: 'INV/26/102', customerId: 'c', dueDate: '2026-09-20', totalPaise: 800000, status: 'overdue', outstandingPaise: 800000, daysOverdue: 20 },
    { id: 'i3', number: 'INV/26/103', customerId: 'd', dueDate: '2026-08-01', totalPaise: 900000, status: 'disputed', outstandingPaise: 900000, daysOverdue: 60 },
  ];
  const rows = todaysFollowUps({ invoices, customers, today: '2026-10-25' });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].customerId, 'a'); // 40 days late beats 20 despite A-grade discount
  assert.equal(rows[0].action, 'letter_call');
  assert.equal(rows[1].customerId, 'c');
  assert.ok(rows[0].score >= rows[1].score);
});

test('whatsapp template mentions invoice, amount and stays polite', () => {
  const t = whatsappTemplate({ name: 'Gupta', number: 'INV/26/007', amountPaise: 118000, dueDate: '2026-10-01', business: 'Sharma Packaging', payLink: 'https://x/pay' });
  assert.ok(t.includes('INV/26/007'));
  assert.ok(t.includes('₹1,180'));
  assert.ok(t.includes('https://x/pay'));
  assert.ok(!/legal|court|case/i.test(t));
});
