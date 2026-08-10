import json
import logging
from typing import Dict, List
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages active WebSockets connections grouped by meeting ID."""
    
    def __init__(self):
        # Maps meeting_id -> list of WebSockets
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, meeting_id: int):
        """Accept connection and add to the meeting's channel list."""
        await websocket.accept()
        if meeting_id not in self.active_connections:
            self.active_connections[meeting_id] = []
        self.active_connections[meeting_id].append(websocket)
        logger.info(f"WebSocket client connected to meeting channel: {meeting_id}")

    def disconnect(self, websocket: WebSocket, meeting_id: int):
        """Remove connection from active meeting channel list."""
        if meeting_id in self.active_connections:
            if websocket in self.active_connections[meeting_id]:
                self.active_connections[meeting_id].remove(websocket)
                logger.info(f"WebSocket client disconnected from meeting channel: {meeting_id}")
            if not self.active_connections[meeting_id]:
                del self.active_connections[meeting_id]

    async def send_personal_message(self, message: str, websocket: WebSocket):
        """Send message to a single client socket."""
        await websocket.send_text(message)

    async def broadcast_to_meeting(self, meeting_id: int, message: dict):
        """Broadcast JSON payload to all connections in a meeting group."""
        if meeting_id in self.active_connections:
            payload = json.dumps(message)
            for connection in self.active_connections[meeting_id]:
                try:
                    await connection.send_text(payload)
                except Exception as e:
                    logger.error(f"Error broadcasting to socket in meeting {meeting_id}: {e}")
                    # Socket might be stale, we will handle cleanups during disconnects


# Global connection manager singleton
manager = ConnectionManager()
