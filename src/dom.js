// 界面结构：注入到**宿主给的根元素**里（插件）或 `document.body` 里的 `#mng-root`（独立网页）。
// 所有可见文字都经 i18n 的 t()；切换语言时 applyDomTexts() 重新填一遍。
//
// ⚠️ 这里**不许**再出现 `document.getElementById('app')` / `document.querySelector('.cash')`：
//    插件挂载时页面里还有宿主的几十个 `.card` / `.cash` 之类，按 document 查会拿到宿主的节点
//    （症状是「游戏 HUD 显示的是宿主的数字」或者「改了没反应」）。一律走 `q()` / `qa()`，
//    它们只在 `ROOT` 里找。
import { t } from '../i18n.js';
import { loadStyles } from './scoped-css.js';

/** 根选择器（CSS 作用域也用它）。 */
export const ROOT_SEL = '#mng-root';

let ROOT = null;
/** 根元素。没挂载时是 null。 */
export const rootEl = () => ROOT;
const q = (s) => (ROOT ? ROOT.querySelector(s) : null);
const qa = (s) => (ROOT ? ROOT.querySelectorAll(s) : []);

const ICON = {
  gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.6 4.9-.1-2.8 2-1.6-2-3.5-2.4.9-2.3-1.4L15.4 2h-4l-.4 2.5-2.3 1.4-2.4-.9-2 3.5 2 1.6-.1 2.8-2 1.6 2 3.5 2.4-.9 2.3 1.4.4 2.5h4l.4-2.5 2.3-1.4 2.4.9 2-3.5Z"/></svg>',
  // 商城：带条纹遮阳棚的小店铺
  inv: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3h16l2 6.2a3.2 3.2 0 0 1-5.2 2.4 3.3 3.3 0 0 1-4.8 0 3.3 3.3 0 0 1-4.8 0A3.2 3.2 0 0 1 2 9.2Zm3.1 1.8-1 4h2.6l.5-4Zm4.1 0-.3 4h2.2l-.3-4Zm4.6 0 .5 4h2.6l-1-4ZM4 13.6a5 5 0 0 0 1.8.3V19h5v-4.5h2.4V19h5v-5.1a5 5 0 0 0 1.8-.3V21H4Z"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5 4 14h5v5h6v-5h5Z"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19 20 10h-5V5H9v5H4Z"/></svg>',
};

