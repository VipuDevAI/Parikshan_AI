"""
AI Detection modules for Edge Agent.
Plugin-based architecture for face recognition, discipline detection, etc.
"""

from typing import Dict, List, Optional, Any
from .base import BaseDetector
from .face_detector import FaceDetector
from .discipline_detector import DisciplineDetector

def create_detector(
    camera_type: str,
    face_encodings: List[Dict],
    config: Dict
) -> 'CompositeDetector':
    """
    Factory function to create appropriate detector based on camera type.
    
    Args:
        camera_type: Type of camera (ENTRY, CLASSROOM, CORRIDOR, etc.)
        face_encodings: List of face encoding data for recognition
        config: School configuration
        
    Returns:
        CompositeDetector with appropriate detection modules
    """
    detectors = []
    
    if config.get('enableFaceRecognition', True):
        detectors.append(FaceDetector(
            face_encodings=face_encodings,
            confidence_threshold=config.get('attendanceConfidenceThreshold', 80) / 100
        ))
        
    if config.get('enableDisciplineAlerts', True) and camera_type in ['CORRIDOR', 'CLASSROOM', 'ENTRY']:
        detectors.append(DisciplineDetector(
            confidence_threshold=config.get('fightConfidenceThreshold', 85) / 100,
            crowding_threshold=config.get('crowdingThreshold', 30),
            running_threshold=config.get('runningThreshold', 5)
        ))
        
    return CompositeDetector(detectors)


class CompositeDetector:
    """Runs multiple detectors on each frame."""
    
    def __init__(self, detectors: List[BaseDetector]):
        self.detectors = detectors
        
    def detect(self, frame) -> List[Dict]:
        """Run all detectors on frame."""
        all_detections = []
        
        for detector in self.detectors:
            try:
                detections = detector.detect(frame)
                if detections:
                    all_detections.extend(detections)
            except Exception as e:
                pass
                
        return all_detections
