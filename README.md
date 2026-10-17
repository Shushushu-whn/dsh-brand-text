# dsh-brand-text

**English** | [中文](./README.zh.md)

Unified branding for the **DSH (DeepSeek Harness) Web** client: sidebar name & logo, hero copy, document title, favicon and PWA manifest — with a built-in settings panel and **in-page double-click editing**.

> ⚠ Not the same as the community plugin [`dsh-custom-brand`](https://github.com/baisama-cloud/dsh-custom-brand).
> Both occupy the sidebar brand slots, so **do not enable them together** — they fight over the same DOM.

## What you can change

| Item | Where it shows | Data key |
|---|---|---|
| Sidebar name | Top-left of the sidebar; also the browser tab title and PWA name | `productName` |
| Hero copy | The line in the middle of an empty new conversation | `heroText` (empty = official default "Into the Unknown" / 「探索未至之境」) |
| Sidebar logo | Sidebar brand slot / favicon / PWA icon | `logoPath` |

Changes take effect on a **page refresh (F5)** — no DSH restart required.

This plugin also covers everything the community plugin `dsh-client-ui-brand` did (title / brand slots / favicon / manifest),
so you do **not** need to install that one.

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
| **Settings panel** | `http://127.0.0.1:<dsh-port>/brand-studio/` | Full editing, shows config path and plugin info |
| **Double-click in place** | Double-click the **top-left brand area** (logo or text) for a quick dialog; double-click the **hero line** to edit that copy | Quick tweaks — the page reloads after saving |

The dialog exposes the same three fields as the panel: sidebar name (= page/tab title), hero copy, logo (file picker).

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
  "logoPath": "D:\\brands\\logo-mark.png"
}
```

## HTTP routes

| Route | Purpose |
|---|---|
| `GET /brand-studio/` | Settings panel |
| `GET /brand-studio/api/config` | Current brand data |
| `POST /brand-studio/api/save` | Save (`{productName, heroText, logoDataUrl}`) |
| `GET /brand-studio/logo` | Current logo, original bytes |
| `GET /brand-studio/mark.svg` | Square icon used for favicon / PWA |
| `GET /brand-studio/manifest.webmanifest` | PWA manifest |

> These routes skip the DSH token check (same as the official plugin routes) and listen on loopback only.
> If you expose DSH to a LAN, add your own access control.

## Compatibility

- Host: `@deepseek-ai/dsh` 0.2.x (developed and verified on `0.2.1-alpha.4`).
- Uses three slots: `sidebar.brand.mark`, `sidebar.brand.name`, `conversation.hero.brand.mark`,
  plus `webserver/index-inject` and the `window.__ModuleLoader__` bundle format (same as official client plugins).
- If branding stops working after a DSH upgrade: check `logs/dsh.log` for `dsh-brand-text` errors,
  then confirm the plugin is still listed in the profile's `bundles`.

## Project layout

```
.
├─ package.json          declares dsh.client / dsh.bundle
├─ cordis.patch.yml      loader layer (also disables the official brand row)
├─ lib\index.js          host half: document metadata + panel routes + brand.json I/O
├─ lib\client\index.js   browser half: brand slots + hero copy + title + double-click editor
├─ install.mjs           idempotent installer for any profile
└─ brand.example.json    config sample
```

## License

[MIT](./LICENSE)
