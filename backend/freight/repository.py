from __future__ import annotations

from abc import ABC, abstractmethod
from collections import defaultdict
from copy import deepcopy
from uuid import UUID

from .models import Approval, ConversationNote, FreightLoad


class FreightRepository(ABC):
    """Storage boundary for freight data. Implement this with Supabase later."""

    @abstractmethod
    def save_load(self, load: FreightLoad) -> FreightLoad: ...

    @abstractmethod
    def get_load(self, load_id: UUID) -> FreightLoad | None: ...

    @abstractmethod
    def list_loads(self) -> list[FreightLoad]: ...

    @abstractmethod
    def add_approval(self, approval: Approval) -> Approval: ...

    @abstractmethod
    def list_approvals(self, load_id: UUID) -> list[Approval]: ...

    @abstractmethod
    def add_note(self, note: ConversationNote) -> ConversationNote: ...

    @abstractmethod
    def list_notes(self, load_id: UUID) -> list[ConversationNote]: ...


class InMemoryFreightRepository(FreightRepository):
    """Deterministic adapter for local development and unit tests only."""

    def __init__(self) -> None:
        self._loads: dict[UUID, FreightLoad] = {}
        self._approvals: dict[UUID, list[Approval]] = defaultdict(list)
        self._notes: dict[UUID, list[ConversationNote]] = defaultdict(list)

    def save_load(self, load: FreightLoad) -> FreightLoad:
        self._loads[load.id] = deepcopy(load)
        return deepcopy(load)

    def get_load(self, load_id: UUID) -> FreightLoad | None:
        load = self._loads.get(load_id)
        return deepcopy(load) if load else None

    def list_loads(self) -> list[FreightLoad]:
        return [deepcopy(load) for load in self._loads.values()]

    def add_approval(self, approval: Approval) -> Approval:
        self._approvals[approval.load_id].append(approval)
        return approval

    def list_approvals(self, load_id: UUID) -> list[Approval]:
        return list(self._approvals[load_id])

    def add_note(self, note: ConversationNote) -> ConversationNote:
        self._notes[note.load_id].append(note)
        return note

    def list_notes(self, load_id: UUID) -> list[ConversationNote]:
        return list(self._notes[load_id])
