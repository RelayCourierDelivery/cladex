from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from .models import Approval, ConversationNote, FreightLoad, LoadStatus
from .repository import FreightRepository


class FreightValidationError(ValueError):
    pass


class InvalidLoadTransition(FreightValidationError):
    pass


class FreightService:
    """Manual, auditable freight workflow; external actions are intentionally absent."""

    _ALLOWED_TRANSITIONS: dict[LoadStatus, set[LoadStatus]] = {
        LoadStatus.DRAFT: {LoadStatus.SUBMITTED, LoadStatus.CANCELLED},
        LoadStatus.SUBMITTED: {LoadStatus.APPROVED, LoadStatus.CANCELLED},
        LoadStatus.APPROVED: {LoadStatus.POSTED, LoadStatus.CANCELLED},
        LoadStatus.POSTED: {LoadStatus.ASSIGNED, LoadStatus.CANCELLED},
        LoadStatus.ASSIGNED: {LoadStatus.IN_TRANSIT, LoadStatus.CANCELLED},
        LoadStatus.IN_TRANSIT: {LoadStatus.DELIVERED, LoadStatus.CANCELLED},
        LoadStatus.DELIVERED: set(),
        LoadStatus.CANCELLED: set(),
    }

    def __init__(self, repository: FreightRepository) -> None:
        self.repository = repository

    def create_load(
        self,
        *,
        reference: str,
        origin: str,
        destination: str,
        commodity: str,
        created_by: str,
        **optional_fields: object,
    ) -> FreightLoad:
        required = {
            "reference": reference,
            "origin": origin,
            "destination": destination,
            "commodity": commodity,
            "created_by": created_by,
        }
        missing = [name for name, value in required.items() if not isinstance(value, str) or not value.strip()]
        if missing:
            raise FreightValidationError(f"Required fields are blank: {', '.join(missing)}")
        load = FreightLoad(**required, **optional_fields)
        return self.repository.save_load(load)

    def transition(
        self,
        load_id: UUID,
        target: LoadStatus,
        *,
        changed_by: str,
        note: str | None = None,
    ) -> FreightLoad:
        load = self._require_load(load_id)
        if not isinstance(changed_by, str) or not changed_by.strip():
            raise FreightValidationError("changed_by is required")
        if target not in self._ALLOWED_TRANSITIONS[load.status]:
            raise InvalidLoadTransition(f"Cannot transition {load.status.value} to {target.value}")
        if target is LoadStatus.APPROVED:
            raise FreightValidationError("Use approve_load for approval transitions")
        load.status = target
        load.updated_at = datetime.now(timezone.utc)
        saved = self.repository.save_load(load)
        self.add_note(load_id, author=changed_by, body=note or f"Status changed to {target.value}")
        return saved

    def approve_load(
        self,
        load_id: UUID,
        *,
        approved_by: str,
        note: str | None = None,
    ) -> FreightLoad:
        load = self._require_load(load_id)
        if load.status is not LoadStatus.SUBMITTED:
            raise InvalidLoadTransition("Only submitted loads can be approved")
        if not isinstance(approved_by, str) or not approved_by.strip():
            raise FreightValidationError("approved_by is required")
        self.repository.add_approval(
            Approval(load_id=load_id, approved_by=approved_by, decision="approved", note=note)
        )
        load.status = LoadStatus.APPROVED
        load.updated_at = datetime.now(timezone.utc)
        saved = self.repository.save_load(load)
        self.add_note(load_id, author=approved_by, body=note or "Load approved")
        return saved

    def add_note(self, load_id: UUID, *, author: str, body: str) -> ConversationNote:
        self._require_load(load_id)
        if not isinstance(author, str) or not author.strip() or not isinstance(body, str) or not body.strip():
            raise FreightValidationError("author and body are required")
        return self.repository.add_note(ConversationNote(load_id=load_id, author=author, body=body))

    def _require_load(self, load_id: UUID) -> FreightLoad:
        load = self.repository.get_load(load_id)
        if load is None:
            raise FreightValidationError(f"Load not found: {load_id}")
        return load
