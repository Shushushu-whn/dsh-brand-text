window.__ModuleLoader__.load({ id: "dsh-brand-text", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
"use strict";

// dsh-brand-text —— 浏览器端
//
// 功能分两组，界面顺序与设置面板一致：
//
//   ① 基本（插件本职）
//        1. 接管侧栏品牌位（左上角 Logo + 左上角文字）与空会话中央的图标插槽
//        2. 维持浏览器标签标题
//        3. 把空会话中央那句写死的 i18n 文案换成自定义文案
//
//   ② 水印（新功能）
//        4. 页面上叠一层半透明斜向水印（透明度/角度/平铺都来自服务端算好的 SVG）
//        5. 双击编辑弹窗里，品牌三项在前、水印在后
//
// 数据来自宿主注入的 global（window.__DSH_BRAND_STUDIO__），它在客户端 bundle 之前执行。

var jsx = require("react/jsx-runtime").jsx;

var GLOBAL_KEY = "__DSH_BRAND_STUDIO__";
var API_SAVE = "/brand-studio/api/save";
var API_WM = "/brand-studio/api/watermark";
var PANEL_URL = "/brand-studio/";
var DEFAULT_PRODUCT = "DeepSeek Harness";
// DSH 官方中央文案（中/英），用于定位那个元素
var DEFAULT_HERO_TEXTS = ["探索未至之境", "Into the Unknown"];

function readBrand() {
  var g = (typeof window !== "undefined" && window[GLOBAL_KEY]) || {};
  var productName = String(g.productName || "").trim() || DEFAULT_PRODUCT;
  var raw = g.watermark || {};
  return {
    productName: productName,
    heroText: String(g.heroText || "").trim(),
    logoHref: String(g.logoHref || "").trim(),
    logoAlt: String(g.logoAlt || "").trim() || productName,
    watermark: {
      enabled: raw.enabled === true,
      text: String(raw.text || "").trim(),
      task: String(raw.task || "").trim(),
      note: String(raw.note || "").trim(),
      opacity: typeof raw.opacity === "number" ? raw.opacity : 0.16,
      angle: typeof raw.angle === "number" ? raw.angle : -20,
      scale: typeof raw.scale === "number" ? raw.scale : 1,
      repeat: raw.repeat !== false,
      onPage: raw.onPage !== false
    },
    watermarkSvg: String(g.watermarkSvg || "").trim()
  };
}

// ================================================================ DOM 小工具
function stopAll(e) {
  e.preventDefault();
  e.stopPropagation();
}

function el(tag, style, props) {
  var node = document.createElement(tag);
  if (style) node.setAttribute("style", style);
  if (props) {
    for (var k in props) {
      if (!Object.prototype.hasOwnProperty.call(props, k)) continue;
      if (k === "text") node.textContent = props[k];
      else if (k.slice(0, 2) === "on") node.addEventListener(k.slice(2).toLowerCase(), props[k]);
      else node.setAttribute(k, props[k]);
    }
  }
  return node;
}

// ================================================================ 双击编辑面板
var editor = null;

function closeEditor() {
  if (editor && editor.parentNode) editor.parentNode.removeChild(editor);
  editor = null;
  document.removeEventListener("keydown", onEditorKey, true);
}

function onEditorKey(e) {
  if (!editor) return;
  if (e.key === "Escape") {
    e.stopPropagation();
    closeEditor();
  }
}

/**
 * 打开编辑面板：① 品牌三项在前，② 水印（新功能）在后。
 * @param {"brand"|"hero"|"watermark"} focus 双击落在哪一块，决定先聚焦哪个输入框
 */
function openEditor(brand, focus) {
  if (editor) return;

  var pendingLogo = null; // data URL

  var overlay = el("div", [
    "position:fixed", "inset:0", "z-index:2147483000",
    "background:rgba(0,0,0,.45)", "display:flex",
    "align-items:center", "justify-content:center"
  ].join(";"));
  overlay.addEventListener("click", function (e) { if (e.target === overlay) closeEditor(); });

  var card = el("div", [
    "width:460px", "max-width:92vw", "max-height:88vh", "overflow:auto",
    "box-sizing:border-box", "background:#171d26", "color:#e6edf3",
    "border:1px solid #2a3441", "border-radius:14px", "padding:20px",
    "font:14px/1.6 'Microsoft YaHei',system-ui,sans-serif",
    "box-shadow:0 24px 64px rgba(0,0,0,.55)"
  ].join(";"));
  card.addEventListener("click", function (e) { e.stopPropagation(); });

  function section(text, tagText, tagColor) {
    var row = el("div", "display:flex;align-items:center;gap:8px;margin:16px 0 10px");
    row.appendChild(el("div", "font-size:13px;font-weight:700", { text: text }));
    if (tagText) {
      row.appendChild(el("span", "font-size:11px;padding:1px 7px;border-radius:999px;border:1px solid " +
        tagColor + ";color:" + tagColor, { text: tagText }));
    }
    return row;
  }

  card.appendChild(el("div", "font-size:16px;font-weight:700;margin:0 0 4px", { text: "DSH 品牌设置" }));
  card.appendChild(el("div", "font-size:12px;color:#8b98a5;margin:0 0 6px",
    { text: "双击打开的快捷编辑：改完保存即刷新页面。" }));

  // ---------------- ① 基本 ----------------
  card.appendChild(section("① 基本设置", "本职", "#2a3441"));

  function field(labelText, inputValue, placeholder) {
    var wrap = el("div", "margin-bottom:12px");
    wrap.appendChild(el("div", "font-size:12px;color:#8b98a5;margin-bottom:6px", { text: labelText }));
    var input = el("input", [
      "width:100%", "box-sizing:border-box", "padding:9px 11px",
      "border-radius:8px", "border:1px solid #2a3441", "background:#0d1218",
      "color:#e6edf3", "font-size:14px", "outline:none"
    ].join(";"), { type: "text", placeholder: placeholder || "" });
    input.value = inputValue || "";
    wrap.appendChild(input);
    return { wrap: wrap, input: input };
  }

  var nameField = field("左上角文字（同时是页面/标签标题）", brand.productName, "DeepSeek Harness");
  var heroField = field("中央标题（留空 = 官方默认）", brand.heroText, "探索未至之境");
  card.appendChild(nameField.wrap);
  card.appendChild(heroField.wrap);

  // logo 行
  var logoWrap = el("div", "margin-bottom:4px");
  logoWrap.appendChild(el("div", "font-size:12px;color:#8b98a5;margin-bottom:6px", { text: "左上角 Logo" }));
  var logoRow = el("div", "display:flex;gap:12px;align-items:center");
  var previewBox = el("div", [
    "width:56px", "height:56px", "flex:0 0 auto", "border-radius:10px",
    "border:1px solid #2a3441", "background:#0d1218",
    "display:flex", "align-items:center", "justify-content:center", "overflow:hidden"
  ].join(";"));
  var previewImg = el("img", "max-width:44px;max-height:44px;display:block", { alt: "" });
  previewImg.src = brand.logoHref;
  previewBox.appendChild(previewImg);

  var fileInput = el("input", "display:none", { type: "file", accept: "image/png,image/jpeg,image/svg+xml,image/webp" });
  fileInput.addEventListener("change", function () {
    var f = fileInput.files && fileInput.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      pendingLogo = String(reader.result || "");
      previewImg.src = pendingLogo;
    };
    reader.readAsDataURL(f);
  });

  var pickBtn = el("button", [
    "cursor:pointer", "border:1px solid #2a3441", "background:transparent",
    "color:#e6edf3", "border-radius:8px", "padding:7px 12px", "font-size:13px"
  ].join(";"), { type: "button", text: "选择图片…" });
  pickBtn.addEventListener("click", function () { fileInput.click(); });

  var pickCol = el("div");
  pickCol.appendChild(pickBtn);
  pickCol.appendChild(el("div", "font-size:11px;color:#8b98a5;margin-top:4px", { text: "建议正方形透明底 PNG" }));
  logoRow.appendChild(previewBox);
  logoRow.appendChild(pickCol);
  logoRow.appendChild(fileInput);
  logoWrap.appendChild(logoRow);
  card.appendChild(logoWrap);

  // ---------------- ② 水印 ----------------
  var wm = brand.watermark;
  card.appendChild(section("② 水印（新功能）", "new", "#5b6fd8"));
  card.appendChild(el("div", "font-size:11px;color:#8b98a5;margin:-4px 0 10px",
    { text: "隔一阵再打开项目时，一眼看出「为什么加」「在干什么活」。" }));

  var wmOn = el("div", "display:flex;align-items:center;gap:8px;font-size:13px;color:#c9d1d9;margin-bottom:8px");
  var wmCheck = el("input", "width:15px;height:15px;accent-color:#2ea36f", { type: "checkbox" });
  wmCheck.checked = !!wm.enabled;
  wmOn.appendChild(wmCheck);
  wmOn.appendChild(el("span", null, { text: "启用水印（叠在页面上）" }));
  card.appendChild(wmOn);

  var wmTextField = field("水印主文字（留空 = 用左上角文字）", wm.text, "例如：某某项目 X 标段");
  var wmTaskField = field("在干什么活", wm.task, "例如：10 月计量支付资料整理");
  card.appendChild(wmTextField.wrap);
  card.appendChild(wmTaskField.wrap);

  var opWrap = el("div", "margin-bottom:12px");
  var opHead = el("div", "display:flex;justify-content:space-between;font-size:12px;color:#8b98a5;margin-bottom:6px");
  opHead.appendChild(el("span", null, { text: "透明度" }));
  var opVal = el("span", "color:#e6edf3", { text: Number(wm.opacity).toFixed(2) });
  opHead.appendChild(opVal);
  var opRange = el("input", "width:100%;accent-color:#2ea36f", {
    type: "range", min: "0.03", max: "0.9", step: "0.01"
  });
  opRange.value = String(wm.opacity);
  opRange.addEventListener("input", function () { opVal.textContent = Number(opRange.value).toFixed(2); });
  opWrap.appendChild(opHead);
  opWrap.appendChild(opRange);
  card.appendChild(opWrap);

  // ---------------- 底部 ----------------
  var msg = el("div", "font-size:12px;min-height:18px;margin-top:10px;color:#8b98a5");
  var actions = el("div", "display:flex;gap:10px;align-items:center;margin-top:12px;flex-wrap:wrap");

  var saveBtn = el("button", [
    "cursor:pointer", "border:0", "border-radius:8px", "padding:9px 16px",
    "font-size:13px", "font-weight:600", "background:#1a7f5a", "color:#fff"
  ].join(";"), { type: "button", text: "保存并刷新" });

  var cancelBtn = el("button", [
    "cursor:pointer", "border:1px solid #2a3441", "border-radius:8px",
    "padding:9px 16px", "font-size:13px", "background:transparent", "color:#e6edf3"
  ].join(";"), { type: "button", text: "取消" });
  cancelBtn.addEventListener("click", closeEditor);

  var panelLink = el("a", "font-size:12px;color:#2ea36f;text-decoration:none", {
    href: PANEL_URL, target: "_blank", rel: "noopener", text: "完整面板（含文件/文件夹贴标）→"
  });

  saveBtn.addEventListener("click", function () {
    msg.textContent = "保存中…";
    msg.setAttribute("style", "font-size:12px;min-height:18px;margin-top:10px;color:#8b98a5");
    var brandBody = {
      productName: nameField.input.value.trim(),
      heroText: heroField.input.value.trim(),
      logoDataUrl: pendingLogo || ""
    };
    var wmBody = {
      enabled: wmCheck.checked,
      text: wmTextField.input.value.trim(),
      task: wmTaskField.input.value.trim(),
      opacity: Number(opRange.value),
      // 这两个在快捷弹窗里不动，沿用原值
      angle: wm.angle,
      scale: wm.scale,
      repeat: wm.repeat,
      onPage: true,
      note: wm.note
    };
    fetch(API_SAVE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(brandBody)
    }).then(function (r) { return r.json(); }).then(function (data) {
      if (!data || !data.ok) throw new Error((data && data.error) || "品牌保存失败");
      return fetch(API_WM, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(wmBody)
      });
    }).then(function (r) { return r.json(); }).then(function (data) {
      if (!data || !data.ok) throw new Error((data && data.error) || "水印保存失败");
      msg.textContent = "已保存，正在刷新页面…";
      setTimeout(function () { window.location.reload(); }, 400);
    }).catch(function (err) {
      msg.textContent = "保存失败：" + (err && err.message ? err.message : err);
      msg.setAttribute("style", "font-size:12px;min-height:18px;margin-top:10px;color:#f85149");
    });
  });

  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);
  actions.appendChild(panelLink);
  card.appendChild(msg);
  card.appendChild(actions);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  editor = overlay;

  document.addEventListener("keydown", onEditorKey, true);
  var target = focus === "hero" ? heroField.input
    : focus === "watermark" ? wmTextField.input
    : nameField.input;
  try { target.focus(); target.select(); } catch (e) { /* ignore */ }

  [nameField.input, heroField.input, wmTextField.input, wmTaskField.input].forEach(function (inp) {
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") saveBtn.click(); });
  });
}

