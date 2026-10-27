import { Decimal } from './decimal.js';
const UNITS = ['', 'K', 'M', 'B', 'T'];
const LETTER_GROUPS = 26 * 26; // aa..zz

const trim = (s        ) => s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');

// Accepts plain numbers and big Decimals. K/M/B/T, then aa..zz, then mantissa e exponent (1.23e1050).
export function fmt(x                  )         {
  let m        , e10        ; // value = m * 10^e10, 1 <= m < 10
  if (x instanceof Decimal) {
    if (!isFinite(x.mantissa) || !isFinite(x.exponent)) return '0';
    if (x.mantissa < 0) return '-' + fmt(x.neg());
    if (x.exponent < 3) return fmt(x.toNumber());
    m = x.mantissa; e10 = x.exponent;
  } else {
    let n = x;
    if (n !== n) return '0';
    if (n < 0) return '-' + fmt(-n);
    if (!isFinite(n)) n = Number.MAX_VALUE;
    if (n < 1000) {
      if (n < 10 && n % 1 !== 0) return n.toFixed(1);
      return Math.floor(n).toString();
    }
    e10 = Math.floor(Math.log10(n));
    m = n / Math.pow(10, e10);
    if (m >= 10) { m /= 10; e10++; } else if (m < 1) { m *= 10; e10--; }
  }
  const e = Math.floor(e10 / 3);
  if (e >= UNITS.length + LETTER_GROUPS) {
    // beyond zz: scientific
    let mm = Math.round(m * 100) / 100, ee = e10;
    if (mm >= 10) { mm /= 10; ee++; }
    return trim(mm.toFixed(2)) + 'e' + ee;
  }
  const v = m * Math.pow(10, e10 - e * 3);
  const s = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
  let unit        ;
  if (e < UNITS.length) unit = UNITS[e];
  else {
    const k = e - UNITS.length; // aa, ab, ...
    const a = Math.floor(k / 26), b = k % 26;
    unit = String.fromCharCode(97 + a) + String.fromCharCode(97 + b);
  }
  return trim(s) + unit;
}

/** small multipliers keep 2 decimals; huge ones switch to the big-number format */
export function fmt2(x                  )         {
  const n = x instanceof Decimal ? (x.exponent < 4 ? x.toNumber() : Infinity) : x;
  return n < 1000 ? n.toFixed(2) : fmt(x);
}

export function fmtTime(sec        , h                       , m                       )         {
  if (sec >= 3600) return h(Math.round(sec / 360) / 10);
  return m(Math.max(1, Math.round(sec / 60)));
}
