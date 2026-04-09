"""
RTSP Stream Manager - Handles camera connections and frame processing.
"""

import cv2
import asyncio
import logging
import threading
from typing import Dict, List, Callable, Optional, Any
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

from .config import CameraConfig

logger = logging.getLogger(__name__)


@dataclass
class StreamStats:
    """Statistics for a camera stream."""
    camera_id: int
    frames_processed: int = 0
    detections_count: int = 0
    errors_count: int = 0
    last_frame_time: Optional[datetime] = None
    is_connected: bool = False


class RTSPStream:
    """Single RTSP camera stream handler."""
    
    def __init__(
        self,
        camera: CameraConfig,
        event_callback: Callable,
        face_encodings: List[Dict],
        school_config: Dict,
        frame_skip: int = 5,
        detection_interval_ms: int = 1000
    ):
        self.camera = camera
        self.event_callback = event_callback
        self.face_encodings = face_encodings
        self.school_config = school_config
        self.frame_skip = frame_skip
        self.detection_interval_ms = detection_interval_ms
        
        self.stats = StreamStats(camera_id=camera.id)
        self._cap: Optional[cv2.VideoCapture] = None
        self._running = False
        self._frame_count = 0
        self._last_detection_time = datetime.now()
        
        self._detector = None
        
    def _init_detector(self):
        """Initialize AI detector (lazy loading)."""
        if self._detector is None:
            from .detectors import create_detector
            self._detector = create_detector(
                camera_type=self.camera.type,
                face_encodings=self.face_encodings,
                config=self.school_config
            )
            
    def connect(self) -> bool:
        """Connect to RTSP stream."""
        try:
            self._cap = cv2.VideoCapture(self.camera.rtsp_url)
            self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            
            if self._cap.isOpened():
                self.stats.is_connected = True
                logger.info(f"Connected to camera {self.camera.name} ({self.camera.id})")
                return True
            else:
                logger.error(f"Failed to connect to camera {self.camera.name}")
                return False
                
        except Exception as e:
            logger.error(f"Connection error for {self.camera.name}: {e}")
            return False
            
    def disconnect(self):
        """Disconnect from RTSP stream."""
        if self._cap:
            self._cap.release()
            self._cap = None
        self.stats.is_connected = False
        
    async def process_frame(self) -> Optional[Dict]:
        """Process a single frame from the stream."""
        if not self._cap or not self._cap.isOpened():
            self.stats.errors_count += 1
            return None
            
        ret, frame = self._cap.read()
        if not ret:
            self.stats.errors_count += 1
            return None
            
        self._frame_count += 1
        self.stats.frames_processed += 1
        self.stats.last_frame_time = datetime.now()
        
        if self._frame_count % self.frame_skip != 0:
            return None
            
        now = datetime.now()
        elapsed_ms = (now - self._last_detection_time).total_seconds() * 1000
        if elapsed_ms < self.detection_interval_ms:
            return None
            
        self._last_detection_time = now
        
        try:
            self._init_detector()
            detections = await asyncio.get_event_loop().run_in_executor(
                None, self._detector.detect, frame
            )
            
            if detections:
                self.stats.detections_count += len(detections)
                for detection in detections:
                    event = {
                        'type': detection['type'],
                        'camera_id': self.camera.id,
                        'timestamp': now.isoformat(),
                        'data': detection['data']
                    }
                    await self.event_callback(event)
                    
            return {'detections': len(detections) if detections else 0}
            
        except Exception as e:
            logger.error(f"Detection error on {self.camera.name}: {e}")
            self.stats.errors_count += 1
            return None


class RTSPStreamManager:
    """Manages multiple RTSP camera streams."""
    
    def __init__(
        self,
        cameras: List[CameraConfig],
        nvrs: List,
        event_callback: Callable,
        face_encodings: List[Dict],
        school_config: Dict,
        max_workers: int = 10
    ):
        self.cameras = cameras
        self.nvrs = nvrs
        self.event_callback = event_callback
        self.face_encodings = face_encodings
        self.school_config = school_config
        
        self._streams: Dict[int, RTSPStream] = {}
        self._running = False
        self._executor = ThreadPoolExecutor(max_workers=max_workers)
        self._tasks: List[asyncio.Task] = []
        
    @property
    def active_camera_count(self) -> int:
        """Get count of active camera connections."""
        return sum(1 for s in self._streams.values() if s.stats.is_connected)
        
    async def start(self):
        """Start all camera streams."""
        logger.info(f"Starting RTSP manager with {len(self.cameras)} cameras")
        self._running = True
        
        for camera in self.cameras:
            if not camera.enabled or not camera.rtsp_url:
                continue
                
            stream = RTSPStream(
                camera=camera,
                event_callback=self.event_callback,
                face_encodings=self.face_encodings,
                school_config=self.school_config
            )
            
            if stream.connect():
                self._streams[camera.id] = stream
                task = asyncio.create_task(self._stream_loop(stream))
                self._tasks.append(task)
                
        logger.info(f"Started {len(self._streams)} camera streams")
        
    async def _stream_loop(self, stream: RTSPStream):
        """Main processing loop for a single stream."""
        reconnect_delay = 5
        
        while self._running:
            try:
                if not stream.stats.is_connected:
                    if stream.connect():
                        reconnect_delay = 5
                    else:
                        await asyncio.sleep(reconnect_delay)
                        reconnect_delay = min(reconnect_delay * 2, 60)
                        continue
                        
                await stream.process_frame()
                await asyncio.sleep(0.033)
                
            except Exception as e:
                logger.error(f"Stream loop error for {stream.camera.name}: {e}")
                stream.disconnect()
                await asyncio.sleep(reconnect_delay)
                
    async def stop(self):
        """Stop all camera streams."""
        logger.info("Stopping RTSP manager")
        self._running = False
        
        for task in self._tasks:
            task.cancel()
            
        for stream in self._streams.values():
            stream.disconnect()
            
        self._streams.clear()
        self._executor.shutdown(wait=False)
        
    async def update_config(self, cameras: List[CameraConfig], face_encodings: List[Dict]):
        """Update camera configuration dynamically."""
        self.cameras = cameras
        self.face_encodings = face_encodings
        
        current_ids = set(self._streams.keys())
        new_ids = set(c.id for c in cameras if c.enabled and c.rtsp_url)
        
        for camera_id in current_ids - new_ids:
            if camera_id in self._streams:
                self._streams[camera_id].disconnect()
                del self._streams[camera_id]
                
        for camera in cameras:
            if camera.id in self._streams:
                self._streams[camera.id].face_encodings = face_encodings
            elif camera.enabled and camera.rtsp_url and camera.id in new_ids - current_ids:
                stream = RTSPStream(
                    camera=camera,
                    event_callback=self.event_callback,
                    face_encodings=face_encodings,
                    school_config=self.school_config
                )
                if stream.connect():
                    self._streams[camera.id] = stream
                    task = asyncio.create_task(self._stream_loop(stream))
                    self._tasks.append(task)
                    
    def get_stats(self) -> List[Dict]:
        """Get statistics for all streams."""
        return [
            {
                'camera_id': s.stats.camera_id,
                'is_connected': s.stats.is_connected,
                'frames_processed': s.stats.frames_processed,
                'detections_count': s.stats.detections_count,
                'errors_count': s.stats.errors_count,
                'last_frame_time': s.stats.last_frame_time.isoformat() if s.stats.last_frame_time else None
            }
            for s in self._streams.values()
        ]
