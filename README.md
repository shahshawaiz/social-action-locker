# Action Locker

A Chrome extension that stops accidental social actions on Facebook: the like you tapped while
scrolling, the share your thumb hit, the friend request you never meant to send. Pick the buttons
you want locked, and Action Locker either blocks them or asks "do it anyway?" first.

**Who it's for:** anyone who scrolls Facebook on a trackpad or touchscreen, and anyone who wants a
little friction before liking or sharing on autopilot.

## What it does

- **Per-action locks** on Facebook: like/react, comment, share, like a comment, reply to a
  comment, add/cancel friend.
- **Two modes:** *Block it* (nothing happens, with a short note) or *Ask me first* (a confirmation
  dialog, then the action goes through).
- **Pause** Facebook for 15 minutes or an hour from the toolbar popup, or switch it off.
- **Fun feedback:** a locked button shakes, a padlock pops up where you clicked, and a toast
  says something light ("Thumb slip averted."). Confetti at 1, 10, 25, 50, 100... saves.
- **Dashboard in the popup:** animated counter, 7-day chart, streak and six achievements to
  unlock (Night owl, On a roll, Full armor...).
- Locked buttons are dimmed on the page, so you can see what's locked before you click.
- **Private by design:** no network requests and no analytics. Settings sync through your Chrome
  profile; stats stay on your device.

Support for X, LinkedIn, Instagram and YouTube, a keyword filter and more are planned: see
[ROADMAP.md](ROADMAP.md).

## Built with

Plain JavaScript, HTML and CSS on Chrome's Manifest V3. No frameworks, no build step, no runtime
dependencies.

```
manifest.json        extension manifest (MV3)
src/platforms.js     the site and the selectors for each lockable action
src/core.js          pure logic: settings, pausing, stats, streaks, achievements (unit-tested)
src/content.js       runs on Facebook: intercepts locked clicks and taps, shows the feedback
src/background.js    service worker: records stats, opens settings on install
popup/               toolbar popup: site switch, pause, dashboard
options/             settings page
test/run.js          unit tests
scripts/             test runner, icon generator, packaging
```

## How to run it

1. Clone the repo: `git clone https://github.com/shahshawaiz/social-action-locker`
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the repository folder.
4. The settings page opens. Pick what to lock, then open Facebook.

After changing code, press the reload icon on the extension's card and refresh the Facebook tab.

### Tests

```sh
scripts/test.sh        # uses Node if installed, otherwise macOS's built-in JavaScriptCore
# or
npm test
```

### Package for the Chrome Web Store

```sh
scripts/package.sh     # writes dist/action-locker-<version>.zip
```

## When a lock stops working

Facebook changes its markup without notice, which breaks selectors. To fix one:

1. Right-click the button and choose **Inspect**.
2. Find a stable attribute on the button (`aria-label`, `role`, or a `data-` attribute).
3. Update the action's `match` list in [`src/platforms.js`](src/platforms.js) and reload the extension.

Selectors that rely on `aria-label` or button text are written for the English interface.
Issues and pull requests with updated selectors are very welcome.

## History

Action Locker began in 2017 as a Manifest V2 extension that loaded its selectors from a remote
Parse server. Version 2 is a rewrite for Manifest V3 with the selectors bundled locally.

## License

[MIT](LICENSE)
