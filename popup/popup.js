(function () {
  'use strict';

  var PLATFORMS = globalThis.SAL_PLATFORMS;
  var SAL = globalThis.SAL;
  var $ = function (id) { return document.getElementById(id); };
  var settings = SAL.defaultSettings(PLATFORMS);
  var platform = null;

  function labelFor(key) {
    var parts = key.split('/');
    var p = PLATFORMS.filter(function (x) { return x.id === parts[0]; })[0];
    var a = p && p.actions.filter(function (x) { return x.id === parts[1]; })[0];
    return p && a ? p.name + ' · ' + a.label : key;
  }

  function save() {
    chrome.storage.sync.set({ settings: settings });
    render();
    if (lastStats !== null) renderAchievements(lastStats, Date.now());
  }

  function render() {
    $('mode').textContent = settings.mode === 'confirm' ? 'Ask first' : 'Block';
    if (!platform) return;
    var now = Date.now();
    var enabled = settings.platforms[platform.id].enabled;
    var paused = SAL.isPaused(settings, platform.id, now);
    $('site-name').textContent = platform.name;
    $('site-enabled').checked = enabled;
    var status;
    if (!enabled) status = 'Off on this site';
    else if (paused) {
      var mins = Math.ceil((settings.pausedUntil[platform.id] - now) / 60000);
      status = 'Paused for ' + mins + ' more min';
    } else status = SAL.lockedCount(settings, platform.id) + ' of ' + platform.actions.length + ' actions locked';
    $('site-status').textContent = status;
    $('resume').hidden = !paused;
    document.querySelectorAll('[data-pause]:not([data-pause="0"])').forEach(function (b) {
      b.disabled = !enabled;
    });
  }

  var lastStats = null;
  var animateNew = false;   // only celebrate badges earned while the popup is open
  var shownTotal = 0;
  var DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function countUp(el, from, to) {
    if (from === to || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = to; return; }
    var t0 = performance.now();
    var dur = Math.min(900, 250 + (to - from) * 20);
    (function tick(t) {
      var k = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  }

  function renderChart(stats, now) {
    var days = SAL.lastDays(stats, now, 7);
    var max = Math.max.apply(null, days.map(function (d) { return d.count; }).concat([1]));
    var chart = $('chart');
    chart.textContent = '';
    var labels = document.querySelector('.chart-days');
    if (!labels) {
      labels = document.createElement('div');
      labels.className = 'chart-days';
      chart.after(labels);
    }
    labels.textContent = '';
    var tbody = $('chart-table').querySelector('tbody');
    tbody.textContent = '';
    var summary = [];
    days.forEach(function (d, i) {
      var parts = d.day.split('-');
      var date = new Date(+parts[0], +parts[1] - 1, +parts[2]);
      var name = i === 6 ? 'Today' : DAY_NAMES[date.getDay()];
      var slot = document.createElement('div');
      slot.className = 'bar-slot';
      var bar = document.createElement('div');
      bar.className = 'bar' + (d.count ? '' : ' zero');
      bar.style.height = '0%';
      var tip = document.createElement('span');
      tip.className = 'bar-tip';
      tip.textContent = name + ': ' + d.count + ' stopped';
      slot.append(tip, bar);
      chart.appendChild(slot);
      requestAnimationFrame(function () { bar.style.height = (d.count / max * 100) + '%'; });
      var lab = document.createElement('span');
      lab.textContent = name === 'Today' ? 'Today' : name.charAt(0);
      if (i === 6) lab.className = 'today';
      labels.appendChild(lab);
      var tr = document.createElement('tr');
      var a = document.createElement('td'); a.textContent = name;
      var b = document.createElement('td'); b.textContent = d.count;
      tr.append(a, b);
      tbody.appendChild(tr);
      summary.push(name + ' ' + d.count);
    });
    chart.setAttribute('aria-label', 'Actions stopped in the last 7 days: ' + summary.join(', '));
  }

  function renderAchievements(stats, now) {
    var box = $('achievements');
    var before = {};
    box.querySelectorAll('.ach.earned').forEach(function (el) { before[el.dataset.id] = true; });
    box.textContent = '';
    var list = SAL.achievements(stats, settings, now);
    var earned = 0;
    list.forEach(function (a) {
      var el = document.createElement('div');
      el.className = 'ach ' + (a.earned ? 'earned' : 'locked');
      if (a.earned && animateNew && !before[a.id]) el.classList.add('fresh');
      el.dataset.id = a.id;
      el.textContent = a.icon;
      el.title = a.name + (a.earned ? ' \u2713' : '') + ' \u2014 ' + a.hint;
      el.setAttribute('aria-label', el.title);
      box.appendChild(el);
      if (a.earned) earned++;
    });
    $('ach-count').textContent = earned + ' / ' + list.length;
  }

  function renderStats(stats) {
    lastStats = stats;
    var now = Date.now();
    var total = (stats && stats.total) || 0;
    countUp($('total'), shownTotal, total);
    shownTotal = total;
    $('today').textContent = SAL.statsForDay(stats, now);
    var streak = SAL.streak(stats, now);
    $('streak').textContent = streak;
    $('streak-box').classList.toggle('hot', streak > 0);
    renderChart(stats, now);
    renderAchievements(stats, now);
    var list = $('top');
    list.textContent = '';
    SAL.topActions(stats, 3).forEach(function (pair) {
      var li = document.createElement('li');
      var name = document.createElement('span');
      name.textContent = labelFor(pair[0]);
      var count = document.createElement('b');
      count.textContent = pair[1];
      li.append(name, count);
      list.appendChild(li);
    });
  }

  chrome.storage.sync.get('settings', function (res) {
    settings = SAL.normalizeSettings(res.settings, PLATFORMS);
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var url = tabs[0] && tabs[0].url;
      try { platform = url ? SAL.platformForHost(new URL(url).hostname, PLATFORMS) : null; } catch (e) { platform = null; }
      $('site').hidden = !platform;
      $('unsupported').hidden = !!platform;
      if (platform) document.documentElement.style.setProperty('--brand', platform.color);
      render();
      renderAchievements(lastStats, Date.now());
    });
  });

  chrome.storage.local.get('stats', function (res) { renderStats(res.stats); });
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === 'local' && changes.stats) { animateNew = true; renderStats(changes.stats.newValue); }
  });

  $('site-enabled').addEventListener('change', function (e) {
    settings.platforms[platform.id].enabled = e.target.checked;
    save();
  });

  document.querySelectorAll('[data-pause]').forEach(function (b) {
    b.addEventListener('click', function () {
      settings = SAL.pause(settings, platform.id, Number(b.dataset.pause), Date.now());
      save();
    });
  });

  $('open-options').addEventListener('click', function (e) {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
})();
