# infrastructure/events

## Overview
Domain-event sink.

## Interface
- `in-process-event-publisher.ts`: `InProcessEventPublisher({logger?})`, `publish(event)` calls `logger.info({event_type, event}, 'vault.event.published')`.

## Invariants
- No subscribers, no persistence, no retries; events are lost when the process exits. Event payloads include `last4` and ids but never full Aadhaar.
- `publish` never throws on missing logger.

## Side Effects
- Console output through the injected logger (in `index.ts`, `console.log`).

## Verification
- Run: `npm test --workspace @fln/backend`
