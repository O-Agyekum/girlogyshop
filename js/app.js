/*
  The Girlogist — storefront logic.
  Products, prices and shipping come from /data/catalog.json.
  Prices shown here are for display only: the server function recalculates
  every total from the same catalogue before asking Revolut for payment.
*/
(async function () {
"use strict";

const T = window.T, LOCALE = window.LOCALE, SHOP = window.SHOP || {};
const CAT = await fetch("/data/catalog.json", {cache: "no-cache"}).then(r => r.json());
const SW = CAT.swatches, SIZES = CAT.sizes, GUIDES = CAT.guides, DEPT_CATS = CAT.deptCats;
const BUNDLES = CAT.bundles, SHIP = CAT.shipping;
const products = CAT.products;
const ORDERS_OPEN = SHOP.ordersOpen === true;

/* ---------- state ---------- */
const store = {
  get(k, d){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch(e){ return false; } },
  del(k){ try { localStorage.removeItem(k); } catch(e){} }
};
let lang = store.get("tg_lang", null) || (((navigator.language || "en").slice(0,2)) in T ? navigator.language.slice(0,2) : "en");
let cart = store.get("tg_cart", []);
let favs = store.get("tg_favs", []);
let view = "home", dept = "her", cat = "all", sort = "rec", query = "";
let fSizes = [], fColors = [], current = null, pColor = null, pSize = null;
let promo = {code: "", percent: 0};

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const t = (k, v = {}) => { if(v.n === 1 && T.en[k+"1"]) k = k+"1"; let s = (T[lang][k] ?? T.en[k] ?? k); if(typeof s === "string") for(const x in v) s = s.replace("{"+x+"}", v[x]); return s; };
const eur = n => new Intl.NumberFormat(LOCALE[lang], {style:"currency", currency:"EUR"}).format(Math.round(n*100)/100);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const byId = id => products.find(p => p.id === id);
const bundleById = id => BUNDLES.find(b => b.id === id);
const pName = p => (p.txt[lang] && p.txt[lang][0]) || p.txt.en[0];
const pDesc = p => (p.txt[lang] && p.txt[lang][1]) || p.txt.en[1];
const bName = b => (b.txt[lang] || b.txt.en)[0];
const catName = c => T[lang].cats[c] || c;
const colName = c => T[lang].cols[c] || c;
const shown = () => products.filter(p => p.visible !== false);
const sizesOf = p => SIZES[p.sk] || [];
const hasSale = () => shown().some(p => p.was);
/* "pod": false pieces (varsity jackets, tracksuits) have no supplier yet: shown as "Coming soon",
   nothing can be added to the bag until a supplier and a delivery time are confirmed */
const comingSoon = p => !!p && p.pod === false;
const bundleSoon = b => comingSoon(byId(b.hers)) || comingSoon(byId(b.his));

/* ---------- product images ---------- */
function art(p, colorKey, mode){
  const imgs = p.images || [];
  if(!imgs.length) return "";
  const k = mode === "zoom" ? 1 : mode === "plain" ? 2 : 0;
  const src = imgs[k] || imgs[0];
  return `<img src="${src}" alt="${esc(pName(p))}" loading="lazy" decoding="async">`;
}
const heartIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/></svg>`;

function priceHtml(p){
  return p.was ? `<span class="now">${eur(p.price)}</span><span class="was">${eur(p.was)}</span>` : eur(p.price);
}
function card(p){
  const on = favs.includes(p.id);
  const badge = comingSoon(p) ? `<span class="badge soon">${t("b_soon")}</span>` : p.was ? `<span class="badge sale">−${Math.round((1-p.price/p.was)*100)}%</span>` : p.badge ? `<span class="badge">${t(p.badge)}</span>` : "";
  const alt = (p.images || [])[1] ? `<div class="alt">${art(p, null, "zoom")}</div>` : "";
  return `<div class="pc">
    <button class="open" data-open="${p.id}">
      <div class="im">${art(p)}${alt}${badge}</div>
      <div class="nm">${esc(pName(p))}</div>
      <div class="pr">${priceHtml(p)}</div>
      <div class="sw">${p.colors.map(c => `<i style="background:${SW[c]}" title="${esc(colName(c))}"></i>`).join("")}</div>
    </button>
    <button class="fav ${on?"on":""}" data-fav="${p.id}" aria-pressed="${on}" aria-label="${esc(t("favs"))}">${heartIcon}</button>
  </div>`;
}
const fill = (el, list, emptyMsg) => el.innerHTML = list.length ? list.map(card).join("") : `<div class="empty">${emptyMsg || ""}</div>`;

function bundleHtml(b){
  const h = byId(b.hers), m = byId(b.his); if(!h || !m) return "";
  const full = h.price + m.price;
  const tx = b.txt[lang] || b.txt.en;
  return `<div class="bundle">
    <button class="im" data-open="${h.id}" style="border:0">${art(h)}</button>
    <button class="im" data-open="${m.id}" style="border:0">${art(m)}</button>
    <div><h3>${esc(tx[0])}</h3><p class="fine" style="margin:0 0 8px">${esc(tx[1])}</p>
      <div class="pr"><span class="now">${eur(b.price)}</span><span class="was">${eur(full)}</span> <span class="fine">${t("bundleSave",{x:eur(full-b.price)})}</span></div>
      ${bundleSoon(b)
        ? `<button class="btn" style="margin-top:10px;padding:10px 16px" disabled>${t("b_soon")}</button>
      <p class="fine" style="margin:6px 0 0">${t("soonNote2")}</p>`
        : `<button class="btn" style="margin-top:10px;padding:10px 16px" data-bundle="${b.id}">${t("addBundle")}</button>
      <p class="fine" style="margin:6px 0 0">${t("pickSizes")}</p>`}</div>
  </div>`;
}

/* ---------- The Collection (lookbook) ----------
   /data/collection.json holds every concept of the design catalogue: 40 categories,
   each a list of {img, w, h, title, sub}. Loaded the first time the page is opened.
   Design names stay in English; category names are translated (T[lang].colCats).  */
let COL = null, colLang = null;
async function renderCollection(){
  if(!COL) COL = await fetch("/data/collection.json", {cache: "no-cache"}).then(r => r.json()).catch(() => ({cats: [], items: 0}));
  if(view !== "collection" || colLang === lang) return;
  colLang = lang;
  const names = T[lang].colCats || T.en.colCats || {};
  const colCatName = c => names[c.n] || c.title;
  $("#colNote").textContent = t("colNote", {n: COL.items, c: COL.cats.length});
  $("#colJump").innerHTML = COL.cats.map(c => `<a class="chipx" href="#col-${c.n}" data-col="${c.n}">${esc(colCatName(c))}</a>`).join("");
  $("#colBody").innerHTML = COL.cats.map(c => `<section class="colcat" id="col-${c.n}">
    <div class="sechead"><h2><span class="num">${String(c.n).padStart(2,"0")}</span> ${esc(colCatName(c))}</h2><span class="fine">${t("colItems", {n: c.items.length})}</span></div>
    <div class="colgrid">${c.items.map(i => `<figure class="coltile">
      <div class="im"><img src="${i.img}" width="${i.w}" height="${i.h}" alt="${esc(i.title)}" loading="lazy" decoding="async"></div>
      <figcaption><b>${esc(i.title)}</b>${i.sub ? `<span>${esc(i.sub)}</span>` : ""}</figcaption>
    </figure>`).join("")}</div>
  </section>`).join("");
}
$("#colJump").addEventListener("click", e => {
  const a = e.target.closest("[data-col]"); if(!a) return;
  e.preventDefault();
  const el = $("#col-" + a.dataset.col); if(el) el.scrollIntoView({behavior: "smooth", block: "start"});
});
$("#colJoin").onclick = () => { go("launch"); setTimeout(() => $("#lnE").focus({preventScroll: true}), 50); };

/* ---------- static text ---------- */
function applyLang(){
  colLang = null; if(view === "collection") renderCollection();
  document.documentElement.lang = lang;
  $$("[data-t]").forEach(el => { const v = t(el.dataset.t); if(typeof v === "string") el.textContent = v; });
  $$("[data-tp]").forEach(el => el.placeholder = t(el.dataset.tp));
  $$("[data-lang]").forEach(b => { b.classList.toggle("on", b.dataset.lang === lang); b.setAttribute("aria-pressed", b.dataset.lang === lang); });
  $("#langSel").value = lang;
  $("#sort").innerHTML = ["rec","new","low","high"].map(k => `<option value="${k}" ${sort===k?"selected":""}>${t("sort_"+k)}</option>`).join("");
  $("#co").innerHTML = T[lang].countries.map(c => `<option>${esc(c)}</option>`).join("");
  $("#faq").innerHTML = T[lang].faq.map(([q,a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("");
  const privLink = `<a href="/legal/confidentialite.html">${esc(t("privacy").toLowerCase())}</a>`;
  $("#lnFine").innerHTML = esc(t("launchFine")).replace("{priv}", privLink);
  $("#nlFine").innerHTML = esc(t("newsFine")).replace("{priv}", privLink);
  $("#cgvLabel").innerHTML = esc(t("acceptCgv")).replace("{cgv}", `<a href="/legal/cgv.html" target="_blank" rel="noopener">${esc(t("cgv"))}</a>`).replace("{priv}", `<a href="/legal/confidentialite.html" target="_blank" rel="noopener">${esc(t("privacy").toLowerCase())}</a>`);
  const storyMap = [["new",null],["her","Tops"],["acc","Accessories"],["her","Tops"],["her","Bottoms"],[hasSale()?"sale":"her",null,hasSale()?null:"low"],["plus",null]];
  const storyIds = ["heart-tee","crewneck-rust","mug","tee-colors","heart-sweatpants","tote","po-cap"];
  $("#heroImg").src = CAT.heroImage;
  $("#stories").innerHTML = T[lang].stories.map((s,i) => { const p = byId(storyIds[i]); return `<button class="story" data-dept-go="${storyMap[i][0]}" ${storyMap[i][1]?`data-cat-go="${storyMap[i][1]}"`:""} ${storyMap[i][2]?`data-sort-go="${storyMap[i][2]}"`:""}><span class="ring"><span class="dot">${p ? art(p) : ""}</span></span>${esc(s)}</button>`; }).join("");
  const tA = byId("heart-hoodie"), tB = byId("po-hoodie"), ab = byId("hoodie-cream");
  $("#tileA").innerHTML = tA ? art(tA) : "";
  $("#tileB").innerHTML = tB ? art(tB) : "";
  $("#aboutArt").innerHTML = ab ? art(ab, null, "plain") : "";
  buildMobileNav();
  refresh();
}
function setLang(l){ lang = l; store.set("tg_lang", l); applyLang(); }
$$("[data-lang]").forEach(b => b.onclick = () => setLang(b.dataset.lang));
$("#langSel").onchange = e => setLang(e.target.value);

/* ---------- social links from config ---------- */
(function(){
  const links = Object.entries(SHOP.social || {}).filter(([, url]) => url);
  if(!links.length){ $("#followCol").hidden = true; return; }
  $("#socialLinks").innerHTML = links.map(([n, url]) => `<a class="fl" href="${esc(url)}" target="_blank" rel="noopener">${esc(n)}</a>`).join("");
})();
$("#year").textContent = new Date().getFullYear();

/* ---------- mega menu ---------- */
let megaTimer;
function megaFor(d){
  if(d === "new" || d === "sale" || d === "couples"){ $("#mega").classList.remove("open"); return; }
  const cats = DEPT_CATS[d];
  const colsHtml = `<div><h4>${t("d_"+d)}</h4><button data-dept-go="${d}">${t("seeAll")}</button>${cats.map(c => `<button data-dept-go="${d}" data-cat-go="${c}">${catName(c)}</button>`).join("")}</div>`;
  const hl = `<div><h4>${t("newIn")}</h4><button data-dept-go="new">${t("d_new")}</button>${hasSale()?`<button data-dept-go="sale">${t("d_sale")}</button>`:""}<button data-dept-go="couples">${t("d_couples")}</button></div>`;
  const cols = `<div><h4>${t("colours")}</h4>${["rust","cream","chocolate","sage","black"].map(c=>`<button data-dept-go="${d}" data-col-go="${c}">${colName(c)}</button>`).join("")}</div>`;
  const help = `<div><h4>${t("help")}</h4><button data-go="help">${t("sizeGuide")}</button><button data-go="help">${t("delRet")}</button><button data-go="help">${t("writeUs")}</button></div>`;
  $("#megaIn").innerHTML = colsHtml + hl + cols + help + `<button class="feat" data-dept-go="${d}" style="border:0;text-align:left"><b>${d==="plus"?t("tileB"):d==="acc"?t("d_acc"):t("tileA")}</b><span style="text-decoration:underline;margin-top:8px">${t("shopNow")}</span></button>`;
  $("#mega").classList.add("open");
}
$$("#depts > button").forEach(b => {
  b.addEventListener("mouseenter", () => { clearTimeout(megaTimer); megaFor(b.dataset.dept); });
  b.addEventListener("click", () => { $("#mega").classList.remove("open"); openDept(b.dataset.dept); });
  b.addEventListener("focus", () => megaFor(b.dataset.dept));
});
$("header").addEventListener("mouseleave", () => { megaTimer = setTimeout(() => $("#mega").classList.remove("open"), 120); });
$("#mega").addEventListener("mouseenter", () => clearTimeout(megaTimer));

function buildMobileNav(){
  $("#mList").innerHTML = ["new","her","plus","acc","couples"].concat(hasSale()?["sale"]:[]).map(d =>
    `<button class="it" data-dept-go="${d}" ${d==="sale"?'style="color:var(--rust)"':""}>${t("d_"+d)}<span>›</span></button>` +
    (DEPT_CATS[d] ? DEPT_CATS[d].map(c => `<button class="sub" data-dept-go="${d}" data-cat-go="${c}">${catName(c)}</button>`).join("") : "")
  ).join("") + `<button class="it" data-go="favs">${t("favs")}<span>›</span></button><button class="it" data-go="help">${t("help")}<span>›</span></button><button class="it" data-go="about">${t("about")}<span>›</span></button>`;
}

/* ---------- listing ---------- */
function openDept(d, c, col, so){
  dept = d; cat = c || "all"; fSizes = []; fColors = col ? [col] : []; query = ""; $("#q").value = "";
  if(so){ sort = so; $("#sort").value = so; }
  go("plp");
}
function listFor(){
  let l = shown();
  if(query){ const q = query.toLowerCase(); l = l.filter(p => ["en","fr","es"].some(k => (p.txt[k]?.[0]||"").toLowerCase().includes(q)) || catName(p.cat).toLowerCase().includes(q)); }
  else if(dept === "new") l = l.filter(p => p.isNew);
  else if(dept === "sale") l = l.filter(p => p.was);
  else if(dept !== "couples") l = l.filter(p => p.dept === dept);
  if(cat !== "all") l = l.filter(p => p.cat === cat);
  if(fColors.length) l = l.filter(p => p.colors.some(c => fColors.includes(c)));
  if(fSizes.length) l = l.filter(p => sizesOf(p).some(s => fSizes.includes(s)));
  const s = {rec:(a,b)=>(b.rank||0)-(a.rank||0), low:(a,b)=>a.price-b.price, high:(a,b)=>b.price-a.price, new:(a,b)=>(b.isNew?1:0)-(a.isNew?1:0)||(b.rank||0)-(a.rank||0)};
  return [...l].sort(s[sort]);
}
function renderPLP(){
  const isC = dept === "couples" && !query;
  const title = query ? `"${query}"` : cat !== "all" ? `${catName(cat)}` : t("d_"+dept);
  $("#plpTitle").textContent = title;
  $("#plpCrumb").textContent = query ? t("search") : (cat !== "all" ? `${t("d_"+dept)} / ${catName(cat)}` : t("d_"+dept));
  $("#plpBundles").hidden = !isC;
  $("#plpGrid").hidden = isC;
  $(".fbar").hidden = isC;
  if(isC){ $("#plpCats").innerHTML = ""; $("#plpBundles").innerHTML = BUNDLES.map(bundleHtml).join(""); return; }
  const base = query ? [] : (DEPT_CATS[dept] || [...new Set(shown().filter(p => dept==="new"?p.isNew:dept==="sale"?p.was:true).map(p => p.cat))]);
  $("#plpCats").innerHTML = base.length ? [`<button class="${cat==="all"?"on":""}" data-cat="all">${t("all")}</button>`, ...base.map(c => `<button class="${cat===c?"on":""}" data-cat="${c}">${catName(c)}</button>`)].join("") : "";
  const list = listFor();
  $("#plpCount").textContent = t("items_n",{n:list.length});
  const n = fSizes.length + fColors.length;
  $("#fCount").textContent = n ? `(${n})` : "";
  $("#activeChips").innerHTML = [...fColors.map(c => `<button class="chipx" data-rmc="${c}">${colName(c)} ×</button>`), ...fSizes.map(s => `<button class="chipx" data-rms="${s}">${s} ×</button>`)].join("");
  fill($("#plpGrid"), list, t("items_n",{n:0}));
}
$("#plpCats").addEventListener("click", e => { const b = e.target.closest("[data-cat]"); if(b){ cat = b.dataset.cat; renderPLP(); syncUrl(); updateMeta(); } });
$("#activeChips").addEventListener("click", e => {
  const c = e.target.closest("[data-rmc]"), s = e.target.closest("[data-rms]");
  if(c) fColors = fColors.filter(x => x !== c.dataset.rmc);
  if(s) fSizes = fSizes.filter(x => x !== s.dataset.rms);
  renderPLP();
});
$("#sort").onchange = e => { sort = e.target.value; renderPLP(); };

let tmpS = [], tmpC = [];
function renderFilters(){
  const pool = shown().filter(p => dept==="new"?p.isNew:dept==="sale"?p.was:p.dept===dept);
  const cols = [...new Set(pool.flatMap(p => p.colors))];
  const sizes = [...new Set(pool.flatMap(sizesOf))];
  $("#fBody").innerHTML = `
    <div class="fgroup"><h3>${t("colour")}</h3><div class="opts">${cols.map(c => `<button class="${tmpC.includes(c)?"on":""}" data-fc="${c}"><i style="background:${SW[c]}"></i>${colName(c)}</button>`).join("")}</div></div>
    ${sizes.length ? `<div class="fgroup"><h3>${t("size")}</h3><div class="opts">${sizes.map(s => `<button class="${tmpS.includes(s)?"on":""}" data-fs="${s}">${s}</button>`).join("")}</div></div>` : ""}
    <div class="fgroup"><h3>${t("filter")}</h3><div class="opts">${["rec","new","low","high"].map(k => `<button class="${sort===k?"on":""}" data-fso="${k}">${t("sort_"+k)}</button>`).join("")}</div></div>`;
  const save = [fSizes, fColors]; fSizes = tmpS; fColors = tmpC;
  const n = listFor().length; [fSizes, fColors] = save;
  $("#fApply").textContent = t("showN",{n});
}
$("#fBody").addEventListener("click", e => {
  const c = e.target.closest("[data-fc]"), s = e.target.closest("[data-fs]"), so = e.target.closest("[data-fso]");
  if(c) tmpC = tmpC.includes(c.dataset.fc) ? tmpC.filter(x => x !== c.dataset.fc) : [...tmpC, c.dataset.fc];
  if(s) tmpS = tmpS.includes(s.dataset.fs) ? tmpS.filter(x => x !== s.dataset.fs) : [...tmpS, s.dataset.fs];
  if(so){ sort = so.dataset.fso; $("#sort").value = sort; }
  renderFilters();
});
$("#openFilters").onclick = () => { tmpS = [...fSizes]; tmpC = [...fColors]; renderFilters(); openDrawer("#fDrawer"); };
$("#fClear").onclick = () => { tmpS = []; tmpC = []; renderFilters(); };
$("#fApply").onclick = () => { fSizes = tmpS; fColors = tmpC; closeDrawers(); renderPLP(); };

/* ---------- product page ----------
   Photos: "images" show the product's first colour (or "photoColor").
   Optional "colorImages": {"rust": [...], ...} gives a colour its own photos;
   colours without photos get a plain swatch and a note saying which colour is shown. */
const photoColor = p => p.photoColor || p.colors[0];
const ownPhotos = (p, c) => (p.colorImages && p.colorImages[c] && p.colorImages[c].length) ? p.colorImages[c] : null;
const photosFor = (p, c) => ownPhotos(p, c) || ownPhotos(p, photoColor(p)) || p.images || [];
const hasPhotosOf = (p, c) => !!ownPhotos(p, c) || c === photoColor(p);

function openProduct(id){ current = byId(id); if(!current) return; pColor = current.colors[0]; pSize = null; go("pdp"); }
function renderPDP(){
  const p = current, imgs = p.images || [];
  $("#pdpCrumbs").innerHTML = `<button data-go="home">${t("home")}</button> / <button data-dept-go="${p.dept}">${t("d_"+p.dept)}</button> / <button data-dept-go="${p.dept}" data-cat-go="${p.cat}">${catName(p.cat)}</button>`;
  const photos = photosFor(p, pColor);
  const tag = hasPhotosOf(p, pColor) ? "" : `<span class="phototag">${esc(t("photoTag", {c: colName(photoColor(p)).toLowerCase()}))}</span>`;
  $("#gal").innerHTML = photos.map((src, i) =>
    `<div class="im ${i === 0 ? "full" : ""}"><img src="${esc(src)}" alt="${esc(pName(p))} – ${esc(t("imgN",{i:i+1, n:photos.length}))}" ${i ? 'loading="lazy"' : ""} decoding="async">${tag}</div>`).join("");
  $("#gal").scrollLeft = 0;
  $("#galDots").innerHTML = photos.length > 1 ? photos.map((_, i) => `<i class="${i === 0 ? "on" : ""}"></i>`).join("") : "";
  $("#pName").textContent = pName(p);
  $("#pPrice").innerHTML = priceHtml(p);
  $("#pColName").textContent = colName(pColor);
  $("#pColors").innerHTML = p.colors.map(c => {
    const own = hasPhotosOf(p, c) ? photosFor(p, c)[0] : "";
    return `<button class="${c===pColor?"on":""} ${own ? "ph" : "sw"}" data-col="${c}" aria-label="${esc(colName(c))}" aria-pressed="${c===pColor}">${own ? `<img src="${esc(own)}" alt="" loading="lazy">` : ""}<i style="background:${SW[c]}"></i></button>`;
  }).join("");
  const note = !hasPhotosOf(p, pColor);
  $("#pPhotoNote").hidden = !note;
  if(note) $("#pPhotoNote").textContent = t("photoShows", {c: colName(photoColor(p)).toLowerCase()});
  $("#pBarName").textContent = pName(p);
  $("#pBarPrice").innerHTML = priceHtml(p);
  const sz = sizesOf(p);
  $("#pSizes").innerHTML = sz.map(s => `<button data-size="${s}" class="${s===pSize?"on":""}" ${(p.soldOut||[]).includes(s)?"disabled":""} aria-pressed="${s===pSize}">${s}</button>`).join("");
  const g = GUIDES[p.sk === "crop" || p.sk === "mens" ? "apparel" : p.sk];
  $("#guide").innerHTML = g ? `<table class="gtable"><tr>${g.h.map(h=>`<th>${h}</th>`).join("")}</tr>${g.r.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}</table>` : "";
  $("#guideBtn").hidden = !g;
  const soon = comingSoon(p);
  $("#pAdd").textContent = t(soon ? "b_soon" : "add");
  $("#pAdd").disabled = soon;
  $("#pBarAdd").textContent = t(soon ? "b_soon" : "add");
  $("#pBarAdd").disabled = soon;
  $("#pSizeBox").hidden = soon || !sz.length;
  $("#pErr").textContent = "";
  /* Gelato makes the printed pieces; "pod": false pieces have no supplier yet, so they are
     "Coming soon": no maker, no delivery promise, nothing to add to the bag */
  $("#pStock").textContent = "● " + t(soon ? "b_soon" : "madeToOrder");
  $("#pShip").textContent = t(soon ? "soonNote2" : "shipInfo");
  $("#pStock").style.color = soon ? "var(--muted)" : "var(--ok)";
  $("#pDesc").textContent = pDesc(p);
  $("#pDetails").innerHTML = (p.det || []).map(d => `<li>${esc(d)}</li>`).join("");
  const on = favs.includes(p.id);
  $("#pFav").classList.toggle("on", on); $("#pFav").setAttribute("aria-pressed", on);
  const rel = shown().filter(x => x.id !== p.id && x.cat === p.cat).concat(shown().filter(x => x.id !== p.id && x.cat !== p.cat && x.dept === p.dept)).slice(0,8);
  fill($("#railRel"), rel);
}
$("#pColors").addEventListener("click", e => { const b = e.target.closest("[data-col]"); if(b){ pColor = b.dataset.col; renderPDP(); } });
$("#pSizes").addEventListener("click", e => { const b = e.target.closest("[data-size]"); if(!b || b.disabled) return; pSize = b.dataset.size; $("#pErr").textContent = ""; $$("#pSizes button").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); }); });
$("#guideBtn").onclick = () => $("#guide").hidden = !$("#guide").hidden;
$("#pFav").onclick = () => toggleFav(current.id);
/* phone carousel: dots follow the swipe */
$("#gal").addEventListener("scroll", () => {
  const g = $("#gal"), i = Math.round(g.scrollLeft / Math.max(1, g.clientWidth));
  $$("#galDots i").forEach((d, k) => d.classList.toggle("on", k === i));
}, {passive: true});
/* sticky bar: shown on phones while the main "Add to bag" button is out of view */
if("IntersectionObserver" in window)
  new IntersectionObserver(([e]) => $("#pBar").classList.toggle("show", !e.isIntersecting)).observe($("#pAdd"));
$("#pBarAdd").onclick = () => {
  if(comingSoon(current)) return;
  if(sizesOf(current).length && !pSize){
    $("#pSizes").scrollIntoView({behavior: "smooth", block: "center"});
    $("#pErr").textContent = t("sizeFirst");
    return;
  }
  $("#pAdd").click();
};
$("#pAdd").onclick = () => {
  if(comingSoon(current)) return;
  if(sizesOf(current).length && !pSize){ $("#pErr").textContent = t("sizeFirst"); return; }
  addToBag(current.id, pColor, pSize, 1);
};

/* ---------- bag ----------
   A cart line is either a product {key,id,color,size,qty}
   or a bundle {key,bundle,qty} sold at the bundle price.     */
function addToBag(id, color, size, n){
  if(comingSoon(byId(id))) return;
  const key = [id,color,size||""].join("|");
  const l = cart.find(x => x.key === key);
  if(l) l.qty += n; else cart.push({key,id,color,size,qty:n});
  saveCart(); toast(t("added"));
}
function addBundle(bid){
  const b = bundleById(bid); if(!b || bundleSoon(b)) return;
  const key = "bundle|" + bid;
  const l = cart.find(x => x.key === key);
  if(l) l.qty += 1; else cart.push({key, bundle: bid, qty: 1});
  saveCart(); toast(t("added"));
}
function toggleFav(id){
  favs = favs.includes(id) ? favs.filter(x => x !== id) : [...favs, id];
  store.set("tg_favs", favs); toast(favs.includes(id) ? t("favAdd") : t("favRem")); refresh();
}
const linePrice = l => l.bundle ? (bundleById(l.bundle)?.price || 0) : (byId(l.id)?.price || 0);
const subtotal = () => cart.reduce((s,l) => s + linePrice(l) * l.qty, 0);
function saveCart(){ store.set("tg_cart", cart); counts(); if(view === "bag") renderBag(); if(view === "checkout") renderCheckout(); }
function counts(){
  cart = cart.filter(l => l.bundle ? bundleById(l.bundle) : byId(l.id));
  const n = cart.reduce((s,l)=>s+l.qty,0);
  $("#bagN").hidden = !n; $("#bagN").textContent = n;
  $("#favN").hidden = !favs.length; $("#favN").textContent = favs.length;
}
function bundleMeta(b){
  return [b.hers, b.his].map(id => { const p = byId(id); const sz = sizesOf(p).includes("M") ? ", M" : ""; return `${esc(pName(p))} (${colName(p.colors[0])}${sz})`; }).join("<br>");
}
function lineHtml(l, editable){
  if(l.bundle){
    const b = bundleById(l.bundle), h = byId(b.hers);
    return `<div class="line"><div class="im">${art(h)}</div>
      <div><div style="font-weight:500">${esc(bName(b))}</div><div class="pr" style="margin:2px 0 6px">${eur(b.price)}</div>
        <div class="meta">${bundleMeta(b)}${editable?"":`<br>× ${l.qty}`}</div>
        ${editable ? `<div class="qty"><button data-q="${l.key}" data-d="-1" aria-label="−">−</button><span>${l.qty}</span><button data-q="${l.key}" data-d="1" aria-label="+">+</button></div>` : ""}</div>
      <div style="text-align:right;font-weight:500">${eur(b.price*l.qty)}${editable?`<br><button class="linkb fine" data-rm="${l.key}" style="margin-top:8px">${t("remove")}</button>`:""}</div></div>`;
  }
  const p = byId(l.id);
  return `<div class="line"><button class="im" data-open="${p.id}" style="border:0">${art(p)}</button>
    <div><div style="font-weight:500">${esc(pName(p))}</div><div class="pr" style="margin:2px 0 6px">${priceHtml(p)}</div>
      <div class="meta">${t("colour")}: ${colName(l.color)}${l.size ? `<br>${t("size")}: ${l.size}` : ""}${editable?"":`<br>× ${l.qty}`}</div>
      ${editable ? `<div class="qty"><button data-q="${l.key}" data-d="-1" aria-label="−">−</button><span>${l.qty}</span><button data-q="${l.key}" data-d="1" aria-label="+">+</button></div>` : ""}</div>
    <div style="text-align:right;font-weight:500">${eur(p.price*l.qty)}${editable?`<br><button class="linkb fine" data-rm="${l.key}" style="margin-top:8px">${t("remove")}</button>`:""}</div></div>`;
}
function renderBag(){
  counts();
  const sub = subtotal();
  $("#bagSum").hidden = !cart.length;
  $("#bagLines").innerHTML = cart.length ? cart.map(l => lineHtml(l, true)).join("") :
    `<div class="empty" style="text-align:left;padding:30px 0">${t("bagEmpty")}<br><button class="btn" data-dept-go="her" style="margin-top:16px">${t("startShop")}</button></div>`;
  const left = SHIP.freeFrom - sub;
  $("#prog").innerHTML = `${left > 0 ? t("toFree",{x:`<strong>${eur(left)}</strong>`}) : `<strong>${t("freeOk")}</strong>`}<div class="bar"><i style="width:${Math.min(100, sub/SHIP.freeFrom*100)}%"></i></div>`;
  $("#bSub").textContent = eur(sub); $("#bTot").textContent = eur(sub);
  $("#bagErr").textContent = "";
}
$("#bagLines").addEventListener("click", e => {
  const q = e.target.closest("[data-q]"), r = e.target.closest("[data-rm]");
  if(q){ const l = cart.find(x => x.key === q.dataset.q); l.qty += +q.dataset.d; if(l.qty <= 0) cart = cart.filter(x => x !== l); saveCart(); }
  if(r){ cart = cart.filter(x => x.key !== r.dataset.rm); saveCart(); }
});
$("#toCheckout").onclick = () => { if(!ORDERS_OPEN) return; if(!cart.length){ $("#bagErr").textContent = t("addFirst"); return; } go("checkout"); };

/* ---------- checkout ----------
   Same formula as the server (netlify/functions/lib/pricing.mjs), in cents. */
function totals(){
  const subC = cart.reduce((s,l) => s + Math.round(linePrice(l)*100) * l.qty, 0);
  const discC = Math.round(subC * promo.percent / 100);
  const free = subC - discC >= Math.round(SHIP.freeFrom*100);
  const method = document.querySelector('input[name="ship"]:checked').dataset.method;
  const shipC = free ? 0 : Math.round(SHIP.methods[method]*100);
  return {sub: subC/100, disc: discC/100, ship: shipC/100, total: (subC - discC + shipC)/100, free, method};
}
function renderCheckout(){
  const x = totals();
  $("#coLines").innerHTML = cart.map(l => lineHtml(l, false)).join("");
  $("#s1").textContent = x.free ? t("free") : eur(SHIP.methods.pickup); $("#s2").textContent = x.free ? t("free") : eur(SHIP.methods.home);
  $("#cSub").textContent = eur(x.sub);
  $("#cDiscRow").hidden = !promo.percent; $("#cDisc").textContent = "−" + eur(x.disc);
  $("#cShip").textContent = x.ship ? eur(x.ship) : t("free");
  $("#cTot").textContent = eur(x.total);
}
$$('input[name="ship"]').forEach(r => r.onchange = renderCheckout);

$("#applyCode").onclick = async () => {
  const c = $("#code").value.trim().toUpperCase(), m = $("#codeMsg");
  if(!c){ m.style.color = "var(--err)"; m.textContent = t("codeEmpty"); return; }
  try {
    const r = await fetch("/api/check-promo", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({code: c})});
    const d = await r.json();
    if(d.valid){ promo = {code: c, percent: d.percent}; m.style.color = "var(--ok)"; m.textContent = t("codeOk"); }
    else { promo = {code: "", percent: 0}; m.style.color = "var(--err)"; m.textContent = t("codeBad"); }
  } catch(e){ m.style.color = "var(--err)"; m.textContent = t("formErr"); }
  renderCheckout();
};
$("#code").oninput = () => $("#codeMsg").textContent = "";

const REQ = ["em","ph","fn","ln","ad","zp","ct"];
REQ.forEach(id => $("#"+id).addEventListener("input", () => $("#coErr").textContent = ""));
$("#cgvOk").onchange = () => $("#cgvErr").textContent = "";

$("#pay").onclick = async () => {
  if(!ORDERS_OPEN) return;
  const err = $("#coErr"), miss = REQ.find(id => !$("#"+id).value.trim());
  if(miss){ err.textContent = t("errFields"); $("#"+miss).focus(); return; }
  if(!/^\S+@\S+\.\S+$/.test($("#em").value.trim())){ err.textContent = t("errEmail"); $("#em").focus(); return; }
  if(!/^[0-9A-Za-z -]{4,8}$/.test($("#zp").value.trim())){ err.textContent = t("errZip"); $("#zp").focus(); return; }
  err.textContent = "";
  if(!$("#cgvOk").checked){ $("#cgvErr").textContent = t("errCgv"); $("#cgvOk").focus(); return; }

  const btn = $("#pay"); btn.disabled = true;
  const label = btn.querySelector("span"); const old = label.textContent; label.textContent = t("redirecting");
  const payload = {
    lang,
    items: cart.map(l => l.bundle ? {bundle: l.bundle, qty: l.qty} : {id: l.id, color: l.color, size: l.size || null, qty: l.qty}),
    promo: promo.code,
    shipping: totals().method,
    customer: {
      email: $("#em").value.trim(), phone: $("#ph").value.trim(),
      firstName: $("#fn").value.trim(), lastName: $("#ln").value.trim(),
      address: $("#ad").value.trim(), postcode: $("#zp").value.trim(), city: $("#ct").value.trim(), country: $("#co").value
    },
    acceptedTerms: true
  };
  try {
    const r = await fetch("/api/create-order", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload)});
    const d = await r.json();
    if(!r.ok || !d.checkoutUrl) throw new Error(d.error || "create-order failed");
    store.set("tg_pending", {ref: d.reference, orderId: d.orderId, total: d.total, lines: cart, email: payload.customer.email});
    /* Send the order details to the shop owner (Netlify Forms notification).
       The payment itself is confirmed by Revolut: match the two with the reference. */
    try {
      const c = payload.customer, f = document.forms.order;
      const vals = {reference: d.reference, revolut_order: d.orderId, total: d.total.toFixed(2) + " EUR", items: d.summary,
        shipping: payload.shipping, email: c.email, name: c.firstName + " " + c.lastName, phone: c.phone,
        address: c.address, postcode: c.postcode, city: c.city, country: c.country, lang};
      Object.entries(vals).forEach(([k, v]) => { if(f.elements[k]) f.elements[k].value = v; });
      await postForm(f);
    } catch(e){ /* payment can still go ahead; Revolut keeps the order */ }
    window.location.href = d.checkoutUrl;
  } catch(e){
    err.textContent = t("payErr");
    btn.disabled = false; label.textContent = old;
  }
};

/* ---------- return from Revolut ---------- */
const stepsHtml = lvl => ["paid","prep","shipped","delivered"].map((k,i) => `<div class="${i<lvl?"on":""}"><b>${i<lvl?"✓":i+1}</b>${t(k)}</div>`).join("");
async function handleReturn(){
  const params = new URLSearchParams(location.search);
  if(params.get("checkout") !== "return") return false;
  const pending = store.get("tg_pending", null);
  history.replaceState({}, "", location.pathname);
  go("done");
  $("#doneSteps").innerHTML = ""; $("#doneSum").innerHTML = "";
  if(!pending){ $("#doneMsg").textContent = t("notPaid", {id: "—"}); return true; }
  $("#doneMsg").textContent = t("checking");
  let state = "";
  try {
    const r = await fetch("/api/order-status?id=" + encodeURIComponent(pending.orderId));
    state = (await r.json()).state || "";
  } catch(e){}
  if(state === "completed" || state === "authorised" || state === "processing"){
    $("#doneMsg").textContent = t("doneMsg", {id: pending.ref});
    $("#doneSteps").innerHTML = stepsHtml(1);
    $("#doneSum").innerHTML = pending.lines.map(l => {
      if(l.bundle){ const b = bundleById(l.bundle); return b ? `<div class="row"><span>${l.qty} × ${esc(bName(b))}</span><span>${eur(b.price*l.qty)}</span></div>` : ""; }
      const p = byId(l.id); return p ? `<div class="row"><span>${l.qty} × ${esc(pName(p))} (${colName(l.color)}${l.size?", "+l.size:""})</span><span>${eur(p.price*l.qty)}</span></div>` : "";
    }).join("") + `<div class="row total"><span>${t("paid")}</span><span>${eur(pending.total)}</span></div>`;
    cart = []; promo = {code:"", percent:0}; saveCart(); store.del("tg_pending");
  } else {
    $("#doneMsg").textContent = t("notPaid", {id: pending.ref});
  }
  return true;
}

/* ---------- contact and newsletter (Netlify Forms) ---------- */
const msg = (el, ok, text) => { el.className = ok ? "okt" : "err"; el.textContent = text; };
async function postForm(form){
  const body = new URLSearchParams(new FormData(form)).toString();
  const r = await fetch("/", {method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"}, body});
  if(!r.ok) throw new Error("form " + r.status);
}
$("#contactForm").addEventListener("submit", async e => {
  e.preventDefault();
  const ok = $("#cn").value.trim() && /^\S+@\S+\.\S+$/.test($("#ce").value.trim()) && $("#cm").value.trim();
  if(!ok){ msg($("#cMsg"), false, t("cErr")); return; }
  try { await postForm(e.target); msg($("#cMsg"), true, t("cOk")); e.target.reset(); }
  catch(err){ msg($("#cMsg"), false, t("formErr")); }
});
["cn","ce","cm"].forEach(id => $("#"+id).addEventListener("input", () => $("#cMsg").textContent = ""));
/* Newsletter sign-up: the footer form and the pre-launch page form go to the same list */
[["#newsForm","#nlE","#nlM"], ["#launchForm","#lnE","#lnM"]].forEach(([f, input, out]) => {
  $(f).addEventListener("submit", async e => {
    e.preventDefault();
    if(!/^\S+@\S+\.\S+$/.test($(input).value.trim())){ msg($(out), false, t("errEmail")); return; }
    try { await postForm(e.target); msg($(out), true, t("nlOk")); e.target.reset(); }
    catch(err){ msg($(out), false, t("formErr")); }
  });
  $(input).oninput = () => $(out).textContent = "";
});
$("#lnJoin").onclick = () => { window.scrollTo({top: 0, behavior: "smooth"}); $("#lnE").focus({preventScroll: true}); };

/* ---------- addresses ----------
   Every page has its own address (/her/tops, /product/tee-black, /bag ...), so links can be
   shared, the browser's Back button works and search engines can see each page.
   netlify/functions/page.mjs serves index.html for these addresses with the right title. */
const DEPT_SLUG = {new:"new", her:"her", plus:"plus-one", acc:"accessories", couples:"couples", sale:"sale"};
const VIEW_SLUG = {favs:"favourites", bag:"bag", checkout:"checkout", help:"help", about:"about", collection:"collection"};
const flip = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [v, k]));
const SLUG_DEPT = flip(DEPT_SLUG), SLUG_VIEW = flip(VIEW_SLUG);
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-");
const catsOf = d => DEPT_CATS[d] || [...new Set(products.map(p => p.cat))];
const SITE = (SHOP.siteUrl || location.origin).replace(/\/$/, "");

function pathFor(v){
  if(v === "launch") return "/";
  if(v === "home") return ORDERS_OPEN ? "/" : "/shop";
  if(v === "pdp" && current) return "/product/" + current.id;
  if(v === "plp") return query ? "/search?q=" + encodeURIComponent(query) : "/" + DEPT_SLUG[dept] + (cat !== "all" ? "/" + slug(cat) : "");
  return VIEW_SLUG[v] ? "/" + VIEW_SLUG[v] : "/";
}
function syncUrl(replace){
  const path = pathFor(view);
  if(path !== location.pathname + location.search) history[replace ? "replaceState" : "pushState"](null, "", path);
}
function routeFrom(loc){
  const parts = loc.pathname.split("/").filter(Boolean).map(x => { try { return decodeURIComponent(x); } catch(e){ return x; } });
  const opt = {push: false};
  if(!parts.length) return go("start", opt);
  if(parts[0] === "shop" && parts.length === 1) return go("home", opt);
  if(parts[0] === "product" && parts.length === 2){
    current = byId(parts[1]);
    if(current && current.visible !== false){ pColor = current.colors[0]; pSize = null; return go("pdp", opt); }
    return go("nf", opt);
  }
  if(parts[0] === "search" && parts.length === 1){
    query = (new URLSearchParams(loc.search).get("q") || "").trim(); $("#q").value = query;
    cat = "all"; fSizes = []; fColors = [];
    return go(query ? "plp" : "home", opt);
  }
  const d = SLUG_DEPT[parts[0]];
  if(d && parts.length <= 2 && (d !== "sale" || hasSale())){
    const c = parts[1] ? catsOf(d).find(x => slug(x) === parts[1]) : "all";
    if(c){ dept = d; cat = c; fSizes = []; fColors = []; query = ""; $("#q").value = ""; return go("plp", opt); }
  }
  if(SLUG_VIEW[parts[0]] && parts.length === 1) return go(SLUG_VIEW[parts[0]], opt);
  go("nf", opt);
}
window.addEventListener("popstate", () => routeFrom(location));

/* Title, description and canonical address of the page being shown */
function setMeta(sel, attr, val){ const el = document.querySelector(sel); if(el) el.setAttribute(attr, val); }
function updateMeta(){
  const brand = SHOP.name || "The Girlogist";
  let title = `${brand} · ${t("metaTag")}`, desc = t("metaDesc");
  if(view === "pdp" && current){ title = `${pName(current)} · ${brand}`; desc = pDesc(current); }
  else if(view === "plp"){ const h = query ? `"${query}"` : cat !== "all" ? `${catName(cat)} · ${t("d_"+dept)}` : t("d_"+dept); title = `${h} · ${brand}`; }
  else if(view === "nf") title = `${t("nfT")} · ${brand}`;
  else if(view === "home" && !ORDERS_OPEN) title = `${t("shop")} · ${brand}`;
  else if(VIEW_SLUG[view]){ title = `${t({favs:"favs", bag:"bag", checkout:"checkout", help:"help", about:"about", collection:"collection"}[view])} · ${brand}`; if(view === "collection") desc = t("colIntro"); }
  document.title = title;
  const url = SITE + pathFor(view);
  setMeta('meta[name="description"]', "content", desc);
  setMeta('link[rel="canonical"]', "href", url);
  setMeta('meta[property="og:title"]', "content", title);
  setMeta('meta[property="og:description"]', "content", desc);
  setMeta('meta[property="og:url"]', "content", url);
}

/* ---------- routing ---------- */
const VIEWS = ["launch","home","plp","pdp","favs","bag","checkout","done","help","about","collection","nf"];
function go(v, opt = {}){
  if(v === "start") v = ORDERS_OPEN ? "home" : "launch";   /* the logo and the address "/" */
  if(v === "checkout" && (!cart.length || !ORDERS_OPEN)) v = "bag";
  view = v;
  VIEWS.forEach(x => $("#v-"+x).hidden = x !== v);
  $$("#depts > button").forEach(b => b.classList.toggle("on", (v === "plp" && !query && b.dataset.dept === dept) || (v === "pdp" && current && b.dataset.dept === current.dept)));
  $("#mega").classList.remove("open");
  closeDrawers();
  refresh();
  /* following a link adds a history entry; arriving from an address or Back/Forward
     keeps the entry and only tidies the address (e.g. /checkout -> /bag) */
  if(v !== "done") syncUrl(opt.push === false);
  window.scrollTo(0,0);
}
function refresh(){
  counts();
  if(view === "home"){
    fill($("#railNew"), shown().filter(p => p.isNew));
    fill($("#gridBest"), [...shown()].sort((a,b)=>(b.rank||0)-(a.rank||0)).slice(0,8));
    $("#homeBundles").innerHTML = BUNDLES.map(bundleHtml).join("");
  }
  if(view === "launch") fill($("#railLaunch"), [...shown()].sort((a,b)=>(b.rank||0)-(a.rank||0)).slice(0,8));
  if(view === "collection") renderCollection();
  if(view === "plp") renderPLP();
  if(view === "pdp" && current) renderPDP();
  if(view === "favs") fill($("#favGrid"), favs.map(byId).filter(Boolean), t("favsEmpty"));
  if(view === "bag") renderBag();
  if(view === "checkout") renderCheckout();
  updateMeta();
}
document.addEventListener("click", e => {
  const fav = e.target.closest("[data-fav]"); if(fav){ e.preventDefault(); toggleFav(fav.dataset.fav); return; }
  const op = e.target.closest("[data-open]"); if(op){ openProduct(op.dataset.open); return; }
  const bu = e.target.closest("[data-bundle]"); if(bu){ addBundle(bu.dataset.bundle); return; }
  const dg = e.target.closest("[data-dept-go]"); if(dg){ openDept(dg.dataset.deptGo, dg.dataset.catGo, dg.dataset.colGo, dg.dataset.sortGo); return; }
  const g = e.target.closest("[data-go]"); if(g){ e.preventDefault(); go(g.dataset.go); return; }
  if(e.target.closest("[data-close]") || e.target === $("#overlay")) closeDrawers();
});
function openDrawer(sel){ $(sel).classList.add("open"); $(sel).setAttribute("aria-hidden","false"); $("#overlay").classList.add("open"); }
function closeDrawers(){ $$(".drawer").forEach(d => { d.classList.remove("open"); d.setAttribute("aria-hidden","true"); }); $("#overlay").classList.remove("open"); }
$("#menuBtn").onclick = () => openDrawer("#mDrawer");
document.addEventListener("keydown", e => { if(e.key === "Escape"){ closeDrawers(); $("#mega").classList.remove("open"); } });
function doSearch(v){ query = v.trim(); if(!query){ if(view === "plp"){ renderPLP(); syncUrl(true); updateMeta(); } return; } cat = "all"; fSizes = []; fColors = []; if(view !== "plp") go("plp"); else { renderPLP(); syncUrl(true); updateMeta(); } }
$("#q").addEventListener("input", e => doSearch(e.target.value));
$("#mq").addEventListener("keydown", e => { if(e.key === "Enter"){ $("#q").value = e.target.value; doSearch(e.target.value); closeDrawers(); } });

let tt;
function toast(m){ const el = $("#toast"); el.textContent = m; el.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => el.classList.remove("show"), 2000); }

/* ship radio buttons carry a method name; prices come from the catalogue */
$$('input[name="ship"]').forEach((r, i) => { r.dataset.method = i === 0 ? "pickup" : "home"; r.value = r.dataset.method; });

/* Orders closed: no checkout, no payment logos, "opening soon" wording */
if(!ORDERS_OPEN){
  $(".promo").dataset.t = "promoSoon";
  const b = $("#toCheckout"); b.dataset.t = "soonBtn"; b.disabled = true;
  b.insertAdjacentHTML("afterend", '<p class="fine" data-t="soonNote" style="margin-top:10px"></p>');
  $$(".pays").forEach(el => el.hidden = true);
}

$$('[data-dept="sale"], [data-dept-go="sale"]').forEach(el => el.hidden = !hasSale());

applyLang();
if(!(await handleReturn())) routeFrom(location);
})();
