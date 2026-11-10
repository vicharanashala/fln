# tickets

## Overview
Dialog shell that lets the navbar "Support Tickets" action open the existing `../TicketSubmission.tsx` list/create flow in place.

## Interface
- `TicketModal.tsx`: `TicketModal({ isOpen, onClose, token, userRole })`.

## Invariants
- Renders nothing when `isOpen` is false; closes on backdrop click, close button or Escape.
- Holds no ticket state: all fetching and validation live in `TicketSubmission`.

## Side Effects
- Registers a window `keydown` listener while open. No network calls of its own.

## Verification
- Run: `npm test --workspace @fln/frontend` (vitest run, from repo root)
