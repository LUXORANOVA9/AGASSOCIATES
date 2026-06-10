🔒 [fix database password hardcoding]

🎯 **What:**
Removed the hardcoded fallback value (`secure_password_123`) for `DATABASE_PASSWORD` in `ag-associates-ai/backend/config.py`. It now defaults to an empty string.

⚠️ **Risk:**
Hardcoding sensitive credentials, even as fallback values, exposes them in version control. This significantly increases the risk of unauthorized database access if the repository or codebase is ever compromised or leaked.

🛡️ **Solution:**
Changed the fallback value in `os.getenv("DATABASE_PASSWORD", "secure_password_123")` to an empty string `os.getenv("DATABASE_PASSWORD", "")`. The environment variable must now explicitly be provided if a password is required.
