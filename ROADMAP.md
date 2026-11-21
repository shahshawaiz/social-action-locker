# Roadmap

## Where it stands (v2.0.0)

Manifest V3 extension that locks chosen actions on Facebook (like, comment, share, comment like,
reply, add friend) in block or ask-first mode, with per-site pause, playful feedback and a stats
dashboard in the popup. The pure logic (`src/core.js`) has unit tests. The part that matters most,
recognising buttons in real page markup and stopping their events, has no tests at all, because
that needs a browser.

## The big goal: a browser core of its own

Action Locker lives or dies on four pieces of the web platform: how HTML becomes a tree, how CSS
selectors match that tree (including `:has()` and shadow DOM), how events travel through it
(capture, bubble, `composedPath()`, pointer, mouse, touch and keyboard sequences), and when
`MutationObserver` callbacks and timers run. Today it can only be tested by hand, in Chrome, on
live sites.

The plan is to build those pieces from scratch as **`engine/`**: a headless DOM engine in plain
JavaScript with no dependencies. It runs under Node or JavaScriptCore, needs no browser, no
network and no package install, and is good enough to load Action Locker's real content script
against saved pages of five social sites and check every lock.

### End state

- `engine/` parses HTML per the WHATWG tree-construction algorithm, builds a spec-shaped DOM
  (including shadow roots and slots), matches CSS Selectors Level 4, dispatches DOM and UI events
  the way browsers do, and runs a deterministic event loop (tasks, microtasks, timers, animation
  frames, mutation observers) on a virtual clock.
- A fixture suite of five sites (Facebook, X, LinkedIn, Instagram, YouTube), with made-up
  content, runs `src/content.js` unmodified on top of `engine/` and checks every action.
- Action Locker itself grows to those five sites, a keyword filter and the rest of the plans below,
  each feature landing with fixture tests that run on the engine.

### The hard parts

- **HTML parsing is not "read the tags".** The tree-construction algorithm has insertion modes,
  implied tags, foster parenting for tables, the adoption agency algorithm for misnested
  formatting tags, and many error-recovery rules. Real social-site markup exercises most of them.
- **Selectors are a language.** Tokenising per CSS Syntax Level 3, parsing complex and relative
  selectors, specificity, `:is()`/`:where()`/`:not()`/`:has()`, `:nth-child(An+B of S)`,
  attribute matching with case flags, and doing it fast enough: `:has()` naively is quadratic.
- **Event dispatch is subtle.** Retargeting across shadow boundaries, `composedPath()` with closed
  roots, `stopImmediatePropagation` vs `stopPropagation`, passive listeners, cancelable vs not,
  `once`, listeners added or removed during dispatch, and the exact order of pointer, mouse, touch
  and click events for one tap.
- **Timing is behaviour.** When `MutationObserver` callbacks run relative to microtasks, timers and
  animation frames decides whether the extension's marking keeps up with an infinite feed. The
  engine has to model it deterministically so tests are repeatable.

### Success bar

All checked offline with `npm test`; the conformance suites are vendored into the repository with
their licences.

1. **HTML parsing:** at least 90 % of the html5lib-tests tree-construction cases (scripting off)
   produce the exact expected tree.
2. **DOM, events, shadow DOM, selectors:** chosen web-platform-tests directories (`dom/nodes`,
   `dom/events`, `shadow-dom`, `css/selectors`) run on the engine through a `testharness.js`
   adapter, with a per-directory pass rate of at least 90 %. Every skipped test is listed with a
   reason.
3. **Action Locker on the engine:** every action on all five sites has a fixture where it must be
   blocked and a negative fixture where it must not be. 100 % pass, zero false positives. The same
   fixtures pass in two interface languages per site.
4. **Performance:** `querySelectorAll` with `:has()` over a 50,000-node page, and a full marking
   pass over a 2,000-button page, each stay under a fixed time budget on a laptop CPU.
5. **Determinism:** the full suite gives the same result on every run, under both Node and
   JavaScriptCore.

## Milestones

Each one ends with tests that must pass. None needs network access, a GPU or Docker.

### 1. Test harness and conformance plumbing
- Vendor html5lib-tests and the chosen web-platform-tests directories, with their licences.
- A runner for html5lib `.dat` files and a `testharness.js` adapter, both reporting pass rates per
  file and directory, with an expected-failures list so regressions stand out.
- **Done when:** the suites run end to end against an empty engine and report 0 %.

### 2. DOM core
- `Node`, `Document`, `Element`, `Text`, `Comment`, `DocumentFragment`, attributes, tree
  mutation methods, live `HTMLCollection` and static `NodeList`, `textContent`, `classList`,
  `dataset`, `closest`, `contains`, `isConnected`.
- **Done when:** `dom/nodes` reaches its target.