// 底栏按钮：商城（投资人 / 皮肤）、设置。
// ⚠️ 原来还有第三个「排行」（全服排行榜 + 登录云同步），接进宿主时整块删掉了 ——
//    那要联网，插件里只会转圈。删的是**按钮**，不是把它藏起来：藏起来还会被
//    guide.js 的 `hud: 'rank'` 找到并高亮一个看不见的东西。
const markup = () => `
  <div id="stage"></div>
  <div id="hud">
    <div class="hud-top">
      <div class="hud-left">
        <div class="hud-cash"><i class="coin" aria-hidden="true"></i><div class="cash-txt"><b class="cash">0</b><small class="rate"></small></div></div>
        <div class="hud-depth"><i class="d-mark" aria-hidden="true"></i><b class="d-name"></b><small class="d-depth"></small></div>
      </div>
      <div class="hud-btns">
        <button class="ibtn" data-act="shop" data-aria="aria.investors" type="button">${ICON.inv}<span class="ib-l" data-t="dock.inv"></span><span class="badge" hidden>!</span></button>
        <button class="ibtn" data-act="settings" data-aria="aria.settings" type="button">${ICON.gear}<span class="ib-l" data-t="dock.set"></span></button>
      </div>
    </div>
    <div class="hud-dock" aria-hidden="true"></div>
    <div class="hud-cam">
      <button class="ibtn" data-act="camUp" data-aria="aria.camUp" type="button">${ICON.up}<span class="ib-l" data-t="dock.up"></span></button>
      <button class="ibtn" data-act="camDown" data-aria="aria.camDown" type="button">${ICON.down}<span class="ib-l" data-t="dock.down"></span></button>
    </div>
    <div class="hud-toast" hidden></div>
    <div class="guide" hidden><button class="g-facebtn" type="button" data-aria="aria.guide"><canvas class="g-face" width="192" height="192" aria-hidden="true"></canvas><i class="g-new" aria-hidden="true"></i></button><div class="g-bubble" role="button" tabindex="0" aria-live="polite"><b class="g-name"></b><span class="g-step"></span><p class="g-text"><span class="g-on"></span><span class="g-ghost" aria-hidden="true"></span></p></div></div>
  </div>
  <section id="panel" class="overlay" hidden role="dialog" aria-modal="true">
    <div class="card">
      <div class="c-band" aria-hidden="true"></div>
      <i class="c-grip" aria-hidden="true"></i>
      <button class="close" data-act="close" data-aria="aria.close" type="button">×</button>
      <div class="c-head"><canvas class="c-icon" width="192" height="192" aria-hidden="true"></canvas><div><h2 class="c-title"></h2><p class="c-sub"></p></div></div>
      <div class="c-body"></div>
      <div class="c-foot"></div>
    </div>
  </section>
  <!-- 加载画面：和纸底的标题卡 + 一整幅矿道剖面（2026-10-26 第三版）
       第一版是「整屏青海波 + 棕绿蓝三色渐变的方框 + 小吊篮 + 轨道矿车」：
       ① 波纹 40px 一格、白 alpha 太亮 ⇒ 像 2003 年的背景图；② 方框里的渐变
       什么都不是；③ 吊篮里那根「矿石」是条黄胶囊 ⇒ 像行李箱；④ 矿车跟竖井无关。
       第二版换成了剖面，但截图一看还是难看，三个具体原因：
       ① 岩体是「等高的横向色带 + 每条带顶上一条亮边」—— 那正是画木板的画法，
          整片岩壁读成瓦楞纸/木板墙；② 吊笼只有顶梁和底板、没有竖栏 ⇒ 读成一张
          长凳；③ 金粒是一堆浮在岩面上的菱形 ⇒ 像撒了把彩纸。
       第三版：岩体只靠「竖向渐变压暗 + 几块不规则大色斑 + 斜向节理」表现，
       横线和亮边一个不留；金粒一律嵌进深色裂缝里；吊笼补上四根竖栏和笼底矿石堆；
       天轮去掉（它本来就小得像个污点），改成绳子直接出画 + 顶部渐隐。
       颜色仍是游戏自己的和纸 + 藏青 + 金。 -->
  <div id="loading">
    <div class="ld-stage">
      <header class="ld-head">
        <h1 class="ld-title" data-t="boot.title"></h1>
        <div class="ld-rule" aria-hidden="true"><b></b></div>
      </header>
      <div class="ld-art" aria-hidden="true">
        <svg class="ld-svg" viewBox="0 0 320 460" preserveAspectRatio="xMidYMid slice" focusable="false">
          <defs>
            <!-- 井筒：从上往下是「天光 → 暖黄」，**不做暗部**。
                 上一版是藏青→近黑，用户反馈「太阴暗了」——矿井题材容易顺手画成夜景，
                 但这是一款给小孩玩的经营游戏，画面要和游戏里那套亮和纸一致。 -->
            <linearGradient id="ldVoid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#FFFDF7" /><stop offset=".26" stop-color="#FFF6E2" />
              <stop offset=".6" stop-color="#FFEAC6" /><stop offset=".86" stop-color="#FBD79E" />
              <stop offset="1" stop-color="#F3C589" />
            </linearGradient>
            <!-- 井壁两侧的暖影：靠壁那侧压一点，井筒才有圆筒感。用暖棕不用黑，
                 一用黑整幅就又暗回去了。 -->
            <linearGradient id="ldWallL" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stop-color="#B87C42" stop-opacity=".4" /><stop offset="1" stop-color="#B87C42" stop-opacity="0" />
            </linearGradient>
            <linearGradient id="ldWallR" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0" stop-color="#B87C42" stop-opacity=".4" /><stop offset="1" stop-color="#B87C42" stop-opacity="0" />
            </linearGradient>
            <!-- 岩体：暖陶土色。体积靠渐变 + 低 alpha 色斑，不画节理线（细线会读成铅笔划痕）。 -->
            <linearGradient id="ldRockG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#D6A06A" /><stop offset=".32" stop-color="#C38D58" />
              <stop offset=".7" stop-color="#AE7A49" /><stop offset="1" stop-color="#96663C" />
            </linearGradient>
            <!-- 岩壁靠井筒那条边：**这一版要用深边**。井筒是亮的，再用亮边就糊在一起了
                 （上一版井筒是暗的，所以那边用的是暖光边）。 -->
            <linearGradient id="ldEdge" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#A87238" stop-opacity=".5" /><stop offset=".5" stop-color="#8A5A2E" stop-opacity=".4" />
              <stop offset="1" stop-color="#7A4E28" stop-opacity=".5" />
            </linearGradient>
            <radialGradient id="ldLamp">
              <stop offset="0" stop-color="#FFF3CE" stop-opacity=".95" /><stop offset=".45" stop-color="#FFC857" stop-opacity=".22" /><stop offset="1" stop-color="#FFC857" stop-opacity="0" />
            </radialGradient>
            <!-- 井底：一团暖光雾，不是黑洞。吊笼 100% 时落进去。 -->
            <radialGradient id="ldHaze">
              <stop offset="0" stop-color="#FFF0C8" stop-opacity=".8" /><stop offset=".55" stop-color="#FFD98F" stop-opacity=".34" /><stop offset="1" stop-color="#FFD98F" stop-opacity="0" />
            </radialGradient>
            <radialGradient id="ldNug">
              <stop offset="0" stop-color="#FFE9A8" stop-opacity=".55" /><stop offset="1" stop-color="#FFE9A8" stop-opacity="0" />
            </radialGradient>
            <!-- 岩体轮廓：爆破后的锯齿边（直上直下会像个塑料槽），左右齿距故意不同 -->
            <clipPath id="ldRockL"><path d="M0 0H92L83 50 92 96 79 150 90 208 77 264 88 322 76 378 87 428 79 460H0Z" /></clipPath>
            <clipPath id="ldRockR"><path d="M320 0H228L237 50 228 96 241 150 230 208 243 264 232 322 244 378 233 428 241 460H320Z" /></clipPath>
          </defs>

          <!-- 井筒：比井口宽，岩体锯齿边压上来时不会露底 -->
          <rect x="74" y="0" width="172" height="460" fill="url(#ldVoid)" />

          <!-- ── 左岩体 ── -->
          <g clip-path="url(#ldRockL)">
            <rect x="0" y="0" width="100" height="460" fill="url(#ldRockG)" />
            <!-- 色斑只给体积：边界错开、互相不平行，alpha 压低到「看得出深浅、说不出形状」 -->
            <path d="M0 0h40l8 30-26 20-22-8Z" fill="#EBC898" opacity=".42" />
            <path d="M0 96h34l6 30-20 18-20-8Z" fill="#94663A" opacity=".32" />
            <path d="M6 196h36l4 32-22 16-24-10Z" fill="#EBC898" opacity=".3" />
            <path d="M0 288h30l8 34-20 16-18-8Z" fill="#94663A" opacity=".34" />
            <path d="M8 388h34l4 30-20 14-22-8Z" fill="#7E5630" opacity=".34" />
            <path d="M0 320h22l10 34-18 16-14-6Z" fill="#EBC898" opacity=".2" />
            <!-- 靠井筒那条边上的深边 -->
            <path d="M92 0 83 50 92 96 79 150 90 208 77 264 88 322 76 378 87 428 79 460"
              fill="none" stroke="url(#ldEdge)" stroke-width="3" />
          </g>

          <!-- ── 右岩体：色斑高度全部错开，不做成左右对称 ── -->
          <g clip-path="url(#ldRockR)">
            <rect x="220" y="0" width="100" height="460" fill="url(#ldRockG)" />
            <path d="M320 44h-38l-8 30 26 20 20-8Z" fill="#EBC898" opacity=".38" />
            <path d="M320 148h-30l-6 32 20 16 16-6Z" fill="#94663A" opacity=".34" />
            <path d="M314 244h-34l-4 32 22 16 22-10Z" fill="#B07F4C" opacity=".26" />
            <path d="M320 340h-30l-8 34 20 16 18-8Z" fill="#EBC898" opacity=".26" />
            <path d="M320 396h-26l-6 30 18 14 14-6Z" fill="#7E5630" opacity=".3" />
            <path d="M228 0 237 50 228 96 241 150 230 208 243 264 232 322 244 378 233 428 241 460"
              fill="none" stroke="url(#ldEdge)" stroke-width="3" />
          </g>

          <!-- 井底暖光雾 -->
          <ellipse class="ld-haze" cx="160" cy="418" rx="92" ry="54" fill="url(#ldHaze)" />
          <rect x="74" y="0" width="46" height="460" fill="url(#ldWallL)" />
          <rect x="200" y="0" width="46" height="460" fill="url(#ldWallR)" />

          <!-- 青苔：游戏本体的岩壁上全是这种绿色藤草。加上它，整幅立刻从「废矿」变成「有生气」，
               也是唯一能压住暖棕大面积发闷的颜色。位置都躲开木撑。 -->
          <g class="ld-moss">
            <g transform="translate(66,182)"><path d="M0 0c-3-6-3-13 0-17 2 5 2 12 0 17Z" fill="#7FB069" /><path d="M0 0c-7-4-9-11-7-15 4 4 6 10 7 15Z" fill="#9CCB86" /><path d="M0 0c7-4 9-11 7-15-4 4-6 10-7 15Z" fill="#6B9B4F" /></g>
            <g transform="translate(56,300)"><path d="M0 0c-3-6-3-12 0-16 2 5 2 11 0 16Z" fill="#9CCB86" /><path d="M0 0c-6-4-8-10-6-14 4 4 5 9 6 14Z" fill="#7FB069" /><path d="M0 0c6-4 8-10 6-14-4 4-5 9-6 14Z" fill="#8CBF68" /></g>
            <g transform="translate(64,412)"><path d="M0 0c-3-5-3-11 0-15 2 5 2 10 0 15Z" fill="#6B9B4F" /><path d="M0 0c-6-4-8-9-6-13 4 4 5 8 6 13Z" fill="#8CBF68" /><path d="M0 0c6-4 8-9 6-13-4 4-5 8-6 13Z" fill="#7FB069" /></g>
            <g transform="translate(256,150)"><path d="M0 0c-3-6-3-12 0-16 2 5 2 11 0 16Z" fill="#7FB069" /><path d="M0 0c-6-4-8-10-6-14 4 4 5 9 6 14Z" fill="#9CCB86" /><path d="M0 0c6-4 8-10 6-14-4 4-5 9-6 14Z" fill="#6B9B4F" /></g>
            <g transform="translate(250,268)"><path d="M0 0c-3-6-3-13 0-17 2 5 2 12 0 17Z" fill="#9CCB86" /><path d="M0 0c-7-4-9-11-7-15 4 4 6 10 7 15Z" fill="#7FB069" /><path d="M0 0c7-4 9-11 7-15-4 4-6 10-7 15Z" fill="#8CBF68" /></g>
            <g transform="translate(258,404)"><path d="M0 0c-3-5-3-11 0-15 2 5 2 10 0 15Z" fill="#7FB069" /><path d="M0 0c-6-4-8-9-6-13 4 4 5 8 6 13Z" fill="#8CBF68" /><path d="M0 0c6-4 8-9 6-13-4 4-5 8-6 13Z" fill="#6B9B4F" /></g>
          </g>

          <!-- 矿脉：嵌在岩面上的金块。
               三个反复踩到的坑：① 一道金色折线收不住尾 ⇒ 看着像一支黄箭头（v4）；
               ② 孤立的小菱形 ⇒ 像撒了把彩纸（v2）；③ 只画金块不画窝 ⇒ 像贴纸。
               所以每块金都先垫一个稍大的暗色「窝」，金块坐在窝里。
               横向位置卡在 38~278：① 避开木撑（x 80~104 / 216~240），柱子不会压住金块；
               ② 平板 834 宽时 preserveAspectRatio 的 slice 左右各裁掉约 37 个 viewBox 单位
                  （见 styles.css 里 .ld-art 的注释），超出这个区间的金块会被裁掉半个。 -->
          <g class="ld-nugget">
            <path d="M40 119l22 3 10 15-15 13-20-10Z" fill="#7A4E28" opacity=".38" />
            <circle cx="57" cy="132" r="9" fill="url(#ldNug)" />
            <path d="M45 124l16 2 7 11-11 9-14-7Z" fill="#F0B429" />
            <path d="M50 126l10 1 5 8-7 5Z" fill="#FFD75E" />
            <path d="M55 127l5 1 2 4-3 2Z" fill="#FFF3CE" opacity=".9" />
            <path d="M38 292l18 3 6 12-12 10-13-7Z" fill="#7A4E28" opacity=".34" />
            <path d="M42 296l14 3 4 10-10 8-10-6Z" fill="#D9A02A" />
            <path d="M47 298l8 2 3 6-5 4Z" fill="#FFD75E" />
            <path d="M278 176l-22 3-10 15 15 13 20-10Z" fill="#7A4E28" opacity=".38" />
            <circle cx="264" cy="188" r="9" fill="url(#ldNug)" />
            <path d="M276 180l-16 2-7 11 11 9 14-7Z" fill="#F0B429" />
            <path d="M271 182l-10 1-5 8 7 5Z" fill="#FFD75E" />
            <path d="M266 183l-5 1-2 4 3 2Z" fill="#FFF3CE" opacity=".9" />
            <path d="M276 346l-18 3-6 12 12 10 13-7Z" fill="#7A4E28" opacity=".34" />
            <path d="M272 352l-14 3-4 10 10 8 10-6Z" fill="#D9A02A" />
            <path d="M267 354l-8 2-3 6 5 4Z" fill="#FFD75E" />
          </g>

          <!-- 木撑：墙上竖柱 + 探进井筒的横托。横托只到 x=104，吊笼走 112，留 8 的间隙
               （横托要是一路横过井筒，吊笼就得从它「穿过去」）。 -->
          <g class="ld-timber">
            <g>
              <rect x="80" y="104" width="16" height="92" rx="1.5" fill="#8A5A2E" /><rect x="91" y="104" width="5" height="92" fill="#A97440" />
              <rect x="224" y="104" width="16" height="92" rx="1.5" fill="#8A5A2E" /><rect x="224" y="104" width="5" height="92" fill="#A97440" />
              <rect x="80" y="104" width="24" height="13" rx="1.5" fill="#96622F" /><rect x="80" y="104" width="24" height="3" rx="1.5" fill="#B07B42" />
              <rect x="216" y="104" width="24" height="13" rx="1.5" fill="#96622F" /><rect x="216" y="104" width="24" height="3" rx="1.5" fill="#B07B42" />
              <rect x="80" y="117" width="24" height="3.5" fill="#7A4E28" opacity=".28" /><rect x="216" y="117" width="24" height="3.5" fill="#7A4E28" opacity=".28" />
            </g>
            <g>
              <rect x="80" y="232" width="16" height="92" rx="1.5" fill="#8A5A2E" /><rect x="91" y="232" width="5" height="92" fill="#A97440" />
              <rect x="224" y="232" width="16" height="92" rx="1.5" fill="#8A5A2E" /><rect x="224" y="232" width="5" height="92" fill="#A97440" />
              <rect x="80" y="232" width="24" height="13" rx="1.5" fill="#96622F" /><rect x="80" y="232" width="24" height="3" rx="1.5" fill="#B07B42" />
              <rect x="216" y="232" width="24" height="13" rx="1.5" fill="#96622F" /><rect x="216" y="232" width="24" height="3" rx="1.5" fill="#B07B42" />
              <rect x="80" y="245" width="24" height="3.5" fill="#7A4E28" opacity=".28" /><rect x="216" y="245" width="24" height="3.5" fill="#7A4E28" opacity=".28" />
            </g>
            <g>
              <rect x="80" y="358" width="16" height="92" rx="1.5" fill="#8A5A2E" /><rect x="91" y="358" width="5" height="92" fill="#A97440" />
              <rect x="224" y="358" width="16" height="92" rx="1.5" fill="#8A5A2E" /><rect x="224" y="358" width="5" height="92" fill="#A97440" />
              <rect x="80" y="358" width="24" height="13" rx="1.5" fill="#96622F" /><rect x="80" y="358" width="24" height="3" rx="1.5" fill="#B07B42" />
              <rect x="216" y="358" width="24" height="13" rx="1.5" fill="#96622F" /><rect x="216" y="358" width="24" height="3" rx="1.5" fill="#B07B42" />
              <rect x="80" y="371" width="24" height="3.5" fill="#7A4E28" opacity=".28" /><rect x="216" y="371" width="24" height="3.5" fill="#7A4E28" opacity=".28" />
            </g>
          </g>

          <!-- 吊笼：随 --p 下降（CSS 里 translateY(56px + --p * 284px)）。
               井筒是亮的 ⇒ 笼子必须是整幅最深的暖棕，否则会糊进背景。 -->
          <g class="ld-cage">
            <rect x="158.7" y="-700" width="2.6" height="700" fill="#C9A96A" />
            <rect x="159.5" y="-700" width="1" height="700" fill="#EBD9AE" opacity=".8" />
            <path d="M160 0v5" stroke="#96622F" stroke-width="4.5" stroke-linecap="round" />
            <rect x="110" y="4" width="100" height="7" rx="2" fill="#96622F" />
            <rect x="110" y="4" width="100" height="2.6" rx="1.3" fill="#B07B42" />
            <!-- 四角立柱 + 竖栏：少了竖栏它就是个长凳（v2 的错） -->
            <rect x="112" y="11" width="5" height="35" fill="#7A4E28" /><rect x="203" y="11" width="5" height="35" fill="#7A4E28" />
            <rect x="128" y="11" width="2.6" height="35" fill="#7A4E28" opacity=".92" /><rect x="145" y="11" width="2.6" height="35" fill="#7A4E28" opacity=".92" />
            <rect x="177" y="11" width="2.6" height="35" fill="#7A4E28" opacity=".92" /><rect x="194" y="11" width="2.6" height="35" fill="#7A4E28" opacity=".92" />
            <rect x="112" y="28" width="96" height="2.4" fill="#7A4E28" opacity=".9" />
            <rect x="108" y="46" width="104" height="8" rx="2" fill="#96622F" />
            <rect x="108" y="46" width="104" height="2.6" rx="1.3" fill="#B07B42" />
            <rect x="108" y="54" width="104" height="3.2" fill="#5C3A1E" opacity=".4" />
            <!-- 灯：光晕罩住笼子和矿石，是整幅唯一的光源 -->
            <circle class="ld-lamp" cx="160" cy="26" r="30" fill="url(#ldLamp)" />
            <rect x="159" y="11" width="2" height="6" fill="#96622F" />
            <rect x="151" y="14.5" width="18" height="4" rx="2" fill="#7A4E28" />
            <rect x="154" y="18" width="12" height="12" rx="2.5" fill="#FFE9B8" />
            <rect x="157" y="21" width="6" height="7" rx="1.5" fill="#FFFDF2" />
            <!-- 笼底的矿石堆：一块块带棱的，不是一排黄胶囊 -->
            <path d="M118 46l4-8 8-2 6 5-2 5Z" fill="#FFD75E" /><path d="M124 40l6-4 6 5-4 5Z" fill="#FFF3CE" opacity=".8" />
            <path d="M136 46l5-9 9-1 5 5-3 5Z" fill="#E0A32B" /><path d="M145 39l5-3 5 4-4 4Z" fill="#F5C443" opacity=".85" />
            <path d="M158 46l6-11 10 2 4 5-3 4Z" fill="#FFD75E" /><path d="M168 37l6-2 4 4-5 3Z" fill="#FFF3CE" opacity=".75" />
            <path d="M176 46l4-7 8-1 5 4-2 4Z" fill="#E0A32B" /><path d="M188 46l5-8 8 2 3 4-2 2Z" fill="#F5C443" />
          </g>

          <!-- 落石粉尘 -->
          <g class="ld-dust" fill="#FFFDF2">
            <circle cx="126" cy="120" r="2" /><circle cx="196" cy="180" r="1.6" /><circle cx="138" cy="240" r="2.2" />
            <circle cx="186" cy="300" r="1.8" /><circle cx="148" cy="360" r="2" /><circle cx="204" cy="410" r="1.6" />
          </g>
        </svg>
      </div>
      <footer class="ld-foot">
        <div class="ld-row"><span class="ld-msg" data-t="boot.loading"></span><b class="ld-pct">0%</b></div>
        <div class="ld-bar" aria-hidden="true"><i></i></div>
        <p class="ld-tip" data-t="boot.tip0"></p>
      </footer>
    </div>
  </div>
  <div id="boot-error" hidden></div>`;

