// Progressive enhancement for the homepage matrix. The page works without this file.
(function () {
  var P = window.__PREFIX__ || '';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var rows = [].slice.call(document.querySelectorAll('#matrix tr.row'));
  var groups = [].slice.call(document.querySelectorAll('#matrix tbody'));
  var q = $('#q'), fg = $('#f-group'), fe = $('#f-exam'), fm = $('#f-match');
  var table = $('#matrix'), count = $('#count'), empty = $('#empty');
  var params = new URLSearchParams(location.search);
  q.value = params.get('q') || ''; fg.value = params.get('group') || ''; fe.value = params.get('exam') || ''; fm.value = params.get('match') || '';
  // Live filtering instead of submitting the search form.
  q.form.addEventListener('submit', function (e) { e.preventDefault(); var first = rows.find(function (r) { return !r.hidden; }); if (first) first.querySelector('a').focus(); });

  function apply() {
    var terms = q.value.toLowerCase().trim().split(/\s+/).filter(Boolean), n = 0;
    rows.forEach(function (r) {
      var ok = (!fg.value || r.dataset.group === fg.value) && (!fm.value || r.dataset.match === fm.value) &&
        (!fe.value || (' ' + r.dataset.exams + ' ').indexOf(' ' + fe.value + ' ') > -1) &&
        terms.every(function (t) { return r.dataset.s.indexOf(t) > -1; });
      r.hidden = !ok; if (ok) n++;
    });
    groups.forEach(function (g) { g.hidden = !g.querySelector('tr.row:not([hidden])'); });
    count.textContent = n + ' of ' + rows.length + ' mappings';
    empty.hidden = n > 0;
    var p = new URLSearchParams();
    if (q.value) p.set('q', q.value); if (fg.value) p.set('group', fg.value); if (fe.value) p.set('exam', fe.value); if (fm.value) p.set('match', fm.value);
    if (localStorage.getItem('cc-view') === 'cards') p.set('view', 'cards');
    history.replaceState(null, '', p.toString() ? '?' + p : location.pathname);
  }
  [q, fg, fe, fm].forEach(function (el) { el.addEventListener(el === q ? 'input' : 'change', apply); });
  q.addEventListener('keydown', function (e) { if (e.key === 'Escape') { q.value = ''; apply(); } });

  // Matrix / cards toggle (persisted).
  var vm = $('#v-matrix'), vc = $('#v-cards');
  function setView(v) { table.classList.toggle('cards', v === 'cards'); vm.setAttribute('aria-checked', v !== 'cards'); vc.setAttribute('aria-checked', v === 'cards'); try { localStorage.setItem('cc-view', v); } catch (e) {} }
  vm.onclick = function () { setView('matrix'); apply(); }; vc.onclick = function () { setView('cards'); apply(); };
  [vm, vc].forEach(function (b) { b.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { var t = b === vm ? vc : vm; t.click(); t.focus(); } }); });
  setView(params.get('view') || localStorage.getItem('cc-view') || 'matrix');
  apply();

  // Detail drawer, data fetched lazily on first open.
  var dlg = $('#drawer'), body = $('#dr-body'), data = null, opener = null;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function render(r) {
    body.innerHTML = '<p class="kicker">' + esc(r.matchLabel) + '</p><h2 id="dr-title">' + esc(r.capability) + '</h2><p class="muted small">' + esc(r.what_for) + '</p>' +
      '<p class="answer"><strong>' + esc(r.answer) + '</strong></p><div class="dr-cols">' +
      r.providers.map(function (p) { return '<div><h3>' + esc(p.name) + '</h3>' + (p.services.length ? p.services.map(function (s) { return '<a class="chip" href="' + s.url + '">' + esc(s.name) + (s.status ? ' <span class="badge b-warn">' + esc(s.status) + '</span>' : '') + '</a>'; }).join('') : '<span class="nochip">No equivalent</span>') + '<p class="small">' + esc(p.pricing) + '</p></div>'; }).join('') +
      '</div><h3>Key differences</h3><ul class="diffs">' + r.differences.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>' +
      (r.exams.length ? '<h3>Exams</h3><p>' + r.exams.map(function (e) { return '<a class="chip exam" href="' + P + '/exams/#' + e.code + '" title="' + esc(e.name) + '">' + esc(e.label) + (e.status !== 'current' ? ' (' + e.status + ')' : '') + '</a>'; }).join('') + '</p>' : '') +
      (r.flags.length ? '<h3>Verification notes</h3><ul class="diffs">' + r.flags.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' : '') +
      '<a class="cta" href="' + r.url + '">Full comparison, FAQ and sources →</a>';
  }
  function open(id) {
    var go = function () { var r = data.find(function (x) { return x.id === id; }); if (!r) return; render(r); dlg.showModal(); $('#dr-close').focus(); };
    if (data) return go();
    fetch(P + '/data/rows.json').then(function (res) { return res.json(); }).then(function (j) { data = j; go(); }).catch(function () { location.href = $('[data-open="' + id + '"]').href; });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-open]');
    if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) { e.preventDefault(); opener = a; open(a.dataset.open); }
  });
  $('#dr-close').onclick = function () { dlg.close(); };
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', function () { if (opener) opener.focus(); });
})();
