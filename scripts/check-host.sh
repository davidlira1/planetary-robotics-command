#!/usr/bin/env bash
set -euo pipefail

# Read-only host diagnostics. No installs, no sudo, no mutations.

mem_kib() {
  awk -v key="$1" '$1 == key ":" { print $2; exit }' /proc/meminfo
}

fmt_mib() {
  local kib="$1"
  if [[ -z "${kib}" ]]; then
    echo "unknown"
    return
  fi
  awk -v kib="${kib}" 'BEGIN { printf "%.0f MiB\n", kib / 1024 }'
}

cmd_or_missing() {
  if command -v "$1" >/dev/null 2>&1; then
    "$@"
  else
    echo "missing"
  fi
}

os_line="unknown"
if [[ -f /etc/os-release ]]; then
  # shellcheck source=/dev/null
  source /etc/os-release
  os_line="${PRETTY_NAME:-${NAME:-unknown} ${VERSION:-}}"
fi

total_kib="$(mem_kib MemTotal || true)"
available_kib="$(mem_kib MemAvailable || true)"

echo "=== Host diagnostics ==="
echo "hostname:      $(hostname)"
echo "os:            ${os_line}"
echo "arch:          $(uname -m)"
echo "cpus:          $(nproc 2>/dev/null || echo unknown)"
echo "ram total:     $(fmt_mib "${total_kib}")"
echo "ram available: $(fmt_mib "${available_kib}")"
if df -h / >/dev/null 2>&1; then
  df -h / | awk 'NR==2 { printf "root fs:       %s free / %s (%s used)\n", $4, $2, $5 }'
else
  echo "root fs:       unknown"
fi
echo "git:           $(cmd_or_missing git --version)"
echo "docker:        $(cmd_or_missing docker --version)"
if command -v docker >/dev/null 2>&1; then
  echo "compose:       $(docker compose version 2>/dev/null || echo missing)"
else
  echo "compose:       missing"
fi

if command -v systemctl >/dev/null 2>&1; then
  echo "docker daemon: $(systemctl is-active docker 2>/dev/null || echo unknown)"
else
  echo "docker daemon: systemctl not available"
fi

echo ""
echo "=== Containers ==="
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed."
elif docker info >/dev/null 2>&1; then
  docker ps
else
  echo "Docker is installed but this shell cannot talk to the daemon."
  echo "If you just ran bootstrap-host.sh, disconnect and reconnect SSH so docker-group membership applies."
fi
