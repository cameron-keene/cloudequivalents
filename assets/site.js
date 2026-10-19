// Shared UI: back-to-top, collapsible <details> groups on category/hub pages.
(function () {
  var STORAGE = 'cc-groups';
  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORAGE) || '{}'); } catch (e) { return {}; }
  }
  function saveState(state) {
    try { localStorage.setItem(STORAGE, JSON.stringify(state)); } catch (e) {}
  }
  function applyClosedAttr(state) {
    var c = Object.keys(state).filter(function (k) { return state[k] === false; });
    if (c.length) document.documentElement.setAttribute('data-cc-closed', c.join(' '));
    else document.documentElement.removeAttribute('data-cc-closed');
  }

  var details = [].slice.call(document.querySelectorAll('details.cat-group[data-group]'));
  if (details.length) {
    // Visual state already applied via data-cc-closed CSS (no CLS). Keep open attr in sync for a11y.
    var state = loadState();
    details.forEach(function (d) {
      if (state[d.dataset.group] === false) d.open = false;
      else d.open = true;
      d.addEventListener('toggle', function () {
        var s = loadState();
        s[d.dataset.group] = d.open;
        saveState(s);
        applyClosedAttr(s);
      });
    });
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-expand-all],[data-collapse-all]');
      if (!btn) return;
      var open = btn.hasAttribute('data-expand-all');
      var s = loadState();
      details.forEach(function (d) { d.open = open; s[d.dataset.group] = open; });
      saveState(s);
      applyClosedAttr(s);
    });
  }

  var btn = document.getElementById('to-top');
  if (!btn) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'to-top';
    btn.className = 'to-top';
    btn.setAttribute('aria-label', 'Back to top');
    btn.hidden = true;
    btn.textContent = '↑';
    document.body.appendChild(btn);
  }
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function onScroll() { btn.hidden = window.scrollY < 480; }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  btn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    var skip = document.querySelector('.skip') || document.getElementById('q') || document.querySelector('a.brand');
    if (skip) skip.focus({ preventScroll: true });
  });
})();