export function applyDomTexts() {
  for (const el of qa('[data-aria]')) el.setAttribute('aria-label', t(el.dataset.aria));
  for (const el of qa('[data-t]')) el.textContent = t(el.dataset.t);
  const gn = q('.g-name'); if (gn) gn.textContent = t('guide.name');
}
// 加载进度：升降篮沿绳下降、矿车沿轨道前进、底部显示百分比（画法在 styles.css 的 .ld-shaft 里）
export function setLoading(p) {
  const v = Math.max(0, Math.min(1, p)), pct = Math.round(v * 100);
  const root = q('#loading');
  if (root) root.style.setProperty('--p', String(v));
  const n = q('.ld-pct'); if (n) n.textContent = pct + '%';
}

/**
 * 建界面 + 装样式。
 *
 * @param {HTMLElement} root  宿主容器里的那块（插件）或 `document.body` 里的 `#mng-root`
 * @param {{ cssUrl: string, cssText?: string, assetUrl?: (rel: string) => string, safeArea?: boolean }} opts
 */
export async function mountDom(root, opts) {
  ROOT = root;
  root.textContent = '';
  const app = document.createElement('div');
  app.id = 'app';
  app.tabIndex = 0;          // 键盘（方向键 / Esc）要在它上面才收得到
  app.insertAdjacentHTML('beforeend', markup());
  root.appendChild(app);
  applyDomTexts();
  await loadStyles(opts.cssUrl, { root: ROOT_SEL, assetUrl: opts.assetUrl, safeArea: opts.safeArea, cssText: opts.cssText });
}

/** 卸载：把根清空 + 让模块变量回到「没挂载」。 */
export function unmountDom() {
  if (ROOT) ROOT.textContent = '';
  ROOT = null;
}
