#!/usr/bin/env bash
# One throwaway self-signed cert for the local HTTP/2 stream-limit lab. Not for anything else.
set -euo pipefail
cd "$(dirname "$0")"

openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout certs/key.pem -out certs/cert.pem \
  -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost"

echo "Wrote certs/cert.pem and certs/key.pem"
