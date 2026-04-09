#!/bin/bash
# Parikshan.AI Edge Agent - Uninstallation Script

set -e

echo "============================================"
echo "  Parikshan.AI Edge Agent Uninstaller"
echo "============================================"
echo ""

INSTALL_DIR="${PARIKSHAN_INSTALL_DIR:-/opt/parikshan-edge}"

# Confirm
read -p "This will remove the Edge Agent and all data. Continue? (y/N): " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Cancelled."
    exit 0
fi

# Stop containers
echo "Stopping Edge Agent..."
cd "$INSTALL_DIR" 2>/dev/null && docker-compose down --volumes 2>/dev/null || true

# Remove Docker image
echo "Removing Docker image..."
docker rmi parikshan-edge-agent 2>/dev/null || true

# Remove installation directory
read -p "Remove configuration and data in $INSTALL_DIR? (y/N): " remove_data
if [[ "$remove_data" == "y" || "$remove_data" == "Y" ]]; then
    echo "Removing $INSTALL_DIR..."
    sudo rm -rf "$INSTALL_DIR"
fi

echo ""
echo "Edge Agent uninstalled successfully."
echo ""
