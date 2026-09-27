import json
import logging
from typing import Dict, List, Optional
from fastapi import WebSocket

logger = logging.getLogger(__name__)


# Color palette assigned to participants round-robin for visual differentiation
SPEAKER_COLORS = [
    "#8ab4f8",  # Google Meet blue
    "#81c995",  # Green
    "#f28b82",  # Coral red
    "#fdd663",  # Yellow
    "#d7aefb",  # Purple
    "#a8c7fa",  # Light blue
    "#ff8bcb",  # Pink
    "#78d9ec",  # Cyan
]


class ParticipantInfo:
    """Tracks an active WebSocket participant in a meeting room."""
    
    def __init__(self, websocket: WebSocket, user_id: int, name: str, color: str):
        self.websocket = websocket
        self.user_id = user_id
        self.name = name
        self.color = color


class ConnectionManager:
    """Manages active WebSocket connections grouped by meeting ID with user identity tracking."""
    
    def __init__(self):
        # Maps meeting_id -> list of ParticipantInfo
        self.active_connections: Dict[int, List[ParticipantInfo]] = {}

    def _get_next_color(self, meeting_id: int) -> str:
        """Assign the next color in the palette for a new participant."""
        existing = self.active_connections.get(meeting_id, [])
        return SPEAKER_COLORS[len(existing) % len(SPEAKER_COLORS)]

    async def connect(
        self,
        websocket: WebSocket,
        meeting_id: int,
        user_id: int,
        name: str
    ) -> "ParticipantInfo":
        """Accept connection, track participant, and return their info."""
        await websocket.accept()
        
        if meeting_id not in self.active_connections:
            self.active_connections[meeting_id] = []

        color = self._get_next_color(meeting_id)
        participant = ParticipantInfo(
            websocket=websocket,
            user_id=user_id,
            name=name,
            color=color
        )
        self.active_connections[meeting_id].append(participant)
        logger.info(
            f"User '{name}' (id={user_id}) joined meeting room {meeting_id}. "
            f"Total participants: {len(self.active_connections[meeting_id])}"
        )
        return participant

    def disconnect(self, websocket: WebSocket, meeting_id: int) -> Optional["ParticipantInfo"]:
        """Remove connection from active meeting channel list. Returns the removed participant."""
        removed: Optional[ParticipantInfo] = None
        if meeting_id in self.active_connections:
            for p in list(self.active_connections[meeting_id]):
                if p.websocket == websocket:
                    self.active_connections[meeting_id].remove(p)
                    removed = p
                    logger.info(
                        f"User '{p.name}' (id={p.user_id}) left meeting room {meeting_id}. "
                        f"Remaining: {len(self.active_connections[meeting_id])}"
                    )
                    break
            if not self.active_connections[meeting_id]:
                del self.active_connections[meeting_id]
        return removed

    def get_participants(self, meeting_id: int) -> List[dict]:
        """Return a serializable list of active participants for a meeting."""
        participants = self.active_connections.get(meeting_id, [])
        return [
            {
                "user_id": p.user_id,
                "name": p.name,
                "color": p.color,
            }
            for p in participants
        ]

    def get_participant_count(self, meeting_id: int) -> int:
        """Return number of connected participants for a given meeting."""
        return len(self.active_connections.get(meeting_id, []))

    def get_color_for_user(self, meeting_id: int, user_id: int) -> str:
        """Look up a participant's assigned color by user_id."""
        for p in self.active_connections.get(meeting_id, []):
            if p.user_id == user_id:
                return p.color
        return SPEAKER_COLORS[0]

    async def send_personal_message(self, message: str, websocket: WebSocket):
        """Send message to a single client socket."""
        await websocket.send_text(message)

    async def broadcast_to_meeting(self, meeting_id: int, message: dict, exclude_ws: Optional[WebSocket] = None):
        """Broadcast JSON payload to all connections in a meeting group, optionally excluding one socket."""
        if meeting_id in self.active_connections:
            payload = json.dumps(message)
            dead_sockets = []
            for participant in self.active_connections[meeting_id]:
                if exclude_ws and participant.websocket == exclude_ws:
                    continue
                try:
                    await participant.websocket.send_text(payload)
                except Exception as e:
                    logger.error(f"Error broadcasting to socket in meeting {meeting_id}: {e}")
                    dead_sockets.append(participant)

            # Clean up dead sockets
            for dead in dead_sockets:
                if dead in self.active_connections.get(meeting_id, []):
                    self.active_connections[meeting_id].remove(dead)


# Global connection manager singleton
manager = ConnectionManager()
