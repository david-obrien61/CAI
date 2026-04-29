#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Ignition OS — Full Stack Launcher
# Starts: Python/FastAPI (8000) · Vite Web (5173) · Expo Mobile
# Usage:  ./start.sh          — start everything
#         ./start.sh --stop   — kill all three servers
# ─────────────────────────────────────────────────────────────────────────────

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$PROJECT_DIR/.logs"
PYTHON_LOG="$LOG_DIR/python.log"
WEB_LOG="$LOG_DIR/web.log"
PID_FILE="$LOG_DIR/ignition.pids"

# ── Bright colors (visible on VS Code dark theme) ────────────────────────────
RED='\033[91m'
GREEN='\033[92m'
YELLOW='\033[93m'
BLUE='\033[94m'
CYAN='\033[96m'
WHITE='\033[97m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# ── Stop mode ────────────────────────────────────────────────────────────────
if [[ "$1" == "--stop" ]]; then
  echo -e "${YELLOW}  Stopping Ignition OS...${RESET}"
  if [[ -f "$PID_FILE" ]]; then
    while IFS= read -r pid; do
      if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" && echo -e "  ${RED}stopped${RESET} PID $pid"
      fi
    done < "$PID_FILE"
    rm "$PID_FILE"
  fi
  lsof -ti:8000 | xargs kill -9 2>/dev/null && echo -e "  ${RED}stopped${RESET} port 8000 (Python)"
  lsof -ti:5173 | xargs kill -9 2>/dev/null && echo -e "  ${RED}stopped${RESET} port 5173 (Vite)"
  lsof -ti:8081 | xargs kill -9 2>/dev/null
  lsof -ti:8082 | xargs kill -9 2>/dev/null
  pkill -f "expo start" 2>/dev/null && echo -e "  ${RED}stopped${RESET} Expo"
  echo -e "${GREEN}  All servers stopped.${RESET}"
  exit 0
fi

# ── Header ───────────────────────────────────────────────────────────────────
clear
echo ""
echo -e "${CYAN}${BOLD}  IGNITION OS // Full Stack Launcher${RESET}"
echo -e "${DIM}  $(date '+%A %B %d, %Y  %H:%M')${RESET}"
echo -e "${DIM}  $PROJECT_DIR${RESET}"
echo ""
echo -e "${DIM}  ────────────────────────────────────────${RESET}"
echo ""

# ── Setup ────────────────────────────────────────────────────────────────────
mkdir -p "$LOG_DIR"
> "$PID_FILE"

# Clear ports before starting
lsof -ti:8000 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null
lsof -ti:8081 | xargs kill -9 2>/dev/null
lsof -ti:8082 | xargs kill -9 2>/dev/null
pkill -f "expo start" 2>/dev/null || true
sleep 0.5

# ── Preflight checks ─────────────────────────────────────────────────────────
echo -e "${WHITE}${BOLD}  Preflight${RESET}"

if [[ ! -f "$PROJECT_DIR/venv/bin/python" ]]; then
  echo -e "  ${RED}FAIL${RESET}  Python venv missing"
  echo -e "        Run: python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
  exit 1
fi
echo -e "  ${GREEN}OK${RESET}    Python venv"

if [[ ! -f "$PROJECT_DIR/.env" ]]; then
  echo -e "  ${YELLOW}WARN${RESET}  .env not found — GEMINI_API_KEY may be unset"
else
  echo -e "  ${GREEN}OK${RESET}    .env file"
fi

if [[ ! -d "$PROJECT_DIR/node_modules" ]]; then
  echo -e "  ${YELLOW}WAIT${RESET}  node_modules missing — installing..."
  cd "$PROJECT_DIR" && npm install --silent
fi
echo -e "  ${GREEN}OK${RESET}    node_modules"
echo ""

# ── Python / FastAPI ─────────────────────────────────────────────────────────
echo -e "${WHITE}${BOLD}  [1/3] Python API${RESET}  → http://localhost:8000"
cd "$PROJECT_DIR"
source venv/bin/activate
nohup venv/bin/uvicorn shop_estimate:app \
  --host 0.0.0.0 \
  --port 8000 \
  --reload \
  > "$PYTHON_LOG" 2>&1 &
PYTHON_PID=$!
echo "$PYTHON_PID" >> "$PID_FILE"

echo -n "        starting"
for i in $(seq 1 20); do
  sleep 0.5
  if curl -s http://localhost:8000/docs > /dev/null 2>&1; then
    echo -e "  ${GREEN}READY${RESET}  (pid $PYTHON_PID)"
    break
  fi
  echo -n "."
  if [[ $i -eq 20 ]]; then
    echo -e "  ${YELLOW}SLOW${RESET}  check .logs/python.log"
  fi
done

# ── Vite Web App ─────────────────────────────────────────────────────────────
echo ""
echo -e "${WHITE}${BOLD}  [2/3] Vite Web App${RESET} → http://localhost:5173"
cd "$PROJECT_DIR"
nohup npm run dev > "$WEB_LOG" 2>&1 &
WEB_PID=$!
echo "$WEB_PID" >> "$PID_FILE"

echo -n "        starting"
for i in $(seq 1 20); do
  sleep 0.5
  if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo -e "  ${GREEN}READY${RESET}  (pid $WEB_PID)"
    break
  fi
  echo -n "."
  if [[ $i -eq 20 ]]; then
    echo -e "  ${YELLOW}SLOW${RESET}  check .logs/web.log"
  fi
done

# ── Expo ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${WHITE}${BOLD}  [3/3] Expo Mobile${RESET}  → scan QR below with your phone"
echo ""

# Note: --dev-client only used after EAS Dev Client build is installed on device.
# Until then, use standard Expo Go mode.
EXPO_CMD="npx expo start --lan"

# ── Summary ───────────────────────────────────────────────────────────────────
echo -e "${DIM}  ────────────────────────────────────────${RESET}"
echo -e "${GREEN}  Web App    ${RESET}→ ${CYAN}http://localhost:5173${RESET}"
echo -e "${GREEN}  Python API ${RESET}→ ${CYAN}http://localhost:8000${RESET}"
echo -e "${GREEN}  API Docs   ${RESET}→ ${CYAN}http://localhost:8000/docs${RESET}"
echo -e "${GREEN}  Expo       ${RESET}→ ${CYAN}scan QR code below${RESET}"
echo -e "${DIM}  ────────────────────────────────────────${RESET}"
echo ""
echo -e "${DIM}  Logs: .logs/python.log  .logs/web.log${RESET}"
echo -e "${YELLOW}  Ctrl+C to stop Expo · ./start.sh --stop to stop all${RESET}"
echo ""

# Open browser
open http://localhost:5173 2>/dev/null || true

# Expo runs in foreground — QR code appears here
cd "$PROJECT_DIR"
$EXPO_CMD
