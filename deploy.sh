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

$DOCKER system prune -f >/dev/null 2>&1 || true
echo "  Disk after cleanup: $(df -h / | awk 'NR==2{print $3\"/\"$2\" (\"$5\" used)\"}')"

echo ""
echo "✓ Treasury Risk API deployment complete!"
echo "  Local API: http://127.0.0.1:4000/health"
