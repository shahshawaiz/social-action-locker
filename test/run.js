/**
 * Unit tests for src/core.js and src/platforms.js.
 *
 *   node test/run.js          (Node 14+)
 *   scripts/test.sh          (uses Node, or macOS's built-in JavaScriptCore if Node is missing)
 */
var isNode = typeof require === 'function' && typeof module !== 'undefined';
var out = typeof print === 'function' && !isNode ? print : function (s) { console.log(s); };
var PLATFORMS, SAL;

if (isNode) {
  PLATFORMS = require('../src/platforms.js');
  SAL = require('../src/core.js');
} else {
  load('src/platforms.js');
  load('src/core.js');
  PLATFORMS = globalThis.SAL_PLATFORMS;
  SAL = globalThis.SAL;
}

var passed = 0;
var failed = 0;

function test(name, fn) {
  try { fn(); passed++; out('  ok   ' + name); }
  catch (e) { failed++; out('  FAIL ' + name + '\n       ' + e.message); }
}
function eq(actual, expected, msg) {
  var a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error((msg ? msg + ': ' : '') + 'expected ' + b + ', got ' + a);
}
function ok(value, msg) { if (!value) throw new Error(msg || 'expected truthy'); }

var NOW = new Date(2026, 10, 19, 12, 0, 0).getTime();
var DAY = 86400000;
var FB = PLATFORMS[0];

out('platforms');

test('Facebook is defined', function () {
  eq(PLATFORMS.map(function (p) { return p.id; }), ['facebook']);
});

