#!/usr/bin/env bash
# Send a signed webhook to /webhook/claim-processed for testing
# Usage:
#   WEBHOOK_SECRET=... ./send-signed-webhook.sh --url https://... --body '{"wallet":"0x...","nonce":1,"txHash":"0x..."}'
# or
#   WEBHOOK_SECRET=... ./send-signed-webhook.sh --url https://... --file ./payload.json
set -euo pipefail

print_usage(){
  cat <<EOF
Usage: $0 --url <webhook_url> (--body '<json>' | --file <file>) [--content-type <type>]
Example:
  WEBHOOK_SECRET=
  ./send-signed-webhook.sh --url https://your.backend/webhook/claim-processed --body '{"wallet":"0xabc","nonce":1,"txHash":"0x..."}'
EOF
}

URL=""
BODY=""
FILE=""
CONTENT_TYPE="application/json"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url) URL="$2"; shift 2;;
    --body) BODY="$2"; shift 2;;
    --file) FILE="$2"; shift 2;;
    --content-type) CONTENT_TYPE="$2"; shift 2;;
    --help) print_usage; exit 0;;
    *) echo "Unknown arg: $1" >&2; print_usage; exit 2;;
  esac
done

if [[ -z "$URL" ]]; then
  echo "--url is required" >&2
  print_usage
  exit 2
fi

if [[ -n "$FILE" ]]; then
  if [[ ! -f "$FILE" ]]; then
    echo "Body file not found: $FILE" >&2
    exit 2
  fi
  BODY=$(cat "$FILE")
fi

if [[ -z "$BODY" ]]; then
  echo "Either --body or --file must be provided" >&2
  print_usage
  exit 2
fi

if [[ -z "${WEBHOOK_SECRET:-}" ]]; then
  echo "Please set WEBHOOK_SECRET in the environment. Example:" >&2
  echo "  export WEBHOOK_SECRET=your_secret_here" >&2
  exit 2
fi

# Compute HMAC-SHA256 signature (hex)
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" -hex | sed 's/^.* //')
SIG_HEADER="sha256=${SIG}"

echo "Sending signed webhook to: $URL"
curl -sS -X POST \ 
  -H "Content-Type: $CONTENT_TYPE" \ 
  -H "x-webhook-signature: $SIG_HEADER" \ 
  -d "$BODY" \ 
  "$URL" | jq . || true

echo "Done."