// ================================================================ 品牌插槽组件
function makeMark(brand) {
  return function BrandMark(props) {
    var size = props.size || 24;
    var className = props.className;
    if (!brand.logoHref) return null;
    return jsx("span", {
      className: className,
      title: "双击编辑品牌",
      onDoubleClick: function (e) { stopAll(e); openEditor(brand, "brand"); },
      onContextMenu: function (e) { stopAll(e); window.open(PANEL_URL, "_blank"); },
      onClick: function (e) { e.stopPropagation(); },
      onPointerDown: function (e) { e.stopPropagation(); },
      style: {
        alignItems: "center",
        cursor: "pointer",
        display: "inline-flex",
        height: size,
        justifyContent: "center",
        width: size
      },
      children: jsx("img", {
        alt: brand.logoAlt,
        src: brand.logoHref,
        draggable: false,
        style: { display: "block", height: size, objectFit: "contain", width: size }
      })
    });
  };
}

function makeName(brand) {
  return function BrandName(props) {
    return jsx("span", {
      title: "双击编辑品牌（左上角文字 / 页面标题）",
      onDoubleClick: function (e) { stopAll(e); openEditor(brand, "brand"); },
      onContextMenu: function (e) { stopAll(e); window.open(PANEL_URL, "_blank"); },
      onClick: function (e) { e.stopPropagation(); },
      onPointerDown: function (e) { e.stopPropagation(); },
      style: {
        cursor: "pointer",
        display: "block",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      },
      children: brand.productName
    });
  };
}

