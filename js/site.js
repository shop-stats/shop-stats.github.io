// Shared by every page: header and menu, theme, data loading, footer and small rendering helpers.
// Each page script calls App.Site.init(render) with its own render(summary) function.
(function (App) {
  'use strict';

  App.PAGES = [
    { id: 'overview',  href: 'index.html',              name: 'Overview' },
    { id: 'survey',    href: 'survey.html',             name: 'About you' },
    { id: 'groups',    href: 'food-groups.html',        name: 'Food groups' },
    { id: 'types',     href: 'snacks-ingredients.html', name: 'Snacks vs ingredients' },
    { id: 'trends',    href: 'spending-over-time.html', name: 'Spending over time' },
    { id: 'top',       href: 'top-items.html',          name: 'Top items' },
    { id: 'prices',    href: 'price-trends.html',       name: 'Price trends' },
    { id: 'list',      href: 'shopping-list.html',      name: 'Shopping list' },
    { id: 'nutrition', href: 'nutrition.html',          name: 'Nutrition' },
    { id: 'diet',      href: 'diet-check.html',         name: 'Diet check' }
  ];

  var UPLOAD_KEY = 'tesco-upload';
  var EXAMPLE_KEY = 'tesco-use-example';
  var THEME_KEY = 'tesco-theme';
  var THEMES = ['auto', 'light', 'dark'];

  // ---------- Helpers shared by page scripts ----------

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtDate(d) {
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function round(v) { return Math.round(v).toLocaleString('en-GB'); }

  function fmtNum(v, dp) {
    return Number(v).toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }

  function groupName(id) {
    var all = App.GROUPS.concat([App.NONFOOD, App.UNCLASSIFIED]);
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i].name;
    return id;
  }

  function areaName(id) {
    var a = (App.NONFOOD_AREAS || []).filter(function (x) { return x.id === id; })[0];
    return a ? a.name : 'Non-food';
  }

  // A product's category for display: its food group, or for household items "Area · smaller category".
  function categoryLabel(p) {
    if (p.group === 'nonfood') return areaName(p.area) + (p.sub && p.sub !== areaName(p.area) ? ' · ' + p.sub : '');
    if (p.group === 'unclassified') return 'Unclassified';
    return groupName(p.group);
  }

  function swatch(id, kind) {
    var v = kind === 'type' ? '--t-' + id : '--g-' + id;
    return '<span class="swatch" style="background:var(' + v + ')"></span>';
  }

  function groupsBySpend(s) {
    return App.GROUPS.slice().sort(function (a, b) { return s.byGroup[b.id].spend - s.byGroup[a.id].spend; });
  }

  function listText(xs) {
    return xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];
  }

  function topList(title, items, valueFn, headSwatch) {
    var body = items.length
      ? '<ol>' + items.map(function (p) {
          var tag = p.group && p.group !== 'unclassified'
            ? swatch(p.group) + esc(categoryLabel(p)) : 'Unclassified';
          var badge = p.bulkQty ? '<span class="badge" title="Long-life item bought in an amount that lasts weeks">Bulk</span>' : '';
          return '<li><span class="name">' + esc(p.name) + badge + '<small>' + tag + '</small></span>' +
            '<span class="val">' + valueFn(p) + '</span></li>';
        }).join('') + '</ol>'
      : '<p class="empty">Nothing in this category.</p>';
    return '<div class="top-list"><h3>' + (headSwatch || '') + esc(title) + '</h3>' + body + '</div>';
  }

  function notice(html) {
    var el = $('notice');
    if (!el) return;
    el.innerHTML = html || '';
    el.hidden = !html;
  }

  App.UI = {
    $: $, esc: esc, fmtDate: fmtDate, round: round, fmtNum: fmtNum, groupName: groupName, swatch: swatch,
    areaName: areaName, categoryLabel: categoryLabel,
    groupsBySpend: groupsBySpend, listText: listText, topList: topList, notice: notice,
    gbp: App.Charts.gbp, pct: App.Charts.pct
  };

  // ---------- Header & menu ----------

  function renderHeader() {
    var current = document.body.getAttribute('data-page') || 'overview'; // the published home page has no body attribute
    var links = App.PAGES.map(function (p) {
      return '<li><a href="' + p.href + '"' + (p.id === current ? ' aria-current="page"' : '') + '>' + esc(p.name) + '</a></li>';
    }).join('');

    var header = $('site-header');
    header.className = 'site-header';
    header.innerHTML =
      '<div class="wrap header-top">' +
        '<a class="brand" href="index.html">' +
          '<span class="eyebrow">Tesco purchase history</span>' +
          '<span class="brand-name">Spending &amp; nutrition summary</span>' +
        '</a>' +
        '<div class="header-actions">' +
          '<span class="period" id="period">Loading…</span>' +
          '<label class="btn btn-small" for="file-input">Load your file</label>' +
          '<input type="file" id="file-input" accept=".json,application/json" hidden>' +
          '<button class="btn btn-ghost btn-small" id="theme-toggle" type="button" aria-label="Switch colour theme">Theme: auto</button>' +
          '<a class="btn btn-ghost btn-small account-link" id="account-link" href="account.html"' +
            (current === 'account' ? ' aria-current="page"' : '') + '>Sign in</a>' +
          '<button class="btn btn-ghost btn-small menu-toggle" id="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button>' +
        '</div>' +
      '</div>' +
      '<nav class="site-nav" id="site-nav" aria-label="Pages"><div class="wrap"><ul>' + links + '</ul></div></nav>';

    // Account link: "Sign in", or the signed-in email.
    if (App.Account && App.Account.status() !== 'off') {
      App.Account.onChange(function (st) {
        var link = $('account-link');
        if (!link) return;
        var email = st.user && st.user.email;
        link.textContent = email ? email : 'Sign in';
        link.title = email ? 'Your account and saved files' : 'Sign in to save files to your account';
      });
    } else {
      $('account-link').textContent = 'Account';
    }

    $('menu-toggle').addEventListener('click', function () {
      var open = header.classList.toggle('menu-open');
      this.setAttribute('aria-expanded', String(open));
    });
  }

  // ---------- Theme ----------

  var theme = 'auto';
  try { theme = localStorage.getItem(THEME_KEY) || 'auto'; } catch (e) { /* storage unavailable */ }

  function applyTheme() {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    var btn = $('theme-toggle');
    if (btn) btn.textContent = 'Theme: ' + theme;
  }

  // ---------- Data ----------

  // The user's file is parsed in the browser and a compact copy is kept in localStorage so every page
  // shows the same data. The bundled example (data/purchases.js) is only used when the user asks for it.
  function readUpload() {
    try { return JSON.parse(localStorage.getItem(UPLOAD_KEY) || 'null'); } catch (e) { return null; }
  }

  function exampleChosen() {
    try { return localStorage.getItem(EXAMPLE_KEY) === '1'; } catch (e) { return false; }
  }

  function setExample(on) {
    try {
      if (on) localStorage.setItem(EXAMPLE_KEY, '1'); else localStorage.removeItem(EXAMPLE_KEY);
    } catch (e) { /* storage unavailable */ }
  }

  function clearUpload() {
    try { localStorage.removeItem(UPLOAD_KEY); } catch (e) { /* storage unavailable */ }
  }

  var refreshBanner = function () {}; // set by init; redraws the file banner (e.g. after saving from the Account page)

  // Remembers that the loaded file is also saved in the signed-in account.
  function markUploadSaved(accountId) {
    var upload = readUpload();
    if (!upload) return;
    upload.accountId = accountId;
    try { localStorage.setItem(UPLOAD_KEY, JSON.stringify(upload)); } catch (e) { /* storage unavailable */ }
  }

  // Makes a file saved in the account the one every page analyses (used by the Account page).
  function openSaved(row) {
    setExample(false);
    localStorage.setItem(UPLOAD_KEY, JSON.stringify({ name: row.name, loadedAt: Date.now(), data: row.data, accountId: row.id }));
  }

  // The file currently loaded in this browser, if any: { name, accountId }.
  function currentUpload() {
    var upload = readUpload();
    return upload ? { name: upload.name, accountId: upload.accountId || null } : null;
  }

  function loadData() {
    var upload = readUpload();
    if (upload && (upload.data || upload.text)) {
      try {
        return {
          parsed: App.Parser.parse(upload.data || upload.text),
          source: { kind: 'upload', name: upload.name, accountId: upload.accountId || null }
        };
      } catch (e) {
        clearUpload();
      }
    }
    if (window.TESCO_DATA && exampleChosen()) {
      return { parsed: App.Parser.parse(window.TESCO_DATA), source: { kind: 'example', name: 'Example data' } };
    }
    return null;
  }

  // ---------- Welcome (no file loaded yet) ----------

  function renderWelcome(show) {
    var main = document.querySelector('main');
    var welcome = $('welcome');
    Array.prototype.forEach.call(main.children, function (el) {
      if (el.classList.contains('page-head') || el.id === 'notice' || el.id === 'welcome') return;
      el.hidden = show;
    });
    if (!show) { if (welcome) welcome.remove(); return; }
    if (welcome) return;

    welcome = document.createElement('section');
    welcome.id = 'welcome';
    welcome.className = 'card welcome';
    welcome.innerHTML =
      '<h2>Analyse your Tesco shopping</h2>' +
      '<p>Load the purchase history file from your Tesco data download and every page fills in: spending by food group, ' +
        'snacks vs ingredients, trends over time, top items, nutrition and a diet check.</p>' +
      '<div class="dropzone" id="dropzone">' +
        '<p><strong>Drop your JSON file here</strong></p><p class="muted">or</p>' +
        '<label class="btn" for="welcome-file">Choose a file</label>' +
        '<input type="file" id="welcome-file" accept=".json,application/json" hidden>' +
      '</div>' +
      '<div class="welcome-cols">' +
        '<div><h3>Getting your file</h3><ol class="steps">' +
          '<li>Sign in to your Tesco account and request a copy of your Clubcard data from the privacy or data settings.</li>' +
          '<li>When Tesco emails you that it is ready, download it and unzip it if needed.</li>' +
          '<li>Choose the JSON file with your purchases. Its name usually ends in <code>-transactions.json</code>.</li>' +
        '</ol></div>' +
        '<div><h3>Your privacy</h3><p class="muted">The file is read by your browser on this computer and is never uploaded anywhere. ' +
          'A compact copy (dates, product names, quantities and prices) is saved in this browser so every page can use it. ' +
          'You can remove it at any time.</p></div>' +
      '</div>' +
      (window.TESCO_DATA ? '<p class="welcome-example"><button type="button" class="link-btn" id="use-example">Or try the site with the example data</button></p>' : '');
    var head = main.querySelector('.notice') || main.querySelector('.page-head');
    head.insertAdjacentElement('afterend', welcome);
  }

  // ---------- Footer ----------

  function renderFooter(s, parsed) {
    var el = $('footer');
    if (!el) return;
    var gbp = App.UI.gbp;
    var unc = s.unclassified;
    var ignored = (parsed && parsed.ignored) || [];
    var minPence = Math.round(App.Parser.MIN_PRICE * 100);
    // Group by product: "Tesco Bag For Life: £0.00, 10 times (5 Jan 2026 – 9 Mar 2026)".
    var groups = {};
    ignored.forEach(function (x) {
      var g = groups[x.name] || (groups[x.name] = { name: x.name, count: 0, prices: {}, first: x.date, last: x.date });
      g.count++;
      g.prices[gbp(x.price)] = true;
      g.first = Math.min(g.first, x.date);
      g.last = Math.max(g.last, x.date);
    });
    var groupList = Object.keys(groups).map(function (k) { return groups[k]; }).sort(function (a, b) { return b.count - a.count; });
    var ignoredNote = ignored.length
      ? '<details><summary>' + ignored.length + ' item' + (ignored.length === 1 ? '' : 's') + ' priced under ' + minPence +
          'p left out as unrealistic (free items, discount lines or data errors)</summary><ul>' +
          groupList.map(function (g) {
            var when = g.first === g.last ? fmtDate(new Date(g.first)) : fmtDate(new Date(g.first)) + ' – ' + fmtDate(new Date(g.last));
            return '<li>' + esc(g.name) + ': ' + Object.keys(g.prices).join(', ') +
              (g.count > 1 ? ', ' + g.count + ' times' : '') + ' (' + when + ')</li>';
          }).join('') + '</ul></details>'
      : '<p>No items priced under ' + minPence + 'p (which would be left out as unrealistic) were found.</p>';
    var diff = s.totals.paid - s.totals.itemSpend;
    el.innerHTML =
      '<p><strong>How this was worked out.</strong> Each product name is matched against keyword rules (data/categories.js) to give it a food group and an item type. ' +
      'Nutrition is estimated from typical values per 100g for that kind of product (data/nutrition.js) multiplied by the pack size in the name, or the actual weight for loose items. ' +
      s.nutrition.sizeGuessed + ' of ' + s.lineCount + ' lines had no size in the name and used a typical pack size. Liquids are counted at 1 ml ≈ 1 g.</p>' +
      '<p><strong>Bulk buys</strong> are long-life items that keep for at least ' + App.Nutrition.BULK_MIN_SHELF_DAYS +
      ' days and hold at least ' + App.Nutrition.BULK_MIN_DAYS_OF_SERVINGS + ' days of servings at one serving a day, using a typical shelf life and serving size for each kind of product (data/nutrition.js).</p>' +
      '<p>Group and type shares use item prices; the total spent uses what was paid at the till, which differs by ' + gbp(Math.abs(diff)) +
      ' because of basket-level discounts. These are estimates for spotting patterns, not medical advice.</p>' +
      (unc.length
        ? '<details><summary>' + unc.length + ' unclassified product' + (unc.length === 1 ? '' : 's') + ' (' + gbp(s.byGroup.unclassified.spend) + ')</summary><ul>' +
          unc.map(function (u) { return '<li>' + esc(u.name) + ': ' + gbp(u.spend) + '</li>'; }).join('') + '</ul></details>'
        : '<p>Every product was matched to a category.</p>') +
      ignoredNote;
  }

  // ---------- Page lifecycle ----------

  // options.dataOptional: the page works without a loaded file (the Account page), so no welcome screen.
  function init(render, options) {
    options = options || {};
    var state = { summary: null, parsed: null, source: null, bannerNote: '' };

    renderHeader();
    applyTheme();

    // The "Save to my account" part of the banner, depending on sign-in.
    function accountAction() {
      var acc = App.Account;
      if (!acc || acc.status() !== 'ready' || state.source.kind !== 'upload' || state.source.temporary) return '';
      var stored = currentUpload();
      state.source.accountId = stored ? stored.accountId : state.source.accountId;
      if (state.source.accountId) return '<span class="saved-tag">Saved in your account</span>';
      if (!acc.state().ready) return '';
      return acc.state().user
        ? '<button type="button" class="link-btn" id="save-account">Save to my account</button>'
        : '<a class="link-btn" href="account.html">Sign in to save this file</a>';
    }

    function sourceBanner(s) {
      var shops = s.totals.shops + ' shop' + (s.totals.shops === 1 ? '' : 's');
      var span = fmtDate(s.period.first) + ' to ' + fmtDate(s.period.last);
      var what = state.source.kind === 'example'
        ? 'Showing the <strong>example data</strong> (' + shops + ', ' + span + ').'
        : 'Analysing <strong>' + esc(state.source.name) + '</strong> (' + shops + ', ' + span + ')' +
          (state.source.temporary ? ', on this page only because the file is too large to save in this browser.' : '.');
      var remove = state.source.kind === 'example' ? 'Close the example' : 'Remove this file';
      return '<div class="source-banner"><span>' + what + '</span><span class="source-actions">' +
        accountAction() +
        '<label class="link-btn" for="file-input">' + (state.source.kind === 'example' ? 'Load your own file' : 'Load a different file') + '</label>' +
        '<button type="button" class="link-btn" id="remove-data">' + remove + '</button></span></div>' +
        (state.bannerNote ? '<p class="banner-note">' + state.bannerNote + '</p>' : '');
    }

    function renderBanner() {
      if (!state.summary) return;
      notice(sourceBanner(state.summary));
      $('remove-data').addEventListener('click', function () {
        if (state.source.kind === 'example') setExample(false);
        else clearUpload();
        state.bannerNote = '';
        reload();
      });
      var save = $('save-account');
      if (save) save.addEventListener('click', function () {
        save.disabled = true;
        save.textContent = 'Saving…';
        App.Account.saveFile(state.source.name, state.parsed).then(function (row) {
          state.source.accountId = row.id;
          markUploadSaved(row.id);
          state.bannerNote = 'Saved to your account. Open it any time from <a href="account.html">your saved files</a>.';
          renderBanner();
        }, function (err) {
          state.bannerNote = '<span class="error-text">Couldn’t save: ' + esc(err.message) + '</span>';
          renderBanner();
        });
      });
    }

    if (App.Account && App.Account.status() === 'ready') {
      App.Account.onChange(function () { renderBanner(); });
    }
    refreshBanner = renderBanner;

    function draw() {
      if (!state.summary) return;
      var s = state.summary;
      $('period').textContent = fmtDate(s.period.first) + ' – ' + fmtDate(s.period.last) + ' · ' + Math.round(s.period.weeks) + ' weeks';
      renderBanner();
      if (typeof Chart !== 'undefined') App.Charts.setup();
      render(s, { parsed: state.parsed, source: state.source });
      renderFooter(s, state.parsed);
      if (typeof Chart === 'undefined' && document.querySelector('canvas')) {
        var el = $('notice');
        el.hidden = false;
        el.insertAdjacentHTML('beforeend', '<p>The charts could not load because Chart.js needs an internet connection. The tables still show every number.</p>');
      }
    }

    function showWelcome(error) {
      state.summary = state.parsed = state.source = null;
      $('period').textContent = 'No file loaded';
      notice(error && options.dataOptional ? '<p class="error-text">' + esc(error) + '</p>' : '');
      $('footer').innerHTML = '';
      if (options.dataOptional) { render(null, { parsed: null, source: null }); return; }
      renderWelcome(true);
      var err = $('welcome-error');
      if (!err) {
        err = document.createElement('p');
        err.id = 'welcome-error';
        err.className = 'welcome-error';
        $('dropzone').insertAdjacentElement('afterend', err);
      }
      err.textContent = error || '';
      err.hidden = !error;
      $('welcome-file').onchange = function (e) { pickFile(e.target); };
      var example = $('use-example');
      if (example) example.onclick = function () { setExample(true); reload(); };
      var zone = $('dropzone');
      zone.ondragover = function (e) { e.preventDefault(); zone.classList.add('drag'); };
      zone.ondragleave = function () { zone.classList.remove('drag'); };
    }

    function show(parsed, source) {
      state.parsed = parsed;
      state.summary = App.Aggregate.build(parsed);
      state.source = source;
      state.bannerNote = '';
      if (!options.dataOptional) renderWelcome(false);
      draw();
    }

    function reload() {
      var loaded;
      try {
        loaded = loadData();
      } catch (err) {
        showWelcome('Could not read the saved data: ' + err.message);
        return;
      }
      if (!loaded) { showWelcome(); return; }
      show(loaded.parsed, loaded.source);
    }

    function fail(message) {
      if (state.summary) notice(sourceBanner(state.summary) + '<p class="error-text">Could not read that file. ' + esc(message) + '</p>');
      else showWelcome(message);
    }

    // Reads a chosen or dropped file, saves a compact copy and shows it on every page.
    function handleFile(file) {
      if (!file) return;
      var reader = new FileReader();
      reader.onerror = function () { fail('The browser could not open it.'); };
      reader.onload = function () {
        var parsed;
        try { parsed = App.Parser.parse(reader.result); } catch (err) { fail(err.message); return; }
        setExample(false);
        try {
          localStorage.setItem(UPLOAD_KEY, JSON.stringify({ name: file.name, loadedAt: Date.now(), data: App.Parser.pack(parsed) }));
          show(parsed, { kind: 'upload', name: file.name });
        } catch (err) {
          // Too large for browser storage: analyse it on this page only.
          show(parsed, { kind: 'upload', name: file.name, temporary: true });
        }
      };
      reader.readAsText(file);
    }

    function pickFile(input) {
      var file = input.files[0];
      input.value = '';
      handleFile(file);
    }

    // Dropping a file anywhere on the page loads it (and stops the browser opening it instead).
    document.addEventListener('dragover', function (e) { e.preventDefault(); });
    document.addEventListener('drop', function (e) {
      e.preventDefault();
      var zone = $('dropzone');
      if (zone) zone.classList.remove('drag');
      if (e.dataTransfer && e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });

    $('theme-toggle').addEventListener('click', function () {
      theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
      try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* storage unavailable */ }
      applyTheme();
      draw();
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      if (theme === 'auto') draw();
    });

    $('file-input').addEventListener('change', function (e) { pickFile(e.target); });

    reload();
    return { redraw: draw };
  }

  App.Site = {
    init: init, openSaved: openSaved, currentUpload: currentUpload, markUploadSaved: markUploadSaved,
    refreshBanner: function () { refreshBanner(); }
  };
})(window.App);
