#!/usr/bin/env python
r"""
把 assets/ 下的 PNG 转成同尺寸 webp，并同步改写 `game.js` 里 IMG 表的后缀。

## 为什么是「换格式」而不是「缩尺寸」

这 39 张 PNG **不是图集**（没有 atlas json，每张单独加载），所以不存在
「改了尺寸 UV 窗口就对不上」的问题 —— 但也没有必要缩：它们在 420×800 的
设计坐标里按原尺寸画，缩了就是白白变糊。

真正占地方的是**格式**：卡通渐变 + 半透明边，PNG 的 deflate 对它几乎没辙。

## 为什么可以整表改后缀

`grep '\.png'` 在这份源码里**只命中 IMG 表**（39 个文件 ↔ 39 条），
`src/` 下一条都没有。所以改后缀是一处改动、全局生效，不存在漏改的引用。

⚠️ 判据不能只看「脚本说成功了」：
   · 每张算 **PSNR**（< 30 dB 直接判失败 —— 那是肉眼可见的糊）；
   · 转完重打 + 跑 `mount-test.mjs`，它断言整轮挂载 **0 个 404**，
     任何漏改的引用都会在那一步 404。

用法：python scripts/compress-assets.py [--dry-run] [--quality 90]
"""
import argparse
import io
import math
import os
import sys

from PIL import Image, ImageChops

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
GAME = os.path.join(ROOT, "game.js")


def flatten(im):
    """
    透明像素**先合成到中灰底再比**。

    ★ 不这么做会得到假的低 PSNR：RGBA 图里全透明区域的 RGB 是任意值，
      直接 `convert('RGB')` 会把它当颜色差算进去。实测 `char-blue.png`
      因此报 17.8 dB —— 看着像「压坏了」，其实是判据错了。

    ★ 底不能用**白色**：Kenney 那套图标是**白色字形 + 透明底**，
      合成到白底后整张图纯白 ⇒ PSNR 恒 99、文件 0 KB，判据完全失效。
      中灰能让「白字形」和「透明区」分开。
    """
    if im.mode in ("RGBA", "LA"):
        bg = Image.new("RGB", im.size, (128, 128, 128))
        bg.paste(im, mask=im.split()[-1])
        return bg
    return im.convert("RGB")


def _psnr_rgb(a, b):
    diff = ImageChops.difference(a, b)
    hist = diff.histogram()
    total = 0
    count = 0
    for ch in range(3):
        h = hist[ch * 256:(ch + 1) * 256]
        for v, n in enumerate(h):
            total += n * (v * v)
            count += n
    if count == 0:
        return 99.0
    mse = total / count
    return 99.0 if mse == 0 else 10 * math.log10((255.0 * 255.0) / mse)


def psnr(a, b):
    """
    取「合成后 RGB」和「alpha 通道」两者中**更差**的那个。

    ★ 只比 RGB 会漏掉 alpha 的劣化，而 alpha 恰恰是这类图标唯一的信息
      （白字形压在透明底上，颜色恒定，变的只有边缘的软硬）。
    """
    q = _psnr_rgb(flatten(a), flatten(b))
    if a.mode in ("RGBA", "LA") and b.mode in ("RGBA", "LA"):
        da = ImageChops.difference(a.split()[-1], b.split()[-1])
        hist = da.histogram()
        total = sum(n * (v * v) for v, n in enumerate(hist))
        count = sum(hist)
        if count:
            mse = total / count
            q = min(q, 99.0 if mse == 0 else 10 * math.log10((255.0 * 255.0) / mse))
    return q


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--quality", type=int, default=90)
    ap.add_argument("--min-psnr", type=float, default=30.0)
    args = ap.parse_args()

    pngs = []
    for dirpath, _dirnames, filenames in os.walk(ASSETS):
        for fn in sorted(filenames):
            if fn.lower().endswith(".png"):
                pngs.append(os.path.join(dirpath, fn))
    pngs.sort()

    if not pngs:
        print("assets/ 下没有 PNG，没什么可压的")
        return 0

    src_total = sum(os.path.getsize(p) for p in pngs)
    out_total = 0
    worst = (99.0, "")
    renamed = []

    for p in pngs:
        rel = os.path.relpath(p, ROOT).replace("\\", "/")
        out = os.path.splitext(p)[0] + ".webp"
        img = Image.open(p)
        img.load()
        has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
        im = img.convert("RGBA" if has_alpha else "RGB")

        buf = io.BytesIO()
        im.save(buf, "WEBP", quality=args.quality, method=6)
        buf.seek(0)
        back = Image.open(buf)
        back.load()
        q = psnr(im, back)
        size = buf.getbuffer().nbytes

        flag = ""
        if q < args.min_psnr:
            flag = "  ← PSNR 过低"
            worst = (q, rel)
        elif q < worst[0]:
            worst = (q, rel)

        print("  %-52s %6.1f KB → %6.1f KB  PSNR %.1f dB%s"
              % (rel, os.path.getsize(p) / 1024, size / 1024, q, flag))
        if q < args.min_psnr:
            print("FAIL: %s 的 PSNR %.1f < %.1f，改成更高质量或保留 PNG" % (rel, q, args.min_psnr))
            return 1

        out_total += size
        renamed.append((rel, rel[:-4] + ".webp"))

        if not args.dry_run:
            with open(out, "wb") as f:
                f.write(buf.getvalue())
            os.remove(p)

    print("\n合计 %.1f KB → %.1f KB（%.0f%%），最差 PSNR %.1f dB（%s）"
          % (src_total / 1024, out_total / 1024,
             100.0 * out_total / max(src_total, 1), worst[0], worst[1]))

    if args.dry_run:
        print("\n--dry-run：没写文件、没改源码")
        return 0

    # ---- 改写 IMG 表 ----
    with io.open(GAME, "r", encoding="utf-8", newline="") as f:
        src = f.read()
    before = src
    for old, new in renamed:
        src = src.replace("'" + old + "'", "'" + new + "'")
    if src == before:
        print("FAIL: game.js 一处都没改到 —— 引用格式变了？")
        return 1

    left = src.count(".png'")
    with io.open(GAME, "w", encoding="utf-8", newline="") as f:
        f.write(src)

    print("game.js: 改写 %d 条引用，剩余 .png' 引用 %d 条（应为 0）" % (len(renamed), left))
    if left:
        print("FAIL: 还有 .png 引用没改到")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
