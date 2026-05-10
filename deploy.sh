#!/bin/bash
# deploy.sh — lives inside treasury-risk-api/
# On server: cd ~/treasury-risk-api && bash deploy.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
CONTAINER_NAME="treasury-risk-api"
IMAGE_NAME="localhost/treasury-risk-api:latest"

cd "$PROJECT_DIR"

DC="sudo docker compose"
DOCKER="sudo docker"

echo "Stopping existing API container..."
$DC down || true

echo "Restarting Podman socket service..."
sudo systemctl restart podman.socket podman-docker.socket 2>/dev/null || true
sleep 3

echo "Pre-build cleanup..."
$DOCKER image prune -f >/dev/null 2>&1 || true
echo "  Disk before build: $(df -h / | awk 'NR==2{print $3\"/\"$2\" (\"$5\" used)\"}')"

echo "Building API runtime image..."
sudo podman build \
  --security-opt seccomp=unconfined \
  --security-opt label=disable \
  --tag "$IMAGE_NAME" \
  .

echo "Starting API container..."
$DC up -d --force-recreate --remove-orphans

echo "Smoke checking API container..."
sleep 6
sudo podman ps --filter "name=$CONTAINER_NAME" --format '{{.Names}} {{.Status}}'

# Health check from host to ensure process is reachable on mapped port.
for attempt in 1 2 3 4 5; do
  if curl -fsS "http://127.0.0.1:4000/health" >/dev/null; then
    echo "Host health check passed on attempt $attempt."
    break
  fi

  if [ "$attempt" -eq 5 ]; then
    echo "Health check failed after $attempt attempts." >&2
    sudo podman logs --tail 120 "$CONTAINER_NAME" || true
    exit 1
  fi

  echo "Health check retry $attempt/5 failed, waiting..."
  sleep 4
done

# Patch NGINX config on the fly to use container name instead of host IP
# This fixes the 502 Bad Gateway issue if the host firewall blocks the port
NGINX_CONF_PATH="$HOME/atreasury-main-app/nginx/conf.d/api.altisly.com.conf"
if [ -f "$NGINX_CONF_PATH" ]; then
  echo "Patching NGINX config to use container name..."
  sed -i 's/proxy_pass http:\/\/[0-9\.]*:4000;/proxy_pass http:\/\/treasury-risk-api:4000;/g' "$NGINX_CONF_PATH"
  
  echo "Reloading NGINX..."
  NGINX_CONTAINER=$(sudo podman ps --format '{{.Names}}' | grep -E 'nginx' | head -n 1)
  if [ -n "$NGINX_CONTAINER" ]; then
    sudo podman exec "$NGINX_CONTAINER" nginx -s reload || true
  fi
fi

$DOCKER system prune -f >/dev/null 2>&1 || true
echo "  Disk after cleanup: $(df -h / | awk 'NR==2{print $3\"/\"$2\" (\"$5\" used)\"}')"

echo ""
echo "✓ Treasury Risk API deployment complete!"
echo "  Local API: http://127.0.0.1:4000/health"
