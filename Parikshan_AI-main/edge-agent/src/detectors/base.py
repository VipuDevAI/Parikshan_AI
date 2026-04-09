"""
Base detector interface for all AI detection modules.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Any
import numpy as np


class BaseDetector(ABC):
    """Abstract base class for all detectors."""
    
    def __init__(self, confidence_threshold: float = 0.8):
        self.confidence_threshold = confidence_threshold
        self._initialized = False
        
    def _initialize(self):
        """Lazy initialization of models. Override in subclass."""
        self._initialized = True
        
    @abstractmethod
    def detect(self, frame: np.ndarray) -> List[Dict]:
        """
        Detect objects/events in frame.
        
        Args:
            frame: OpenCV frame (BGR format)
            
        Returns:
            List of detection results with format:
            {
                'type': 'ATTENDANCE' | 'ALERT' | 'DISCIPLINE' | 'PRESENCE',
                'data': {
                    ... detection-specific data
                }
            }
        """
        pass
        
    @abstractmethod
    def get_name(self) -> str:
        """Get detector name."""
        pass
