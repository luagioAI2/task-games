// Big numbers for every coin-scale value (coins, costs, income, multipliers, divine power).
// break_infinity.js (MIT) stores mantissa × 10^exponent, so values grow far past JS's 1.8e308 limit.
import Decimal from './vendor/break_infinity.js';
                                                                
export { Decimal };
                              

// Safety net: a Decimal that slips into plain arithmetic/comparison acts as a (possibly Infinity) number
// instead of the library's default string coercion. Template strings still use toString().
(Decimal.prototype       ).valueOf = function (             ) { return this.toNumber(); };

export const ZERO = new Decimal(0);
export const ONE = new Decimal(1);
const BIG_E = 9e15;

/** true for a usable finite Decimal (no NaN, no library "infinity") */
export function isDec(x     )               { return x instanceof Decimal; }
export function okDec(x         ) { return isFinite(x.mantissa) && isFinite(x.exponent) && Math.abs(x.exponent) < BIG_E; }

/** parse anything a save might hold (number, "1.2e5000" string, Decimal) — invalid → fallback */
export function dec(x     , fb                = 0)          {
  try {
    if (x instanceof Decimal) return okDec(x) ? x : new Decimal(fb);
    if (typeof x === 'number') return Number.isFinite(x) ? new Decimal(x) : new Decimal(fb);
    if (typeof x === 'string' && x.trim()) {
      const s = x.trim().replace(/E/g, 'e');
      if (!/^-?\d+(\.\d+)?(e[+-]?\d+(\.\d+)?)?$/.test(s)) return new Decimal(fb);
      const d = new Decimal(s);
      return okDec(d) ? d : new Decimal(fb);
    }
    if (x && typeof x === 'object' && typeof x.mantissa === 'number' && typeof x.exponent === 'number') {
      const d = Decimal.fromMantissaExponent(x.mantissa, x.exponent);
      return okDec(d) ? d : new Decimal(fb);
    }
  } catch { /* fall through */ }
  return new Decimal(fb);
}

/** a Decimal as a plain number for small-scale uses (progress bars, thresholds); clamps to ±1e300 */
export function num(x                  )         {
  if (typeof x === 'number') return Number.isFinite(x) ? x : (x > 0 ? 1e300 : x < 0 ? -1e300 : 0);
  if (!okDec(x)) return 0;
  if (x.exponent > 300) return x.mantissa > 0 ? 1e300 : -1e300;
  return x.toNumber();
}
export const dmax = (a               , b               ) => Decimal.max(a, b);
export const dmin = (a               , b               ) => Decimal.min(a, b);
