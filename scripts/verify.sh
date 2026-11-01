#!/usr/bin/env bash
set -euo pipefail
npm ci --no-audit --no-fund
npm run build
npx tsc --noEmit
node --test tests/enquiry.test.mjs
node scripts/browser-qa.mjs
