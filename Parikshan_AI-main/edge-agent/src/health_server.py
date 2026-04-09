"""
Health check server for Docker/Kubernetes health probes.
"""

import asyncio
import logging
from aiohttp import web
from typing import Any

logger = logging.getLogger(__name__)


class HealthServer:
    """HTTP server for health checks and metrics."""
    
    def __init__(self, port: int = 8080, agent: Any = None):
        self.port = port
        self.agent = agent
        self._app: web.Application = None
        self._runner: web.AppRunner = None
        self._site: web.TCPSite = None
        
    async def start(self):
        """Start the health server."""
        self._app = web.Application()
        self._app.router.add_get('/health', self._health_handler)
        self._app.router.add_get('/ready', self._ready_handler)
        self._app.router.add_get('/metrics', self._metrics_handler)
        self._app.router.add_get('/status', self._status_handler)
        
        self._runner = web.AppRunner(self._app)
        await self._runner.setup()
        self._site = web.TCPSite(self._runner, '0.0.0.0', self.port)
        await self._site.start()
        
        logger.info(f"Health server started on port {self.port}")
        
    async def stop(self):
        """Stop the health server."""
        if self._runner:
            await self._runner.cleanup()
            
    async def _health_handler(self, request: web.Request) -> web.Response:
        """Health check endpoint."""
        return web.json_response({'status': 'healthy'})
        
    async def _ready_handler(self, request: web.Request) -> web.Response:
        """Readiness check endpoint."""
        if self.agent and hasattr(self.agent, '_running') and self.agent._running:
            return web.json_response({'status': 'ready'})
        else:
            return web.json_response({'status': 'not_ready'}, status=503)
            
    async def _metrics_handler(self, request: web.Request) -> web.Response:
        """Prometheus-compatible metrics endpoint."""
        if not self.agent:
            return web.json_response({})
            
        metrics = []
        
        if hasattr(self.agent, 'event_queue'):
            queue_stats = self.agent.event_queue.get_queue_stats()
            metrics.append(f'edge_agent_events_pending {queue_stats.get("pending", 0)}')
            metrics.append(f'edge_agent_events_processed_total {queue_stats.get("total_processed", 0)}')
            metrics.append(f'edge_agent_events_failed {queue_stats.get("failed", 0)}')
            
        if hasattr(self.agent, 'rtsp_manager') and self.agent.rtsp_manager:
            metrics.append(f'edge_agent_cameras_active {self.agent.rtsp_manager.active_camera_count}')
            
            for stat in self.agent.rtsp_manager.get_stats():
                camera_id = stat['camera_id']
                metrics.append(f'edge_agent_camera_frames_processed{{camera_id="{camera_id}"}} {stat["frames_processed"]}')
                metrics.append(f'edge_agent_camera_detections{{camera_id="{camera_id}"}} {stat["detections_count"]}')
                metrics.append(f'edge_agent_camera_errors{{camera_id="{camera_id}"}} {stat["errors_count"]}')
                metrics.append(f'edge_agent_camera_connected{{camera_id="{camera_id}"}} {1 if stat["is_connected"] else 0}')
                
        return web.Response(text='\n'.join(metrics), content_type='text/plain')
        
    async def _status_handler(self, request: web.Request) -> web.Response:
        """Detailed status endpoint."""
        if not self.agent:
            return web.json_response({'status': 'unknown'})
            
        status = {
            'status': 'running' if self.agent._running else 'stopped',
            'version': self.agent.config.version if hasattr(self.agent, 'config') else 'unknown',
            'agent_id': self.agent.config.agent_id if hasattr(self.agent, 'config') else 'unknown',
        }
        
        if hasattr(self.agent, 'event_queue'):
            status['queue'] = self.agent.event_queue.get_queue_stats()
            
        if hasattr(self.agent, 'rtsp_manager') and self.agent.rtsp_manager:
            status['cameras'] = {
                'active': self.agent.rtsp_manager.active_camera_count,
                'total': len(self.agent.config.cameras) if hasattr(self.agent, 'config') else 0,
                'streams': self.agent.rtsp_manager.get_stats()
            }
            
        return web.json_response(status)
