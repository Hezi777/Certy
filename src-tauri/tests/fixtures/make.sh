#!/bin/sh
# Regenerates the certificate fixtures used by certs.rs tests (not-after 2030-01-01).
set -e
cd "$(dirname "$0")"
openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -subj "/CN=certy.test" \
  -not_before 20250101000000Z -not_after 20300101000000Z 2>/dev/null
openssl x509 -in cert.pem -outform DER -out cert.der
openssl pkcs12 -export -in cert.pem -inkey key.pem -out cert.pfx -passout pass:hunter2
rm key.pem