// ================================================================ 标题
function brandTitle(title, productName) {
  var sep = " \u2014 ";
  var at = title.lastIndexOf(sep);
  if (at === -1) return productName;
  var prefix = title.slice(0, at);
  if (!prefix) return productName;
  return prefix + sep + productName;
}

function installTitle(productName) {
  var running = false;
  function tick() {
    if (running) return;
    var next = brandTitle(document.title, productName);
    if (document.title === next) return;
    running = true;
    document.title = next;
    running = false;
  }
  tick();
  var mo = new MutationObserver(tick);
  mo.observe(document.head, { childList: true, characterData: true, subtree: true });
  return function () { mo.disconnect(); };
}

// ================================================================ 中央文案
function installHeroText(brand) {
  var text = brand.heroText;
  if (!text) return function () {};

  var patched = null;
  function findTarget() {
    // 官方那句标题在 DOM 里是 span / h1 / p / div 都有可能（构建产物改版会换标签），
    // 所以按"无子元素 + 文本等于官方默认值"来找，不绑死标签名。
    var nodes = document.querySelectorAll("span,h1,h2,h3,p,div");
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.children && node.children.length) continue;
      if (node.isContentEditable) continue;
      var s = (node.textContent || "").trim();
      if (DEFAULT_HERO_TEXTS.indexOf(s) !== -1) return node;
    }
    return null;
  }

  function bind(node) {
    if (node.__dshBrandBound) return;
    node.__dshBrandBound = true;
    node.title = "双击编辑中央标题";
    node.addEventListener("dblclick", function (e) { stopAll(e); openEditor(brand, "hero"); });
  }

  function run() {
    if (patched && patched.isConnected && (patched.textContent || "").trim() === text) return;
    var node = findTarget();
    if (!node) { patched = null; return; }
    node.textContent = text;
    bind(node);
    patched = node;
  }
  run();
  // SPA 重新渲染会把文案写回去，用 MutationObserver 兜住
  var mo = new MutationObserver(run);
  mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  return function () { mo.disconnect(); };
}

