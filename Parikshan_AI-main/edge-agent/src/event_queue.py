"""
Event Queue - SQLite-based offline resilience for events.
"""

import sqlite3
import json
import logging
import asyncio
from typing import Dict, List, Optional
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)


class EventQueue:
    """SQLite-based event queue for offline resilience."""
    
    def __init__(self, db_path: str = '/app/data/queue.db'):
        self.db_path = db_path
        self._processed_count = 0
        self._init_db()
        
    def _init_db(self):
        """Initialize SQLite database."""
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                camera_id INTEGER NOT NULL,
                timestamp TEXT NOT NULL,
                data TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                retry_count INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                processed_at TEXT
            )
        ''')
        
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_events_status ON events(status)
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS stats (
                key TEXT PRIMARY KEY,
                value INTEGER DEFAULT 0
            )
        ''')
        
        cursor.execute('INSERT OR IGNORE INTO stats (key, value) VALUES (?, ?)', ('processed_count', 0))
        cursor.execute('SELECT value FROM stats WHERE key = ?', ('processed_count',))
        row = cursor.fetchone()
        if row:
            self._processed_count = row[0]
            
        conn.commit()
        conn.close()
        
        logger.info(f"Event queue initialized at {self.db_path}")
        
    @property
    def processed_count(self) -> int:
        """Total events processed."""
        return self._processed_count
        
    @property
    def pending_count(self) -> int:
        """Count of pending events in queue."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM events WHERE status = ?', ('pending',))
        count = cursor.fetchone()[0]
        conn.close()
        return count
        
    async def enqueue(self, event: Dict) -> int:
        """Add event to queue."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO events (type, camera_id, timestamp, data)
            VALUES (?, ?, ?, ?)
        ''', (
            event['type'],
            event['camera_id'],
            event['timestamp'],
            json.dumps(event['data'])
        ))
        
        event_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return event_id
        
    async def get_pending(self, batch_size: int = 50) -> List[Dict]:
        """Get pending events for processing."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, type, camera_id, timestamp, data, retry_count
            FROM events
            WHERE status = ? AND retry_count < 5
            ORDER BY created_at ASC
            LIMIT ?
        ''', ('pending', batch_size))
        
        rows = cursor.fetchall()
        conn.close()
        
        return [
            {
                'id': row['id'],
                'type': row['type'],
                'camera_id': row['camera_id'],
                'timestamp': row['timestamp'],
                'data': json.loads(row['data']),
                'retry_count': row['retry_count']
            }
            for row in rows
        ]
        
    async def mark_processed(self, event_ids: List[int]):
        """Mark events as processed."""
        if not event_ids:
            return
            
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        placeholders = ','.join('?' * len(event_ids))
        cursor.execute(f'''
            UPDATE events
            SET status = 'processed', processed_at = ?
            WHERE id IN ({placeholders})
        ''', [datetime.now().isoformat()] + event_ids)
        
        self._processed_count += len(event_ids)
        cursor.execute('UPDATE stats SET value = ? WHERE key = ?', (self._processed_count, 'processed_count'))
        
        conn.commit()
        conn.close()
        
    async def mark_failed(self, event_ids: List[int]):
        """Mark events as failed and increment retry count."""
        if not event_ids:
            return
            
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        placeholders = ','.join('?' * len(event_ids))
        cursor.execute(f'''
            UPDATE events
            SET retry_count = retry_count + 1,
                status = CASE WHEN retry_count >= 4 THEN 'failed' ELSE 'pending' END
            WHERE id IN ({placeholders})
        ''', event_ids)
        
        conn.commit()
        conn.close()
        
    async def flush(self):
        """Flush any pending writes to disk."""
        pass
        
    async def cleanup_old(self, days: int = 7):
        """Remove old processed/failed events."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            DELETE FROM events
            WHERE status IN ('processed', 'failed')
            AND created_at < datetime('now', ?)
        ''', (f'-{days} days',))
        
        deleted = cursor.rowcount
        conn.commit()
        conn.close()
        
        if deleted > 0:
            logger.info(f"Cleaned up {deleted} old events")
            
    def get_queue_stats(self) -> Dict:
        """Get queue statistics."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT status, COUNT(*) as count
            FROM events
            GROUP BY status
        ''')
        
        stats = {'pending': 0, 'processed': 0, 'failed': 0}
        for row in cursor.fetchall():
            stats[row[0]] = row[1]
            
        conn.close()
        
        return {
            **stats,
            'total_processed': self._processed_count
        }
