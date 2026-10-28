#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""把 assets/ 里的 webp 有损重编码一遍（**不改尺寸、不改文件名**）。

```bash
python scripts/compress-webp.py            # 真压
python scripts/compress-webp.py --dry-run  # 只算体积
python scripts/compress-webp.py -q 90      # 换质量
```

## 为什么不用 skill 里那支 compress-assets.py

那支只处理 **png/jpg → webp**。这一款扒下来**本来就是 webp**（站点直接发 webp），
它扫一遍会一个文件都不匹配，白跑。

## 三条硬规则

1. **尺寸一个像素都不许动**。帧图的裁切矩形写在各自的 `manifest.json`
   （`frame.w/h × cols/rows`）里，缩放图不缩放清单 = 裁到画外，
   **而且不报错**（只是走路的小人变成空白/两个人）。
   → 这里只换编码参数，`size` 前后断言相等。
2. **原子写**（`tmp` + `os.replace`）。中途被 SIGTERM 打断会留下 0 字节文件，
   而 webp 0 字节在页面上表现为「图不见了」，跟压缩脚本毫无关联的样子。
3. **只留真的变小了的**。小图（十几 KB）重编码有时反而变大，那种就保留原文件。

体积参考（renttower 实测）：239 张 12.28 MB → 7.08 MB（q85，57%）。
"""
import argparse
import io
import os
import sys

from PIL import Image

DEFAULT_Q = 85
# method 6 比 4 只小 1~2%，但慢 3 倍以上 —— 239 张会撞工具超时（被 SIGTERM，一行日志都没有）
DEFAULT_METHOD = 4
MIN_GAIN = 0.95  # 新文件不到原体积 95% 才替换


def human(n):
    return f"{n / 1048576:.2f} MB" if n >= 1048576 else f"{n / 1024:.0f} KB"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("project", nargs="?", default=".", help="工程目录（里面有 assets/）")
    ap.add_argument("-q", "--quality", type=int, default=DEFAULT_Q)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    root = os.path.join(os.path.abspath(args.project), "assets")
    if not os.path.isdir(root):
        print(f"没有 assets/ 目录：{root}")
        return 2

    files = []
    for dirpath, _dirs, names in os.walk(root):
        for fn in names:
            if fn.lower().endswith(".webp"):
                files.append(os.path.join(dirpath, fn))
    files.sort()

    before = sum(os.path.getsize(p) for p in files)
    after = 0
    kept = 0
    failed = []
    for p in files:
        size0 = os.path.getsize(p)
        try:
            im = Image.open(p)
            im.load()
            size = im.size
            mode = "RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB"
            im = im.convert(mode)
            buf = io.BytesIO()
            # alpha_quality 默认 100 = 透明通道无损，只压 RGB —— 描边不会糊
            im.save(buf, "WEBP", quality=args.quality, method=DEFAULT_METHOD)
            data = buf.getvalue()
        except Exception as e:  # noqa: BLE001
            failed.append((p, str(e)))
            after += size0
            continue

        if len(data) >= size0 * MIN_GAIN:
            kept += 1
            after += size0
            continue

        if not args.dry_run:
            tmp = p + ".tmp"
            with open(tmp, "wb") as f:
                f.write(data)
            os.replace(tmp, p)
            # 写完立刻回读：尺寸必须一模一样（规则 1 的判据）
            with Image.open(p) as chk:
                if chk.size != size:
                    print(f"  !! 尺寸变了 {p}: {size} -> {chk.size}")
                    return 3
        after += len(data)

    print(f"webp {len(files)} 张：{human(before)} → {human(after)}（{int(after * 100 / max(1, before))}%）")
    print(f"  跳过（压了不更小）{kept} 张" + ("  [dry-run 未写盘]" if args.dry_run else ""))
    if failed:
        print(f"  ! 打不开 {len(failed)} 张：")
        for p, e in failed[:5]:
            print(f"    {p}: {e}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
