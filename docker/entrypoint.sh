#!/usr/bin/env bash
set -Eeuo pipefail

workspace_key=$(printf '%s' "${PIARRE_WORKSPACE_SOURCE:?Workspace source is required}" | sha256sum | cut -c1-24)
profile="$PIARRE_USER_DATA/workspaces/$workspace_key"
mkdir -p "$profile/User" "$CODEX_HOME"
if [[ ! -f "$profile/User/settings.json" ]]; then
  cp /opt/piarre/settings.json "$profile/User/settings.json"
fi
if [[ ! -f "$CODEX_HOME/config.toml" ]]; then
  printf 'cli_auth_credentials_store = "file"\n' > "$CODEX_HOME/config.toml"
fi
git config --global --replace-all safe.directory /workspace

pids=()
cleanup() {
  trap - EXIT INT TERM
  if ((${#pids[@]})); then
    kill "${pids[@]}" 2>/dev/null || true
    wait "${pids[@]}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM
Xvfb "$DISPLAY" -screen 0 "${PIARRE_SCREEN:-1600x1000x24}" -nolisten tcp &
pids+=("$!")
for attempt in {1..50}; do
  if xdpyinfo -display "$DISPLAY" >/dev/null 2>&1; then break; fi
  sleep 0.1
done
xdpyinfo -display "$DISPLAY" >/dev/null
openbox &
pids+=("$!")
x11vnc -display "$DISPLAY" -forever -shared -nopw -localhost -rfbport 5900 -quiet &
pids+=("$!")
websockify --web=/usr/share/novnc 6080 127.0.0.1:5900 &
pids+=("$!")
dbus-run-session -- code --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --user-data-dir "$profile" --extensions-dir /opt/piarre/extensions \
  --new-window --wait /workspace &
pids+=("$!")
printf '\nPiarre desktop is listening on container port 6080\nSign in once: docker compose exec piarre codex login --device-auth\n'
wait -n "${pids[@]}"
