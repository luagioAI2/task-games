// 存档：平台自动存档 gp.player.saves（kv：{ save: JSON }，读 latestSync / 写 putLatest，平台负责合并写入与关页刷新）。
// 内容：世界进度、上次在线时间（算离线收益）、教学进度、看过的深层、声音开关、语言。
// 旧版本存在 localStorage 里的进度会以 legacy 影子存档出现在 latestSync 里（键名不变），读到后转换一次。?qa 不读写存档。
import { CONFIG } from './config.js';

const fresh = () => ({ v: 1, sound: true, music: true, lang: null, world: null, lastSeen: 0, tut: 0, layers: [], tips: {} });
const parse = (s) => { try { const d = typeof s === 'string' ? JSON.parse(s) : s; return d && typeof d === 'object' ? d : null; } catch { return null; } };
const cloud = () => { try { return window.gp?.player?.saves ?? null; } catch { return null; } };

export class Save {
  constructor(qa = false) {
    this.qa = qa;
    this.data = fresh();
    const c = qa ? null : cloud();
    let d = null;
    if (c) {
      const kv = c.latestSync, legacy = !!c.latestInfo?.legacy;
      if (legacy && kv && typeof kv === 'object') d = parse(kv[CONFIG.saveKey]);
      else if (typeof kv === 'string') d = parse(kv);
      else if (kv && typeof kv === 'object') d = parse(kv.save);
      if (legacy && d) this.migrated = true;
    }
    if (d && d.v === 1) this.data = { ...fresh(), ...d, sound: d.sound !== false, music: d.music !== false };
    if (this.migrated) this.write();
  }
  write() {
    const c = this.qa ? null : cloud(); if (!c) return;
    try { void c.putLatest({ save: JSON.stringify(this.data) }, 'kv'); } catch { /* 平台不可用时忽略 */ }
  }
  // “重置进度”不清掉花硬币买来的东西：已买的投资人人数（paidInv）和已到账的购买记录（paidIds，防重复发放）都保留
  clear() {
    const d = this.data;
    this.data = { ...fresh(), sound: d.sound, music: d.music, lang: d.lang, langPicked: d.langPicked, paidInv: d.paidInv ?? 0, paidIds: d.paidIds ?? [], ownedSkins: d.ownedSkins ?? [], skins: d.skins ?? {} };   // 硬币买的东西（投资人、皮肤）重置进度也保留
    this.write();
  }
}
