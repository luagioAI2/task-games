#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
assets/*.png  ->  assets/*.webp  +  assets/manifest.json

两条硬规则（来自 game.js 的实现，改了就坏）：

1) UV 锁定的图**绝对不能缩放**。
   - chute-art.png        : chuteWin() 里写死 x/1672, y/941
   - figure-box-sheet.png : BOX_SHEETS.figure.W/H = 1536/1024，front/side/back 是像素窗口
   - cake-plate-box-sheet.png / cake-parfait-box-sheet.png : 同上
   - noctis-box-sheet.png : W/H = 1223/1286
   缩放这些图 = 贴图窗口错位（箱子印歪、出货口花纹错位），而且不会报错。

2) 其余图按长边 <= 1024 缩，保持宽高比。

用法：
  python scripts/convert-webp.py            # 真转
  python scripts/convert-webp.py --dry-run  # 只算体积，不写文件
"""
import hashlib
import json
import os
import shutil
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets")
BACKUP = os.path.join(ROOT, "_originals", "assets-png")

# 像素坐标锁定 -> 只转码不缩放
UV_LOCKED = {
    "chute-art.png",
    "figure-box-sheet.png",
    "cake-plate-box-sheet.png",
    "cake-parfait-box-sheet.png",
    "noctis-box-sheet.png",
}

Q_LOCKED = 88   # 贴图集/出货口图：细节多，给高一点
Q_NORMAL = 82   # 其余
MAX_EDGE = 1024

# 质量地板：编码后量 PSNR（白底合成后），低于这个值就升 q 重编。
# 为什么要自动而不是手调：加新图的人不会去跑体检脚本，地板必须内建。
PSNR_FLOOR = 34.0
Q_STEPS = [0, 6, 12]     # 依次尝试 q+0 / q+6 / q+12，封顶 95

DRY = "--dry-run" in sys.argv


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def has_real_alpha(im):
    if im.mode not in ("RGBA", "LA"):
        return False
    lo, hi = im.getchannel("A").getextrema()
    return lo < 250          # 全 255 或接近 -> 没有真实透明，转 RGB 省体积


def encode(im, q):
    import io
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=q, method=6)
    return buf.getvalue()


def psnr_on_white(ref, data):
    """把 webp 字节解码后与 ref 都合成到白底再比。

    ⚠️ 不能直接比 RGBA：alpha=0 处的 RGB 是无意义值，PNG 里常是黑/白，编码后会被改写，
       直接比会得到 maxErr=255 / PSNR≈16dB 的假阴性（看着像压坏了，肉眼完全不可见）。
    """
    import io
    import math
    from PIL import ImageChops, ImageStat
    dec = Image.open(io.BytesIO(data)).convert(ref.mode)
    if ref.mode == "RGBA":
        bg = Image.new("RGBA", ref.size, (255, 255, 255, 255))
        a = Image.alpha_composite(bg, ref).convert("RGB")
        b = Image.alpha_composite(bg, dec).convert("RGB")
    else:
        a, b = ref, dec
    st = ImageStat.Stat(ImageChops.difference(a, b))
    mse = sum(v * v for v in st.rms) / len(st.rms)
    return 99.0 if mse <= 1e-9 else 10 * math.log10(255.0 * 255.0 / mse)


def main():
    files = sorted(f for f in os.listdir(SRC) if f.lower().endswith(".png"))
    if not files:
        print("assets/ 里没有 png")
        return 1

    if not DRY:
        pass   # 原图归档由调用方 mv 完成，见上

    rows = []
    tot_in = tot_out = 0

    for name in files:
        src = os.path.join(SRC, name)
        im = Image.open(src)
        in_bytes = os.path.getsize(src)
        w0, h0 = im.size

        locked = name in UV_LOCKED
        if locked:
            w1, h1 = w0, h0
        else:
            scale = min(1.0, MAX_EDGE / float(max(w0, h0)))
            w1, h1 = max(1, round(w0 * scale)), max(1, round(h0 * scale))
            if (w1, h1) != (w0, h0):
                im = im.resize((w1, h1), Image.LANCZOS)

        if has_real_alpha(im):
            im = im.convert("RGBA")
        else:
            im = im.convert("RGB")

        out_name = os.path.splitext(name)[0] + ".webp"
        out_path = os.path.join(SRC, out_name)

        q0 = Q_LOCKED if locked else Q_NORMAL
        chosen_q, data, psnr = None, None, None
        for step in Q_STEPS:
            q = min(95, q0 + step)
            data = encode(im, q)
            psnr = psnr_on_white(im, data)
            chosen_q = q
            if psnr >= PSNR_FLOOR:
                break

        # 升 q 仍达不到地板：说明是「细节密度」而不是「压缩率」的问题（实测 pop-sweets.png
        # 缩到 1024 后 q100 也只有 32.5dB）。此时唯一有效的手段是**不缩**——多留像素、降 q。
        if psnr < PSNR_FLOOR and (w1, h1) != (w0, h0):
            im_full = Image.open(src)
            im_full = im_full.convert("RGBA") if has_real_alpha(im_full) else im_full.convert("RGB")
            for step in Q_STEPS:
                q = min(95, q0 + step)
                d2 = encode(im_full, q)
                p2 = psnr_on_white(im_full, d2)
                if p2 > psnr:
                    im, data, psnr, chosen_q = im_full, d2, p2, q
                    w1, h1 = w0, h0
                if psnr >= PSNR_FLOOR:
                    break

        out_bytes = len(data)

        if DRY:
            pass
        else:
            with open(out_path, "wb") as f:
                f.write(data)
            # 只写不删。原图由调用方用 mv 归档到 _originals/assets-png/。
            # 为什么不在脚本里 os.remove：本机 safe-delete 闸门会进子进程，
            # 同一轮累计删除数超过 50 就抛 SAFE_DELETE_BULK_CONFIRM_REQUIRED 并中断。
            # mv 是 rename，不触发闸门；而且「原图去哪了」这件事留在命令行里更清楚。

        tot_in += in_bytes
        tot_out += out_bytes
        rows.append({
            "file": out_name,
            "w": w1, "h": h1,
            "bytes": out_bytes,
            "sha256": sha256(out_path) if not DRY else "",
            "src": {"file": name, "w": w0, "h": h0, "bytes": in_bytes},
            "uvLocked": locked,
            "q": chosen_q,
            "psnr": round(psnr, 2),
        })
        flag = "" if psnr >= PSNR_FLOOR else "  <-- 未达地板"
        print("%-34s %4dx%-5d -> %4dx%-5d  %6.2fMB -> %5.2fMB  %5.1fx  q%-2d %5.2fdB%s" % (
            name, w0, h0, w1, h1, in_bytes / 1048576, out_bytes / 1048576,
            in_bytes / max(1, out_bytes), chosen_q, psnr, flag))

    manifest = {
        "generated": "convert-webp.py",
        "note": "uvLocked=true 的图尺寸不可改：game.js 用像素坐标算 UV 窗口",
        "total": {"srcBytes": tot_in, "webpBytes": tot_out,
                  "ratio": round(tot_in / max(1, tot_out), 2)},
        "assets": rows,
    }

    if not DRY:
        with open(os.path.join(SRC, "manifest.json"), "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=1)

    print("\n合计 %.2fMB -> %.2fMB  (%.1fx, 砍掉 %.0f%%)" % (
        tot_in / 1048576, tot_out / 1048576,
        tot_in / max(1, tot_out), 100 * (1 - tot_out / max(1, tot_in))))
    return 0


if __name__ == "__main__":
    sys.exit(main())
