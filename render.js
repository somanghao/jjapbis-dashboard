/* render.js — 짭비스 대시보드 렌더 엔진 (단방향: data.json → DOM)
 *
 * 데이터는 data.json 에서만 읽는다. 마크업(클래스 계약)은 스킨과 무관하게 고정.
 * 스킨 CSS 는 아래 클래스들만 스타일링하면 된다 (스킨 추가 = CSS 1장):
 *   레이아웃  .dash > .dash-top(.dash-brand .dash-gen .skin-switch) .tabbar .panels
 *   탭        .tab[data-tab].is-active  / .tab-ico .tab-badge
 *   패널/카드  .panel[data-panel].is-active  .card[data-card] > .card-head(.card-title .card-count) .card-body
 *   서비스    .svc-strip > .svc-chip(.is-on/.is-off)[data-svc] > .svc-dot .svc-label
 *   행        .row > .row-when .row-text   / .sec-h / .empty
 *   아이디어  .idea > .idea-name .idea-desc
 *   대화      .chat-line(.is-user/.is-bot) > .chat-who .chat-when .chat-msg
 *   태그      .tag
 *   스킨버튼  .skin-btn[data-skin].is-active
 */
(function () {
  "use strict";

  var SKINS = [
    { id: "white1", name: "화이트·미니멀" },
    { id: "white2", name: "화이트·소프트" },
    { id: "white3", name: "화이트·매거진" },
    { id: "cyber", name: "사이버펑크" },
    { id: "webtoon", name: "웹툰" },
  ];
  var TABS = [
    { id: "overview", ico: "🏠" },
    { id: "alarm", ico: "⏰" },
    { id: "todo", ico: "✅" },
    { id: "idea", ico: "💡" },
    { id: "pl", ico: "📋" },
    { id: "makenovel", ico: "📖" },
  ];

  function ls(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); }
    catch (e) { return null; }
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function empty(msg) { return '<div class="empty">' + esc(msg || "없음") + "</div>"; }

  /* ---- 카드 빌더들 (HTML 문자열) ---- */
  function cardHTML(id, title, count, bodyHTML) {
    var c = (count === "" || count == null) ? "" : '<span class="card-count">' + esc(count) + "</span>";
    return '<article class="card" data-card="' + id + '">' +
      '<header class="card-head"><span class="card-title">' + esc(title) + "</span>" + c + "</header>" +
      '<div class="card-body">' + bodyHTML + "</div></article>";
  }
  function rows(list, fn) { return list && list.length ? list.map(fn).join("") : empty("없음"); }

  function remRows(list, emptyMsg) {
    if (!list || !list.length) return empty(emptyMsg || "없음");
    return list.map(function (r) {
      return '<div class="row"><div class="row-when">' + esc(r.when) + " · " + esc(r.rel) +
        '</div><div class="row-text">' + esc(r.text) + "</div></div>";
    }).join("");
  }
  function ideaRows(list) {
    if (!list || !list.length) return empty("오늘자 없음");
    return list.map(function (i) {
      return '<div class="idea"><div class="idea-name">' + esc(i.name) +
        '</div><div class="idea-desc">' + esc(i.desc) + "</div></div>";
    }).join("");
  }
  function sectionRows(sections) {
    if (!sections || !sections.length) return empty("없음");
    return sections.map(function (s) {
      var items = (s.items && s.items.length)
        ? s.items.map(function (it) { return '<div class="row"><div class="row-text">' + esc(it) + "</div></div>"; }).join("")
        : '<div class="sub">— 비어있음</div>';
      return '<div class="sec-h">' + esc(s.section) + "</div>" + items;
    }).join("");
  }
  function chatRows(list) {
    if (!list || !list.length) return empty("오늘 대화 없음");
    return list.map(function (c) {
      var who = c.who === "사용자" ? "is-user" : "is-bot";
      return '<div class="chat-line ' + who + '"><span class="chat-who">' + esc(c.who) +
        '</span><span class="chat-when">' + esc(c.ts) + '</span><div class="chat-msg">' + esc(c.msg) + "</div></div>";
    }).join("");
  }
  function svcStrip(services) {
    return '<div class="svc-strip">' + services.map(function (s) {
      var on = s.state === "active";
      return '<div class="svc-chip ' + (on ? "is-on" : "is-off") + '" data-svc="' + s.key +
        '" title="' + esc(s.detail || s.state) + '"><span class="svc-dot"></span>' +
        '<span class="svc-label">' + esc(s.label) + "</span></div>";
    }).join("") + "</div>";
  }

  /* ---- 패널 빌더 ---- */
  function buildPanels(d) {
    var P = {};
    P.overview = svcStrip(d.services) +
      cardHTML("imminent", "⏰ 임박 알림", d.imminent.length, remRows(d.imminent, "임박한 알림 없음")) +
      cardHTML("today_memo", "📝 오늘 메모", d.today_memos.length,
        rows(d.today_memos, function (x) { return '<div class="row"><div class="row-text">' + esc(x) + "</div></div>"; }) === empty("없음")
          ? empty("오늘자 없음") : rows(d.today_memos, function (x) { return '<div class="row"><div class="row-text">' + esc(x) + "</div></div>"; })) +
      cardHTML("today_idea", "💡 오늘 아이디어", d.today_ideas.length, ideaRows(d.today_ideas)) +
      cardHTML("chat", "💬 오늘 대화", d.chat.length, chatRows(d.chat));

    P.alarm = cardHTML("reminders", "⏰ 예정 알림 (내가 보낸)", d.reminders.length, remRows(d.reminders, "예정 알림 없음")) +
      cardHTML("crons", "🔁 정기 브리핑", d.crons.length,
        rows(d.crons, function (c) {
          return '<div class="row"><div class="row-when">' + esc(c.when) + " · " + esc(c.rel) +
            '</div><div class="row-text">' + esc(c.name) + "</div></div>";
        }));

    P.todo = cardHTML("todos", "✅ 할일 / 메모", todoCount(d), sectionRows(d.todos)) +
      cardHTML("open", "📌 오픈 항목", "", sectionRows(d.open_items));

    P.idea = cardHTML("ideas", "💡 아이디어", d.ideas.length,
      d.ideas.length ? d.ideas.map(function (i) {
        return '<div class="idea"><div class="idea-name">' + esc(i.name) + '</div><div class="idea-desc">' + esc(i.desc) + "</div></div>";
      }).join("") : empty("없음"));

    var mn = d.makenovel || { todo: [], in_progress: [], done: [], available: false };
    function mnRows(list) {
      if (!list || !list.length) return empty("없음");
      return list.map(function (t) {
        var tag = t.status ? ' <span class="tag">' + esc(t.status) + "</span>" : "";
        return '<div class="row"><div class="row-when">' + esc(t.id) +
          '</div><div class="row-text">' + esc(t.title) + tag + "</div></div>";
      }).join("");
    }
    function mnShowcaseHTML() {
      var url = (d.makenovel && d.makenovel.showcase_url) || "https://makenovel.vercel.app/design-showcase";
      var variants = [
        { id: "webnovel", label: "📜 웹소설", bg: "#0f172a" },
        { id: "fairytale", label: "✨ 동화", bg: "#f43f5e" },
        { id: "game", label: "🎮 게임", bg: "#7c3aed" }
      ];
      var sep = url.indexOf("?") >= 0 ? "&" : "?";
      var chips = variants.map(function (v) {
        return '<a href="' + esc(url + sep + "v=" + v.id) + '" target="_blank" rel="noopener" ' +
          'style="flex:1 1 90px;text-align:center;text-decoration:none;color:#fff;font-weight:700;' +
          'font-size:13px;padding:10px 8px;border-radius:10px;background:' + v.bg + ';' +
          'box-shadow:0 2px 8px rgba(0,0,0,.18)">' + esc(v.label) + ' →</a>';
      }).join("");
      return '<a href="' + esc(url) + '" target="_blank" rel="noopener" ' +
        'style="display:flex;align-items:center;gap:10px;text-decoration:none;padding:12px 14px;' +
        'border-radius:12px;background:linear-gradient(135deg,#7048e8,#e64980);color:#fff;' +
        'font-weight:700;font-size:14px;box-shadow:0 4px 14px rgba(112,72,232,.32)">' +
        '<span style="font-size:18px">🎨</span>' +
        '<span>웹소설 · 동화 · 게임 시안 3종 한눈에 보기 →</span></a>' +
        '<div style="margin-top:9px;display:flex;flex-wrap:wrap;gap:8px">' + chips + '</div>';
    }
    P.makenovel = (mn.available ? "" : '<div class="empty">협업 STATE.json 미연결</div>') +
      cardHTML("mn_showcase", "🎨 메인 시안 3종", "", mnShowcaseHTML()) +
      cardHTML("mn_prog", "🔄 진행중", mn.in_progress.length, mnRows(mn.in_progress)) +
      cardHTML("mn_todo", "📋 할일", mn.todo.length, mnRows(mn.todo)) +
      cardHTML("mn_done", "✅ 한일", mn.done.length, mnRows(mn.done));

    var pl = d.pl || { done: [], todo: [], feedback: [], missed: [], next: [] };
    function plRows(list, label) {
      if (!list || !list.length) return '<div class="sub">— ' + esc(label) + ' 없음</div>';
      return list.map(function (it) { return '<div class="row"><div class="row-text">' + esc(it) + "</div></div>"; }).join("");
    }
    P.pl = cardHTML("pl_done", "✅ 잘한 일", pl.done.length, plRows(pl.done, "잘한 일")) +
      cardHTML("pl_todo", "📋 해야 할 일", pl.todo.length, plRows(pl.todo, "해야 할 일")) +
      cardHTML("pl_feedback", "⚠️ 지적당한 점", pl.feedback.length, plRows(pl.feedback, "지적")) +
      cardHTML("pl_missed", "❌ 못한 일", pl.missed.length, plRows(pl.missed, "못한 일")) +
      cardHTML("pl_next", "🎯 내일 할 일", pl.next.length, plRows(pl.next, "내일"));
    return P;
  }
  function todoCount(d) { var n = 0; d.todos.forEach(function (s) { n += s.items.length; }); return n; }
  function tabBadge(d, id) {
    if (id === "alarm") return d.reminders.length;
    if (id === "todo") return todoCount(d);
    if (id === "idea") return d.ideas.length;
    if (id === "makenovel") { var m = d.makenovel || { todo: [], in_progress: [] }; return (m.todo.length + m.in_progress.length) || ""; }
    return "";
  }

  /* ---- 전체 셸 빌드 ---- */
  function buildShell(d) {
    var skinOpts = SKINS.map(function (s) {
      return '<button class="skin-opt" data-skin="' + s.id + '">' + esc(s.name) + "</button>";
    }).join("");
    var tabs = TABS.map(function (t) {
      var b = tabBadge(d, t.id);
      var badge = b === "" ? "" : '<span class="tab-badge">' + esc(b) + "</span>";
      return '<button class="tab" data-tab="' + t.id + '"><span class="tab-ico">' + t.ico + "</span>" + badge + "</button>";
    }).join("");
    var panels = TABS.map(function (t) {
      return '<section class="panel" data-panel="' + t.id + '">' + (window.__P[t.id] || "") + "</section>";
    }).join("");

    return '<div class="dash">' +
      '<header class="dash-top"><div class="dash-brand">🤖 짭비스</div>' +
      '<div class="dash-gen">' + esc(d.generated_short) + " 갱신</div>" +
      '<div class="skin-pick"><button class="skin-toggle" id="skinToggle" title="스킨 전환" aria-label="스킨 전환">🎨</button>' +
      '<div class="skin-menu" id="skinMenu">' + skinOpts + "</div></div>" +
      '</header>' +
      '<nav class="tabbar">' + tabs + "</nav>" +
      '<main class="panels">' + panels + "</main></div>";
  }

  /* ---- 상호작용 ---- */
  function activateTab(id) {
    var t, p, i, ts = document.querySelectorAll(".tab"), ps = document.querySelectorAll(".panel");
    for (i = 0; i < ts.length; i++) ts[i].classList.toggle("is-active", ts[i].dataset.tab === id);
    for (i = 0; i < ps.length; i++) ps[i].classList.toggle("is-active", ps[i].dataset.panel === id);
    ls("jjtab", id);
  }
  function applySkin(id) {
    if (!SKINS.some(function (s) { return s.id === id; })) id = SKINS[0].id;
    document.getElementById("skin-css").setAttribute("href", "skins/" + id + ".css?ts=" + Date.now());
    document.body.className = "skin-" + id;
    var bs = document.querySelectorAll(".skin-opt"), i;
    for (i = 0; i < bs.length; i++) bs[i].classList.toggle("is-active", bs[i].dataset.skin === id);
    ls("jjskin", id);
  }
  function wire() {
    document.querySelector(".tabbar").addEventListener("click", function (e) {
      var b = e.target.closest(".tab"); if (b) activateTab(b.dataset.tab);
    });
    var toggle = document.getElementById("skinToggle");
    var menu = document.getElementById("skinMenu");
    if (toggle && menu) {
      toggle.addEventListener("click", function (e) { e.stopPropagation(); menu.classList.toggle("open"); });
      menu.addEventListener("click", function (e) {
        var b = e.target.closest(".skin-opt");
        if (b) { applySkin(b.dataset.skin); menu.classList.remove("open"); }
      });
      document.addEventListener("click", function () { menu.classList.remove("open"); });
    }
  }

  function paint(d) {
    window.__P = buildPanels(d);
    document.getElementById("app").innerHTML = buildShell(d);
    wire();
    activateTab(ls("jjtab") || "overview");
    applySkin(ls("jjskin") || "webtoon");
  }

  function load() {
    fetch("data.json?ts=" + Date.now()).then(function (r) { return r.json(); })
      .then(paint)
      .catch(function (e) {
        document.getElementById("app").innerHTML = '<div class="loading">data.json 로드 실패: ' + esc(e) + "</div>";
      });
  }

  load();
  setInterval(load, 60000); // 단방향 자동 갱신 (data.json 재요청)
})();
