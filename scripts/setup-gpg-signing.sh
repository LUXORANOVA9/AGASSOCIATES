#!/usr/bin/env bash
# scripts/setup-gpg-signing.sh
#
# One-shot setup for GPG-signed commits on the AG Associates repo.
# Idempotent — safe to re-run. Does NOT push anything to GitHub;
# the GitHub public-key upload step must be done in the browser
# (https://github.com/settings/keys → GPG keys section).
#
# What this script does:
#   1. Verifies gpg is installed
#   2. Generates an ed25519 GPG key with UID "Aditya Gade <aditya@agassociates.in>"
#      (skipped if a key with that UID already exists)
#   3. Configures git locally:
#        user.signingkey   = <key id>
#        commit.gpgsign    = true
#        user.email        = aditya@agassociates.in
#        user.name         = Aditya Gade
#   4. Exports the public key to scripts/.gpg-public-key.asc
#   5. Runs a throwaway sign+verify test in /tmp
#   6. Prints the GitHub UI step (the only thing the user must do manually)
#
# Usage:  bash scripts/setup-gpg-signing.sh
set -euo pipefail

GPG_NAME='Aditya Gade'
GPG_EMAIL='admin@advadiityagade.com'
GPG_UID="$GPG_NAME <$GPG_EMAIL>"
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PUBKEY_OUT="$REPO_ROOT/scripts/.gpg-public-key.asc"

step() { printf "\n\033[1;34m▶ %s\033[0m\n" "$*"; }
ok()   { printf "  \033[1;32m✓\033[0m %s\n" "$*"; }
fail() { printf "  \033[1;31m✗\033[0m %s\n" "$*"; exit 1; }

# ── 1. verify gpg installed ───────────────────────────────────
step "1. Checking gpg is installed"
command -v gpg >/dev/null || fail "gpg not found. Install: sudo apt install -y gnupg"
GPG_VERSION=$(gpg --version | head -1 | awk '{print $3}')
ok "gpg $GPG_VERSION"

# ── 2. ensure key exists ──────────────────────────────────────
step "2. Looking for an existing GPG key with UID $GPG_UID"
EXISTING_KEY=$(gpg --list-secret-keys --keyid-format=long "$GPG_UID" 2>/dev/null | grep -oE '[A-F0-9]{16,}' | head -1 || true)
if [[ -n "$EXISTING_KEY" ]]; then
  ok "Found existing key: $EXISTING_KEY (fingerprint ends ${EXISTING_KEY: -16})"
  GPG_KEY_ID="$EXISTING_KEY"
else
  step "   No key found. Generating a new ed25519 key (no passphrase)..."
  gpg --quick-generate-key \
    --batch --pinentry-mode loopback --passphrase '' \
    "$GPG_UID" ed25519 default 0 >/dev/null 2>&1 \
    || fail "gpg --quick-generate-key failed"
  GPG_KEY_ID=$(gpg --list-secret-keys --keyid-format=long "$GPG_UID" 2>/dev/null | grep -oE '[A-F0-9]{16,}' | head -1)
  [[ -n "$GPG_KEY_ID" ]] || fail "Key generated but key id could not be read"
  ok "Generated key: $GPG_KEY_ID"
fi

# ── 3. configure git locally ──────────────────────────────────
step "3. Configuring git in $REPO_ROOT"
git config --local user.email   "$GPG_EMAIL"
git config --local user.name    "$GPG_NAME"
git config --local user.signingkey "$GPG_KEY_ID"
git config --local commit.gpgsign  true
ok "user.email     = $GPG_EMAIL"
ok "user.name      = $GPG_NAME"
ok "user.signingkey = $GPG_KEY_ID"
ok "commit.gpgsign  = true"

# ── 4. export public key ──────────────────────────────────────
step "4. Exporting public key to $PUBKEY_OUT"
FINGERPRINT=$(gpg --list-keys --with-colons "$GPG_KEY_ID" 2>/dev/null | awk -F: '/^fpr:/ {print $10; exit}')
[[ -n "$FINGERPRINT" ]] || fail "Could not read fingerprint for $GPG_KEY_ID"
gpg --armor --export "$FINGERPRINT" > "$PUBKEY_OUT"
chmod 600 "$PUBKEY_OUT"
ok "Wrote $PUBKEY_OUT (fingerprint: $FINGERPRINT)"

# ── 5. throwaway sign+verify test ─────────────────────────────
step "5. Running throwaway sign+verify test in /tmp"
TEST_DIR=$(mktemp -d)
git init -q "$TEST_DIR"
(
  cd "$TEST_DIR"
  git -c user.email="$GPG_EMAIL" -c user.name="$GPG_NAME" \
      -c commit.gpgsign=true -c user.signingkey="$GPG_KEY_ID" \
      commit --allow-empty -q -m "setup-gpg-signing.sh verify"
  if git log --show-signature -1 | grep -q "Good signature from \"$GPG_UID\""; then
    :
  else
    git log --show-signature -1
    rm -rf "$TEST_DIR"
    fail "Throwaway sign+verify test FAILED"
  fi
)
rm -rf "$TEST_DIR"
ok "Throwaway commit signed and verified locally"

# ── 6. print the manual step ──────────────────────────────────
printf "\n"
printf "============================================================\n"
printf "  ONE MANUAL STEP REMAINS\n"
printf "============================================================\n\n"

cat <<EOF
GitHub requires the public key to be added to your account before
it will mark any commit as "Verified". This MUST be done in a
browser (2FA + CSRF-protected form; not automatable from WSL2).

  1. Open https://github.com/settings/keys
     (you MUST be signed in as LUXORANOVA9, not rajkhemani)

  2. Scroll past the "SSH keys" section to the "GPG keys" section

  3. Click "New GPG key"

  4. Paste the contents of:
        $PUBKEY_OUT
     (\`cat $PUBKEY_OUT\` to print)

  5. Click "Add GPG key"

  6. Verify by running:
        cd $REPO_ROOT
        git commit --allow-empty -m "verify gpg"
        git push
     The commit on github.com should show a green "Verified" badge.

Once the public key is in your GitHub account, every future
\`git commit\` on this repo will be automatically signed and the
ruleset violation "Commits must have verified signatures" will
disappear from push output.

Common "We got an error" causes:
  - The block was pasted into the SSH section (not GPG)
  - Trailing/leading whitespace from the terminal copy
  - The same fingerprint already exists in the account (delete + re-add)
  - Signed in as the wrong GitHub account
EOF