test('action ids are unique and every action has a matcher', function () {
  PLATFORMS.forEach(function (p) {
    ok(/^#[0-9a-f]{6}$/i.test(p.color), p.id + ' color');
    ok(p.hosts.length > 0, p.id + ' hosts');
    var ids = {};
    p.actions.forEach(function (a) {
      ok(!ids[a.id], 'duplicate action ' + p.id + '/' + a.id);
      ids[a.id] = true;
      ok(a.label && a.group, p.id + '/' + a.id + ' label and group');
      ok(a.match.length > 0, p.id + '/' + a.id + ' has matchers');
      a.match.forEach(function (m) {
        ok(typeof m.selector === 'string' && m.selector.length > 0, p.id + '/' + a.id + ' selector');
        ok(m.text === undefined || Array.isArray(m.text), p.id + '/' + a.id + ' text');
      });
    });
  });
});

test('selectors have balanced brackets and quotes', function () {
  PLATFORMS.forEach(function (p) {
    p.actions.forEach(function (a) {
      a.match.forEach(function (m) {
        [m.selector, m.within || ''].forEach(function (s) {
          var paren = 0, square = 0, quotes = 0;
          for (var i = 0; i < s.length; i++) {
            var c = s[i];
            if (c === '"') quotes++;
            if (c === '(') paren++;
            if (c === ')') paren--;
            if (c === '[') square++;
            if (c === ']') square--;
          }
          ok(paren === 0 && square === 0 && quotes % 2 === 0, p.id + '/' + a.id + ': ' + s);
        });
      });
    });
  });
});

out('hosts');

test('platformForHost matches the site and its subdomains', function () {
  eq(SAL.platformForHost('facebook.com', PLATFORMS).id, 'facebook');
  eq(SAL.platformForHost('www.facebook.com', PLATFORMS).id, 'facebook');
  eq(SAL.platformForHost('WEB.Facebook.com', PLATFORMS).id, 'facebook');
});

test('platformForHost rejects look-alike and other domains', function () {
  eq(SAL.platformForHost('notfacebook.com', PLATFORMS), null);
  eq(SAL.platformForHost('facebook.com.evil.example', PLATFORMS), null);
  eq(SAL.platformForHost('example.com', PLATFORMS), null);
  eq(SAL.platformForHost('', PLATFORMS), null);
});

out('settings');

test('defaults follow each action defaultLocked flag', function () {
  var s = SAL.defaultSettings(PLATFORMS);
  eq(s.mode, 'block');
  eq(s.platforms.facebook.enabled, true);
  eq(s.platforms.facebook.actions.like, true);
  eq(s.platforms.facebook.actions.comment, false);
});

test('normalizeSettings keeps stored choices, drops unknown keys, adds new actions', function () {
  var s = SAL.normalizeSettings({
    mode: 'confirm',
    platforms: { facebook: { enabled: false, actions: { like: false, gone: true } }, myspace: { enabled: true } },
    pausedUntil: { facebook: NOW + 1000, bogus: 'soon' }
  }, PLATFORMS);
  eq(s.mode, 'confirm');
  eq(s.platforms.facebook.enabled, false);
  eq(s.platforms.facebook.actions.like, false);
  eq(s.platforms.facebook.actions.gone, undefined);
  eq(s.platforms.facebook.actions.share, true, 'missing action falls back to default');
  eq(s.platforms.myspace, undefined);
  eq(s.pausedUntil, { facebook: NOW + 1000 });
});

test('normalizeSettings survives garbage', function () {
  eq(SAL.normalizeSettings(null, PLATFORMS), SAL.defaultSettings(PLATFORMS));
  eq(SAL.normalizeSettings('nope', PLATFORMS), SAL.defaultSettings(PLATFORMS));
  eq(SAL.normalizeSettings({ mode: 'explode' }, PLATFORMS).mode, 'block');
});

out('locking');

test('lockMode returns the mode for locked actions and null otherwise', function () {
  var s = SAL.defaultSettings(PLATFORMS);
  eq(SAL.lockMode(s, 'facebook', 'like', NOW), 'block');
  eq(SAL.lockMode(s, 'facebook', 'comment', NOW), null);
  s.mode = 'confirm';
  eq(SAL.lockMode(s, 'facebook', 'like', NOW), 'confirm');
  s.platforms.facebook.enabled = false;
  eq(SAL.lockMode(s, 'facebook', 'like', NOW), null);
  eq(SAL.lockMode(s, 'nowhere', 'like', NOW), null);
});

test('pause unlocks a site until it expires, and 0 resumes', function () {
  var s = SAL.pause(SAL.defaultSettings(PLATFORMS), 'facebook', 15, NOW);
  eq(SAL.lockMode(s, 'facebook', 'like', NOW), null);
  eq(SAL.lockMode(s, 'facebook', 'like', NOW + 14 * 60000), null);
  eq(SAL.lockMode(s, 'facebook', 'like', NOW + 15 * 60000), 'block');
  var resumed = SAL.pause(s, 'facebook', 0, NOW);
  eq(SAL.lockMode(resumed, 'facebook', 'like', NOW), 'block');
});

test('pause does not mutate the settings it was given', function () {
  var s = SAL.defaultSettings(PLATFORMS);
  SAL.pause(s, 'facebook', 10, NOW);
  eq(s.pausedUntil, {});
});

test('lockedCount counts locked actions on enabled sites', function () {
  var s = SAL.defaultSettings(PLATFORMS);
  eq(SAL.lockedCount(s, 'facebook'), 4);
  s.platforms.facebook.enabled = false;
  eq(SAL.lockedCount(s, 'facebook'), 0);
});

test('textMatches is exact, trimmed and case-insensitive', function () {
  ok(SAL.textMatches('  Like ', ['Like']));
  ok(SAL.textMatches('reply\n', ['Reply']));
  ok(!SAL.textMatches('Likes', ['Like']));
  ok(SAL.textMatches('anything', undefined));
});

out('stats');

test('recordBlock counts total, per day and per action', function () {
  var st = SAL.recordBlock(null, 'facebook', 'like', NOW);
  st = SAL.recordBlock(st, 'facebook', 'like', NOW);
  st = SAL.recordBlock(st, 'facebook', 'share', NOW);
  eq(st.total, 3);
  eq(SAL.statsForDay(st, NOW), 3);
  eq(st.byAction['facebook/like'], 2);
  eq(SAL.topActions(st, 1), [['facebook/like', 2]]);
});

test('recordBlock keeps only the last 30 days', function () {
  var st = SAL.recordBlock(null, 'facebook', 'like', NOW - 40 * DAY);
  st = SAL.recordBlock(st, 'facebook', 'like', NOW - 29 * DAY);
  st = SAL.recordBlock(st, 'facebook', 'like', NOW);
  eq(Object.keys(st.byDay).length, 2);
  eq(st.total, 3, 'total is never trimmed');
});

test('recordBlock counts late-night saves', function () {
  var late = new Date(2026, 10, 19, 2, 30).getTime();
  eq(SAL.recordBlock(null, 'facebook', 'like', late).night, 1);
  eq(SAL.recordBlock(null, 'facebook', 'like', NOW).night, undefined);
});

test('dayKey uses local dates', function () {
  eq(SAL.dayKey(NOW), '2026-11-19');
});

out('dashboard');

test('lastDays returns n days oldest first, with zeros filled in', function () {
  var st = SAL.recordBlock(null, 'facebook', 'like', NOW);
  st = SAL.recordBlock(st, 'facebook', 'like', NOW - 2 * DAY);
  var days = SAL.lastDays(st, NOW, 7);
  eq(days.length, 7);
  eq(days[6], { day: '2026-11-19', count: 1 });
  eq(days[4].count, 1);
  eq(days[5].count, 0);
});

test('streak counts consecutive days ending today or yesterday', function () {
  eq(SAL.streak(null, NOW), 0);
  var st = SAL.recordBlock(null, 'facebook', 'like', NOW - 1 * DAY);
  st = SAL.recordBlock(st, 'facebook', 'like', NOW - 2 * DAY);
  eq(SAL.streak(st, NOW), 2, 'nothing today yet: streak still alive from yesterday');
  st = SAL.recordBlock(st, 'facebook', 'like', NOW);
  eq(SAL.streak(st, NOW), 3);
  eq(SAL.streak(SAL.recordBlock(null, 'facebook', 'like', NOW - 3 * DAY), NOW), 0, 'gap breaks it');
});

test('milestoneCrossed reports the highest milestone passed', function () {
  eq(SAL.milestoneCrossed(0, 1), 1);
  eq(SAL.milestoneCrossed(9, 10), 10);
  eq(SAL.milestoneCrossed(10, 11), 0);
  eq(SAL.milestoneCrossed(8, 30), 25);
});

test('achievements unlock from stats and settings', function () {
  var s = SAL.defaultSettings(PLATFORMS);
  eq(SAL.achievements(null, s, NOW).filter(function (a) { return a.earned; }), [], 'nothing earned on day one');
  var st = SAL.recordBlock(null, 'facebook', 'like', new Date(2026, 10, 19, 1).getTime());
  var got = {};
  SAL.achievements(st, s, NOW).forEach(function (a) { got[a.id] = a.earned; });
  eq(got.first, true);
  eq(got.night, true);
  eq(got.ten, false);
  eq(got.armor, false);
  FB.actions.forEach(function (a) { s.platforms.facebook.actions[a.id] = true; });
  eq(SAL.achievements(st, s, NOW).filter(function (a) { return a.id === 'armor'; })[0].earned, true,
     'every action locked');
});

test('quip fills in the action and site and never leaves a placeholder', function () {
  var like = FB.actions[0];
  for (var i = 0; i < 20; i++) {
    var day = SAL.quip(like, 'Facebook', NOW, i);
    var night = SAL.quip(like, 'Facebook', new Date(2026, 10, 19, 1).getTime(), i);
    ok(day.indexOf('{') === -1 && night.indexOf('{') === -1, day + ' / ' + night);
  }
  eq(SAL.quip(like, 'Facebook', NOW, 1), 'Not today, accidental like.');
});

out('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) {
  if (isNode) process.exit(1);
  else throw new Error(failed + ' test(s) failed');
}
