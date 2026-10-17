window.__ModuleLoader__.load({ id: "dsh-brand-text", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
"use strict";

// dsh-brand-text —— 浏览器端
//
// 干四件事：
//   1. 接管侧栏品牌位（图标 + 文字）与空会话中央的图标插槽
//   2. 维持浏览器标签标题
//   3. 把空会话中央那句被写死的 i18n 文案换成自定义文案
//   4. 双击就地编辑：双击左上角品牌 / 中央标题 → 弹出同一套字段，
//      改完直接写回 brand.json 并刷新（与 /brand-studio/ 面板是同一份数据、同一套 API）
//
// 数据来自宿主注入的 global（window.__DSH_BRAND_STUDIO__），它在客户端 bundle 之前执行。

var jsx = require("react/jsx-runtime").jsx;

var GLOBAL_KEY = "__DSH_BRAND_STUDIO__";
var API_SAVE = "/brand-studio/api/save";
var PANEL_URL = "/brand-studio/";
var DEFAULT_PRODUCT = "DeepSeek Harness";
// DSH 官方中央文案（中/英），用于定位那个元素
var DEFAULT_HERO_TEXTS = ["探索未至之境", "Into the Unknown"];

function readBrand() {
  var g = (typeof window !== "undefined" && window[GLOBAL_KEY]) || {};
  var productName = String(g.productName || "").trim() || DEFAULT_PRODUCT;
  return {
    productName: productName,
    heroText: String(g.heroText || "").trim(),
    logoHref: String(g.logoHref || "").trim(),
    logoAlt: String(g.logoAlt || "").trim() || productName
  };
}

// ================================================================ 双击编辑面板
var editor = null;

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
 * 打开编辑面板。
 * @param {object} brand 当前品牌数据
 * @param {"brand"|"hero"} focus 双击落在哪一块，决定先聚焦哪个输入框
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
    "width:430px", "max-width:92vw", "box-sizing:border-box",
    "background:#171d26", "color:#e6edf3",
    "border:1px solid #2a3441", "border-radius:14px", "padding:20px",
    "font:14px/1.6 'Microsoft YaHei',system-ui,sans-serif",
    "box-shadow:0 24px 64px rgba(0,0,0,.55)"
  ].join(";"));
  card.addEventListener("click", function (e) { e.stopPropagation(); });

  var title = el("div", "font-size:16px;font-weight:700;margin:0 0 4px", { text: "品牌设置" });
  var sub = el("div", "font-size:12px;color:#8b98a5;margin:0 0 16px",
    { text: "双击打开的快捷编辑：改完保存即刷新页面。也可双击中央标题改文案。" });

  function field(labelText, inputValue, placeholder) {
    var wrap = el("div", "margin-bottom:14px");
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
  var heroField = field("中央文字（留空 = 官方默认）", brand.heroText, "探索未至之境");

  // logo 行
  var logoWrap = el("div", "margin-bottom:14px");
  logoWrap.appendChild(el("div", "font-size:12px;color:#8b98a5;margin-bottom:6px", { text: "Logo（左上角图标）" }));
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

  var logoHint = el("div", "font-size:11px;color:#8b98a5;margin-top:4px",
    { text: "建议正方形透明底 PNG" });

  var pickCol = el("div");
  pickCol.appendChild(pickBtn);
  pickCol.appendChild(logoHint);
  logoRow.appendChild(previewBox);
  logoRow.appendChild(pickCol);
  logoRow.appendChild(fileInput);
  logoWrap.appendChild(logoRow);

  // 底部按钮
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
    href: PANEL_URL, target: "_blank", rel: "noopener", text: "打开完整面板 →"
  });

  saveBtn.addEventListener("click", function () {
    msg.textContent = "保存中…";
    msg.setAttribute("style", "font-size:12px;min-height:18px;margin-top:10px;color:#8b98a5");
    fetch(API_SAVE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productName: nameField.input.value.trim(),
        heroText: heroField.input.value.trim(),
        logoDataUrl: pendingLogo || ""
      })
    }).then(function (r) { return r.json(); }).then(function (data) {
      if (!data || !data.ok) throw new Error((data && data.error) || "保存失败");
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

  card.appendChild(title);
  card.appendChild(sub);
  card.appendChild(nameField.wrap);
  card.appendChild(heroField.wrap);
  card.appendChild(logoWrap);
  card.appendChild(msg);
  card.appendChild(actions);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  editor = overlay;

  document.addEventListener("keydown", onEditorKey, true);
  var target = focus === "hero" ? heroField.input : nameField.input;
  try { target.focus(); target.select(); } catch (e) { /* ignore */ }

  nameField.input.addEventListener("keydown", function (e) { if (e.key === "Enter") saveBtn.click(); });
  heroField.input.addEventListener("keydown", function (e) { if (e.key === "Enter") saveBtn.click(); });
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
    node.title = "双击编辑中央文案";
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

  ctx.effect(function () { return installTitle(brand.productName); }, "dsh-brand-text: document title");
  ctx.effect(function () { return installHeroText(brand); }, "dsh-brand-text: hero text");
}

exports.apply = apply;
exports.inject = inject;
exports.readBrand = readBrand;
exports.openEditor = function () { openEditor(readBrand(), "brand"); };
return module.exports; } });
