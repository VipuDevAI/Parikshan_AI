"""
API client for communicating with Parikshan.AI cloud.
"""

import aiohttp
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)


class ParikShanAPIClient:
    """Client for Parikshan.AI cloud API."""
    
    def __init__(self, api_url: str, agent_id: str, secret: str, school_code: str = ""):
        self.api_url = api_url.rstrip('/')
        self.agent_id = agent_id
        self.secret = secret
        self.school_code = school_code
        self.token: Optional[str] = None
        self.token_expires_at: Optional[datetime] = None
        self.school_id: Optional[int] = None
        self._session: Optional[aiohttp.ClientSession] = None
        
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create HTTP session."""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session
        
    async def close(self):
        """Close the HTTP session."""
        if self._session and not self._session.closed:
            await self._session.close()
            
    def _get_headers(self) -> Dict[str, str]:
        """Get headers for authenticated requests."""
        headers = {
            'Content-Type': 'application/json',
            'X-Agent-Id': self.agent_id
        }
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        return headers
        
    async def login(self) -> bool:
        """Authenticate with the cloud and get access token."""
        try:
            session = await self._get_session()
            
            async with session.post(
                f'{self.api_url}/api/edge/login',
                json={
                    'agentId': self.agent_id,
                    'secret': self.secret,
                    'schoolCode': self.school_code
                },
                headers={'Content-Type': 'application/json'}
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    self.token = data['token']
                    self.token_expires_at = datetime.fromisoformat(data['expiresAt'].replace('Z', '+00:00'))
                    self.school_id = data['schoolId']
                    logger.info(f"Logged in successfully. School ID: {self.school_id}")
                    return True
                else:
                    error = await resp.text()
                    logger.error(f"Login failed: {resp.status} - {error}")
                    return False
                    
        except Exception as e:
            logger.error(f"Login error: {e}")
            return False
            
    async def _ensure_authenticated(self):
        """Ensure we have a valid token, re-authenticate if needed."""
        if not self.token or (self.token_expires_at and datetime.now(self.token_expires_at.tzinfo) >= self.token_expires_at):
            await self.login()
            
    async def get_config(self) -> Optional[Dict]:
        """Get camera and face encoding configuration from cloud."""
        await self._ensure_authenticated()
        
        try:
            session = await self._get_session()
            
            async with session.get(
                f'{self.api_url}/api/edge/config',
                headers=self._get_headers()
            ) as resp:
                if resp.status == 200:
                    return await resp.json()
                else:
                    error = await resp.text()
                    logger.error(f"Get config failed: {resp.status} - {error}")
                    return None
                    
        except Exception as e:
            logger.error(f"Get config error: {e}")
            return None
            
    async def send_heartbeat(self, metrics: Dict) -> bool:
        """Send heartbeat with agent metrics."""
        await self._ensure_authenticated()
        
        try:
            session = await self._get_session()
            
            async with session.post(
                f'{self.api_url}/api/edge/heartbeat',
                json=metrics,
                headers=self._get_headers()
            ) as resp:
                if resp.status == 200:
                    return True
                else:
                    error = await resp.text()
                    logger.warning(f"Heartbeat failed: {resp.status} - {error}")
                    return False
                    
        except Exception as e:
            logger.error(f"Heartbeat error: {e}")
            return False
            
    async def submit_events(self, events: List[Dict]) -> Dict:
        """Submit detection events to cloud."""
        await self._ensure_authenticated()
        
        try:
            session = await self._get_session()
            
            formatted_events = []
            for event in events:
                formatted_events.append({
                    'type': event['type'],
                    'cameraId': event['camera_id'],
                    'timestamp': event['timestamp'],
                    'data': event['data']
                })
                
            async with session.post(
                f'{self.api_url}/api/edge/events',
                json={
                    'agentId': self.agent_id,
                    'events': formatted_events
                },
                headers=self._get_headers()
            ) as resp:
                if resp.status == 200:
                    return await resp.json()
                else:
                    error = await resp.text()
                    logger.error(f"Submit events failed: {resp.status} - {error}")
                    return {'processed': 0, 'failed': len(events)}
                    
        except Exception as e:
            logger.error(f"Submit events error: {e}")
            return {'processed': 0, 'failed': len(events)}
