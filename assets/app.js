/* 408计组带学站 全站脚本：主题、字号、侧栏、进度、打卡、搜索 */
(function () {
  "use strict";
  var doc = document, body = doc.body, root = doc.documentElement;
  var rootPrefix = (body.dataset.root || "") + "";           // 当前页到站点根的相对前缀
  var pageId = body.dataset.page || "";                       // 如 "ch1/s-12.html"，首页为 "index"

  /* ---------- 主题 ---------- */
  function applyTheme(t) {
    root.setAttribute("data-theme", t);
    var btn = doc.getElementById("themeBtn");
    if (btn) btn.textContent = t === "dark" ? "☀️" : "🌙";
  }
  var savedTheme = null;
  try { savedTheme = localStorage.getItem("coa-theme"); } catch (e) {}
  applyTheme(savedTheme || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  var themeBtn = doc.getElementById("themeBtn");
  if (themeBtn) themeBtn.addEventListener("click", function () {
    var cur = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(cur);
    try { localStorage.setItem("coa-theme", cur); } catch (e) {}
  });

  /* ---------- 字号 ---------- */
  var STEPS = [15, 16, 17, 18, 19, 21];
  function applyFont(i) {
    i = Math.max(0, Math.min(STEPS.length - 1, i));
    root.style.fontSize = STEPS[i] + "px";
    try { localStorage.setItem("coa-font", String(i)); } catch (e) {}
    return i;
  }
  var fontIdx = 1;
  try { fontIdx = parseInt(localStorage.getItem("coa-font") || "1", 10) || 1; } catch (e) {}
  applyFont(fontIdx);
  function bindFont(id, delta) {
    var b = doc.getElementById(id);
    if (b) b.addEventListener("click", function () {
      var cur = STEPS.indexOf(parseInt(root.style.fontSize, 10));
      applyFont((cur < 0 ? 1 : cur) + delta);
    });
  }
  bindFont("fontMinus", -1);
  bindFont("fontPlus", 1);

  /* ---------- 移动端侧栏 ---------- */
  var menuBtn = doc.getElementById("menuBtn");
  if (menuBtn) menuBtn.addEventListener("click", function () { body.classList.toggle("side-open"); });
  var backdrop = doc.querySelector(".side-backdrop");
  if (backdrop) backdrop.addEventListener("click", function () { body.classList.remove("side-open"); });

  /* ---------- 侧栏展开/收起 ---------- */
  var expanded = {};
  try { expanded = JSON.parse(localStorage.getItem("coa-exp") || "{}"); } catch (e) {}
  doc.querySelectorAll(".side-item.side-ch").forEach(function (row) {
    var ch = row.dataset.ch;
    var sub = row.nextElementSibling;
    var isCurrent = pageId.indexOf("ch" + ch + "/") === 0;
    if (expanded[ch] || isCurrent) { row.classList.add("expanded"); if (sub) sub.style.display = "block"; }
    var arrow = row.querySelector(".side-arrow");
    if (arrow) arrow.addEventListener("click", function (ev) {
      ev.preventDefault();
      var open = !row.classList.contains("expanded");
      row.classList.toggle("expanded", open);
      if (sub) sub.style.display = open ? "block" : "none";
      expanded[ch] = open;
      try { localStorage.setItem("coa-exp", JSON.stringify(expanded)); } catch (e) {}
    });
  });

  /* ---------- 已学进度（自动记录浏览过的页面） ---------- */
  var visited = [];
  try { visited = JSON.parse(localStorage.getItem("coa-visited") || "[]"); } catch (e) {}
  if (pageId && pageId !== "index" && visited.indexOf(pageId) < 0) {
    visited.push(pageId);
    try { localStorage.setItem("coa-visited", JSON.stringify(visited)); } catch (e) {}
  }
  var vset = {};
  visited.forEach(function (p) { vset[p] = 1; });
  var groupCount = {};
  doc.querySelectorAll(".side-sub a[data-page-id]").forEach(function (a) {
    var pid = a.dataset.pageId;
    if (vset[pid]) a.classList.add("visited");
    var g = a.dataset.group || "g1";
    groupCount[g] = groupCount[g] || { n: 0, t: 0 };
    groupCount[g].t++;
    if (vset[pid]) groupCount[g].n++;
  });
  doc.querySelectorAll("[data-counter-group]").forEach(function (el) {
    var c = groupCount[el.dataset.counterGroup];
    if (c) el.textContent = "已学 " + c.n + "/" + c.t;
  });

  /* ---------- 首页打卡 ---------- */
  var ciBtn = doc.getElementById("checkinBtn");
  if (ciBtn) {
    var KEY = "coa-checkin";
    var load = function () { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; } };
    var save = function (a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} };
    var ymd = function (d) {
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    };
    var render = function () {
      var dates = load(), today = ymd(new Date());
      var has = dates.indexOf(today) >= 0;
      var set = {}; dates.forEach(function (d) { set[d] = 1; });
      var streak = 0, d = new Date();
      if (!set[ymd(d)]) d.setDate(d.getDate() - 1);   // 今天未打卡则从昨天起算连续
      while (set[ymd(d)]) { streak++; d.setDate(d.getDate() - 1); }
      ciBtn.textContent = has ? "✅ 今日已打卡" : "✅ 今日打卡";
      ciBtn.classList.toggle("done", has);
      var s1 = doc.getElementById("ciStreak"), s2 = doc.getElementById("ciTotal");
      if (s1) s1.textContent = streak;
      if (s2) s2.textContent = dates.length;
    };
    ciBtn.addEventListener("click", function () {
      var dates = load(), today = ymd(new Date());
      if (dates.indexOf(today) < 0) { dates.push(today); save(dates); }
      render();
    });
    render();
  }

  /* ---------- 搜索 ---------- */
  var box = doc.getElementById("searchBox"), list = doc.getElementById("searchResults");
  if (box && list) {
    var INDEX = null, sel = -1, items = [];
    var openList = function () { list.classList.add("open"); };
    var closeList = function () { list.classList.remove("open"); sel = -1; };
    var ensureIndex = function () {
      if (INDEX) return Promise.resolve(INDEX);
      return fetch(rootPrefix + "search-index.json?v=2").then(function (r) { return r.json(); })
        .then(function (d) { INDEX = d; return d; }).catch(function () { INDEX = []; });
    };
    var renderResults = function (q) {
      items = [];
      var qq = q.trim().toLowerCase();
      if (!qq) { closeList(); return; }
      var hits = [];
      INDEX.forEach(function (e) {
        var hay = (e.t + " " + (e.h || []).join(" ") + " " + (e.x || "")).toLowerCase();
        if (hay.indexOf(qq) >= 0) hits.push(e);
      });
      hits = hits.slice(0, 8);
      var html = "";
      if (!hits.length) html = '<li class="none">没有匹配的内容</li>';
      hits.forEach(function (e) {
        var snip = "";
        var xl = (e.x || "").toLowerCase();
        var pos = xl.indexOf(qq);
        if (pos >= 0) {
          var s = Math.max(0, pos - 22);
          snip = "…" + e.x.slice(s, pos + qq.length + 34) + "…";
        } else {
          snip = (e.h || []).filter(function (h) { return h.toLowerCase().indexOf(qq) >= 0; })[0] || "";
        }
        html += '<li><a href="' + rootPrefix + e.u + '"><div class="r-t">' + e.t +
                '</div>' + (snip ? '<div class="r-h">' + snip + "</div>" : "") + "</a></li>";
      });
      list.innerHTML = html;
      sel = -1;
      openList();
    };
    box.addEventListener("input", function () { ensureIndex().then(function () { renderResults(box.value); }); });
    box.addEventListener("focus", function () { ensureIndex().then(function () { renderResults(box.value); }); });
    box.addEventListener("keydown", function (ev) {
      var rows = list.querySelectorAll("a");
      if (ev.key === "Escape") { closeList(); return; }
      if (ev.key === "Enter") { (sel >= 0 && rows[sel]) ? rows[sel].click() : (rows[0] && rows[0].click()); return; }
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        if (!rows.length) return;
        ev.preventDefault();
        sel = ev.key === "ArrowDown" ? Math.min(rows.length - 1, sel + 1) : Math.max(0, sel - 1);
        rows.forEach(function (r, i) { r.classList.toggle("sel", i === sel); });
      }
    });
    doc.addEventListener("click", function (ev) {
      if (!box.contains(ev.target) && !list.contains(ev.target)) closeList();
    });
  }
})();
