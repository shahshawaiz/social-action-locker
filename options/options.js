(function () {
  'use strict';

  var PLATFORMS = globalThis.SAL_PLATFORMS;
  var SAL = globalThis.SAL;
  var settings = SAL.defaultSettings(PLATFORMS);
  var savedTimer = null;

  function save() {
    chrome.storage.sync.set({ settings: settings }, function () {
      var el = document.getElementById('saved');
      el.textContent = 'Saved';
      el.classList.add('show');
      clearTimeout(savedTimer);
      savedTimer = setTimeout(function () { el.classList.remove('show'); }, 1200);
    });
  }

  function renderMode() {
    document.querySelectorAll('input[name="mode"]').forEach(function (r) {
      r.checked = r.value === settings.mode;
    });
  }

  function renderPlatforms() {
    var host = document.getElementById('platforms');
    host.textContent = '';
    var tpl = document.getElementById('platform-tpl');

    PLATFORMS.forEach(function (p) {
      var card = tpl.content.firstElementChild.cloneNode(true);
      var state = settings.platforms[p.id];
      card.style.setProperty('--brand', p.color);
      card.querySelector('.platform-name').textContent = p.name;
      card.querySelector('.count').textContent = SAL.lockedCount(settings, p.id) + ' / ' + p.actions.length + ' locked';
      card.classList.toggle('off', !state.enabled);

      var enabled = card.querySelector('.platform-enabled');
      enabled.checked = state.enabled;
      enabled.setAttribute('aria-label', 'Action Locker on ' + p.name);
      enabled.addEventListener('change', function () {
        state.enabled = enabled.checked;
        save(); renderPlatforms();
      });

      card.querySelector('.lock-all').addEventListener('click', function () { setAll(p, true); });
      card.querySelector('.unlock-all').addEventListener('click', function () { setAll(p, false); });

      var groups = {};
      var groupsEl = card.querySelector('.groups');
      p.actions.forEach(function (a) {
        if (!groups[a.group]) {
          var g = document.createElement('div');
          g.className = 'group';
          var h = document.createElement('h3');
          h.textContent = a.group;
          g.appendChild(h);
          groupsEl.appendChild(g);
          groups[a.group] = g;
        }
        var row = document.createElement('label');
        row.className = 'action';
        var name = document.createElement('span');
        name.textContent = a.label;
        if (a.keys) {
          var kbd = document.createElement('kbd');
          kbd.textContent = a.keys.join(', ').toUpperCase();
          kbd.title = 'Keyboard shortcut also locked';
          name.appendChild(kbd);
        }
        var sw = document.createElement('span');
        sw.className = 'switch';
        var input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = state.actions[a.id];
        input.disabled = !state.enabled;
        var slider = document.createElement('span');
        slider.className = 'slider';
        sw.append(input, slider);
        input.addEventListener('change', function () {
          state.actions[a.id] = input.checked;
          save();
          card.querySelector('.count').textContent = SAL.lockedCount(settings, p.id) + ' / ' + p.actions.length + ' locked';
        });
        row.append(name, sw);
        groups[a.group].appendChild(row);
      });

      host.appendChild(card);
    });
  }

  function setAll(p, value) {
    p.actions.forEach(function (a) { settings.platforms[p.id].actions[a.id] = value; });
    save(); renderPlatforms();
  }

  function renderStats(stats) {
    var line = document.getElementById('stats-line');
    var total = (stats && stats.total) || 0;
    if (!total) { line.textContent = 'No actions blocked yet.'; return; }
    line.textContent = total + ' accidental action' + (total === 1 ? '' : 's') + ' stopped so far, ' +
      SAL.statsForDay(stats, Date.now()) + ' today.';
  }

  document.querySelectorAll('input[name="mode"]').forEach(function (r) {
    r.addEventListener('change', function () { settings.mode = r.value; save(); });
  });

  document.getElementById('reset-stats').addEventListener('click', function () {
    if (confirm('Reset all blocked-action stats?')) chrome.storage.local.set({ stats: SAL.emptyStats() });
  });

  document.getElementById('reset-all').addEventListener('click', function () {
    if (!confirm('Restore the default locks for every site?')) return;
    settings = SAL.defaultSettings(PLATFORMS);
    save(); renderMode(); renderPlatforms();
  });

  chrome.storage.sync.get('settings', function (res) {
    settings = SAL.normalizeSettings(res.settings, PLATFORMS);
    renderMode();
    renderPlatforms();
  });

  chrome.storage.local.get('stats', function (res) { renderStats(res.stats); });
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === 'local' && changes.stats) renderStats(changes.stats.newValue);
  });
})();
