#!/bin/bash
# Parikshan.AI Edge Agent - Installation Script
# Run: curl -sSL https://parikshan.ai/edge/install.sh | bash

set -e

echo "============================================"
echo "  Parikshan.AI Edge Agent Installer"
echo "  SmartGenEduX 2025"
echo "============================================"
echo ""

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed."
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check for Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "Error: Docker Compose is not installed."
    echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

# Get installation directory
INSTALL_DIR="${PARIKSHAN_INSTALL_DIR:-/opt/parikshan-edge}"
echo "Installation directory: $INSTALL_DIR"

# Create directory structure
sudo mkdir -p "$INSTALL_DIR"/{config,data,logs}

# Download latest agent files
echo "Downloading Edge Agent..."
cd "$INSTALL_DIR"

# In production, these would be downloaded from parikshan.ai
# For now, we assume files are already present or pulled from git

# Interactive configuration
echo ""
echo "Enter your Edge Agent credentials (from Parikshan.AI dashboard):"
read -p "Agent ID: " AGENT_ID
read -s -p "Agent Secret: " AGENT_SECRET
echo ""
read -p "School Code: " SCHOOL_CODE

# Create .env file
cat > "$INSTALL_DIR/.env" << EOF
AGENT_ID=$AGENT_ID
AGENT_SECRET=$AGENT_SECRET
SCHOOL_CODE=$SCHOOL_CODE
PARIKSHAN_API_URL=https://parikshan.ai
EOF

# Create config file
cat > "$INSTALL_DIR/config/agent.yaml" << EOF
agent:
  id: "$AGENT_ID"
  secret: "$AGENT_SECRET"

api:
  url: "https://parikshan.ai"

school:
  code: "$SCHOOL_CODE"

detection:
  face: true
  discipline: true
  attention: false
  uniform: false

thresholds:
  face: 0.80
  discipline: 0.85

performance:
  max_cameras_per_worker: 10
  frame_skip_count: 5
  detection_interval_ms: 1000
EOF

# Set permissions
sudo chown -R "$USER:$USER" "$INSTALL_DIR"
chmod 600 "$INSTALL_DIR/.env"

echo ""
echo "Starting Edge Agent..."

# Pull and start container
docker-compose up -d

echo ""
echo "============================================"
echo "  Installation Complete!"
echo "============================================"
echo ""
echo "Edge Agent is now running."
echo ""
echo "Useful commands:"
echo "  View logs:    docker-compose logs -f"
echo "  Stop agent:   docker-compose down"
echo "  Update:       docker-compose pull && docker-compose up -d"
echo "  Status:       curl http://localhost:8080/status"
echo ""
echo "Dashboard: Configure cameras at https://parikshan.ai/cameras"
echo ""
