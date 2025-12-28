#!/bin/bash
# Parikshan.AI Edge Agent - Update Script

set -e

echo "============================================"
echo "  Parikshan.AI Edge Agent Updater"
echo "============================================"
echo ""

INSTALL_DIR="${PARIKSHAN_INSTALL_DIR:-/opt/parikshan-edge}"

cd "$INSTALL_DIR"

# Get current version
echo "Current version:"
curl -s http://localhost:8080/status | grep -o '"version":"[^"]*"' || echo "Unknown"

echo ""
echo "Pulling latest version..."

# Pull latest image
docker-compose pull

echo "Restarting with new version..."

# Recreate container with new image
docker-compose up -d --force-recreate

echo ""
echo "Waiting for agent to start..."
sleep 5

# Check new version
echo "New version:"
curl -s http://localhost:8080/status | grep -o '"version":"[^"]*"' || echo "Unknown"

echo ""
echo "Update complete!"
echo ""
