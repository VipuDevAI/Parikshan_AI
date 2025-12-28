#!/usr/bin/env python3
"""
Parikshan.AI Edge Agent - Main Entry Point
Connects to RTSP cameras, runs AI detection locally, sends events to cloud.
"""

import os
import sys
import signal
import logging
import asyncio
import threading
from typing import Dict, Optional
from datetime import datetime

from .config import Config
from .api_client import ParikShanAPIClient
from .rtsp_manager import RTSPStreamManager
from .event_queue import EventQueue
from .health_server import HealthServer

logging.basicConfig(
    level=os.getenv('LOG_LEVEL', 'INFO'),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class EdgeAgent:
    """Main Edge Agent orchestrator."""
    
    def __init__(self, config_path: str = None):
        self.config = Config(config_path)
        self.api_client = ParikShanAPIClient(
            api_url=self.config.api_url,
            agent_id=self.config.agent_id,
            secret=self.config.agent_secret,
            school_code=self.config.school_code
        )
        self.event_queue = EventQueue(db_path=self.config.queue_db_path)
        self.rtsp_manager: Optional[RTSPStreamManager] = None
        self.health_server: Optional[HealthServer] = None
        self._shutdown_event = asyncio.Event()
        self._running = False
        
    async def start(self):
        """Start the Edge Agent."""
        logger.info(f"Starting Parikshan.AI Edge Agent v{self.config.version}")
        
        try:
            await self._authenticate()
            await self._sync_configuration()
            await self._start_services()
            await self._run_main_loop()
        except Exception as e:
            logger.error(f"Fatal error: {e}")
            await self.stop()
            raise
            
    async def _authenticate(self):
        """Authenticate with Parikshan.AI cloud."""
        logger.info("Authenticating with Parikshan.AI cloud...")
        success = await self.api_client.login()
        if not success:
            raise RuntimeError("Failed to authenticate with Parikshan.AI")
        logger.info("Authentication successful")
        
    async def _sync_configuration(self):
        """Sync camera and face encoding configuration from cloud."""
        logger.info("Syncing configuration from cloud...")
        config_data = await self.api_client.get_config()
        
        if config_data:
            self.config.update_from_cloud(config_data)
            logger.info(f"Synced {len(config_data.get('cameras', []))} cameras, "
                       f"{len(config_data.get('faceEncodings', []))} face encodings")
        else:
            logger.warning("No configuration received from cloud")
            
    async def _start_services(self):
        """Start all agent services."""
        self.health_server = HealthServer(port=8080, agent=self)
        await self.health_server.start()
        
        self.rtsp_manager = RTSPStreamManager(
            cameras=self.config.cameras,
            nvrs=self.config.nvrs,
            event_callback=self._handle_detection_event,
            face_encodings=self.config.face_encodings,
            school_config=self.config.school_config
        )
        await self.rtsp_manager.start()
        
        asyncio.create_task(self._event_sync_loop())
        asyncio.create_task(self._heartbeat_loop())
        asyncio.create_task(self._config_refresh_loop())
        
        self._running = True
        logger.info("All services started successfully")
        
    async def _run_main_loop(self):
        """Main event loop - waits for shutdown signal."""
        logger.info("Edge Agent running. Press Ctrl+C to stop.")
        await self._shutdown_event.wait()
        
    async def _handle_detection_event(self, event: Dict):
        """Handle detection events from RTSP streams."""
        await self.event_queue.enqueue(event)
        
    async def _event_sync_loop(self):
        """Periodically sync queued events to cloud."""
        while not self._shutdown_event.is_set():
            try:
                events = await self.event_queue.get_pending(batch_size=50)
                if events:
                    result = await self.api_client.submit_events(events)
                    if result['processed'] > 0:
                        await self.event_queue.mark_processed([e['id'] for e in events[:result['processed']]])
                    logger.info(f"Synced {result['processed']} events, {result.get('failed', 0)} failed")
            except Exception as e:
                logger.error(f"Event sync error: {e}")
                
            await asyncio.sleep(5)
            
    async def _heartbeat_loop(self):
        """Send periodic heartbeats to cloud."""
        while not self._shutdown_event.is_set():
            try:
                metrics = self._collect_metrics()
                await self.api_client.send_heartbeat(metrics)
            except Exception as e:
                logger.error(f"Heartbeat error: {e}")
                
            await asyncio.sleep(30)
            
    async def _config_refresh_loop(self):
        """Periodically refresh configuration from cloud."""
        while not self._shutdown_event.is_set():
            await asyncio.sleep(300)
            try:
                await self._sync_configuration()
                if self.rtsp_manager:
                    await self.rtsp_manager.update_config(
                        self.config.cameras,
                        self.config.face_encodings
                    )
            except Exception as e:
                logger.error(f"Config refresh error: {e}")
                
    def _collect_metrics(self) -> Dict:
        """Collect agent metrics for heartbeat."""
        return {
            'agentId': self.config.agent_id,
            'status': 'ONLINE' if self._running else 'OFFLINE',
            'activeCameras': self.rtsp_manager.active_camera_count if self.rtsp_manager else 0,
            'eventsProcessed': self.event_queue.processed_count,
            'eventsQueuedOffline': self.event_queue.pending_count,
            'version': self.config.version,
            'hostname': os.uname().nodename if hasattr(os, 'uname') else 'unknown',
            'ipAddress': self._get_local_ip()
        }
        
    def _get_local_ip(self) -> str:
        """Get local IP address."""
        import socket
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return "unknown"
            
    async def stop(self):
        """Stop the Edge Agent gracefully."""
        logger.info("Stopping Edge Agent...")
        self._shutdown_event.set()
        self._running = False
        
        if self.rtsp_manager:
            await self.rtsp_manager.stop()
        if self.health_server:
            await self.health_server.stop()
            
        await self.event_queue.flush()
        logger.info("Edge Agent stopped")


async def main():
    """Main entry point."""
    config_path = os.getenv('CONFIG_PATH', '/app/config/agent.yaml')
    agent = EdgeAgent(config_path)
    
    def signal_handler(sig, frame):
        logger.info("Received shutdown signal")
        asyncio.create_task(agent.stop())
        
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        await agent.start()
    except KeyboardInterrupt:
        await agent.stop()


if __name__ == "__main__":
    asyncio.run(main())
