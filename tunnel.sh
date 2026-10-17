#!/usr/bin/env bash
#
# ./tunnel.sh — run the phone app over ngrok, so it works on any network:
# public Wi-Fi that isolates devices, an IPv6-only hotspot, anywhere.
#
# Starts what is not already running (Supabase, the API), opens ngrok tunnels
# for the API, Supabase and Metro, starts Expo with the tunnel URLs in place
# of the ones in apps/mobile/.env, and prints a QR code that opens the Band Wall
# development build (installed with `npm run mobile:ios`) on the Metro tunnel.
#
# NGROK_METRO_DOMAIN=<your-static-domain>.ngrok-free.app pins Metro to the
# free static domain ngrok gives every account, so the dev build's "Recently
# opened" entry keeps working between runs instead of needing a fresh scan.
#
# Supabase gets a tunnel too: the phone signs in against Supabase directly,
# not through the API, so without it the app loads but cannot log in.
#
# ⚠️ This puts your local Supabase and API on the public internet, and the
# local Supabase stack runs on well-known default secrets. Ctrl+C stops
# everything; don't leave it running.

set -euo pipefail
# Job control: every background job gets its own process group, so cleanup can
# stop `npm run dev` *and* the Nest process it spawned with one kill.
set -m

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$(mktemp -d -t artist-dashboard-tunnel)"
NGROK_WEB="127.0.0.1:4047"   # ngrok's local API; off 4040 so it can't clash
API_PORT=3001
SUPABASE_PORT=54321
METRO_PORT=8081

pids=()

die() { echo -e "\n✖ $*\n" >&2; exit 1; }
listening() { lsof -iTCP:"$1" -sTCP:LISTEN -t >/dev/null 2>&1; }

cleanup() {
  trap - EXIT INT TERM
  echo -e "\nStopping tunnels and servers…"
  for pid in "${pids[@]+"${pids[@]}"}"; do
    kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
  done
  echo "Logs kept in $LOG_DIR"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

wait_for() { # wait_for <seconds> <description> <command…>
  local seconds=$1 what=$2; shift 2
  for ((i = 0; i < seconds; i++)); do
    if "$@"; then return 0; fi
    sleep 1
  done
  die "$what did not come up within ${seconds}s. Logs: $LOG_DIR"
}

# --- Preflight ---------------------------------------------------------------

command -v ngrok >/dev/null || die "ngrok is not installed: brew install ngrok"
NGROK_CHECK="$(ngrok config check 2>&1)" || die "ngrok config check failed:\n$NGROK_CHECK\n\n  Log in with: ngrok config add-authtoken <token>"
NGROK_DEFAULT_CONFIG="$(sed -n 's/^Valid configuration file at //p' <<<"$NGROK_CHECK")"
[[ -n "$NGROK_DEFAULT_CONFIG" ]] || die "Could not find ngrok's config file in:\n$NGROK_CHECK"

grep -q '^EXPO_PUBLIC_SUPABASE_ANON_KEY=..*' "$ROOT/apps/mobile/.env" 2>/dev/null ||
  die "apps/mobile/.env needs EXPO_PUBLIC_SUPABASE_ANON_KEY (see apps/mobile/README.md)."

# Metro bakes EXPO_PUBLIC_* into the bundle, so a server already running has
# the old URLs. It has to be this script's Metro.
listening "$METRO_PORT" && die "Something is already on port $METRO_PORT — stop your running Expo server (npm run mobile) first."

# --- Supabase and the API ----------------------------------------------------

if ! listening "$SUPABASE_PORT"; then
  echo "Starting Supabase…"
  (cd "$ROOT" && npx supabase start) || die "npx supabase start failed (is Docker running?)"
fi

if listening "$API_PORT"; then
  echo "API already running on $API_PORT — using it."
else
  echo "Starting the API (log: $LOG_DIR/api.log)…"
  (cd "$ROOT" && exec npm run dev -w apps/api) >"$LOG_DIR/api.log" 2>&1 </dev/null &
  pids+=($!)
  wait_for 120 "The API" listening "$API_PORT"
fi

# --- ngrok -------------------------------------------------------------------

# A second config file beside yours: it adds these tunnels for this run only.
# Your ngrok.yml (and its authtoken) is read, never written.
cat >"$LOG_DIR/ngrok.yml" <<EOF
version: "3"
agent:
  web_addr: $NGROK_WEB
tunnels:
  artist-dashboard-api:
    proto: http
    addr: $API_PORT
  artist-dashboard-supabase:
    proto: http
    addr: $SUPABASE_PORT
  artist-dashboard-metro:
    proto: http
    addr: $METRO_PORT
${NGROK_METRO_DOMAIN:+    domain: $NGROK_METRO_DOMAIN}
EOF

echo "Opening ngrok tunnels (log: $LOG_DIR/ngrok.log)…"
ngrok start artist-dashboard-api artist-dashboard-supabase artist-dashboard-metro \
  --config "$NGROK_DEFAULT_CONFIG" --config "$LOG_DIR/ngrok.yml" \
  --log "$LOG_DIR/ngrok.log" --log-format logfmt >/dev/null 2>&1 </dev/null &
pids+=($!)

tunnel_url() { # tunnel_url <name> — prints the public URL, or nothing yet
  curl -s "http://$NGROK_WEB/api/tunnels" 2>/dev/null | node -e '
    let s = "";
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      try {
        const t = JSON.parse(s).tunnels.find((t) => t.name === process.argv[1]);
        if (t) process.stdout.write(t.public_url);
      } catch {}
    });' "$1"
}
tunnels_up() {
  [[ -n "$(tunnel_url artist-dashboard-api)" && -n "$(tunnel_url artist-dashboard-supabase)" && -n "$(tunnel_url artist-dashboard-metro)" ]]
}
if ! wait_for_tunnels="$(wait_for 30 "ngrok's tunnels" tunnels_up 2>&1)"; then
  echo "$wait_for_tunnels" >&2
  grep -E 'lvl=(eror|crit)|ERR_NGROK' "$LOG_DIR/ngrok.log" >&2 || tail -n 20 "$LOG_DIR/ngrok.log" >&2
  exit 1
