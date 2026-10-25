const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function below100(n) {
  return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
}
function below1000(n) {
  const h = Math.floor(n / 100), r = n % 100;
  return [h ? ONES[h] + ' Hundred' : '', r ? below100(r) : ''].filter(Boolean).join(' ');
}

// Indian grouping: Crore, Lakh, Thousand.
export function numberToIndianWords(n) {
  if (!Number.isInteger(n) || n < 0) throw new Error('Expected a non-negative integer');
  if (n === 0) return 'Zero';
  const parts = [];
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(numberToIndianWords(crore) + ' Crore');
  if (lakh) parts.push(below100(lakh) + ' Lakh');
  if (thousand) parts.push(below100(thousand) + ' Thousand');
  if (n) parts.push(below1000(n));
  return parts.join(' ');
}

// 11800000 paise -> "Rupees One Lakh Eighteen Thousand Only"
export function amountInWords(paise) {
  if (!Number.isInteger(paise) || paise < 0) throw new Error('Expected non-negative whole paise');
  const rupees = Math.floor(paise / 100), p = paise % 100;
  let s = 'Rupees ' + numberToIndianWords(rupees);
  if (p) s += ' and ' + numberToIndianWords(p) + ' Paise';
  return s + ' Only';
}
