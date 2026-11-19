/**
 * Service worker: counts blocked actions (one writer, so tabs don't race on the stats)
 * and opens the options page on first install.
 */
importScripts('platforms.js', 'core.js');

chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
});

var queue = Promise.resolve();

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || msg.type !== 'blocked') return;
  queue = queue.then(function () {
    return chrome.storage.local.get('stats').then(function (res) {
      var before = (res.stats && res.stats.total) || 0;
      var stats = SAL.recordBlock(res.stats, String(msg.platform), String(msg.action), Date.now());
      return chrome.storage.local.set({ stats: stats }).then(function () {
        sendResponse({ total: stats.total, milestone: SAL.milestoneCrossed(before, stats.total) });
      });
    });
  }).catch(function (e) {
    console.warn('Action Locker: could not record stats', e);
    sendResponse(null);
  });
  return true; // answer asynchronously
});