fi

API_URL="$(tunnel_url artist-dashboard-api)"
SUPABASE_URL="$(tunnel_url artist-dashboard-supabase)"
METRO_URL="$(tunnel_url artist-dashboard-metro)"

# --- Expo --------------------------------------------------------------------

# Variables set here win over apps/mobile/.env (Expo never lets .env overwrite
# one that is already set), so .env is left alone and still supplies the anon
# key. EXPO_PACKAGER_PROXY_URL makes the manifest point the phone at the Metro
# tunnel for the bundle instead of at this machine's LAN address. --clear
# because the tunnel URLs are new every run and are inlined at bundle time.
echo "Starting Expo (log: $LOG_DIR/expo.log)…"
(
  cd "$ROOT/apps/mobile"
  export EXPO_PUBLIC_API_URL="$API_URL"
  export EXPO_PUBLIC_SUPABASE_URL="$SUPABASE_URL"
  export EXPO_PACKAGER_PROXY_URL="$METRO_URL"
  exec npx expo start --clear --port "$METRO_PORT"
) >"$LOG_DIR/expo.log" 2>&1 </dev/null &
pids+=($!)
wait_for 120 "Expo" curl -sf "http://127.0.0.1:$METRO_PORT/status" -o /dev/null

# The development build's own link: the app's scheme, then the Metro URL it
# should load. Expo Go cannot open this project since P13 (expo-dev-client).
SCHEME="$(node -p 'require(process.argv[1]).expo.scheme' "$ROOT/apps/mobile/app.json")"
DEV_BUILD_URL="$SCHEME://expo-development-client/?url=$(node -p 'encodeURIComponent(process.argv[1])' "$METRO_URL")"

echo
node -e 'require("qrcode-terminal").generate(process.argv[1], { small: true })' "$DEV_BUILD_URL"
cat <<EOF

  Scan with the iPhone Camera → opens Band Wall:  $DEV_BUILD_URL
  Or in Band Wall's launcher → Enter URL manually:  $METRO_URL

  API       $API_URL
  Supabase  $SUPABASE_URL
  Metro     $METRO_URL

  ⚠️  Your local Supabase and API are public until you press Ctrl+C.
  Reload the app by shaking the phone → Reload. Logs: $LOG_DIR

--- Expo output --------------------------------------------------------------
EOF

tail -n 0 -f "$LOG_DIR/expo.log"
