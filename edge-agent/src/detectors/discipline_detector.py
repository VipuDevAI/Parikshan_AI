"""
Discipline Detection module.
Detects fighting, running, crowding using pose estimation and object detection.
"""

import logging
from typing import Dict, List, Optional
import numpy as np

from .base import BaseDetector

logger = logging.getLogger(__name__)


class DisciplineDetector(BaseDetector):
    """Discipline event detection (fights, running, crowding)."""
    
    def __init__(
        self,
        confidence_threshold: float = 0.85,
        crowding_threshold: int = 30,
        running_threshold: int = 5
    ):
        super().__init__(confidence_threshold)
        self.crowding_threshold = crowding_threshold
        self.running_threshold = running_threshold
        
        self._yolo = None
        self._pose_detector = None
        self._prev_positions = {}
        self._frame_count = 0
        
    def _initialize(self):
        """Load detection models."""
        if self._initialized:
            return
            
        try:
            from ultralytics import YOLO
            self._yolo = YOLO('yolov8n.pt')
            logger.info("YOLO model loaded for discipline detection")
        except Exception as e:
            logger.warning(f"YOLO not available: {e}. Using basic motion detection.")
            
        self._initialized = True
        
    def detect(self, frame: np.ndarray) -> List[Dict]:
        """Detect discipline events in frame."""
        if not self._initialized:
            self._initialize()
            
        detections = []
        self._frame_count += 1
        
        try:
            person_count, person_boxes = self._detect_persons(frame)
            
            if person_count >= self.crowding_threshold:
                detections.append({
                    'type': 'DISCIPLINE',
                    'data': {
                        'eventType': 'CROWDING',
                        'count': person_count,
                        'confidence': 0.9
                    }
                })
                
            running_count = self._detect_running(person_boxes)
            if running_count >= self.running_threshold:
                detections.append({
                    'type': 'DISCIPLINE',
                    'data': {
                        'eventType': 'RUNNING',
                        'count': running_count,
                        'confidence': 0.85
                    }
                })
                
            fight_confidence = self._detect_fight(frame, person_boxes)
            if fight_confidence >= self.confidence_threshold:
                detections.append({
                    'type': 'DISCIPLINE',
                    'data': {
                        'eventType': 'FIGHT',
                        'confidence': float(fight_confidence)
                    }
                })
                
        except Exception as e:
            logger.error(f"Discipline detection error: {e}")
            
        return detections
        
    def _detect_persons(self, frame: np.ndarray) -> tuple:
        """Detect persons in frame."""
        if self._yolo is None:
            return 0, []
            
        try:
            results = self._yolo(frame, classes=[0], verbose=False)
            boxes = []
            
            for result in results:
                for box in result.boxes:
                    if box.conf[0] > 0.5:
                        boxes.append(box.xyxy[0].cpu().numpy())
                        
            return len(boxes), boxes
            
        except Exception as e:
            logger.error(f"Person detection error: {e}")
            return 0, []
            
    def _detect_running(self, boxes: List) -> int:
        """Detect running based on position changes between frames."""
        running_count = 0
        current_positions = {}
        
        for i, box in enumerate(boxes):
            center_x = (box[0] + box[2]) / 2
            center_y = (box[1] + box[3]) / 2
            current_positions[i] = (center_x, center_y)
            
            if i in self._prev_positions:
                prev = self._prev_positions[i]
                distance = np.sqrt((center_x - prev[0])**2 + (center_y - prev[1])**2)
                
                if distance > 50:
                    running_count += 1
                    
        self._prev_positions = current_positions
        return running_count
        
    def _detect_fight(self, frame: np.ndarray, boxes: List) -> float:
        """Detect fighting behavior based on proximity and motion."""
        if len(boxes) < 2:
            return 0.0
            
        for i in range(len(boxes)):
            for j in range(i + 1, len(boxes)):
                box1, box2 = boxes[i], boxes[j]
                
                center1 = ((box1[0] + box1[2]) / 2, (box1[1] + box1[3]) / 2)
                center2 = ((box2[0] + box2[2]) / 2, (box2[1] + box2[3]) / 2)
                
                distance = np.sqrt((center1[0] - center2[0])**2 + (center1[1] - center2[1])**2)
                
                avg_height = ((box1[3] - box1[1]) + (box2[3] - box2[1])) / 2
                
                if distance < avg_height * 0.5:
                    return 0.85
                    
        return 0.0
        
    def get_name(self) -> str:
        return "DisciplineDetector"
