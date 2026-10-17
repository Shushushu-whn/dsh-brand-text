# dsh-brand-text

[English](./README.md) | **中文**

DSH（DeepSeek Harness）Web 端的**一体化品牌插件**：侧栏文字与 Logo、中央文案、浏览器标题、favicon 与 PWA 图标，并自带设置面板和**页面内双击就地编辑**。

> ⚠ 本插件**不是**社区插件 [`dsh-custom-brand`](https://github.com/baisama-cloud/dsh-custom-brand)。
> 两者都要占用侧栏品牌位，**不要同时启用**，否则会互相抢 DOM。

## 能改什么

| 项 | 显示位置 | 数据键 |
|---|---|---|
| 侧栏文字 | 侧边栏最上方；同时是浏览器标签标题、PWA 名称 | `productName` |
| 中央文案 | 新建对话时页面正中间那句 | `heroText`（留空 = 官方默认「探索未至之境」） |
| 侧栏图标 | 侧栏品牌位 / favicon / PWA 图标 | `logoPath` |

改完**刷新页面（F5）**即生效，**不需要重启 DSH**。

本插件已覆盖社区插件 `dsh-client-ui-brand` 的全部能力（标题 / 品牌位 / favicon / manifest），
装它就**不需要**再装那个。

## 快速开始

```bash
# 1. 装进某个 profile（路径换成你自己的）
node install.mjs --profile "<profile 目录>"

# 2. 重启那一套 DSH

# 3. 打开设置面板
#    http://127.0.0.1:<DSH 端口>/brand-studio/
```

`install.mjs` 是幂等的：写 `link:` 依赖 → 加进 `bundles` → 跑一次 `pnpm install`，想跑几遍跑几遍。

## 两种用法（同一份数据、同一套 API）

| 用法 | 怎么用 | 适合 |
|---|---|---|
| **设置面板** | `http://127.0.0.1:<DSH 端口>/brand-studio/` | 完整编辑，显示配置路径与插件信息 |
| **双击就地编辑** | 双击**左上角品牌区**（Logo 或文字）弹快捷编辑；双击**中央那句标题**直接改文案 | 顺手改一下，保存后自动刷新 |

弹窗三个字段与面板完全一致：侧栏文字（= 页面/标签标题）、中央文案、Logo（选图）。

> 取舍：侧栏品牌区本身是"点一下 = 新建对话"按钮，双击会先触发两次点击。
> 为保证双击可用，插件在品牌插槽里拦掉了 `click` / `pointerdown`——**单击品牌不再新建对话**；
> 双击编辑、右键打开完整面板。

## 安装

### A. 本地目录（开发 / 自用，改代码即时生效）

```bash
cd /path/to/dsh-brand-text
node install.mjs --profile "<profile 目录>"
```

手工等价写法（在目标 profile 里）：

1. `dependencies` 加 `"dsh-brand-text": "link:<插件绝对路径>"`
2. `dsh.profile.bundles` 里加上 `"dsh-brand-text"`
3. 在 profile 目录执行 `pnpm install --no-frozen-lockfile`

### B. 直接从 GitHub 装

```bash
dsh plugin --profile web add github:Shushushu-whn/dsh-brand-text
```

### C. 从 npm 装（发布后）

```bash
dsh plugin --profile web add dsh-brand-text
```

## 卸载

从 `dsh.profile.bundles` 与 `dependencies` 里删掉 `dsh-brand-text`，再跑一次 `pnpm install`。
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
  "productName": "湖北交投",
  "heroText": "汉宜改扩建 HYSJSG-1 总承包施工项目经理部",
  "logoPath": "D:\\brands\\logo-mark.png"
}
```

## HTTP 路由

| 路由 | 用途 |
|---|---|
| `GET /brand-studio/` | 设置面板 |
| `GET /brand-studio/api/config` | 当前品牌数据 |
| `POST /brand-studio/api/save` | 保存（`{productName, heroText, logoDataUrl}`） |
| `GET /brand-studio/logo` | 当前 logo 原图 |
| `GET /brand-studio/mark.svg` | 方形图标（favicon / PWA 用） |
| `GET /brand-studio/manifest.webmanifest` | PWA manifest |

> 这些路由不走 DSH 的令牌校验（与官方插件路由一致），只监听本机回环地址。
> 若把 DSH 暴露到局域网，请自行加访问控制。

## 兼容性

- 宿主：`@deepseek-ai/dsh` 0.2.x（在 `0.2.1-alpha.4` 上开发验证）。
- 依赖三个插槽：`sidebar.brand.mark`、`sidebar.brand.name`、`conversation.hero.brand.mark`；
  依赖 `webserver/index-inject` 与 `window.__ModuleLoader__` 的 bundle 格式（与官方客户端插件一致）。
- 升级 DSH 后若品牌失效：先看 `logs/dsh.log` 里有没有 `dsh-brand-text` 报错，
  再确认 profile 的 `bundles` 里仍有本插件。

## 目录结构

```
.
├─ package.json          声明 dsh.client / dsh.bundle
├─ cordis.patch.yml      挂载层（含禁用官方品牌行）
├─ lib\index.js          宿主侧：文档标题/图标 + 面板路由 + 读写 brand.json
├─ lib\client\index.js   浏览器侧：品牌插槽 + 中央文案 + 标题 + 双击编辑
├─ install.mjs           装进任意 profile（幂等）
└─ brand.example.json    配置样例
```

## License

[MIT](./LICENSE)