// ================================================================ ② 页面水印层
function installWatermark(brand) {
  var wm = brand.watermark;
  var svg = brand.watermarkSvg;
  if (!wm || !wm.enabled || !wm.onPage || !svg) return function () {};

  var layer = null;
  function build() {
    // SPA 偶尔会整体替换 body，发现被摘掉就补回去
    if (layer && layer.isConnected) return;
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
    layer = el("div", [
      "position:fixed", "inset:0", "z-index:2147482000",
      "pointer-events:none", "overflow:hidden",
      "opacity:" + wm.opacity
    ].join(";"), { "data-dsh-watermark": "1" });
    layer.style.backgroundImage = 'url("data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '")';
    layer.style.backgroundRepeat = wm.repeat ? "repeat" : "no-repeat";
    layer.style.backgroundPosition = wm.repeat ? "0 0" : "center";
    document.body.appendChild(layer);
  }
  build();
  var mo = new MutationObserver(build);
  mo.observe(document.documentElement, { childList: true, subtree: true });
  return function () {
    mo.disconnect();
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
  };
}

// ================================================================ 入口
var inject = ["slots"];

function apply(ctx) {
  var brand = readBrand();
  var BrandMark = makeMark(brand);
  var BrandName = makeName(brand);

  ctx.slots.inject("sidebar.brand.mark", function () {
    return ctx.slots.inject("sidebar.brand.name", function () {
      return ctx.slots.inject("conversation.hero.brand.mark", function* () {
        yield ctx.slots.register({ name: "sidebar.brand.mark" }, BrandMark);
        yield ctx.slots.register({ name: "sidebar.brand.name" }, BrandName);
        yield ctx.slots.register({ name: "conversation.hero.brand.mark" }, BrandMark);
      });
    });
  });

  // ① 基本
  ctx.effect(function () { return installTitle(brand.productName); }, "dsh-brand-text: document title");
  ctx.effect(function () { return installHeroText(brand); }, "dsh-brand-text: hero text");
  // ② 水印
  ctx.effect(function () { return installWatermark(brand); }, "dsh-brand-text: watermark layer");
}

exports.apply = apply;
exports.inject = inject;
exports.readBrand = readBrand;
exports.openEditor = function () { openEditor(readBrand(), "brand"); };
return module.exports; } });
