// 13-week cash forecast. Whole weeks, Monday-start, IST dates. Pure.
// Expected inflow = open invoices shifted by the customer's payment habit
// (A-grade: on time, B: +1 week, C: +4 weeks). Outflow = recurring monthly
// expenses + dated supplier bills. Closing always chains into next week's opening.

import { diffDays, addDays } from '../engine/dates.js';
import { formatINR } from '../engine/money.js';

export function gradeDelayWeeks(grade) {
  if (grade === 'A') return 0;
  if (grade === 'B') return 1;
  return 4; // C or unknown: about a month late
}

function mondayOf(iso) {
  const d = new Date(Date.parse(iso + 'T00:00:00Z'));
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(d.getTime() - dow * 86400000).toISOString().slice(0, 10);
}

// { cashPaise, safetyPaise, today, invoices: [{outstanding, dueDate, customerId, number}],
//   customers: [{id, grade}], expenses: [{label, category, amountPaise, recurrence, dayOfMonth, dueDate}],
//   overrides?: { extraInPaise, cGradeExtraWeeks, pauseOutflows? } }
export function forecast({ cashPaise, safetyPaise, today, invoices, customers, expenses, overrides = {} }) {
  const weeks = [];
  const start = mondayOf(today);
  const weekStarts = Array.from({ length: 13 }, (_, i) => addDays(start, i * 7));
  const weekOf = (iso) => weekStarts.findIndex((w) => iso >= w && iso < addDays(w, 7));

  const gradeById = new Map(customers.map((c) => [c.id, c.grade]));
  const extraC = overrides.cGradeExtraWeeks ?? 0;

  // inflows
  const inByWeek = new Array(13).fill(0);
  for (const inv of invoices) {
    if (!inv.outstanding || inv.outstanding <= 0) continue;
    const g = gradeById.get(inv.customerId) ?? 'C';
    let wk = weekOf(inv.dueDate);
    if (wk < 0) wk = inv.dueDate < weekStarts[0] ? 0 : 12; // clamp into horizon
    wk += gradeDelayWeeks(g) + (g === 'C' ? extraC : 0);
    wk = Math.min(12, Math.max(0, wk));
    inByWeek[wk] += inv.outstanding;
  }
  if (overrides.extraInPaise) inByWeek[0] += overrides.extraInPaise;

  // outflows
  const outByWeek = new Array(13).fill(0);
  for (const e of expenses) {
    if (overrides.pauseOutflows) break;
    if (e.recurrence === 'monthly') {
      // every month in the horizon, on day_of_month
      let y = Number(weekStarts[0].slice(0, 4)), m = Number(weekStarts[0].slice(5, 7));
      for (let k = 0; k < 4; k++) {
        const iso = `${y}-${String(m).padStart(2, '0')}-${String(Math.min(28, e.dayOfMonth ?? 1)).padStart(2, '0')}`;
        let wk = weekOf(iso);
        if (wk >= 0 && wk < 13) outByWeek[wk] += e.amountPaise;
        m++; if (m > 12) { m = 1; y++; }
      }
    } else if (e.dueDate) {
      let wk = weekOf(e.dueDate);
      if (wk < 0) wk = e.dueDate < weekStarts[0] ? 0 : 12;
      outByWeek[wk] += e.amountPaise;
    }
  }

  let opening = cashPaise;
  for (let i = 0; i < 13; i++) {
    const closing = opening + inByWeek[i] - outByWeek[i];
    weeks.push({
      weekStart: weekStarts[i], openingPaise: opening,
      inPaise: inByWeek[i], outPaise: outByWeek[i], closingPaise: closing,
      belowBuffer: closing < (safetyPaise ?? 0),
    });
    opening = closing;
  }
  return weeks;
}

// The "what-if" story for the demo: where is cash tightest and what moves it.
export function forecastHeadline(weeks) {
  const worst = weeks.reduce((a, b) => (b.closingPaise < a.closingPaise ? b : a), weeks[0]);
  const firstShort = weeks.find((w) => w.belowBuffer);
  return {
    worstWeek: worst,
    worstWeekLabel: `hafta ${worst.weekStart}`,
    shortfall: firstShort ? Math.max(0, 0 - firstShort.closingPaise) : 0,
    endsAt: formatINR(weeks[weeks.length - 1].closingPaise),
  };
}
