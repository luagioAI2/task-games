"""README 目录结构同步到经济改造之后。一次性脚本。"""
import io

P = 'README.md'
src = io.open(P, encoding='utf-8').read()
n0 = len(src)

def one(old, new):
    global src
    c = src.count(old)
    assert c == 1, 'ABORT: 锚点出现 %d 次: %r' % (c, old[:60])
    src = src.replace(old, new, 1)

one("""i18n.js               多语言文案
daily.js              每日签到 / 印章
market.js             跳蚤市场行情模拟
""",
    """i18n.js               多语言文案
wallet.js             钱包：币/积分的内存镜像 + 买币/付费/入账（全部走宿主 API）
recycle.js            回收价表（按稀有度 1 / 2 / 5，snackbox 单独 3）
""")

one("dist-plugin/          打包产物：prizepark.plugin.mjs（3.27 MB / gzip 1.09 MB）",
    "dist-plugin/          打包产物：prizepark.plugin.mjs（3.24 MB / gzip 1.08 MB）")

one("_originals/           原件归档：41 张 PNG（65 MB）+ 原 fx 库（3.2 MB），可删",
    "_originals/           原件归档：41 张 PNG（65 MB）+ 原 fx 库（3.2 MB）+ 改造前的\n"
    "                      daily.js / market.js / game.pre-economy.js.bak，确认不要后可整目录删")

io.open(P, 'w', encoding='utf-8', newline='\n').write(src)
print('OK %d -> %d bytes' % (n0, len(src)))
