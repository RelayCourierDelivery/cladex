# Freight domain module

This package provides a manual, auditable domain workflow for live freight loads. It is deliberately transport- and vendor-agnostic: it does not expose HTTP routes, connect to Supabase, store credentials, contact brokers, assign carriers, book freight, dispatch vehicles, collect payment, or advance a load automatically.

## Lifecycle

`draft -> submitted -> approved -> posted -> assigned -> in_transit -> delivered`

A load may be cancelled before delivery. The `submitted -> approved` transition requires `approve_load`, which persists a named approval decision. All status changes and human comments can be recorded as conversation notes.

## Integration

Provide an implementation of `FreightRepository` for the selected persistence provider. The existing `InMemoryFreightRepository` is intended only for local development and unit tests. Keep authentication and API transport outside this package; callers must identify the human actor in `created_by`, `changed_by`, `approved_by`, or `author` fields.

## Non-goals

Automation involving broker outreach, carrier assignment, booking, dispatch, payment, or automatic status advancement is intentionally out of scope.
