#!/usr/bin/env bash
# Generate two 32-byte hex secrets for WEBHOOK_SECRET and ADMIN_API_KEY
# WARNING: Do not commit these values to source control.
set -euo pipefail

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is required. Install OpenSSL and retry." >&2
  exit 1
fi

WEBHOOK_SECRET=$(openssl rand -hex 32)
ADMIN_API_KEY=$(openssl rand -hex 32)

cat <<EOF
# Copy these values to your secret manager (Render, GitHub Secrets, etc.)
WEBHOOK_SECRET=$WEBHOOK_SECRET
ADMIN_API_KEY=$ADMIN_API_KEY
EOF

printf "\nNotes:\n - Do NOT commit these values.\n - Use Render dashboard or GitHub Secrets to store them.\n"