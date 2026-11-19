# Roadmap

## Where it stands (v2.0.0)

Manifest V3 extension that locks chosen actions on Facebook (like, comment, share, comment like,
reply, add friend) in block or ask-first mode, with per-site pause, playful feedback and a stats
dashboard in the popup. Pure logic (`src/core.js`) has unit tests; the matching of real page
markup has none yet, and there is no CI.

## Where it is going

**End state:** a lock you can trust, on the five sites people scroll most (Facebook, X, LinkedIn,
Instagram, YouTube), plus a keyword filter that hides posts and videos you don't want to see.
Every lockable action and every filter rule is proven, by an offline test suite run in CI, to work
when it should and stay out of the way when it shouldn't.

**The hard part:** the extension has to recognise one button among thousands on pages whose markup
is obfuscated, changes without notice, differs by language and A/B test, and sometimes lives in
shadow DOM; then stop the event before the site's own handlers see it (pointer, touch, click,
double-tap and keyboard paths all differ per site), and, in ask-first mode, replay it faithfully.
The keyword filter has the same problem in reverse: find the post or video card around the text,
hide exactly that card, and keep up with infinite scroll. A false positive breaks the site; a
false negative is the bug the extension exists to prevent.

**Success bar for the project** (all checked by `npm test`, offline, and in CI):

1. Every action in `src/platforms.js` has at least one fixture where it must be blocked and one
   negative fixture (look-alike button, post text containing "Like", etc.) where it must not be.
   100 % pass, zero false positives, on all five sites.
2. The same fixtures pass in at least two interface languages per site.
3. The keyword filter hides every matching post or video card in the fixtures and nothing else
   (not comments, menus or the user's own posts).
4. A marking pass over a 2,000-button fixture page stays under a fixed time budget.
5. Ask-first mode replays the action on the original element in every fixture.
6. CI is green on every push and pull request.

## Milestones

Each milestone ends with tests that must pass; none of them needs network access.

### 1. Offline fixture harness and CI
- Hand-built HTML fixtures for Facebook (feed, single post, comments, profile) that copy the real
  markup structure, with made-up names and text only.
- A DOM test runner that loads `src/content.js` against a fixture, dispatches real pointer, click
  and key events, and asserts blocked / allowed / confirm dialog shown.
- GitHub Actions workflow: unit tests, fixture tests, manifest validation and a syntax check of
  every script on each push and pull request; a packaged zip as a build artifact.
- **Done when:** success-bar items 1 and 6 pass for Facebook.

### 2. More sites: X, LinkedIn, Instagram, YouTube
- **X:** like, repost, reply, bookmark, send a post, follow; X's single-key shortcuts
  (`L`, `T`, `R`, `B`) locked along with their buttons.
- **LinkedIn:** react, comment, repost, send privately, connect, follow.
- **Instagram:** like (including double-tap on photos and videos), comment, share, save, follow.
- **YouTube:** like, dislike, subscribe, like a comment, post a comment, on watch pages and Shorts.
- Fixtures for each site before its selectors are written; keyboard and double-tap paths tested.
- **Done when:** success-bar item 1 passes on all five sites.

### 3. Keyword filter
- Hide posts (Facebook, X, LinkedIn, Instagram) and videos (YouTube) that mention chosen words.
- Matching: whole words, any case, `crypto*` prefix wildcards, phrases, hashtags, non-English
  letters; regex characters treated literally.
- Two styles: fold into a "click to show" bar, or remove completely; re-check cards as infinite
  scroll fills them in.
- Settings: keyword chips with suggestions, per-site on/off.
- **Done when:** success-bar item 3 passes on all five sites, and matching has unit tests.

### 4. "Try it here" playground
- A panel of made-up posts in the options page that follows the current settings, so users can
  feel each lock, mode and keyword before using it on a real site.
- **Done when:** every mode and filter style can be exercised in the playground, with tests.

### 5. Matching engine v2
- Split matching out of `content.js` into a tested module; ranked fallback selectors per action;
  locale-independent signals first (`data-testid`, custom element names, icon shapes), text last.
- Second-language fixtures for each site.
- Incremental marking (only mutated subtrees) instead of full-page rescans.
- **Done when:** success-bar items 2 and 4 pass.

### 6. Interaction modes and rules
- Hold-to-confirm mode, and faithful replay in ask-first mode on sites that act on pointer events.
- Schedules: lock automatically in chosen time windows (time zone and DST handled, unit-tested).
- Per-account rules: lock follows/likes only for listed accounts (needs author extraction per site).
- **Done when:** success-bar item 5 passes and the schedule and rule logic has unit tests.

## TODO: content blocking (after the keyword filter)

- [ ] **Block by account**: hide everything from listed accounts, channels or pages.
- [ ] **Block by type**: Shorts, Reels, "Suggested for you", promoted/sponsored posts, live streams.
- [ ] **Advanced keywords**: exclusions (`-word`), "all of these words", optional regular expressions.
- [ ] **Hide the numbers**: like, view and follower counts.
- [ ] **Hide comment sections** per site.
- [ ] **Focus mode**: hide the whole home feed and keep search, messages and notifications.
- [ ] **Blur instead of fold**: show a blurred post with the matched word, click to reveal.
- [ ] A "hidden today" counter and a log of what was hidden and why, kept on the device only.

## TODO: other ideas

- [ ] **Cool-down mode**: a locked action unlocks only after a 10-second countdown.
- [ ] **Daily budget**: allow 5 likes a day, then lock; resets at midnight.
- [ ] **Time limits per site**, with a gentle full-page reminder when one is used up.
- [ ] **Undo window**: after an allowed action, a 5-second toast to undo it.
- [ ] **Weekly report** in the options page: stopped actions and hidden posts by site.
- [ ] More achievements once there are more sites (for example, saved on three different sites).
- [ ] Keyboard shortcut to pause the current site (`chrome.commands`).
- [ ] Firefox build; publish to the Chrome Web Store and Firefox Add-ons.
- [ ] Translations of the interface.

## Working offline

Everything above is built and checked without internet: the extension has no server and makes no
network requests, the fixtures live in the repository, and the tests need only Node (or macOS's
JavaScriptCore for the pure-logic suite). No GPU, Docker, sound or cloud service is involved.

The one thing that needs a live connection is checking fixtures against the current real sites.
That happens outside working sessions; fixtures never contain real people's names, photos or posts.

## Done

- [x] Rewrite for Manifest V3 (v2.0.0): no jQuery or Angular, no remote server.
- [x] Facebook locks: like/react, comment, share, comment like, reply, add/cancel friend.
- [x] Block and ask-first modes, per-site pause, stats.
- [x] Visual feedback: button shake, padlock pop, playful toasts, milestone confetti.
- [x] Popup dashboard: animated counter, 7-day chart, streak, achievements.
- [x] Unit tests for the pure logic.
