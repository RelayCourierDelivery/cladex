from backend.freight import (
    FreightService,
    FreightValidationError,
    InMemoryFreightRepository,
    InvalidLoadTransition,
    LoadStatus,
)


def make_service() -> FreightService:
    return FreightService(InMemoryFreightRepository())


def make_load(service: FreightService):
    return service.create_load(
        reference="LD-100",
        origin="Austin, TX",
        destination="Dallas, TX",
        commodity="Palletized goods",
        created_by="dispatcher@example.test",
    )


def test_manual_lifecycle_requires_named_approval() -> None:
    service = make_service()
    load = make_load(service)
    load = service.transition(load.id, LoadStatus.SUBMITTED, changed_by="dispatcher@example.test")
    load = service.approve_load(
        load.id,
        approved_by="manager@example.test",
        note="Documents reviewed",
    )
    load = service.transition(load.id, LoadStatus.POSTED, changed_by="dispatcher@example.test")
    load = service.transition(load.id, LoadStatus.ASSIGNED, changed_by="dispatcher@example.test")
    load = service.transition(load.id, LoadStatus.IN_TRANSIT, changed_by="dispatcher@example.test")
    load = service.transition(load.id, LoadStatus.DELIVERED, changed_by="dispatcher@example.test")

    assert load.status is LoadStatus.DELIVERED
    assert service.repository.list_approvals(load.id)[0].approved_by == "manager@example.test"
    assert len(service.repository.list_notes(load.id)) == 6


def test_approval_cannot_be_bypassed() -> None:
    service = make_service()
    load = make_load(service)

    try:
        service.transition(load.id, LoadStatus.APPROVED, changed_by="dispatcher@example.test")
    except FreightValidationError as error:
        assert "approval" in str(error).lower()
    else:
        raise AssertionError("approval transition was unexpectedly permitted")


def test_invalid_automatic_jump_is_rejected() -> None:
    service = make_service()
    load = make_load(service)

    try:
        service.transition(load.id, LoadStatus.DELIVERED, changed_by="scheduler")
    except InvalidLoadTransition:
        pass
    else:
        raise AssertionError("automatic status jump was unexpectedly permitted")
