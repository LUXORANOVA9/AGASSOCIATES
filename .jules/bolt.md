## 2024-05-19 - Initializing Bolt Journal\n**Learning:** Bolt journal initialized.\n**Action:** Keep entries focused on critical performance learnings.

## 2024-05-19 - Regex Compilation Optimization
**Learning:** In Python, multiple `re.sub()` calls with raw string patterns inside a frequently called function (like `_clean_markdown` in PDF generator) add significant overhead due to repeated regex parsing. Pre-compiling them at the module or class level gives a solid performance boost.
**Action:** Move regular expressions used repeatedly in string manipulation to compiled constants. Also combine simple alternative patterns when possible (e.g. replacing `#`, `##`, `###` headers with a single regex `^#{1,3}\s+(.+)$`).