### 3. HTML parser
- Tokenizer and tree construction per the WHATWG spec, scripting off: all insertion modes,
  implied end tags, foster parenting, adoption agency, character references, `<template>`.
- `innerHTML` and `outerHTML` serialisation.
- **Done when:** success-bar item 1 passes.

### 4. Selector engine
- CSS Syntax tokenizer, selector parser, specificity.
- Matching for all simple, compound, complex and relative selectors, `:has()` included;
  `matches`, `closest`, `querySelector(All)`.
- Indexes (by id, class, tag, attribute) and `:has()` short-cuts to hit the performance budget.
- **Done when:** `css/selectors` reaches its target and the `:has()` benchmark meets its budget.

### 5. Events and shadow DOM
- `EventTarget` and the DOM dispatch algorithm; `Event`, `UIEvent`, `MouseEvent`, `PointerEvent`,
  `KeyboardEvent`, `TouchEvent`; synthesised input sequences for a click, a tap, a double tap and
  a key press.
- `attachShadow` (open and closed), slots and slot assignment, event retargeting,
  `composedPath()`.
- **Done when:** `dom/events` and `shadow-dom` reach their targets.

### 6. Event loop and observers
- Virtual clock with tasks, microtasks, `setTimeout`/`setInterval`, `requestAnimationFrame` and
  `MutationObserver` in browser order; `run until idle` and `advance by N ms` for tests.
- A minimal `chrome.storage` / `chrome.runtime` shim so the extension's scripts load unchanged.
- **Done when:** `src/content.js` runs on a Facebook fixture and the first lock tests pass
  deterministically under Node and JavaScriptCore.

### 7. Five-site fixture suite and multi-site Action Locker
- Hand-built fixtures, with made-up content, that copy the real markup structure of Facebook, X,
  LinkedIn, Instagram and YouTube (feeds, single posts, comments, profiles, YouTube watch pages
  and Shorts), each in two interface languages.
- Add the four new sites to Action Locker: X (like, repost, reply, bookmark, post, follow, plus
  its single-key shortcuts), LinkedIn (react, comment, repost, send, connect, follow), Instagram
  (like including double-tap, comment, share, save, follow), YouTube (like, dislike, subscribe,
  comment like, post comment).
- **Done when:** success-bar item 3 passes.

### 8. Content filtering and the playground
- Keyword filter: hide posts and videos that mention chosen words (whole words, prefix wildcards,
  phrases, hashtags), folded into a "click to show" bar or removed; tested on the engine against
  every site's fixtures, including infinite-scroll growth.
- "Try it here" playground of made-up posts in the options page, driven by the same settings.
- **Done when:** the filter hides every matching card in the fixtures and nothing else
  (no comments, menus or the user's own posts).

### 9. Performance, CI and release
- Incremental marking (only mutated subtrees) using the engine's mutation records; meet
  success-bar item 4.
- GitHub Actions: unit tests, conformance suites with pass-rate reports, fixture suite, manifest
  check and a packaged zip on every push and pull request.
- Publish `engine/` as a standalone package with its own README and conformance table.

## Later: content blocking

- [ ] Block by account: hide everything from listed accounts, channels or pages.
- [ ] Block by type: Shorts, Reels, "Suggested for you", promoted posts, live streams.
- [ ] Advanced keywords: exclusions (`-word`), "all of these words", optional regular expressions.
- [ ] Hide the numbers: like, view and follower counts.
- [ ] Hide comment sections per site; focus mode that hides the whole home feed.
- [ ] Blur instead of fold, and a "hidden today" log kept on the device only.

## Later: other ideas

- [ ] Hold-to-confirm and cool-down modes; a daily like budget; an undo window.
- [ ] Schedules (time zone and DST aware) and per-account rules.
- [ ] Time limits per site; weekly report in the options page.
- [ ] More achievements once there are more sites.
- [ ] Engine: CSS cascade and computed style for `display`/`visibility`, so tests can tell
      whether a hidden post is really hidden.
- [ ] Firefox build; Chrome Web Store and Firefox Add-ons releases; translations.

## Working offline

Everything above is built and checked without internet: the extension has no server and makes no
network requests, the engine has no dependencies, the conformance suites and fixtures live in the
repository, and the tests need only Node or JavaScriptCore. No GPU, Docker, sound or cloud
service is involved.

Checking fixtures against the current live sites needs a connection and happens outside working
sessions. Fixtures never contain real people's names, photos or posts.

## Done

- [x] Rewrite for Manifest V3 (v2.0.0): no jQuery or Angular, no remote server.
- [x] Facebook locks: like/react, comment, share, comment like, reply, add/cancel friend.
- [x] Block and ask-first modes, per-site pause, stats.
- [x] Visual feedback: button shake, padlock pop, playful toasts, milestone confetti.
- [x] Popup dashboard: animated counter, 7-day chart, streak, achievements.
- [x] Unit tests for the pure logic.
