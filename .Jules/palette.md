## 2024-05-19 - Focus indicators
**Learning:** Found multiple interactive elements across the app that lack `focus-visible` styles, making keyboard navigation very difficult.
**Action:** Always add explicit `focus-visible:ring-2 focus-visible:outline-none` styles to buttons and links. For this PR, I will focus on improving the `ContactSection` link accessibility as it contains both disabled placeholder links (which need `tabIndex={-1}`) and active links (which need focus rings).

## 2024-05-19 - Improved A11y for Icon-Only Buttons
**Learning:** Icon-only buttons without `aria-label`s are an accessibility hazard, causing screen readers to just read "button" without context, leaving users confused. The `FileUploader` component had icon-only buttons for canceling and retrying uploads, and `NotificationBell` had icon-only buttons for the bell and marking individual notifications as read.
**Action:** Next time, ensure all icon-only interactive elements (like buttons and links) have an `aria-label` or visually hidden text to provide context for screen reader users. Additionally, use `aria-expanded` on toggle buttons to indicate their state.
