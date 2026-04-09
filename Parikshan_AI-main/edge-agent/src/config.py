"""
Configuration management for Edge Agent.
"""

import os
import yaml
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class CameraConfig:
    """Camera configuration."""
    id: int
    name: str
    rtsp_url: str
    type: str
    location: str
    enabled: bool = True


@dataclass
class NVRConfig:
    """NVR configuration."""
    id: int
    name: str
    ip_address: str
    port: int
    username: str
    password: str
    rtsp_template: str
    total_channels: int


class Config:
    """Edge Agent configuration manager."""
    
    def __init__(self, config_path: str = None):
        self.version = "1.0.0"
        
        self.api_url = os.getenv('PARIKSHAN_API_URL', 'https://parikshan.ai')
        self.agent_id = os.getenv('AGENT_ID', '')
        self.agent_secret = os.getenv('AGENT_SECRET', '')
        self.school_code = os.getenv('SCHOOL_CODE', '')
        
        self.queue_db_path = os.getenv('QUEUE_DB_PATH', '/app/data/queue.db')
        self.log_level = os.getenv('LOG_LEVEL', 'INFO')
        
        self.cameras: List[CameraConfig] = []
        self.nvrs: List[NVRConfig] = []
        self.face_encodings: List[Dict] = []
        self.school_config: Dict = {}
        
        self.heartbeat_interval = 30
        self.config_refresh_interval = 300
        self.event_batch_size = 50
        self.event_sync_interval = 5
        
        self.face_detection_enabled = True
        self.discipline_detection_enabled = True
        self.attention_detection_enabled = False
        self.uniform_detection_enabled = False
        
        self.face_confidence_threshold = 0.80
        self.discipline_confidence_threshold = 0.85
        
        self.max_cameras_per_worker = 10
        self.frame_skip_count = 5
        self.detection_interval_ms = 1000
        
        if config_path and os.path.exists(config_path):
            self._load_from_file(config_path)
            
    def _load_from_file(self, config_path: str):
        """Load configuration from YAML file."""
        try:
            with open(config_path, 'r') as f:
                data = yaml.safe_load(f)
                
            if 'agent' in data:
                agent = data['agent']
                self.agent_id = agent.get('id', self.agent_id)
                self.agent_secret = agent.get('secret', self.agent_secret)
                
            if 'api' in data:
                api = data['api']
                self.api_url = api.get('url', self.api_url)
                
            if 'detection' in data:
                detection = data['detection']
                self.face_detection_enabled = detection.get('face', True)
                self.discipline_detection_enabled = detection.get('discipline', True)
                self.attention_detection_enabled = detection.get('attention', False)
                self.uniform_detection_enabled = detection.get('uniform', False)
                
            if 'thresholds' in data:
                thresholds = data['thresholds']
                self.face_confidence_threshold = thresholds.get('face', 0.80)
                self.discipline_confidence_threshold = thresholds.get('discipline', 0.85)
                
            if 'performance' in data:
                perf = data['performance']
                self.max_cameras_per_worker = perf.get('max_cameras_per_worker', 10)
                self.frame_skip_count = perf.get('frame_skip_count', 5)
                self.detection_interval_ms = perf.get('detection_interval_ms', 1000)
                
            logger.info(f"Loaded configuration from {config_path}")
            
        except Exception as e:
            logger.warning(f"Could not load config file: {e}")
            
    def update_from_cloud(self, cloud_config: Dict):
        """Update configuration from cloud sync."""
        if 'cameras' in cloud_config:
            self.cameras = []
            for cam in cloud_config['cameras']:
                rtsp_url = cam.get('rtspUrl', '')
                if not rtsp_url and cam.get('nvrId'):
                    rtsp_url = self._build_nvr_rtsp_url(cam)
                    
                self.cameras.append(CameraConfig(
                    id=cam['id'],
                    name=cam['name'],
                    rtsp_url=rtsp_url,
                    type=cam.get('type', 'GENERAL'),
                    location=cam.get('location', ''),
                    enabled=cam.get('isActive', True)
                ))
                
        if 'nvrs' in cloud_config:
            self.nvrs = []
            for nvr in cloud_config['nvrs']:
                self.nvrs.append(NVRConfig(
                    id=nvr['id'],
                    name=nvr['name'],
                    ip_address=nvr['ipAddress'],
                    port=nvr.get('port', 554),
                    username=nvr.get('username', ''),
                    password=nvr.get('password', ''),
                    rtsp_template=nvr.get('rtspTemplate', ''),
                    total_channels=nvr.get('totalChannels', 16)
                ))
                
        if 'faceEncodings' in cloud_config:
            self.face_encodings = cloud_config['faceEncodings']
            
        if 'schoolConfig' in cloud_config:
            sc = cloud_config['schoolConfig']
            self.school_config = sc
            self.face_detection_enabled = sc.get('enableFaceRecognition', True)
            self.discipline_detection_enabled = sc.get('enableDisciplineAlerts', True)
            self.face_confidence_threshold = sc.get('attendanceConfidenceThreshold', 80) / 100
            self.discipline_confidence_threshold = sc.get('fightConfidenceThreshold', 85) / 100
            
    def _build_nvr_rtsp_url(self, camera: Dict) -> str:
        """Build RTSP URL for NVR-connected camera."""
        nvr_id = camera.get('nvrId')
        channel = camera.get('channelNumber', 1)
        
        for nvr in self.nvrs:
            if nvr.id == nvr_id:
                template = nvr.rtsp_template or "rtsp://{username}:{password}@{ip}:{port}/cam/realmonitor?channel={channel}&subtype=0"
                return template.format(
                    username=nvr.username,
                    password=nvr.password,
                    ip=nvr.ip_address,
                    port=nvr.port,
                    channel=channel
                )
                
        return ''
        
    def get_active_cameras(self) -> List[CameraConfig]:
        """Get list of active cameras with valid RTSP URLs."""
        return [c for c in self.cameras if c.enabled and c.rtsp_url]
