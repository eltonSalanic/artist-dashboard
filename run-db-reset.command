#!/bin/zsh -l
cd "$(dirname "$0")/apps/api" || exit 1
echo "▶ npx prisma migrate deploy  (in apps/api)"
npx prisma migrate deploy || { echo "✖ migrate failed"; exit 1; }
cd ../..
echo ""
echo "▶ npm run db:seed -w apps/api"
npm run db:seed -w apps/api || { echo "✖ seed failed"; exit 1; }
echo ""
echo "✔ Done"
