# dsh-brand-text

[English](./README.md) | **中文**

DSH（DeepSeek Harness）Web 端的**一体化品牌插件**，功能分成**两组**：

1. **① 基本设置**（插件本职）—— 左上角 Logo、左上角文字、空会话正中间那句标题、浏览器标签标题、favicon 与 PWA 图标。
2. **② 水印**（新功能）—— 页面上叠一层可调透明度的半透明水印；**并且**可以把「为什么加 / 在干什么活」贴到 DSH 对应的项目文件、文件夹上。

两组都在同一个面板 `/brand-studio/` 里改，也可以双击就地改，数据都存在同一份 `brand.json`。

> ⚠ 本插件**不是**社区插件 [`dsh-custom-brand`](https://github.com/baisama-cloud/dsh-custom-brand)。
> 两者都要占用侧栏品牌位，**不要同时启用**，否则会互相抢 DOM。

## ① 基本设置 —— 能改什么

| 项 | 显示位置 | 数据键 |
|---|---|---|
| 左上角文字 | 侧边栏最上方；同时是浏览器标签标题、PWA 名称 | `productName` |
| 中间标题 | 新建对话时页面正中间那句 | `heroText`（留空 = 官方默认「探索未至之境」） |
| 左上角 Logo | 侧栏品牌位 / favicon / PWA 图标 | `logoPath` |

改完**刷新页面（F5）**即生效，**不需要重启 DSH**。

本插件已覆盖社区插件 `dsh-client-ui-brand` 的全部能力（标题 / 品牌位 / favicon / manifest），
装它就**不需要**再装那个。

## ② 水印 —— 为什么要放在 DSH 里做

给照片打水印只是其中一半。另一半才是把它放进 DSH 的理由：

> 干活时往项目里加了一批文件/文件夹，过两周再打开，已经想不起来**当时为什么加**、
> **那阵子在干什么活**。

所以水印记的就是这两句 —— 「为什么加」和「在干什么活」，并且用两种形式呈现：

| 形式 | 在哪儿看到 | 说明 |
|---|---|---|
| **A 页面水印** | DSH 页面上浮一层半透明斜向文字 | 透明度 / 角度 / 字号 / 平铺与否都能调；`pointer-events:none`，绝不挡点击 |
| **B 文件/文件夹贴标** | 写进项目目录本身：一份 `_DSH水印说明.md`、资源管理器**悬停提示**（InfoTip）、文件夹图标换成品牌徽标 | 离开 DSH 也认得出来 |

贴过的路径都进**台账**（`watermark.targets`），每条都有「打开」和「撤标」。撤标会删掉说明文件、
还原原来的 `desktop.ini`、清掉目录属性。

> B 形式仅 Windows（依赖 `desktop.ini` + `attrib`）；A 形式任何浏览器都行。
> 贴标会给目标目录加**系统**属性——这是让资源管理器去读 `desktop.ini` 的必要条件，
> 资源管理器可能要按 F5 才刷新出来。

## 快速开始

```bash
# 1. 装进某个 profile —— 优先从 GitHub 装（推荐）
dsh plugin --profile web add github:Shushushu-whn/dsh-brand-text

# 2. 重启那一套 DSH

# 3. 打开设置面板
#    http://127.0.0.1:<DSH 端口>/brand-studio/
```

GitHub 这条路走不通时（没网、pnpm 拒绝构建 git 依赖、版本门禁），再退回本地安装：
见 [安装 C](#c-本地目录离线--兜底)。

## 两种用法（同一份数据、同一套 API）

| 用法 | 怎么用 | 适合 |
|---|---|---|
| **设置面板** | `http://127.0.0.1:<DSH 端口>/brand-studio/` | 全都有：基本三项、水印（带实时预览）、文件/文件夹台账 |
| **双击就地编辑** | 双击**左上角品牌区**（Logo 或文字）弹快捷编辑；双击**中间那句标题**直接改文案 | 顺手改一下，保存后自动刷新 |

弹窗顺序与面板一致：**① 基本在前**（左上角文字、中间标题、Logo），**② 水印在后**
（开关、水印主文字、在干什么活、透明度滑杆）。

> 取舍：侧栏品牌区本身是"点一下 = 新建对话"按钮，双击会先触发两次点击。
> 为保证双击可用，插件在品牌插槽里拦掉了 `click` / `pointerdown`——**单击品牌不再新建对话**；
> 双击编辑、右键打开完整面板。

## 安装

**推荐顺序：先 GitHub → 有 npm 包就用 npm → 都不行再本地安装。**

### A. 直接从 GitHub 装（推荐）

```bash
dsh plugin --profile web add github:Shushushu-whn/dsh-brand-text
```

装完重启 DSH。升级用 `dsh plugin --profile web update dsh-brand-text`（或删掉重装）。

### B. 从 npm 装（发布后）

```bash
dsh plugin --profile web add dsh-brand-text
```

### C. 本地目录（离线 / 兜底）

GitHub 这条路失败时用：没网、pnpm 不允许构建 git 依赖、或版本门禁拦住安装。

```bash
# 先下载或 clone 仓库，然后：
cd /path/to/dsh-brand-text
node install.mjs --profile "<profile 目录>"
```

`install.mjs` 是幂等的：写 `link:` 依赖 → 加进 `bundles` → 跑一次 `pnpm install`，想跑几遍跑几遍。
本地安装改 `lib/` 里的代码立即生效，不用重装。

手工等价写法（在目标 profile 里）：

1. `dependencies` 加 `"dsh-brand-text": "link:<插件绝对路径>"`
2. `dsh.profile.bundles` 里加上 `"dsh-brand-text"`
3. 在 profile 目录执行 `pnpm install --no-frozen-lockfile`

## 卸载

从 `dsh.profile.bundles` 与 `dependencies` 里删掉 `dsh-brand-text`，再跑一次 `pnpm install`。
建议先在台账里把贴过的标撤掉（`brand.json` 是你自己的，会保留）。
profile 的 `cordis.patch.yml` 里 `- id: dsh-brand-text` 那段留着也无害。

## 配置

只认一个配置项：

```yaml
- id: dsh-brand-text
  config:
    configPath: ''      # 留空 = 用插件目录下的 brand.json
```

各 profile 可以各自覆盖，实现"一套插件、多套品牌"：

```yaml
- id: dsh-brand-text
  config:
    configPath: 'D:\brands\team-a.json'
```

`brand.json` 格式见 [brand.example.json](./brand.example.json)：

```json
{
  "productName": "某某单位",
  "heroText": "某某项目 X 标段总承包施工项目经理部",
  "logoPath": "D:\\brands\\logo-mark.png",
  "watermark": {
    "enabled": true,
    "text": "某某项目 X 标段",
    "task": "10 月计量支付资料整理",
    "note": "业主 11 月初内业检查，先归集这批原始记录",
    "opacity": 0.18,
    "angle": -20,
    "scale": 1,
    "repeat": true,
    "color": "#ffffff",
    "onPage": true,
    "targets": [
      { "path": "D:\\projects\\site-b", "purpose": "内业检查归集", "task": "计量资料整理", "at": "2026-10-17 21:33" }
    ]
  }
}
```

老配置里没有 `watermark` 字段也能照常跑（默认关闭）。

## HTTP 路由

| 路由 | 用途 |
|---|---|
| `GET /brand-studio/` | 设置面板（① 基本 + ② 水印） |
| `GET /brand-studio/api/config` | 当前品牌 + 水印数据 |
| `POST /brand-studio/api/save` | 保存 ①（`{productName, heroText, logoDataUrl}`） |
| `POST /brand-studio/api/watermark` | 保存 ② 页面水印参数 |
| `POST /brand-studio/api/watermark/target` | 贴标 / 撤标（`{path, purpose, task}` 或 `{remove:true, path}`） |
| `POST /brand-studio/api/open` | 在文件管理器里打开台账里的路径（只认台账内路径） |
| `GET /brand-studio/watermark.svg` | 水印贴片：不带参数 = 当前配置，带参数 = 实时预览 |
| `GET /brand-studio/watermark-card.svg` | 可下载/打印的说明卡 |
| `GET /brand-studio/logo` | 当前 logo 原图 |
| `GET /brand-studio/mark.svg` | 方形图标（favicon / PWA 用） |
| `GET /brand-studio/manifest.webmanifest` | PWA manifest |

> 这些路由不走 DSH 的令牌校验（与官方插件路由一致），只监听本机回环地址。
> 若把 DSH 暴露到局域网，请自行加访问控制。

## 兼容性

- 宿主：`@deepseek-ai/dsh` 0.2.x（在 `0.2.1-alpha.4` 上开发验证）。
- 依赖三个插槽：`sidebar.brand.mark`、`sidebar.brand.name`、`conversation.hero.brand.mark`；
  依赖 `webserver/index-inject` 与 `window.__ModuleLoader__` 的 bundle 格式（与官方客户端插件一致）。
- 文件/文件夹贴标仅 Windows，且会安静降级：`attrib` 不可用时说明文件照样写。
- 升级 DSH 后若品牌失效：先看 `logs/dsh.log` 里有没有 `dsh-brand-text` 报错，
  再确认 profile 的 `bundles` 里仍有本插件。

## 目录结构

```
.
├─ package.json          声明 dsh.client / dsh.bundle
├─ cordis.patch.yml      挂载层（含禁用官方品牌行）
├─ lib\index.js          宿主侧：路由、index.html 改写、读写 brand.json
├─ lib\config.js         ① 品牌配置：读取 / 归一化 / 原子写 / logo 字节
├─ lib\watermark.js      ② 水印：SVG 贴片、说明卡、文件/文件夹贴标
├─ lib\panel.js          设置面板页面（基本在前，水印在后）
├─ lib\client\index.js   浏览器侧：品牌插槽 + 中间标题 + 标题 + 水印层 + 双击编辑
├─ install.mjs           装进任意 profile（幂等）
└─ brand.example.json    配置样例
```

## License

[MIT](./LICENSE)
