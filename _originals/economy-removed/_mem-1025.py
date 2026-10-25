"""写 2026-10-25 日志 + 新建 notes/plugin-host.md（索引里早就指着它，但文件一直不存在）。"""
import io, os

M = r'E:\plan\test25\.workbuddy-ai\memory'
LOG = os.path.join(M, '2026-10-25.md')
NOTE = os.path.join(M, 'notes', 'plugin-host.md')

NOTE_TEXT = u"""# kid-quest-farm-2d —— 农场 App = 插件宿主本体

worktree，分支 `farm-2d`。**它是宿主，不是游戏**：内置游戏只剩农场，其余都走插件。

## 起服务

```bash
npm run dev -- --port 4391 --strictPort     # 开发（HMR）
# preview 脚本写死 4180 —— 那口常被别的项目占着，起之前先 netstat
```

`vite` 默认绑 0.0.0.0，日志里会打印局域网 IP，真机可以直接连。

## 2026-10-25 快照

| 项 | 状态 |
| --- | --- |
| HEAD | `3d7d2a7` fix(cloudfarm): 1.1.3 |
| 工作区 | **32 个改动未提交** + 「游戏市场」整块未入库（`GameStore.tsx` / `storefront.ts` / `size.ts` / `public/store/`） |
| `HOST_API` | **4**（10-23 加 `mintVoucher`：抓到奖品**直接发兑换券**，不经过币） |
| 内置游戏 | 只剩 农场 / 钓鱼池(comingSoon)。**内置娃娃机已整台移除**（commit `332511b`） |
| 插件（本地包） | prizepark **1.6.1** / claw3d **1.0.0** / cloudfarm **1.1.4** |
| 远程商店 | **未配**：`CATALOG_URL = ''` → 界面明说「这个版本没有配置游戏商店」，不摆必然失败的按钮 |

## 三款插件是怎么进来的（两条路，信任根不同）

| 来源 | 包在哪 | 凭什么信 | 界面 |
| --- | --- | --- | --- |
| **本地**（随 App 发） | `public/games/<id>/` | SHA-256 **烧在 `src/games/localGames.ts`** | 设置 → 游戏 →「游戏市场」 |
| **远程** | 任意 https | Ed25519 目录签名 → 目录里的 SHA-256 | 设置 → 在线商店（未配就不显示按钮） |

`localGames.ts` 是**自动生成**的（`node scripts/make-local-catalog.mjs`），
输入是 `public/games/index.json`（只有 id/名字/版本/路径），哈希由脚本现算。
哈希**不能**放进 `public/` —— 那是发布物，等于让包自己证明自己。

## 装/换插件包时必查的三件事

1. **换完包必须重跑 `make-local-catalog.mjs`**，否则哈希对不上 → 点安装报「包内容校验不过」。
   10 秒自检：算 `public/games/*/*.mjs` 的 sha256 与 `localGames.ts` 里的比。
2. 包声明的 `minHostApi` 必须 ≤ `HOST_API`（现在 4），否则 loader 直接拒，报「请先更新 App」。
3. `public/games/` 必须 `-text`（`.gitattributes` 已钉）—— 按字节哈希校验的东西被换行符改写就装不上。

## 换游戏（用户视角）

底部导航**只有一格「游戏」**，显示当前那款的名字。切换在
设置 → 游戏 → 已下载 →「设为当前」。所以「进娃娃机」= 先把 奖品公园/爪爪乐 设为当前。
"""

LOG_TEXT = u"""# 2026-10-25

## 起了农场 App（worktree farm-2d）给用户看当前版本

用户：「帮我启动下 农场app worktree farm-2d 我看下。现在版本到哪了。」

**地址**：`http://127.0.0.1:4391/`（`npm run dev -- --port 4391 --strictPort`，后台任务跑的）。
`preview` 脚本写死 4180，那口常被别人占 —— 所以起 dev 时显式给 4391。

### 版本状态（对比 10-22 我离开时，变化很大）

- HEAD `3d7d2a7`（cloudfarm 1.1.3，10-24）
- **工作区 32 个改动未提交**，还有「游戏市场」整块未入库：
  `GameStore.tsx` / `storefront.ts` / `size.ts` / `public/store/` / `build-store-shots.py`
- `HOST_API` **2 → 4**：10-23 加 `mintVoucher`（抓到奖品直接发券，不经过币）
- **内置娃娃机整台移除**（`332511b`），registry 只剩 农场 + 钓鱼池(comingSoon)
  ⇒ 我 10-22 记的「不用顶掉现在的娃娃机」后来被推翻了，娃娃机改由两个插件提供
- 三款插件以**本地包**随 App 发：prizepark **1.6.1** / claw3d 1.0.0 / cloudfarm 1.1.4
- 远程商店仍未配（`CATALOG_URL = ''`），界面明说「这个版本没有配置游戏商店」

### 顺手验的

- **三个本地包哈希全对**（算 sha256 与 `localGames.ts` 比，3/3 OK）
  ⇒ 点「安装」不会因为哈希不匹配失败
- `scripts/capture.mjs http://127.0.0.1:4391/ screenshots/look-1025` 跑通，**控制台 0 报错**，
  出图 38 张（含新手引导 10 张）。注意它打印「截图对应的 bundle：unknown」——
  dev server 没有构建哈希，这是正常的，别当成坏了

### 沉淀

新建 `notes/plugin-host.md`（MEMORY.md 的索引一直指着它，但文件从来没建过）。
里面记了「两条安装路线的信任根不同」「换包必须重跑 make-local-catalog」「换游戏在哪切」。
"""

io.open(LOG, 'w', encoding='utf-8', newline='\n').write(LOG_TEXT)
print('log OK', os.path.getsize(LOG))

if os.path.exists(NOTE):
    print('note EXISTS, skip')
else:
    io.open(NOTE, 'w', encoding='utf-8', newline='\n').write(NOTE_TEXT)
    print('note OK', os.path.getsize(NOTE))
