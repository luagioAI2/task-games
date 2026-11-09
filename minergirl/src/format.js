// 大数字格式：位数固定，不随数值跳动——1000 以下显示整数（10 以下的小数保留两位，如 3.57）；
// 1000 以上一律两位小数 + 单位：1.20K、35.70K、356.56K、12.00M。
// 单位用通用的英文缩写（K 千 / M 百万 / B 十亿 / T 万亿 / Qa 10^15 / Qi 10^18 / Sx / Sp / Oc / No / Dc），
// 最深的矿道价格在 10^15 以上，所以 Qa 是正常会看到的；再往上（10^36 起）才退回 aa ab ac…
import { t } from '../i18n.js';
const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
const unit = (k) => (k < UNITS.length ? UNITS[k] : String.fromCharCode(97 + Math.floor((k - UNITS.length) / 26)) + String.fromCharCode(97 + ((k - UNITS.length) % 26)));
export function fmt(n) {
  if (!Number.isFinite(n)) return '∞';
  if (n < 0) return '-' + fmt(-n);
  let k = n < 1000 ? 0 : Math.floor(Math.log10(n) / 3);
  if (k === 0) { const f = Math.floor(n * 100 + 1e-6) / 100; return n >= 10 || Number.isInteger(f) ? String(Math.floor(n + 1e-9)) : f.toFixed(2); }
  let v = Math.floor((n / Math.pow(10, k * 3)) * 100 + 1e-6) / 100;
  if (v >= 1000) { k++; v = Math.floor(v / 10) / 100; }
  return v.toFixed(2) + unit(k);
}
// 面板里的时间类数值（秒）：固定一位小数
export const fmtSec = (n) => (Number.isFinite(n) ? n.toFixed(1) : '∞');
export const fmtTime = (s) => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? t('time.h', { h, m }) : m ? t('time.m', { m, s: x }) : t('time.s', { s: x }); };
// 技能计时：mm:ss（与参考作一样显示 00:28 / 04:54）
export const fmtClock = (s) => { s = Math.max(0, Math.ceil(s)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
