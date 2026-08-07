/**
 * EventPublisher port (Session 4, AADHAAR_VAULT_FREE_ARCHITECTURE.md §8.3).
 *
 * Domain events are published from the application layer (e.g. the
 * `TokenizeAadhaar` command publishes `AadhaarTokenized`). Adapters are
 * swappable — the v0.1 implementation is in-process only; a future
 * Redis Streams / NATS / Kafka adapter can be dropped in without
 * touching command code.
 *
 * Domain purity: the port knows nothing about Aadhaar. It only knows
 * that an event with an opaque `type` tag and a JSON-shaped payload
 * was published. Adapters may serialize the payload for their
 * transport.
 */
export interface DomainEvent {
    /** Stable event-type tag, e.g. "AadhaarTokenized". */
    type: string;
    /** Additional fields. Adapters MUST round-trip unknown keys. */
    [key: string]: unknown;
}

export interface EventPublisher {
    /**
     * Publish one event. Implementations may be fire-and-forget (the
     * returned promise resolves when the publish has been *accepted*,
     * not when downstream listeners have processed it).
     */
    publish(event: DomainEvent): Promise<void>;
}