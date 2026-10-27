// Walk-cycle packs. Every tenant kind gets its own pack named walk-<kind>; couples and
// families add a partner pack that walks beside them. A missing pack only means that tenant never goes out.
import * as PIXI from "pixi.js";
import { TENANT_TYPES } from "./data.js";
import { assetUrl } from "../src/asset.js";

                           
                         
                
              
                  
                                                                          
                  
 

/** Historical names that predate the walk-<kind> convention. */
const EXTRA = ["walk-student", "walk-office", "walk-doctor", "walk-celebrity", "walk-swat", "walk-couple-a", "walk-couple-b", "walk-family-a", "walk-family-b"];
const PACKS = EXTRA.concat(TENANT_TYPES.filter((t) => t.kind !== "couple" && t.kind !== "family").map((t) => "walk-" + t.kind));

const HEIGHT_K                         = { "walk-family-b": 0.68 };

/** Loads every pack; a single broken pack is skipped instead of failing the whole set. */
export async function loadWalks()                                    {
  const out                           = {};
  await Promise.all(PACKS.map(async (d) => {
    try {
      const base = assetUrl(`assets/${d}`);
      const m = await (await fetch(`${base}/manifest.json`)).json();
      const pages                 = await Promise.all(m.pages.map((p        ) => PIXI.Assets.load(`${base}/${p}`)));
      const per = m.frame.cols * m.frame.rows;
      const frames                 = [];
      for (let i = 0; i < m.frame.count; i++) {
        const j = i % per;
        frames.push(new PIXI.Texture({
          source: pages[Math.floor(i / per)].source,
          frame: new PIXI.Rectangle((j % m.frame.cols) * m.frame.w, Math.floor(j / m.frame.cols) * m.frame.h, m.frame.w, m.frame.h),
        }));
      }
      out[d] = { frames, count: frames.length, fps: m.fps, anchorY: m.anchor?.y ?? 1, heightK: HEIGHT_K[d] ?? 1 };
    } catch {
      // that tenant simply never goes outside
    }
  }));
  return out;
}
