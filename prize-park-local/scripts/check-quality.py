#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""转换前的质量体检：对每张图算出 webp 与（缩放后的）原图的 PSNR / 最大误差。

只读，不改任何文件。PSNR < 32dB 的会标出来人工看。
"""
import io
import math
import os
import sys

from PIL import Image, ImageChops, ImageStat

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets")

UV_LOCKED = {
    "chute-art.png", "figure-box-sheet.png", "cake-plate-box-sheet.png",
    "cake-parfait-box-sheet.png", "noctis-box-sheet.png",
}
Q_LOCKED, Q_NORMAL, MAX_EDGE = 88, 82, 1024


def main():
    # 转换后 assets/ 里只剩 webp，原件在 _originals/assets-png/。
    # 体检以原件为准；没归档过就退回读 assets/*.png（首次转换前的场景）。
    srcdir = os.path.join(ROOT, "_originals", "assets-png")
    if not os.path.isdir(srcdir) or not [f for f in os.listdir(srcdir) if f.endswith(".png")]:
        srcdir = SRC

    worst = []
    for name in sorted(f for f in os.listdir(srcdir) if f.endswith(".png")):
        src = os.path.join(srcdir, name)
        im = Image.open(src)
        w0, h0 = im.size
        locked = name in UV_LOCKED
        if not locked:
            s = min(1.0, MAX_EDGE / float(max(w0, h0)))
            if s < 1.0:
                im = im.resize((max(1, round(w0 * s)), max(1, round(h0 * s))), Image.LANCZOS)
        # 与原图同尺寸比较。
        # ⚠️ 不能直接比 RGBA：alpha=0 的像素 RGB 是无意义值，PNG 里常是黑/白，
        #    webp 编码后会被改写 -> maxErr 恒 255、PSNR 掉到 16dB，看着像压坏了，其实完全不可见。
        #    正确做法：两边都合成到同一个背景色上再比（这才是肉眼看到的）。
        has_a = im.mode in ("RGBA", "LA") and im.getchannel("A").getextrema()[0] < 250
        ref = im.convert("RGBA" if has_a else "RGB")

        # 优先量磁盘上真实的 webp —— 那才是用户下载到的东西。
        # 早期版本这里是自己再编一遍，于是「转换脚本升了 q」而「体检仍按 q82 报」，
        # 两份数字对不上（pop-sweets 报 30.56，实际落盘是 34.21）。体检必须量产物。
        on_disk = os.path.join(SRC, os.path.splitext(name)[0] + ".webp")
        if os.path.exists(on_disk):
            with open(on_disk, "rb") as f:
                data = f.read()
            tag = "disk"
        else:
            buf = io.BytesIO()
            ref.save(buf, "WEBP", quality=(Q_LOCKED if locked else Q_NORMAL), method=6)
            data = buf.getvalue()
            tag = "sim"
        dec = Image.open(io.BytesIO(data)).convert(ref.mode)
        # 落盘文件可能为了守质量地板而保留原尺寸（如 pop-sweets 1672 而非 1024）。
        # 统一缩到「显示目标尺寸」再比 —— 那才是肉眼看到的。
        if dec.size != ref.size:
            dec = dec.resize(ref.size, Image.LANCZOS)

        if has_a:
            bg = Image.new("RGBA", ref.size, (255, 255, 255, 255))
            ref_c = Image.alpha_composite(bg, ref).convert("RGB")
            dec_c = Image.alpha_composite(bg, dec).convert("RGB")
            # alpha 通道单独看：真正的边缘毛刺在这里
            a_diff = ImageChops.difference(ref.getchannel("A"), dec.getchannel("A"))
            a_mse = ImageStat.Stat(a_diff).rms[0] ** 2
            a_psnr = 99.0 if a_mse <= 1e-9 else 10 * math.log10(255.0 * 255.0 / a_mse)
        else:
            ref_c, dec_c = ref, dec
            a_psnr = None

        diff = ImageChops.difference(ref_c, dec_c)
        st = ImageStat.Stat(diff)
        mse = sum(v * v for v in st.rms) / len(st.rms)   # rms 已是均方根
        psnr = 99.0 if mse <= 1e-9 else 10 * math.log10(255.0 * 255.0 / mse)
        mx = max(diff.getextrema(), key=lambda t: t[1])[1]
        worst.append((psnr, name, mx, ref.size, a_psnr))
        extra = "" if a_psnr is None else "  alphaPSNR %5.2f" % a_psnr
        print("%-34s %-12s %-4s PSNR %5.2f dB  maxErr %3d%s" % (name, "%dx%d" % ref.size, tag, psnr, mx, extra))

    worst.sort()
    print("\n--- 最差 6 张（按白底合成后 PSNR）---")
    for p, n, mx, sz, ap in worst[:6]:
        print("  %-34s %5.2f dB  maxErr %d%s" % (n, p, mx, "" if ap is None else "  alpha %5.2f" % ap))
    bad = [w for w in worst if w[0] < 32]
    print("\n低于 32dB 的：", len(bad))

    if "--verify" in sys.argv:
        return verify_sizes()
    return 0


def verify_sizes():
    """尺寸审计：直接读磁盘上的 webp 与 _originals 里的 png 比，不信任 manifest 自述。

    规则：
      uvLocked  -> 必须与原图**逐像素同尺寸**（game.js 用像素坐标算 UV，差一点就错位）
      其余      -> 宽高比误差 < 0.4%，且（长边 <= 1024 或 为了守质量地板而保留原尺寸）
    """
    import glob
    import json

    bak = os.path.join(ROOT, "_originals", "assets-png")
    man = json.load(open(os.path.join(SRC, "manifest.json"), encoding="utf-8"))
    locked = {a["file"] for a in man["assets"] if a["uvLocked"]}
    floor = {a["file"]: a["psnr"] for a in man["assets"]}

    bad = []
    for p in sorted(glob.glob(os.path.join(SRC, "*.webp"))):
        name = os.path.basename(p)
        src = os.path.join(bak, os.path.splitext(name)[0] + ".png")
        if not os.path.exists(src):
            bad.append((name, "原件不在 _originals/", ""))
            continue
        w0, h0 = Image.open(src).size
        w1, h1 = Image.open(p).size
        if name in locked:
            ok = (w0, h0) == (w1, h1)
            why = "uvLocked 必须同尺寸"
        else:
            same_aspect = abs(w1 / w0 - h1 / h0) < 0.004
            kept_full = (w1, h1) == (w0, h0) and floor.get(name, 0) >= 34.0
            ok = same_aspect and (max(w1, h1) <= MAX_EDGE or kept_full)
            why = "比例/长边"
        if not ok:
            bad.append((name, "%dx%d -> %dx%d" % (w0, h0, w1, h1), why))

    print("\n--- 尺寸审计 ---")
    print("检查 %d 张，不合格 %d 张" % (len(glob.glob(os.path.join(SRC, "*.webp"))), len(bad)))
    for b in bad:
        print("  ✗", b)
    return 0 if not bad else 1


if __name__ == "__main__":
    sys.exit(main())
