// Progressive enhancement for the homepage matrix. Works without this file (all groups expanded).
(function () {
  var P = window.__PREFIX__ || '';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var rows = $$('#matrix tr.row');
  var groups = $$('#matrix tbody[data-group]');
  var q = $('#q'), fg = $('#f-group'), fe = $('#f-exam'), fm = $('#f-match'), fj = $('#f-jump');
  var table = $('#matrix'), count = $('#count'), empty = $('#empty');
  var STORAGE = 'cc-groups';
  var params = new URLSearchParams(location.search);
  if (q) q.value = params.get('q') || '';
  if (fg) fg.value = params.get('group') || '';
  if (fe) fe.value = params.get('exam') || '';
  if (fm) fm.value = params.get('match') || '';

  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORAGE) || '{}'); } catch (e) { return {}; }
  }
  function saveState(state) {
    try { localStorage.setItem(STORAGE, JSON.stringify(state)); } catch (e) {}
  }
  function closedList(state) {
    return Object.keys(state).filter(function (k) { return state[k] === false; });
  }
  function applyClosedAttr(state) {
    var c = closedList(state);
    if (c.length) document.documentElement.setAttribute('data-cc-closed', c.join(' '));
    else document.documentElement.removeAttribute('data-cc-closed');
  }
  function setExpanded(tb, open, state) {
    var id = tb.dataset.group;
    var btn = tb.querySelector('.grp-toggle');
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    state[id] = open;
    applyClosedAttr(state);
  }
  function syncAriaFromAttr() {
    var closed = (document.documentElement.getAttribute('data-cc-closed') || '').split(/\s+/).filter(Boolean);
    groups.forEach(function (tb) {
      var open = closed.indexOf(tb.dataset.group) === -1;
      var btn = tb.querySelector('.grp-toggle');
      if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
  syncAriaFromAttr();

  // Toggle one group
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.grp-toggle');
    if (!btn || !table.contains(btn)) return;
    e.preventDefault();
    var state = loadState();
    var open = btn.getAttribute('aria-expanded') !== 'true';
    var tb = btn.closest('tbody');
    setExpanded(tb, open, state);
    saveState(state);
  });

  function expandAll() {
    var state = loadState();
    groups.forEach(function (tb) { setExpanded(tb, true, state); });
    saveState(state);
  }
  function collapseAll() {
    var state = loadState();
    groups.forEach(function (tb) {
      // Don't collapse groups that are already filter-hidden
      if (tb.classList.contains('is-empty')) return;
      setExpanded(tb, false, state);
    });
    saveState(state);
  }
  var ea = $('#expand-all'), ca = $('#collapse-all');
  if (ea) ea.addEventListener('click', expandAll);
  if (ca) ca.addEventListener('click', collapseAll);

  function filteringActive() {
    return !!(q.value.trim() || fg.value || fe.value || fm.value);
  }

  function apply() {
    var terms = q.value.toLowerCase().trim().split(/\s+/).filter(Boolean), n = 0;
    var state = loadState();
    var filtering = filteringActive();
    rows.forEach(function (r) {
      var ok = (!fg.value || r.dataset.group === fg.value) && (!fm.value || r.dataset.match === fm.value) &&
        (!fe.value || (' ' + r.dataset.exams + ' ').indexOf(' ' + fe.value + ' ') > -1) &&
        terms.every(function (t) { return r.dataset.s.indexOf(t) > -1; });
      r.hidden = !ok; if (ok) n++;
    });
    groups.forEach(function (g) {
      var visible = g.querySelectorAll('tr.row:not([hidden])').length;
      var total = +g.dataset.count || g.querySelectorAll('tr.row').length;
      g.classList.toggle('is-empty', visible === 0);
      g.hidden = false; // keep header for dimming; CSS dims is-empty
      if (visible === 0) {
        g.setAttribute('aria-hidden', 'true');
      } else {
        g.removeAttribute('aria-hidden');
      }
      var label = g.querySelector('[data-count-label]');
      if (label) label.textContent = filtering ? '(' + visible + ' of ' + total + ')' : '(' + total + ')';
      // Auto-expand groups with matches when filtering; leave empty groups collapsed visually via is-empty
      if (filtering && visible > 0) setExpanded(g, true, state);
    });
    if (filtering) applyClosedAttr(state); // don't persist auto-expand into storage mid-filter
    else applyClosedAttr(loadState());

    // Update jump nav active/dim
    $$('.jump a[data-jump]').forEach(function (a) {
      var tb = $('#rows-' + a.dataset.jump) || document.querySelector('tbody[data-group="' + a.dataset.jump + '"]');
      var emptyG = tb && tb.classList.contains('is-empty');
      a.classList.toggle('is-dim', !!emptyG);
      a.setAttribute('aria-disabled', emptyG ? 'true' : 'false');
    });

    // Keep aria-expanded in sync with data-cc-closed
    var closed = (document.documentElement.getAttribute('data-cc-closed') || '').split(/\s+/).filter(Boolean);
    groups.forEach(function (tb) {
      var btn = tb.querySelector('.grp-toggle');
      if (btn) btn.setAttribute('aria-expanded', closed.indexOf(tb.dataset.group) === -1 ? 'true' : 'false');
    });
    var tbEl = $('#toolbar');
    if (tbEl) document.documentElement.style.setProperty('--toolbar-h', tbEl.offsetHeight + 'px');

    count.textContent = n + ' of ' + rows.length + ' mappings';
    empty.hidden = n > 0;
    var p = new URLSearchParams();
    if (q.value) p.set('q', q.value); if (fg.value) p.set('group', fg.value); if (fe.value) p.set('exam', fe.value); if (fm.value) p.set('match', fm.value);
    if (localStorage.getItem('cc-view') === 'cards') p.set('view', 'cards');
    history.replaceState(null, '', p.toString() ? '?' + p : location.pathname);
  }

  if (q && q.form) q.form.addEventListener('submit', function (e) {
    e.preventDefault();
    var first = rows.find(function (r) { return !r.hidden; });
    if (first) first.querySelector('a').focus();
  });
  [q, fg, fe, fm].forEach(function (el) {
    if (!el) return;
    el.addEventListener(el === q ? 'input' : 'change', apply);
  });
  if (q) q.addEventListener('keydown', function (e) { if (e.key === 'Escape') { q.value = ''; apply(); } });

  // Jump to group (sidebar + mobile select)
  function jumpTo(id) {
    var el = document.getElementById('g-' + id);
    if (!el) return;
    // Ensure expanded
    var state = loadState();
    var tb = el.closest('tbody');
    setExpanded(tb, true, state);
    saveState(state);
    el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    el.focus({ preventScroll: true });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('.jump a[data-jump]');
    if (!a) return;
    e.preventDefault();
    if (a.classList.contains('is-dim')) return;
    jumpTo(a.dataset.jump);
  });
  if (fj) fj.addEventListener('change', function () { if (fj.value) { jumpTo(fj.value); fj.value = ''; } });

  // Matrix / cards toggle
  var vm = $('#v-matrix'), vc = $('#v-cards');
  function setView(v) {
    table.classList.toggle('cards', v === 'cards');
    if (vm) vm.setAttribute('aria-checked', v !== 'cards');
    if (vc) vc.setAttribute('aria-checked', v === 'cards');
    try { localStorage.setItem('cc-view', v); } catch (e) {}
  }
  if (vm) vm.onclick = function () { setView('matrix'); apply(); };
  if (vc) vc.onclick = function () { setView('cards'); apply(); };
  [vm, vc].forEach(function (b) {
    if (!b) return;
    b.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { var t = b === vm ? vc : vm; t.click(); t.focus(); }
    });
  });
  setView(params.get('view') || localStorage.getItem('cc-view') || 'matrix');
  apply();

  // Detail drawer
  var dlg = $('#drawer'), body = $('#dr-body'), data = null, opener = null;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function render(r) {
    body.innerHTML = '<p class="kicker">' + esc(r.matchLabel) + '</p><h2 id="dr-title">' + esc(r.capability) + '</h2><p class="muted small">' + esc(r.what_for) + '</p>' +
      '<p class="answer"><strong>' + esc(r.answer) + '</strong></p><div class="dr-cols">' +
      r.providers.map(function (p) {
        return '<div><h3>' + esc(p.name) + '</h3>' +
          (p.services.length ? p.services.map(function (s) {
            return '<a class="chip" href="' + s.url + '">' + esc(s.name) + (s.status ? ' <span class="badge b-warn">' + esc(s.status) + '</span>' : '') + '</a>';
          }).join('') : '<span class="nochip">No equivalent</span>') +
          '<p class="small">' + esc(p.pricing) + '</p></div>';
      }).join('') +
      '</div><h3>Key differences</h3><ul class="diffs">' + r.differences.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>' +
      (r.exams.length ? '<h3>Exams</h3><p>' + r.exams.map(function (e) {
        return '<a class="chip exam" href="' + P + '/exams/#' + e.code + '" title="' + esc(e.name) + '">' + esc(e.label) + (e.status !== 'current' ? ' (' + e.status + ')' : '') + '</a>';
      }).join('') + '</p>' : '') +
      (r.flags.length ? '<h3>Verification notes</h3><ul class="diffs">' + r.flags.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' : '') +
      '<a class="cta" href="' + r.url + '">Full comparison, FAQ and sources →</a>';
  }
  function openDrawer(id) {
    var go = function () {
      var r = data.find(function (x) { return x.id === id; });
      if (!r) return;
      render(r);
      dlg.showModal();
      $('#dr-close').focus();
    };
    if (data) return go();
    fetch(P + '/data/rows.json').then(function (res) { return res.json(); }).then(function (j) { data = j; go(); })
      .catch(function () { location.href = $('[data-open="' + id + '"]').href; });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-open]');
    if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
      e.preventDefault(); opener = a; openDrawer(a.dataset.open);
    }
  });
  if ($('#dr-close')) $('#dr-close').onclick = function () { dlg.close(); };
  if (dlg) {
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', function () { if (opener) opener.focus(); });
  }
})();
