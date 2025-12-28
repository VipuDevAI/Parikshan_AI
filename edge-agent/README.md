# Parikshan.AI Edge Agent

On-premise AI processing for school camera systems. The Edge Agent runs locally on your school's server to process camera feeds with face recognition and discipline detection, sending only event metadata to the cloud.

## Architecture Overview

```
[Cameras/NVR] --> [Edge Agent] --> [Parikshan.AI Cloud]
     RTSP           Local AI          Events Only
                   Processing          (No Video)
```

### Privacy-First Design

- Video never leaves your premises
- Only metadata events (attendance, alerts) sent to cloud
- Face encodings stored locally and synced securely
- NVR credentials encrypted with AES-256-GCM

## System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 4 cores | 8+ cores (Intel i7/Xeon) |
| RAM | 8 GB | 16 GB+ |
| Storage | 50 GB SSD | 100 GB SSD |
| GPU | None | NVIDIA GTX 1050+ (for 100+ cameras) |
| Network | Gigabit LAN | Gigabit LAN + 25 Mbps upload |
| OS | Ubuntu 20.04+ | Ubuntu 22.04 LTS |

### Camera Capacity Guidelines

| CPU Cores | RAM | Cameras (CPU-only) | Cameras (with GPU) |
|-----------|-----|-------------------|-------------------|
| 4 | 8 GB | 10-15 | 25-30 |
| 8 | 16 GB | 25-35 | 50-75 |
| 16+ | 32 GB | 50-75 | 100-150 |

## Quick Start

### 1. Register Agent in Dashboard

1. Login to Parikshan.AI as Principal or Admin
2. Go to **Cameras** > **Edge Agents** tab
3. Click **Register Edge Agent**
4. Save the **Agent ID** and **Secret** (shown only once!)

### 2. Install on School Server

```bash
# Download and run installer
curl -sSL https://parikshan.ai/edge/install.sh | bash

# Enter credentials when prompted:
# - Agent ID: (from step 1)
# - Agent Secret: (from step 1)
# - School Code: (your school code)
```

### 3. Configure Cameras

1. Go to **Cameras** tab in dashboard
2. Add your cameras with RTSP URLs
3. Edge Agent will automatically sync configuration

## Manual Installation

If the install script doesn't work, you can install manually:

```bash
# 1. Create installation directory
sudo mkdir -p /opt/parikshan-edge/{config,data,logs}

# 2. Clone or download edge-agent files
cd /opt/parikshan-edge
git clone https://github.com/parikshan/edge-agent.git .

# 3. Create .env file
cat > .env << EOF
AGENT_ID=your-agent-id
AGENT_SECRET=your-agent-secret
SCHOOL_CODE=your-school-code
PARIKSHAN_API_URL=https://parikshan.ai
EOF

# 4. Build and start
docker-compose up -d
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `AGENT_ID` | Unique agent identifier from dashboard | Yes |
| `AGENT_SECRET` | One-time secret from registration | Yes |
| `SCHOOL_CODE` | Your school's code | Yes |
| `PARIKSHAN_API_URL` | Cloud API URL | Yes (default: https://parikshan.ai) |
| `LOG_LEVEL` | Logging level (DEBUG, INFO, WARN, ERROR) | No (default: INFO) |
| `MAX_WORKERS` | Max parallel camera processing threads | No (default: 10) |

### config/agent.yaml

```yaml
agent:
  id: "your-agent-id"
  secret: "your-agent-secret"

api:
  url: "https://parikshan.ai"

detection:
  face: true           # Enable face recognition
  discipline: true     # Enable fight/running detection
  attention: false     # Enable attention monitoring
  uniform: false       # Enable uniform check

thresholds:
  face: 0.80           # Face recognition confidence (0.0-1.0)
  discipline: 0.85     # Discipline event confidence

performance:
  max_cameras_per_worker: 10
  frame_skip_count: 5        # Process every Nth frame
  detection_interval_ms: 1000
```

## Operations

### Check Status

```bash
# Container status
docker-compose ps

# Health check
curl http://localhost:8080/health

# Detailed status
curl http://localhost:8080/status

# Prometheus metrics
curl http://localhost:8080/metrics
```

### View Logs

```bash
# Follow logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100

# Check specific log file
tail -f /opt/parikshan-edge/logs/agent.log
```

### Update Agent

```bash
# Run update script
./update.sh

# Or manually
docker-compose pull
docker-compose up -d --force-recreate
```

### Stop/Start

```bash
# Stop
docker-compose down

# Start
docker-compose up -d

# Restart
docker-compose restart
```

### Uninstall

```bash
./uninstall.sh
```

## AI Detection Modules

### Face Recognition

- Uses `face_recognition` library (dlib-based)
- 128-dimensional face encodings
- Supports up to 10,000 face encodings per agent
- Confidence threshold: 80% (configurable)

**Events Generated:**
- `ATTENDANCE`: When a known face is detected at entry cameras

### Discipline Detection

- Uses YOLOv8 for person detection
- Motion tracking for running detection
- Proximity analysis for fight detection
- Crowding threshold monitoring

**Events Generated:**
- `DISCIPLINE`: Running, fighting, or crowding detected

### Attention Monitoring (Optional)

- Head pose estimation
- Gaze direction tracking
- Attention score calculation

**Events Generated:**
- `ATTENTION`: Periodic attention reports for classrooms

## Offline Resilience

The Edge Agent includes a SQLite-based offline queue for network resilience:

- Events queued locally when cloud is unreachable
- Automatic retry with exponential backoff
- Maximum 5 retry attempts per event
- Queue synced every 5 seconds when online
- 7-day retention for processed events

## Troubleshooting

### Agent Not Connecting

1. Check network connectivity:
   ```bash
   curl -I https://parikshan.ai/api/health
   ```

2. Verify credentials:
   ```bash
   cat /opt/parikshan-edge/.env
   ```

3. Check logs for errors:
   ```bash
   docker-compose logs | grep -i error
   ```

### Cameras Not Processing

1. Verify RTSP URLs are accessible:
   ```bash
   ffprobe rtsp://ip:port/stream
   ```

2. Check camera configuration synced:
   ```bash
   curl http://localhost:8080/status | jq '.cameras'
   ```

3. Look for connection errors:
   ```bash
   docker-compose logs | grep -i "rtsp\|camera"
   ```

### High CPU Usage

1. Increase frame skip:
   ```yaml
   performance:
     frame_skip_count: 10  # Process every 10th frame
   ```

2. Reduce active cameras

3. Consider adding GPU support

### Face Recognition Not Working

1. Check face encodings synced:
   ```bash
   curl http://localhost:8080/status | jq '.faceEncodings'
   ```

2. Verify camera placement (faces should be clearly visible)

3. Check lighting conditions

## Security

- All API communication over HTTPS
- Agent authentication with time-limited tokens (24h expiry)
- NVR credentials encrypted at rest (AES-256-GCM)
- No video data transmitted to cloud
- Agent secret stored securely (never logged)

## Support

- Dashboard: https://parikshan.ai
- Documentation: https://docs.parikshan.ai
- Email: support@parikshan.ai
- Phone: +91-XXXX-XXXX-XX

---

Powered by SmartGenEduX 2025 | All Rights Reserved
