/**
 * Pure logic shared by the content script, popup and options page.
 * No DOM and no chrome.* calls here, so it runs under the test runner too.
 */
(function (root) {
  'use strict';

  var SETTINGS_VERSION = 1;
  var MODES = ['block', 'confirm'];
  var STATS_DAYS_KEPT = 30;

  function defaultSettings(platforms) {
    var s = { version: SETTINGS_VERSION, mode: 'block', platforms: {}, pausedUntil: {} };
    platforms.forEach(function (p) {
      var actions = {};
      p.actions.forEach(function (a) { actions[a.id] = !!a.defaultLocked; });
      s.platforms[p.id] = { enabled: true, actions: actions };
    });
    return s;
  }

  /** Merge stored settings over defaults: keeps known values, adds new actions, drops unknown ones. */
  function normalizeSettings(raw, platforms) {
    var s = defaultSettings(platforms);
    if (!raw || typeof raw !== 'object') return s;
    if (MODES.indexOf(raw.mode) !== -1) s.mode = raw.mode;
    platforms.forEach(function (p) {
      var stored = raw.platforms && raw.platforms[p.id];
      if (stored && typeof stored === 'object') {
        if (typeof stored.enabled === 'boolean') s.platforms[p.id].enabled = stored.enabled;
        p.actions.forEach(function (a) {
          if (stored.actions && typeof stored.actions[a.id] === 'boolean') {
            s.platforms[p.id].actions[a.id] = stored.actions[a.id];
          }
        });
      }
      var until = raw.pausedUntil && raw.pausedUntil[p.id];
      if (typeof until === 'number' && isFinite(until)) s.pausedUntil[p.id] = until;
    });
    return s;
  }

  function hostMatches(hostname, host) {
    hostname = String(hostname || '').toLowerCase();
    return hostname === host || hostname.slice(-(host.length + 1)) === '.' + host;
  }

  function platformForHost(hostname, platforms) {
    for (var i = 0; i < platforms.length; i++) {
      for (var j = 0; j < platforms[i].hosts.length; j++) {
        if (hostMatches(hostname, platforms[i].hosts[j])) return platforms[i];
      }
    }
    return null;
  }

  function isPaused(settings, platformId, now) {
    var until = settings.pausedUntil && settings.pausedUntil[platformId];
    return typeof until === 'number' && until > now;
  }

  /** Returns a copy of settings with platformId paused for `minutes` (0 resumes). */
  function pause(settings, platformId, minutes, now) {
    var copy = JSON.parse(JSON.stringify(settings));
    copy.pausedUntil = copy.pausedUntil || {};
    if (minutes > 0) copy.pausedUntil[platformId] = now + minutes * 60000;
    else delete copy.pausedUntil[platformId];
    return copy;
  }

  /** How an action is locked right now: null (not locked), 'block' or 'confirm'. */
  function lockMode(settings, platformId, actionId, now) {
    var p = settings.platforms[platformId];
    if (!p || !p.enabled || !p.actions[actionId]) return null;
    if (isPaused(settings, platformId, now)) return null;
    return settings.mode;
  }

  function lockedCount(settings, platformId) {
    var p = settings.platforms[platformId];
    if (!p || !p.enabled) return 0;
    return Object.keys(p.actions).filter(function (k) { return p.actions[k]; }).length;
  }

  function textMatches(text, wanted) {
    if (!wanted) return true;
    var t = String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
    for (var i = 0; i < wanted.length; i++) if (t === wanted[i].toLowerCase()) return true;
    return false;
  }

  function dayKey(now) {
    var d = new Date(now);
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function emptyStats() { return { total: 0, byDay: {}, byAction: {} }; }

  /** Returns new stats with one blocked action counted; keeps only the last 30 days. */
  function recordBlock(stats, platformId, actionId, now) {
    var s = stats && typeof stats === 'object' ? JSON.parse(JSON.stringify(stats)) : emptyStats();
    s.total = (s.total || 0) + 1;
    s.byDay = s.byDay || {};
    s.byAction = s.byAction || {};
    var day = dayKey(now);
    s.byDay[day] = (s.byDay[day] || 0) + 1;
    var k = platformId + '/' + actionId;
    s.byAction[k] = (s.byAction[k] || 0) + 1;
    var hour = new Date(now).getHours();
    if (hour < 5) s.night = (s.night || 0) + 1;
    var cutoff = dayKey(now - (STATS_DAYS_KEPT - 1) * 86400000);
    Object.keys(s.byDay).forEach(function (d) { if (d < cutoff) delete s.byDay[d]; });
    return s;
  }

  function statsForDay(stats, now) {
    return (stats && stats.byDay && stats.byDay[dayKey(now)]) || 0;
  }

  /** Top N [key, count] pairs by count, for the popup. */
  function topActions(stats, n) {
    var by = (stats && stats.byAction) || {};
    return Object.keys(by)
      .map(function (k) { return [k, by[k]]; })
      .sort(function (a, b) { return b[1] - a[1] || (a[0] < b[0] ? -1 : 1); })
      .slice(0, n);
  }

  // ---- the fun part ------------------------------------------------------

  /** [{day, count}] for the last n days, oldest first, today last. */
  function lastDays(stats, now, n) {
    var out = [];
    for (var i = n - 1; i >= 0; i--) {
      var day = dayKey(now - i * 86400000);
      out.push({ day: day, count: (stats && stats.byDay && stats.byDay[day]) || 0 });
    }
    return out;
  }

  /** Consecutive days, ending today (or yesterday), on which Action Locker stopped something. */
  function streak(stats, now) {
    var days = 0;
    var start = statsForDay(stats, now) > 0 ? 0 : 1;
    for (var i = start; i < STATS_DAYS_KEPT; i++) {
      if (((stats && stats.byDay && stats.byDay[dayKey(now - i * 86400000)]) || 0) > 0) days++;
      else break;
    }
    return days;
  }

  var MILESTONES = [1, 10, 25, 50, 100, 250, 500, 1000];

  /** The milestone crossed when the total went from `before` to `after`, or 0. */
  function milestoneCrossed(before, after) {
    for (var i = MILESTONES.length - 1; i >= 0; i--) {
      if (before < MILESTONES[i] && after >= MILESTONES[i]) return MILESTONES[i];
    }
    return 0;
  }

  var ACHIEVEMENTS = [
    { id: 'first', icon: '🛡️', name: 'First save', hint: 'Stop your first accidental action' },
    { id: 'ten', icon: '👍', name: 'Steady thumb', hint: 'Stop 10 actions' },
    { id: 'hundred', icon: '🏆', name: 'Iron will', hint: 'Stop 100 actions' },
    { id: 'night', icon: '🦉', name: 'Night owl', hint: 'Get saved between midnight and 5 am' },
    { id: 'streak', icon: '🔥', name: 'On a roll', hint: 'Get saved 3 days in a row' },
    { id: 'armor', icon: '🧱', name: 'Full armor', hint: 'Lock every action Action Locker knows' }
  ];

  function achievements(stats, settings, now) {
    var total = (stats && stats.total) || 0;
    var armored = Object.keys(settings.platforms).every(function (id) {
      var p = settings.platforms[id];
      return p.enabled && Object.keys(p.actions).every(function (k) { return p.actions[k]; });
    });
    var earned = {
      first: total >= 1,
      ten: total >= 10,
      hundred: total >= 100,
      night: ((stats && stats.night) || 0) >= 1,
      streak: streak(stats, now) >= 3,
      armor: armored
    };
    return ACHIEVEMENTS.map(function (a) {
      return { id: a.id, icon: a.icon, name: a.name, hint: a.hint, earned: !!earned[a.id] };
    });
  }

  var QUIPS = [
    'Thumb slip averted.',
    'Not today, accidental {action}.',
    'Saved you an awkward "oops".',
    'Locked tight. Your {site} reputation is safe.',
    'Nice try, thumb.',
    'That {action} will have to wait.',
    'Plot twist: nothing happened.',
    'Your future self says thanks.'
  ];
  var NIGHT_QUIPS = [
    'It’s late. That {action} can wait till morning.',
    'Nothing good happens on {site} after 2 am.'
  ];

  /** A short, light-hearted line for the toast. `seed` picks the line (pass the running total). */
  function quip(action, siteName, now, seed) {
    var pool = new Date(now).getHours() < 5 ? NIGHT_QUIPS : QUIPS;
    var line = pool[Math.abs(seed | 0) % pool.length];
    var label = action.label.split(' /')[0].toLowerCase();
    return line.replace('{action}', label).replace('{site}', siteName);
  }

  var api = {
    MODES: MODES,
    defaultSettings: defaultSettings,
    normalizeSettings: normalizeSettings,
    hostMatches: hostMatches,
    platformForHost: platformForHost,
    isPaused: isPaused,
    pause: pause,
    lockMode: lockMode,
    lockedCount: lockedCount,
    textMatches: textMatches,
    dayKey: dayKey,
    emptyStats: emptyStats,
    recordBlock: recordBlock,
    statsForDay: statsForDay,
    topActions: topActions,
    lastDays: lastDays,
    streak: streak,
    MILESTONES: MILESTONES,
    milestoneCrossed: milestoneCrossed,
    achievements: achievements,
    quip: quip
  };

  root.SAL = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
