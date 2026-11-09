// Texture manifest and loader.
import * as PIXI from "pixi.js";
import { TENANT_TYPES } from "./data.js";
import { assetUrl } from "../src/asset.js";

export const TENANT_TEX                         = Object.fromEntries(
  TENANT_TYPES.map((t) => [t.kind, `assets/tenant_${t.kind}.webp`]),
);

export const TEX_PATHS = [
  "assets/bg_city.webp", "assets/room_base.webp", "assets/room_base_dim.webp",
  "assets/lobby.webp", "assets/stair_core.webp", "assets/roof.webp", "assets/sky_lounge.webp",
  "assets/basement_parking.webp", "assets/basement_storage.webp", "assets/basement_gym.webp", "assets/basement_sento.webp", "assets/basement_shopping.webp",
  "assets/fx_aircon.webp", "assets/fx_bath.webp", "assets/fx_kitchen.webp", "assets/fx_dryer.webp",
  "assets/fx_tv.webp", "assets/fx_shelf.webp", "assets/fx_chandelier.webp", "assets/fx_rug.webp",
  "assets/room_lux.webp", "assets/room_lux_dim.webp",
  "assets/fx_breach.webp", "assets/fx_stain.webp", "assets/fx_board.webp", "assets/typhoon_cloud.webp", "assets/missile.webp", "assets/fx_scorch.webp",
  "assets/debris_plank.webp", "assets/debris_tile.webp", "assets/debris_leaf.webp",
  "assets/police_van.webp", "assets/konbini.webp",
  "assets/kb_shop_bg.webp", "assets/kb_counter.webp", ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `assets/kb_item_${i}.webp`),
  ...Object.values(TENANT_TEX),
];

/** Loads every texture, reporting real progress 0..1. */
export async function loadTextures(onProgress                     )                                        {
  const total = TEX_PATHS.length;
  let done = 0;
  onProgress(0);
  // ★ 键用 alias，**不能用源路径**：插件的 `src` 带了包根前缀
  //   （`/games/renttower/assets/x.webp`），而 `Assets.get("assets/x.webp")` 按 URL 查，
  //   查不到 ⇒ 整张纹理表全是 undefined。症状不是报错，是**画面一片空白**
  //   （`new PIXI.Sprite(undefined)` 会退回 Texture.WHITE），只有 `tex.width` 那种地方才炸。
  const aliasOf = (p        ) => p.split("/").pop() .replace(".webp", "");
  await PIXI.Assets.load(TEX_PATHS.map((p) => ({ src: assetUrl(p), alias: aliasOf(p) })), (p) => {
    done = Math.min(total, Math.round(p * total));
    onProgress(done / total);
  });
  const out                               = {};
  for (const p of TEX_PATHS) out[aliasOf(p)] = PIXI.Assets.get(aliasOf(p));
  return out;
}
