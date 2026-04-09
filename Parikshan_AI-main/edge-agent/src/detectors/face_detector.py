"""
Face Detection and Recognition module.
Uses face_recognition library (dlib-based) or InsightFace for production.
"""

import logging
from typing import Dict, List, Optional
import numpy as np

from .base import BaseDetector

logger = logging.getLogger(__name__)


class FaceDetector(BaseDetector):
    """Face detection and recognition for attendance tracking."""
    
    def __init__(
        self,
        face_encodings: List[Dict],
        confidence_threshold: float = 0.8,
        use_gpu: bool = False
    ):
        super().__init__(confidence_threshold)
        self.face_encodings_data = face_encodings
        self.use_gpu = use_gpu
        
        self._known_encodings: List[np.ndarray] = []
        self._known_ids: List[Dict] = []
        self._face_recognition = None
        
    def _initialize(self):
        """Load face recognition models and encodings."""
        if self._initialized:
            return
            
        try:
            import face_recognition
            self._face_recognition = face_recognition
            
            for fe in self.face_encodings_data:
                encoding_str = fe.get('encoding', '')
                if encoding_str:
                    try:
                        import base64
                        encoding_bytes = base64.b64decode(encoding_str)
                        encoding = np.frombuffer(encoding_bytes, dtype=np.float64)
                        if len(encoding) == 128:
                            self._known_encodings.append(encoding)
                            self._known_ids.append({
                                'entityType': fe.get('entityType'),
                                'entityId': fe.get('entityId'),
                                'sectionId': fe.get('sectionId')
                            })
                    except Exception as e:
                        logger.warning(f"Failed to decode face encoding: {e}")
                        
            logger.info(f"Loaded {len(self._known_encodings)} face encodings")
            self._initialized = True
            
        except ImportError:
            logger.error("face_recognition not installed. Face detection disabled.")
            self._initialized = True
            
    def detect(self, frame: np.ndarray) -> List[Dict]:
        """Detect and recognize faces in frame."""
        if not self._initialized:
            self._initialize()
            
        if self._face_recognition is None:
            return []
            
        detections = []
        
        try:
            small_frame = frame[::2, ::2, :]
            rgb_frame = small_frame[:, :, ::-1]
            
            face_locations = self._face_recognition.face_locations(rgb_frame, model='hog')
            
            if not face_locations:
                return []
                
            face_encodings = self._face_recognition.face_encodings(rgb_frame, face_locations)
            
            for encoding in face_encodings:
                if len(self._known_encodings) == 0:
                    continue
                    
                distances = self._face_recognition.face_distance(self._known_encodings, encoding)
                best_match_idx = np.argmin(distances)
                
                confidence = 1 - distances[best_match_idx]
                
                if confidence >= self.confidence_threshold:
                    match = self._known_ids[best_match_idx]
                    detections.append({
                        'type': 'ATTENDANCE',
                        'data': {
                            'entityType': match['entityType'],
                            'entityId': match['entityId'],
                            'sectionId': match.get('sectionId'),
                            'confidence': float(confidence)
                        }
                    })
                    
        except Exception as e:
            logger.error(f"Face detection error: {e}")
            
        return detections
        
    def get_name(self) -> str:
        return "FaceDetector"
