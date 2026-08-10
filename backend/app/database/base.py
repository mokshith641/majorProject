# Import all the models so that Base has them registered before importing by Alembic
from app.database.session import Base # noqa
from app.models.user import User # noqa
from app.models.settings import UserSettings # noqa
from app.models.meeting import Meeting, Participant # noqa
from app.models.transcription import Transcript # noqa
from app.models.summary import Summary # noqa
from app.models.activity import ActivityLog # noqa
from app.models.report import Report # noqa
from app.models.notification import Notification # noqa

