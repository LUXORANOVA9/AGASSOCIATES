## 2024-05-19 - Focus indicators
**Learning:** Found multiple interactive elements across the app that lack `focus-visible` styles, making keyboard navigation very difficult.
**Action:** Always add explicit `focus-visible:ring-2 focus-visible:outline-none` styles to buttons and links. For this PR, I will focus on improving the `ContactSection` link accessibility as it contains both disabled placeholder links (which need `tabIndex={-1}`) and active links (which need focus rings).
