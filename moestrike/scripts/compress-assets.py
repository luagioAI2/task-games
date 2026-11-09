#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""把 `assets/` 里**已经过采样**的 webp 重编码到「实际显示尺寸 + 一点余量」。

```bash
python scripts/compress-assets.py --dry-run    # 只报体积
python scripts/compress-assets.py              # 真写
```

## 为什么不能套 `scrape-game-into-farm/scripts/compress-assets.py`

那个脚本是 **png/jpg → webp**；这一款扒下来**本来就是 webp**，
所以要做的是「**重新编码 + 降分辨率**」，判据完全不同。

## 三档怎么定的（都是量出来的，不是拍的）

| 目录 | 游戏里的显示尺寸（逻辑 px，W=540） | 3× 手机上实际要的像素 | 目标 |
| --- | --- | --- | --- |
| `chara/` | 首页主视觉 ≈ 292 宽；详情面板 ≈ 340 宽 | ≈ 735 | **768** |
| `boss/` | 敌人半径 `r=92` ⇒ 直径 184 | ≈ 400 | **512** |
| `mon/` | 敌人半径 `r=42~46` ⇒ 直径 ≈ 92 | ≈ 200 | **320** |
| `bg/` | **整屏铺满**（`Math.max(w/tx.w, h/tx.h)`） | ≈ 1170 | **保持 1024** |

★ `bg/` 绝对不能缩：它本来就只有 1024，铺到 390×844@3× 已经是**放大**使用，
  再缩就是肉眼可见的糊。同理 `ui-gem/` 是 204² 的小图标，留着。

★ 原图在 `_originals/` 里有备份（扒站产物），需要回滚就 `git checkout -- assets`。

★★ **必须原子写**（`tmp` + `os.replace`）。2026-10-26 实测：前台跑被 SIGTERM 掐掉时，
   正好在 `im.save(p)` 里 ⇒ **文件被截成 0 字节**，而下一个进程打开它就
   `UnidentifiedImageError` —— 报错指向的文件看着完全正常（名字对、路径对），
   真正的原因在上一次被杀掉的运行里。写临时文件再 replace，掐在哪一刀都不会毁原图。

★★ 顺带：**开始前先扫一遍 0 字节 / 打不开的文件并直接退出**。
   0 字节的图在游戏里是「一块空白」而不是报错，很容易被当成「设计就是这样」。
"""
import argparse
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 目录 → (长边目标, 质量)。不在表里的目录一律跳过（见文件头说明）。
PLAN = {
    "chara": (768, 86),
    "boss": (512, 88),
    "mon": (320, 88),
}


def human(n):
    return f"{n / 1048576:.2f} MB" if n >= 1048576 else f"{n / 1024:.0f} KB"


def scan_broken():
    """开跑前的体检：0 字节 / PIL 打不开的都列出来。有就直接退出，别在坏图上继续压。"""
    bad = []
    for dp, _dn, fns in os.walk(os.path.join(ROOT, "assets")):
        for fn in fns:
            if not fn.lower().endswith((".webp", ".png", ".jpg", ".jpeg")):
                continue
            p = os.path.join(dp, fn)
            if os.path.getsize(p) == 0:
                bad.append((os.path.relpath(p, ROOT), "0 字节"))
                continue
            try:
                Image.open(p).load()
            except Exception as e:  # noqa: BLE001
                bad.append((os.path.relpath(p, ROOT), type(e).__name__))
    return bad


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    broken = scan_broken()
    if broken:
        print("✗ assets/ 里有坏图，先修好再压（否则压出来的还是坏的）：")
        for rel, why in broken:
            print(f"   {rel}  —— {why}")
        print("\n  修法：`git checkout -- assets/<路径>`，或从 _originals/ 重新拷。")
        return 2

    rows = []
    for sub, (target, q) in PLAN.items():
        d = os.path.join(ROOT, "assets", sub)
        if not os.path.isdir(d):
            print(f"  ! 没有 {sub}/，跳过")
            continue
        for fn in sorted(os.listdir(d)):
            if not fn.lower().endswith(".webp"):
                continue
            p = os.path.join(d, fn)
            before = os.path.getsize(p)
            im = Image.open(p)
            w, h = im.size
            if max(w, h) <= target:
                rows.append((os.path.relpath(p, ROOT), (w, h), (w, h), before, before, True))
                continue
            k = target / max(w, h)
            out = (max(1, round(w * k)), max(1, round(h * k)))
            if args.dry_run:
                # 经验值：像素数按面积缩、再算 webp 的线性关系，粗估就够排序用
                after = int(before * (out[0] * out[1]) / (w * h) * 0.95)
            else:
                r = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB")
                r = r.resize(out, Image.LANCZOS)
                tmp = p + ".tmp"
                r.save(tmp, "WEBP", quality=q, method=6)
                os.replace(tmp, p)   # 原子替换：掐在上一行也只是留个 .tmp，原图还在
                after = os.path.getsize(p)
            rows.append((os.path.relpath(p, ROOT), (w, h), out, before, after, False))

    if not rows:
        print("没有可压的图。")
        return 0

    changed = [r for r in rows if not r[5]]
    rows.sort(key=lambda r: r[3] - r[4], reverse=True)
    for rel, was, now, b, a, skipped in rows[:14]:
        note = "（已达标，跳过）" if skipped else ""
        size = "" if was == now else f" → {now[0]}×{now[1]}"
        print(f"  {rel:<34} {was[0]}×{was[1]}{size:<14} {human(b):>8} → {human(a):>8} {note}")
    if len(rows) > 14:
        print(f"  … 另有 {len(rows) - 14} 张")

    tb = sum(r[3] for r in changed)
    ta = sum(r[4] for r in changed)
    print(f"\n重编码 {len(changed)} 张：{human(tb)} → {human(ta)}（−{100 * (1 - ta / tb):.0f}%）")
    print(f"assets/ 合计 {human(sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(os.path.join(ROOT, 'assets')) for f in fs))}")
    if args.dry_run:
        print("\n（--dry-run，没有写文件）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
