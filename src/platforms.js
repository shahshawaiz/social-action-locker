/**
 * Platform definitions: which sites Action Locker runs on and which buttons it can lock.
 *
 * Each action lists one or more matchers. A matcher has:
 *   selector  CSS selector for the clickable element
 *   text      optional list of exact (trimmed, case-insensitive) labels the element must show
 *   within    optional ancestor selector the element must sit inside
 * Per action, defaultLocked says whether it starts locked on a fresh install.
 *
 * Sites change their markup often. When a lock stops working, the fix is almost always
 * a selector here; see "When a lock stops working" in README.md.
 */
(function (root) {
  'use strict';

  var PLATFORMS = [
    {
      id: 'facebook',
      name: 'Facebook',
      color: '#1877f2',
      hosts: ['facebook.com'],
      actions: [
        {
          id: 'like', label: 'Like / react', group: 'Posts', defaultLocked: true,
          match: [{ selector: '[role="button"][aria-label="Like"], [role="button"][aria-label="Remove Like"], [role="button"][aria-label^="Change "][aria-label$=" reaction"]' }]
        },
        {
          id: 'comment', label: 'Comment', group: 'Posts', defaultLocked: false,
          match: [{ selector: '[role="button"][aria-label="Leave a comment"], [role="button"][aria-label="Comment"]' }]
        },
        {
          id: 'share', label: 'Share', group: 'Posts', defaultLocked: true,
          match: [{ selector: '[role="button"][aria-label^="Send this to friends"], [role="button"][aria-label="Share"]' }]
        },
        {
          id: 'comment-like', label: 'Like a comment', group: 'Comments', defaultLocked: true,
          match: [{ selector: '[role="button"]', text: ['Like'], within: '[role="article"][aria-label^="Comment by"], [role="article"][aria-label^="Reply by"]' }]
        },
        {
          id: 'comment-reply', label: 'Reply to a comment', group: 'Comments', defaultLocked: false,
          match: [{ selector: '[role="button"]', text: ['Reply'], within: '[role="article"][aria-label^="Comment by"], [role="article"][aria-label^="Reply by"]' }]
        },
        {
          id: 'add-friend', label: 'Add / cancel friend', group: 'People', defaultLocked: true,
          match: [{ selector: '[role="button"][aria-label="Add friend"], [role="button"][aria-label="Add Friend"], [role="button"][aria-label="Cancel request"]' }]
        }
      ]
    }
  ];

  root.SAL_PLATFORMS = PLATFORMS;
  if (typeof module !== 'undefined' && module.exports) module.exports = PLATFORMS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
