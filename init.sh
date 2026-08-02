#!/bin/bash
set -e
echo "=== English Buddy Harness Initialization ==="

echo "--- Backend ---"
cd src/backend
pip install --break-system-packages -r requirements.txt -q
# Remove stale DB so init_db() recreates it fresh (avoids shared-state test failures)
rm -f data/english_buddy.db
pytest -q
echo "Backend: OK"
cd ../..

echo "--- Frontend ---"
cd src/frontend
npm install --silent
npx tsc --noEmit
npm test -- --passWithNoTests
echo "Frontend: OK"
cd ../..

echo "=== Initialization Complete ==="
echo "Next steps:"
echo "1. Read feature_list.json to see current feature state"
echo "2. Pick ONE unfinished feature to work on"
echo "3. Implement only that feature"
echo "4. Re-run ./init.sh before claiming done"
