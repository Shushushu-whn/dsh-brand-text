# dsh-brand-text

**English** | [中文](./README.zh.md)

Branding for the **DSH (DeepSeek Harness) Web** client, in **two layers**:

1. **Basics** — sidebar logo, sidebar name, the hero title in the middle of an empty conversation, browser tab title, favicon and PWA manifest.
2. **Watermark** — a translucent, opacity-tunable overlay on the page, **plus** a stamping ledger that writes *“why this was added”* and *“what job was running”* into the project files and folders DSH works on.

Both layers are edited from one settings panel (`/brand-studio/`) or by double-clicking in place, and both live in the same `brand.json`.

> ⚠ Not the same as the community plugin [`dsh-custom-brand`](https://github.com/baisama-cloud/dsh-custom-brand).
> Both occupy the sidebar brand slots, so **do not enable them together** — they fight over the same DOM.

## ① Basics — what you can change

| Item | Where it shows | Data key |
|---|---|---|
| Sidebar name | Top-left of the sidebar; also the browser tab title and PWA name | `productName` |
| Hero title | The line in the middle of an empty new conversation | `heroText` (empty = official default "Into the Unknown" / 「探索未至之境」) |
| Sidebar logo | Sidebar brand slot / favicon / PWA icon | `logoPath` |

Changes take effect on a **page refresh (F5)** — no DSH restart required.

This plugin also covers everything the community plugin `dsh-client-ui-brand` did (title / brand slots / favicon / manifest),
so you do **not** need to install that one.

## ② Watermark — why bother doing it inside DSH

The obvious use is stamping photos. The less obvious one is the reason this lives in DSH:

> You add a pile of project files/folders while working on something. Two weeks later you open them again and
> have no idea **why they were added** or **what job you were in the middle of**.

So the watermark stores two sentences — *why this was added* and *what is being worked on* — and shows them in two places:

| Form | Where you see it | Notes |
|---|---|---|
| **A. Page overlay** | A translucent diagonal text layer over DSH | opacity / angle / size / tiled-or-single are all tunable; `pointer-events: none`, so it never blocks clicks |
| **B. File / folder stamp** | Inside the project directory — a `_DSH水印说明.md` note, an Explorer hover tip (InfoTip), and folder icon swapped to the brand mark | Written to the folder itself, so it survives outside DSH |

Stamps are tracked in a **ledger** (`watermark.targets`) with an *apply* / *undo* button per path. Undo removes the note,
restores the previous `desktop.ini`, and clears the folder attribute.

> Windows only for form B (it relies on `desktop.ini` + `attrib`). Form A works on any browser.
> Applying a stamp sets the **system** attribute on the target folder — that is how Explorer is told to read `desktop.ini`.
> Explorer may need F5 to pick it up.

## Quick start

```bash
# 1. install into a profile — GitHub first (recommended)
dsh plugin --profile web add github:Shushushu-whn/dsh-brand-text

# 2. restart that DSH instance

# 3. open the settings panel
#    http://127.0.0.1:<dsh-port>/brand-studio/
```

If the GitHub route fails (network, pnpm build blocked, version gate), fall back to a local copy —
see [Install C](#c-from-a-local-folder-offline--fallback).

## Two ways to edit (same data, same API)

| Way | How | Good for |
|---|---|---|
| **Settings panel** | `http://127.0.0.1:<dsh-port>/brand-studio/` | Everything: basics, watermark tuning with a live preview, and the file/folder ledger |
| **Double-click in place** | Double-click the **top-left brand area** (logo or text) for a quick dialog; double-click the **hero line** to edit that copy | Quick tweaks — the page reloads after saving |

The dialog keeps the same order as the panel: **① basics first** (name, hero title, logo), **② watermark after it**
(enable switch, watermark text, *what job is running*, opacity slider).

> Trade-off: the sidebar brand area is normally a "new conversation" button, and a double-click would fire two clicks.
> To make double-click usable, the plugin swallows `click` / `pointerdown` on the brand slots —
> **a single click no longer starts a new conversation**; double-click edits, right-click opens the full panel.

## Install

**Recommended order: GitHub first → npm (if published) → local copy as the fallback.**

### A. Straight from GitHub (recommended)

```bash
dsh plugin --profile web add github:Shushushu-whn/dsh-brand-text
```

Restart DSH afterwards. Updates are just `dsh plugin --profile web update dsh-brand-text`
(or remove + add again).

### B. From npm (when published)

```bash
dsh plugin --profile web add dsh-brand-text
```

### C. From a local folder (offline / fallback)

Use this when the GitHub route fails — no network, pnpm blocked from building a git dependency,
or a version gate stops the install.

```bash
# download or clone the repo, then:
cd /path/to/dsh-brand-text
node install.mjs --profile "<path-to-profile>"
```

`install.mjs` is idempotent: it writes a `link:` dependency, adds the plugin to `bundles`,
then runs `pnpm install`. Run it as often as you like.
Local installs pick up your edits immediately (no reinstall needed after changing `lib/`).

Manual equivalent, inside the target profile:

1. add `"dsh-brand-text": "link:<absolute path to this plugin>"` to `dependencies`
2. add `"dsh-brand-text"` to `dsh.profile.bundles`
3. run `pnpm install --no-frozen-lockfile` in the profile directory

## Uninstall

Remove `dsh-brand-text` from `dsh.profile.bundles` and `dependencies`, then run `pnpm install` again.
Undoing folder stamps first is a good idea (the ledger lives in `brand.json`, which you keep).
The `- id: dsh-brand-text` block in the profile's `cordis.patch.yml` can stay (harmless) or be deleted.

## Configuration

The plugin takes a single option:

```yaml
- id: dsh-brand-text
  config:
    configPath: ''      # empty = brand.json next to the plugin
```

Each profile can override it, so one plugin can serve several brands:

```yaml
- id: dsh-brand-text
  config:
    configPath: 'D:\brands\team-a.json'
```

`brand.json` shape — see [brand.example.json](./brand.example.json):

```json
{
  "productName": "Acme Corp",
  "heroText": "Ask the drawings. Find the sheet. Check the spec.",
  "logoPath": "D:\\brands\\logo-mark.png",
  "watermark": {
    "enabled": true,
    "text": "Acme Corp — Site B",
    "task": "October payment-measurement paperwork",
    "note": "Client internal audit in early November, collecting raw records first",
    "opacity": 0.18,
    "angle": -20,
    "scale": 1,
    "repeat": true,
    "color": "#ffffff",
    "onPage": true,
    "targets": [
      { "path": "D:\\projects\\site-b", "purpose": "audit evidence", "task": "paperwork", "at": "2026-10-17 21:33" }
    ]
  }
}
```

Old files without a `watermark` key keep working — it defaults to disabled.

## HTTP routes

| Route | Purpose |
|---|---|
| `GET /brand-studio/` | Settings panel (① basics, ② watermark) |
| `GET /brand-studio/api/config` | Current brand + watermark data |
| `POST /brand-studio/api/save` | Save ① (`{productName, heroText, logoDataUrl}`) |
| `POST /brand-studio/api/watermark` | Save ② overlay settings |
| `POST /brand-studio/api/watermark/target` | Apply / undo a folder stamp (`{path, purpose, task}` or `{remove:true, path}`) |
| `POST /brand-studio/api/open` | Open a ledger path in the file manager (ledger paths only) |
| `GET /brand-studio/watermark.svg` | Watermark tile — no params = current config, with params = live preview |
| `GET /brand-studio/watermark-card.svg` | A printable/savable summary card |
| `GET /brand-studio/logo` | Current logo, original bytes |
| `GET /brand-studio/mark.svg` | Square icon used for favicon / PWA |
| `GET /brand-studio/manifest.webmanifest` | PWA manifest |

> These routes skip the DSH token check (same as the official plugin routes) and listen on loopback only.
> If you expose DSH to a LAN, add your own access control.

## Compatibility

- Host: `@deepseek-ai/dsh` 0.2.x (developed and verified on `0.2.1-alpha.4`).
- Uses three slots: `sidebar.brand.mark`, `sidebar.brand.name`, `conversation.hero.brand.mark`,
  plus `webserver/index-inject` and the `window.__ModuleLoader__` bundle format (same as official client plugins).
- Folder stamping is Windows-only and degrades quietly: if `attrib` is unavailable the note file is still written.
- If branding stops working after a DSH upgrade: check `logs/dsh.log` for `dsh-brand-text` errors,
  then confirm the plugin is still listed in the profile's `bundles`.

## Project layout

```
.
├─ package.json          declares dsh.client / dsh.bundle
├─ cordis.patch.yml      loader layer (also disables the official brand row)
├─ lib\index.js          host half: routes, index.html tap, brand.json I/O
├─ lib\config.js         ① brand config: read / normalize / atomic write / logo bytes
├─ lib\watermark.js      ② watermark: SVG tiles, summary card, folder stamping
├─ lib\panel.js          settings panel markup (basics first, watermark second)
├─ lib\client\index.js   browser half: brand slots + hero copy + title + watermark overlay + double-click editor
├─ install.mjs           idempotent installer for any profile
└─ brand.example.json    config sample
```

## License

[MIT](./LICENSE)
