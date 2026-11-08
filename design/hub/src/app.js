(function () {
  'use strict';
  var app = document.querySelector('.app');

  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }

  /* ---------- screen theme (Auto follows the viewer's own setting) ---------- */
  function setScreens(v) {
    if (['auto', 'light', 'dark'].indexOf(v) < 0) v = 'auto';
    app.dataset.screens = v;
    each('[data-set-screens]', function (b) { b.setAttribute('aria-pressed', String(b.dataset.setScreens === v)); });
    save('journey-hub-screens', v);
  }
  each('[data-set-screens]', function (b) { b.addEventListener('click', function () { setScreens(b.dataset.setScreens); }); });
  setScreens(load('journey-hub-screens') || 'auto');

  /* ---------- accent colour ---------- */
  // The build sets data-accent to the chosen accent (or the default while none is chosen).
  // The saved preference is keyed by that value, so choosing an accent resets everyone's view to it.
  var accents = {}, baseAccent = app.dataset.accent, accentKey = 'journey-hub-accent:' + baseAccent;
  each('[data-set-accent]', function (b) { accents[b.dataset.setAccent] = true; });
  function setAccent(v) {
    if (!accents[v]) v = baseAccent;
    app.dataset.accent = v;
    each('[data-set-accent]', function (b) { b.setAttribute('aria-pressed', String(b.dataset.setAccent === v)); });
    save(accentKey, v);
  }
  each('[data-set-accent]', function (b) { b.addEventListener('click', function () { setAccent(b.dataset.setAccent); }); });
  setAccent(load(accentKey) || baseAccent);

  /* ---------- phone sizes: 4 or 2 columns on wide screens, a swipeable row on phones ---------- */
  var gallery = document.getElementById('gallery');
  function fit() {
    var w = gallery.clientWidth, z, cols;
    if (!w) return;
    if (w <= 720) { cols = 1; z = Math.min(0.9, (w - 24) / 410); }
    else { cols = w >= 1180 ? 4 : 2; z = Math.min(0.8, ((w - (cols - 1) * 28) / cols) / 410); }
    app.style.setProperty('--z', z.toFixed(3));
    gallery.style.setProperty('--cols', String(cols));
  }

  /* ---------- views: #overview, #screens ... or the id of anything inside a view ---------- */
  var views = {}, current = null, nav = document.querySelector('.nav');
  each('.view', function (s) { views[s.dataset.view] = s; });
  function route() {
    var h = (location.hash || '').slice(1), name = h, target = null;
    try { h = decodeURIComponent(h); } catch (e) { }
    if (!views[h]) {
      var el = h ? document.getElementById(h) : null, v = el && el.closest('.view');
      if (v) { name = v.dataset.view; target = el; } else name = 'overview';
    } else name = h;
    var changed = name !== current;
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== name; });
    each('.nav a', function (a) {
      if (a.getAttribute('href') === '#' + name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    current = name;
    if (name === 'screens') fit();
    if (target) target.scrollIntoView();
    else if (changed) window.scrollTo(0, 0);
    var on = nav && nav.querySelector('[aria-current]');
    if (on && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2;
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('resize', function () { if (current === 'screens') fit(); });
  route();

  /* ---------- comment buttons: open claude.ai's own comment box on a screen or page ---------- */
  // Shown only where this view can comment (the owner, and people the hub is shared with to comment).
  var cbtns = document.querySelectorAll('[data-comment-for]');
  function hideComments() { Array.prototype.forEach.call(cbtns, function (b) { b.hidden = true; }); }
  if (window.claude && typeof window.claude.use === 'function') {
    window.claude.use('comments').then(function (c) {
      if (!c || typeof c.openComposer !== 'function') return;
      Array.prototype.forEach.call(cbtns, function (b) {
        b.hidden = false;
        b.addEventListener('click', function () {
          var t = document.getElementById(b.dataset.commentFor);
          if (!t) return;
          // A whole page is anchored at its title, so the comment pin sits where the page starts.
          if (t.classList.contains('view')) t = t.querySelector('h1') || t;
          c.openComposer({ element: t }).catch(function (e) {
            var code = e && e.code;
            if (['unavailable', 'forbidden', 'not_granted', 'capability_disabled', 'capability_removed'].indexOf(code) >= 0) hideComments();
          });
        });
      });
    }, function () { });
  }
})();
