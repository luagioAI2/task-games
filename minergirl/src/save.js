// 存档：整份进度一个键（`save`），落在宿主给的 store 上。
//
// 原版落在平台的云端 KV（`gp.player.saves`：读 `latestSync` / 写 `putLatest`）。
// 接进宿主后换成 `host.storage`（见 `src/host.js`）—— **同步读写内存缓存**，
// 挂载时 preload 一次、卸载时 flush 一次。所以这里保持同步接口不变：
// `persist()` 是在帧里被调的，不能 await。
//
// 内容：世界进度、上次在线时间（算离线收益）、教学进度、看过的深层、声音 / 语言开关、穿着的皮肤。
import { CONFIG } from './config.js';

const fresh = () => ({ v: 1, sound: true, music: true, lang: null, world: null, lastSeen: 0, tut: 0, layers: [], tips: {} });
const parse = (s) => { try { const d = typeof s === 'string' ? JSON.parse(s) : s; return d && typeof d === 'object' ? d : null; } catch { return null; } };

/**
 * @param {{ get(k: string): unknown, set(k: string, v: unknown): void }} store
 *        `src/host.js` 的 `makeHostStore` / `makeLocalStore`，或 `noStore()`（?qa 不落盘）
 */
export class Save {
  constructor(store) {
    this.store = store;
    this.data = fresh();
    // 兼容两种落盘形态：整对象（现在的）和 JSON 字符串（老版本 / 手工塞进去的）
    const d = parse(store.get(CONFIG.saveKey));
    if (d && d.v === 1) this.data = { ...fresh(), ...d, sound: d.sound !== false, music: d.music !== false };
  }
  write() { this.store.set(CONFIG.saveKey, this.data); }
  // 「重置进度」不清掉**外观与偏好**：声音 / 语言 / 穿着的皮肤都保留。
  // ⚠️ 皮肤能不能穿是**按累计收入现算**的（`skinUnlocked`），所以重置之后
  //    身上这件还在、但换不下来 —— 这是刻意的：进度没了，打扮还留着。
  clear() {
    const d = this.data;
    this.data = { ...fresh(), sound: d.sound, music: d.music, lang: d.lang, haptics: d.haptics, skins: d.skins ?? {} };
    this.write();
  }
}

/** ?qa / 预览用：读得到空档，写进去就丢（不污染真实存档）。 */
export function noStore() {
  return { get: () => undefined, set: () => {}, remove: () => {}, flush: async () => {} };
}
