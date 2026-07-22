#!/bin/bash
# Pulls reyse-vault into ./vault at build time, so the Talk to Rey feature can
# point the Agent SDK's cwd at it and pick up CLAUDE.md the same way voice-line
# does on the Chromebook. Needs VAULT_GITHUB_TOKEN (a GitHub personal access
# token scoped to read reyse-vault) set as a Railway environment variable.
#
# Safe to run without it set (e.g. local dev without the Talk feature) --
# warns and exits cleanly rather than failing the whole build.
set -u

if [ -z "${VAULT_GITHUB_TOKEN:-}" ]; then
  echo "VAULT_GITHUB_TOKEN not set -- skipping reyse-vault clone (Talk to Rey needs this at runtime)."
  exit 0
fi

REPO_URL="https://${VAULT_GITHUB_TOKEN}@github.com/morgankingreysecouk/reyse-vault.git"

if [ -d "vault/.git" ]; then
  echo "Updating existing vault checkout..."
  git -C vault pull --ff-only
else
  echo "Cloning reyse-vault..."
  rm -rf vault
  git clone --depth 1 "$REPO_URL" vault
fi
