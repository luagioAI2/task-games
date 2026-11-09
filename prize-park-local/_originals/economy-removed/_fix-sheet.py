"""回收面板「合计」行去重：原来那行写的是「全部卖掉 ×N」，和下面的大按钮一模一样。"""
import io

def sub(P, old, new, cnt=1):
    s = io.open(P, encoding='utf-8').read()
    c = s.count(old)
    assert c == cnt, 'ABORT %s: 锚点 %d 次 (期望 %d): %r' % (P, c, cnt, old[:50])
    io.open(P, 'w', encoding='utf-8', newline='\n').write(s.replace(old, new, cnt))
    print('ok', P)

# 1) 三个语言各补一个 sellTotal
sub('i18n.js', 'recycleEach: "1個あたり", sellOne: "1個売る", sellAll: "まとめて売る",',
    'recycleEach: "1個あたり", sellOne: "1個売る", sellAll: "まとめて売る", sellTotal: "合計",')
sub('i18n.js', 'recycleEach: "each", sellOne: "Sell 1", sellAll: "Sell all",',
    'recycleEach: "each", sellOne: "Sell 1", sellAll: "Sell all", sellTotal: "Total",')
sub('i18n.js', 'recycleEach: "每个回收", sellOne: "卖 1 个", sellAll: "全部卖掉",',
    'recycleEach: "每个回收", sellOne: "卖 1 个", sellAll: "全部卖掉", sellTotal: "合计",')

# 2) 汇总行改成「合计」
sub('game.js',
    '<div class="calc"><div class="tot"><span>${T("sellAll")} ×${have}</span><span>${COIN.emoji} ${each * have}</span></div></div>',
    '<div class="calc"><div class="tot"><span>${T("sellTotal")} ×${have}</span><span>${COIN.emoji} ${each * have}</span></div></div>')
