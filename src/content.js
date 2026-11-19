/**
 * Content script: runs on supported sites, stops locked actions before the site sees them.
 *
 * Listeners sit on `window` in the capture phase, so they run before the site's own
 * handlers. A locked click is either blocked (with a short toast) or held behind a
 * confirmation dialog, depending on the mode chosen in the options page.
 */
(function () {
  'use strict';

  var SAL = globalThis.SAL;
  var PLATFORM = SAL.platformForHost(location.hostname, globalThis.SAL_PLATFORMS);
  if (!PLATFORM) return;

  var settings = SAL.defaultSettings(globalThis.SAL_PLATFORMS);
  var bypassEl = null;      // element the user just confirmed; its replayed click passes through
  var dialogOpen = false;
  var POINTER_EVENTS = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'touchstart', 'touchend'];

  // ---- settings ----------------------------------------------------------

  chrome.storage.sync.get('settings', function (res) {
    applySettings(res.settings);
    scheduleMark(true);
  });

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === 'sync' && changes.settings) {
      applySettings(changes.settings.newValue);
      scheduleMark(true);
    }
  });

  function applySettings(raw) {
    settings = SAL.normalizeSettings(raw, globalThis.SAL_PLATFORMS);
  }

  function modeFor(action) {
    return SAL.lockMode(settings, PLATFORM.id, action.id, Date.now());
  }

  // ---- matching ----------------------------------------------------------

  function safeMatches(el, selector) {
    try { return el.matches(selector); } catch (e) { return false; }
  }

  function elementMatches(el, m) {
    if (!safeMatches(el, m.selector)) return false;
    if (m.within && !el.closest(m.within)) return false;
    return SAL.textMatches(el.textContent, m.text);
  }

  /** Walk the event path (shadow DOM included) and return the first locked action hit. */
  function findLocked(event) {
    var path = event.composedPath ? event.composedPath() : [];
    for (var i = 0; i < path.length; i++) {
      var el = path[i];
      if (!(el instanceof Element)) continue;
      if (el === document.body || el === document.documentElement) break;
      for (var j = 0; j < PLATFORM.actions.length; j++) {
        var action = PLATFORM.actions[j];
        var mode = modeFor(action);
        if (!mode) continue;
        for (var k = 0; k < action.match.length; k++) {
          if (elementMatches(el, action.match[k])) return { action: action, el: el, mode: mode };
        }
      }
    }
    return null;
  }

  function pathIncludes(event, el) {
    return event.composedPath && event.composedPath().indexOf(el) !== -1;
  }

  function stop(event) {
    if (event.cancelable) event.preventDefault();
    event.stopImmediatePropagation();
  }

  /**
   * Count a stopped action and show the feedback: shake the button, pop a padlock where the
   * pointer was, then a toast with a light-hearted line and the running total. `title` null
   * means "no toast" (ask-first mode shows its dialog instead).
   */
  function report(action, title, el, event) {
    if (el) shake(el);
    if (event && typeof event.clientX === 'number' && (event.clientX || event.clientY)) pop(event.clientX, event.clientY);
    var line = SAL.quip(action, PLATFORM.name, Date.now(), Math.floor(Math.random() * 1000));
    function done(resp) {
      if (title) toast(title, line, resp && resp.total);
      if (resp && resp.milestone) celebrate(resp.milestone);
    }
    try {
      chrome.runtime.sendMessage({ type: 'blocked', platform: PLATFORM.id, action: action.id }, function (resp) {
        void chrome.runtime.lastError; // service worker asleep or reloaded: still show the toast
        done(resp);
      });
    } catch (e) { done(null); /* extension was reloaded under this page */ }
  }

  // ---- event interception -----------------------------------------------

  function onPointer(event) {
    if (dialogOpen && isOwnUi(event)) return;
    if (bypassEl && pathIncludes(event, bypassEl)) return;
    if (findLocked(event)) stop(event);
  }

  function onClick(event) {
    if (isOwnUi(event)) return;
    if (bypassEl && pathIncludes(event, bypassEl)) { bypassEl = null; return; }
    var hit = findLocked(event);
    if (!hit) return;
    stop(event);
    if (hit.mode === 'confirm') { report(hit.action, null, null, null); askThenReplay(hit); }
    else report(hit.action, hit.action.label + ' is locked', hit.el, event);
  }

  var opts = { capture: true, passive: false };
  POINTER_EVENTS.forEach(function (type) { window.addEventListener(type, onPointer, opts); });
  window.addEventListener('click', onClick, opts);

  // ---- marking locked buttons -------------------------------------------

  var markTimer = null;

  function scheduleMark(reset) {
    if (reset) clearMarks();
    if (markTimer) return;
    markTimer = setTimeout(function () { markTimer = null; mark(); }, 400);
  }

  function clearMarks() {
    document.querySelectorAll('[data-sal-locked]').forEach(function (el) {
      el.removeAttribute('data-sal-locked');
    });
  }

  function mark() {
    PLATFORM.actions.forEach(function (action) {
      var mode = modeFor(action);
      if (!mode) return;
      action.match.forEach(function (m) {
        var els;
        try { els = document.querySelectorAll(m.selector); } catch (e) { return; }
        els.forEach(function (el) {
          if (el.getAttribute('data-sal-locked') === mode) return;
          if (elementMatches(el, m)) {
            el.setAttribute('data-sal-locked', mode);
          }
        });
      });
    });
  }

  function startObserver() {
    new MutationObserver(function () { scheduleMark(false); })
      .observe(document.documentElement, { childList: true, subtree: true });
    scheduleMark(false);
  }

  if (document.documentElement) startObserver();
  else document.addEventListener('DOMContentLoaded', startObserver);

  // A pause expires on its own: check every 15 s and refresh the marks when it flips.
  var wasPaused = false;
  setInterval(function () {
    var paused = SAL.isPaused(settings, PLATFORM.id, Date.now());
    if (paused !== wasPaused) { wasPaused = paused; scheduleMark(true); }
  }, 15000);

  // ---- own UI (toast + confirm), isolated in a shadow root ---------------

  var uiHost = null;
  var uiRoot = null;

  function isOwnUi(event) {
    return !!uiHost && pathIncludes(event, uiHost);
  }

  function ui() {
    if (uiRoot) return uiRoot;
    uiHost = document.createElement('sal-ui');
    uiHost.style.cssText = 'all: initial; position: fixed; z-index: 2147483647; inset: auto 0 0 auto;';
    uiRoot = uiHost.attachShadow({ mode: 'closed' });
    var style = document.createElement('style');
    style.textContent = [
      ':host { font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; }',
      '.toast { position: fixed; right: 20px; bottom: 20px; max-width: 320px; padding: 10px 14px;',
      '  background: #111827; color: #f9fafb; border-radius: 10px; box-shadow: 0 6px 24px rgba(0,0,0,.25);',
      '  display: flex; gap: 8px; align-items: center; opacity: 0; transform: translateY(8px);',
      '  transition: opacity .15s, transform .15s; }',
      '.toast.show { opacity: 1; transform: none; }',
      '.toast { gap: 10px; }',
      '.toast-icon { font-size: 20px; animation: wiggle .5s ease; }',
      '.toast b { display: block; font-weight: 600; }',
      '.toast small { display: block; color: #cbd5e1; font-size: 12.5px; }',
      '.toast-count { margin-left: auto; font: 700 12px ui-monospace, monospace; padding: 2px 7px; border-radius: 999px;',
      '  background: ' + PLATFORM.color + '; color: #fff; align-self: flex-start; }',
      '@keyframes wiggle { 0%,100% { transform: rotate(0) } 25% { transform: rotate(-18deg) } 75% { transform: rotate(18deg) } }',
      '.pop { position: fixed; font-size: 22px; transform: translate(-50%, -50%); pointer-events: none;',
      '  animation: pop .7s ease-out forwards; }',
      '@keyframes pop { 0% { opacity: 0; transform: translate(-50%,-50%) scale(.4) }',
      '  30% { opacity: 1; transform: translate(-50%,-90%) scale(1.25) }',
      '  100% { opacity: 0; transform: translate(-50%,-160%) scale(1) } }',
      '.confetti { position: fixed; inset: 0; pointer-events: none; overflow: hidden; }',
      '.confetti i { position: absolute; top: -12px; width: 8px; height: 12px; border-radius: 2px;',
      '  animation: fall linear forwards; }',
      '@keyframes fall { to { transform: translate(var(--drift), 105vh) rotate(var(--spin)); } }',
      '.milestone { position: fixed; top: 24px; left: 50%; transform: translateX(-50%); padding: 12px 20px;',
      '  background: #fff; color: #111827; border-radius: 999px; font-weight: 700; font-size: 15px;',
      '  box-shadow: 0 10px 30px rgba(0,0,0,.25); animation: drop .4s ease-out; pointer-events: none; }',
      '@keyframes drop { from { transform: translate(-50%, -30px); opacity: 0 } }',
      '@media (prefers-reduced-motion: reduce) { .pop, .confetti { display: none } .toast-icon, .milestone { animation: none } }',
      '.backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.35); display: grid; place-items: center; }',
      '.dialog { background: #fff; color: #111827; border-radius: 14px; padding: 20px 22px; width: min(360px, 90vw);',
      '  box-shadow: 0 20px 50px rgba(0,0,0,.3); }',
      '.dialog h2 { margin: 0 0 6px; font-size: 17px; }',
      '.dialog p { margin: 0 0 16px; color: #4b5563; }',
      '.row { display: flex; gap: 8px; justify-content: flex-end; }',
      'button { font: inherit; border-radius: 8px; padding: 7px 14px; cursor: pointer; border: 1px solid #d1d5db; background: #fff; color: #111827; }',
      'button.go { background: ' + PLATFORM.color + '; border-color: transparent; color: #fff; }',
      'button:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }'
    ].join('\n');
    uiRoot.appendChild(style);
    (document.body || document.documentElement).appendChild(uiHost);
    return uiRoot;
  }

  var toastTimer = null;
  function toast(title, line, total) {
    var root = ui();
    var old = root.querySelector('.toast');
    if (old) old.remove();
    var el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    var icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.textContent = '\uD83D\uDD12';
    var text = document.createElement('div');
    var b = document.createElement('b');
    b.textContent = title;
    var small = document.createElement('small');
    small.textContent = line;
    text.append(b, small);
    el.append(icon, text);
    if (total) {
      var count = document.createElement('span');
      count.className = 'toast-count';
      count.textContent = '#' + total;
      count.title = total + ' accidental actions stopped so far';
      el.appendChild(count);
    }
    root.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { el.remove(); }, 200);
    }, 2800);
  }

  // ---- little bits of joy ----------------------------------------------

  function shake(el) {
    el.setAttribute('data-sal-shake', '');
    setTimeout(function () { el.removeAttribute('data-sal-shake'); }, 450);
  }

  function pop(x, y) {
    var root = ui();
    var p = document.createElement('div');
    p.className = 'pop';
    p.textContent = '\uD83D\uDD12';
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    root.appendChild(p);
    setTimeout(function () { p.remove(); }, 700);
  }

  var CONFETTI = ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#a855f7', '#ec4899'];

  function celebrate(milestone) {
    var root = ui();
    var wrap = document.createElement('div');
    wrap.className = 'confetti';
    for (var i = 0; i < 80; i++) {
      var c = document.createElement('i');
      c.style.left = (Math.random() * 100) + 'vw';
      c.style.background = CONFETTI[i % CONFETTI.length];
      c.style.animationDelay = (Math.random() * 0.4) + 's';
      c.style.animationDuration = (1.4 + Math.random() * 1.2) + 's';
      c.style.setProperty('--drift', (Math.random() * 160 - 80) + 'px');
      c.style.setProperty('--spin', (Math.random() * 720 - 360) + 'deg');
      wrap.appendChild(c);
    }
    var banner = document.createElement('div');
    banner.className = 'milestone';
    banner.setAttribute('role', 'status');
    banner.textContent = milestone === 1
      ? '\uD83C\uDF89 Your first save! Action Locker has your back.'
      : '\uD83C\uDF89 ' + milestone + ' accidental actions stopped!';
    root.append(wrap, banner);
    setTimeout(function () { wrap.remove(); banner.remove(); }, 3200);
  }

  function askThenReplay(hit) {
    if (dialogOpen) return;
    dialogOpen = true;
    var root = ui();
    var backdrop = document.createElement('div');
    backdrop.className = 'backdrop';
    var dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');
    var h = document.createElement('h2');
    h.textContent = hit.action.label + '?';
    var p = document.createElement('p');
    p.textContent = 'This action is locked on ' + PLATFORM.name + '. Do it anyway?';
    var row = document.createElement('div');
    row.className = 'row';
    var cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    var go = document.createElement('button');
    go.className = 'go';
    go.textContent = 'Yes, do it';
    row.append(cancel, go);
    dialog.append(h, p, row);
    backdrop.appendChild(dialog);
    root.appendChild(backdrop);
    cancel.focus();

    function close(proceed) {
      dialogOpen = false;
      backdrop.remove();
      document.removeEventListener('keydown', onKey, true);
      if (proceed && hit.el.isConnected) {
        bypassEl = hit.el;
        hit.el.click();
        bypassEl = null;
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); close(false); }
    }
    cancel.addEventListener('click', function () { close(false); });
    go.addEventListener('click', function () { close(true); });
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(false); });
    document.addEventListener('keydown', onKey, true);
  }
})();
