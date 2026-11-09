#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
cloudfarm: assets/**/*.png|*.jpg  ->  assets/**/*.webp  +  assets/manifest.json

从 prize-park-local/scripts/convert-webp.py 移植。两处结构性差异：

1) 这里资源是**三层子目录**（assets/animals/、assets/crops/、assets/chicken-walk/…），
   不是平铺 —— 用 os.walk。
2) 源图混有 jpg（4 张背景）。jpg 一律 UV 锁定且只转码不缩放（见下）。

三条硬规则（来自 world.js / ui.js 的实现，改了就坏）：

1) UV 锁定的图**绝对不能缩放**。
   world.js:443-460 拿 1024 宽的源图开像素窗口：
     ranch frame (0,0,1024,960)   field frame (0,50,1024,915)
     river frame (0,0,1024,320)   pond  frame (0,30,1024,994)
   world.js:528 river 子窗口 (470,58,134,262) 给 bridge-deck 用
   缩放 = 窗口错位（背景拼接缝错开、桥面浮到水上），而且不会报错。

2) 其余图按长边 <= 1024 缩。⚠️ 实测这套资源**全部已 <= 1024**，所以这条恒等于空操作 ——
   留着的意义是：将来加了大图，脚本会自己兜住。体积收益全部来自「换格式 + 调 q」。

3) 输出一律 .webp。引用侧（ALL_TEXTURES / ui.js 的 ico/itemImg/cropImg/thumbs）
   已同步改成 .webp —— 两边必须一起改，见 docs/porting-notes.md。

用法：
  python scripts/convert-webp.py            # 真转
  python scripts/convert-webp.py --dry-run  # 只算体积，不写文件
"""
import hashlib
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets")

# 像素坐标锁定 -> 只转码不缩放。键是相对 assets/ 的 posix 路径。
UV_LOCKED = {
    "bg/ranch.jpg",
    "bg/field.jpg",
    "bg/river.jpg",
    "bg/pond.jpg",
    # ui.js:42 的 ico() 写死 width/height 属性，但那是显示尺寸不是 UV；
    # 真正锁的是下面这几张「被当成图集切片」的：
    "sprites/bridge-deck.png",   # world.js:528 从 river 取 (470,58,134,262)
}

Q_LOCKED = 88   # 图集/背景：细节多，给高一点
Q_NORMAL = 82   # 其余
MAX_EDGE = 1024

# 质量地板：编码后量 PSNR（白底合成后），低于这个值就升 q 重编。
# 为什么要自动而不是手调：加新图的人不会去跑体检脚本，地板必须内建。
PSNR_FLOOR = 34.0
Q_STEPS = [0, 6, 12]     # 依次尝试 q+0 / q+6 / q+12，封顶 95

SRC_EXT = (".png", ".jpg", ".jpeg")

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


def collect():
    """返回 [(rel_posix, abs_path)]，按路径排序保证可复现。"""
    out = []
    for dirpath, _dirnames, filenames in os.walk(SRC):
        for f in filenames:
            if not f.lower().endswith(SRC_EXT):
                continue
            if f == "manifest.json":
                continue
            abs_p = os.path.join(dirpath, f)
            rel = os.path.relpath(abs_p, SRC).replace(os.sep, "/")
            out.append((rel, abs_p))
    out.sort(key=lambda t: t[0])
    return out


def main():
    files = collect()
    if not files:
        print("assets/ 里没有 png/jpg")
        return 1

    rows = []
    tot_in = tot_out = 0
    scaled = []          # 真的被缩过的（本轮实测应为空）
    below_floor = []     # 升 q 也到不了地板的

    for rel, src in files:
        im = Image.open(src)
        in_bytes = os.path.getsize(src)
        w0, h0 = im.size

        locked = rel in UV_LOCKED or im.format == "JPEG"
        if locked:
            w1, h1 = w0, h0
        else:
            scale = min(1.0, MAX_EDGE / float(max(w0, h0)))
            w1, h1 = max(1, round(w0 * scale)), max(1, round(h0 * scale))
            if (w1, h1) != (w0, h0):
                im = im.resize((w1, h1), Image.LANCZOS)
                scaled.append((rel, (w0, h0), (w1, h1)))

        if has_real_alpha(im):
            im = im.convert("RGBA")
        else:
            im = im.convert("RGB")

        out_rel = os.path.splitext(rel)[0] + ".webp"
        out_path = os.path.join(SRC, out_rel)

        q0 = Q_LOCKED if locked else Q_NORMAL
        chosen_q, data, psnr = None, None, None
        for step in Q_STEPS:
            q = min(95, q0 + step)
            data = encode(im, q)
            psnr = psnr_on_white(im, data)
            chosen_q = q
            if psnr >= PSNR_FLOOR:
                break

        # 升 q 仍达不到地板：说明是「细节密度」而不是「压缩率」的问题。
        # 此时唯一有效的手段是**不缩**——多留像素、降 q。
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

        if not DRY:
            d = os.path.dirname(out_path)
            if d and not os.path.isdir(d):
                os.makedirs(d)
            with open(out_path, "wb") as f:
                f.write(data)
            # 只写不删。原图由调用方用 mv 归档。
            # 为什么不在脚本里 os.remove：本机 safe-delete 闸门会进子进程，
            # 同一轮累计删除数超过 50 就抛 SAFE_DELETE_BULK_CONFIRM_REQUIRED 并中断。
            # mv 是 rename，不触发闸门。

        tot_in += in_bytes
        tot_out += out_bytes
        rows.append({
            "file": out_rel,
            "w": w1, "h": h1,
            "bytes": out_bytes,
            "sha256": sha256(out_path) if not DRY else "",
            "src": {"file": rel, "w": w0, "h": h0, "bytes": in_bytes},
            "uvLocked": locked,
            "q": chosen_q,
            "psnr": round(psnr, 2),
        })
        flag = "" if psnr >= PSNR_FLOOR else "  <-- 未达地板"
        if psnr < PSNR_FLOOR:
            below_floor.append((rel, psnr))
        print("%-32s %4dx%-4d -> %4dx%-4d  %7.1fKB -> %6.1fKB  %5.1fx  q%-2d %5.2fdB%s" % (
            rel, w0, h0, w1, h1, in_bytes / 1024.0, out_bytes / 1024.0,
            in_bytes / max(1, out_bytes), chosen_q, psnr, flag))

    manifest = {
        "generated": "convert-webp.py",
        "note": "uvLocked=true 的图尺寸不可改：world.js 用像素坐标算 UV 窗口",
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
    print("被缩放的文件：%d 个%s" % (
        len(scaled), ("  " + str(scaled[:3])) if scaled else "（全部原本就 <= %dpx）" % MAX_EDGE))
    print("未达地板：%d 个%s" % (len(below_floor), ("  " + str(below_floor[:5])) if below_floor else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
