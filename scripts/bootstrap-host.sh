#!/usr/bin/env bash
set -euo pipefail

# Prepares a disposable Ubuntu host for the PRC production Compose stack.
# Does not create .env.prod, install application runtimes, or configure firewalls.

DOCKER_KEYRING="/etc/apt/keyrings/docker.asc"
DOCKER_LIST="/etc/apt/sources.list.d/docker.list"
MIN_UBUNTU_MAJOR=22

die() {
  echo "error: $*" >&2
  exit 1
}

detect_deploy_user() {
  if [[ "${EUID}" -eq 0 ]]; then
    if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
      printf '%s\n' "${SUDO_USER}"
      return 0
    fi
    die "run as a sudo-capable user, not as root login"
  fi
  if [[ -z "${USER:-}" || "${USER}" == "root" ]]; then
    die "could not detect a non-root deployment user"
  fi
  printf '%s\n' "${USER}"
}

verify_os() {
  if [[ "$(uname -s)" != "Linux" ]]; then
    die "unsupported OS ($(uname -s)); this script supports Ubuntu 22.04 or newer"
  fi
  if [[ ! -f /etc/os-release ]]; then
    die "/etc/os-release is missing; cannot verify Ubuntu"
  fi
  # shellcheck source=/dev/null
  source /etc/os-release
  echo "Detected: ${NAME:-unknown} ${VERSION:-unknown} (${ID:-unknown} ${VERSION_ID:-unknown})"
  if [[ "${ID:-}" != "ubuntu" ]]; then
    die "unsupported distribution '${ID:-unknown}'; this script supports Ubuntu only"
  fi
  local major="${VERSION_ID%%.*}"
  if [[ -z "${major}" || ! "${major}" =~ ^[0-9]+$ ]]; then
    die "could not parse Ubuntu VERSION_ID '${VERSION_ID:-}'"
  fi
  if (( major < MIN_UBUNTU_MAJOR )); then
    die "Ubuntu ${VERSION_ID} is too old; need ${MIN_UBUNTU_MAJOR}.04 LTS or newer"
  fi
}

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

user_in_docker_group() {
  local user="$1"
  id -nG "${user}" 2>/dev/null | grep -qw docker
}

session_can_use_docker() {
  docker info >/dev/null 2>&1
}

print_diagnostics() {
  # shellcheck source=/dev/null
  source /etc/os-release
  local total_kib available_kib
  total_kib="$(mem_kib MemTotal || true)"
  available_kib="$(mem_kib MemAvailable || true)"

  echo ""
  echo "=== Host diagnostics ==="
  echo "hostname:      $(hostname)"
  echo "os:            ${PRETTY_NAME:-${NAME:-unknown} ${VERSION:-}}"
  echo "arch:          $(uname -m)"
  echo "cpus:          $(nproc)"
  echo "ram total:     $(fmt_mib "${total_kib}")"
  echo "ram available: $(fmt_mib "${available_kib}")"
  df -h / | awk 'NR==2 { printf "root fs:       %s free / %s (%s used)\n", $4, $2, $5 }'
  echo "git:           $(git --version 2>/dev/null || echo missing)"
  echo "docker:        $(docker --version 2>/dev/null || echo missing)"
  echo "compose:       $(docker compose version 2>/dev/null || echo missing)"
}

DEPLOY_USER="$(detect_deploy_user)"
echo "Deployment user: ${DEPLOY_USER}"
verify_os

export DEBIAN_FRONTEND=noninteractive

echo ""
echo "=== Base packages ==="
sudo apt-get update
sudo apt-get install -y git curl ca-certificates gnupg

echo ""
echo "=== Docker apt repository ==="
sudo install -m 0755 -d /etc/apt/keyrings
if [[ ! -f "${DOCKER_KEYRING}" ]]; then
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o "${DOCKER_KEYRING}"
  sudo chmod a+r "${DOCKER_KEYRING}"
fi

# shellcheck source=/dev/null
source /etc/os-release
codename="${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}"
[[ -n "${codename}" ]] || die "could not determine Ubuntu codename for the Docker apt repository"
arch="$(dpkg --print-architecture)"
desired_list="deb [arch=${arch} signed-by=${DOCKER_KEYRING}] https://download.docker.com/linux/ubuntu ${codename} stable"
if [[ ! -f "${DOCKER_LIST}" ]] || ! grep -Fxq "${desired_list}" "${DOCKER_LIST}"; then
  printf '%s\n' "${desired_list}" | sudo tee "${DOCKER_LIST}" >/dev/null
fi

sudo apt-get update

echo ""
echo "=== Docker Engine ==="
sudo apt-get install -y \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-buildx-plugin \
  docker-compose-plugin

echo ""
echo "=== Docker service ==="
sudo systemctl enable --now docker
sudo docker info >/dev/null

docker_group_added=0
if getent group docker >/dev/null; then
  if user_in_docker_group "${DEPLOY_USER}"; then
    echo "User ${DEPLOY_USER} is already in the docker group."
  else
    sudo usermod -aG docker "${DEPLOY_USER}"
    docker_group_added=1
    echo "Added ${DEPLOY_USER} to the docker group."
  fi
else
  die "docker group is missing after installing Docker"
fi

echo ""
echo "=== Tooling ==="
git --version
docker --version
docker compose version

echo ""
echo "=== Docker daemon ==="
if session_can_use_docker; then
  docker info
else
  echo "Current shell cannot talk to Docker without sudo yet (group membership applies after a new SSH session)."
  sudo docker info
fi

print_diagnostics

echo ""
echo "Host bootstrap complete."
echo "Git, Docker Engine, and Docker Compose are installed."
echo "Do not install Node, PostgreSQL, RabbitMQ, or Nginx on the host; they run in Compose."
if [[ "${docker_group_added}" -eq 1 ]] || ! session_can_use_docker; then
  echo ""
  echo "Disconnect and reconnect SSH before using docker without sudo, then run:"
  echo "  ./scripts/check-host.sh"
  echo "  cp .env.prod.example .env.prod   # edit secrets"
  echo "  ./scripts/prod-init.sh"
fi
