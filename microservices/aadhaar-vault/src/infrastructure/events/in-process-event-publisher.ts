/**
 * In-process EventPublisher adapter (Session 4).
 *
 * Fire-and-forget within the request lifetime — events are emitted to
 * the supplied logger at info level. There is no delivery guarantee
 * beyond "the publish() Promise resolves when the logger accepts the
 * line". Session 5+ can add a queue-backed adapter; until then this is
 * the only implementation.
 *
 * Domain purity: the adapter never inspects `event.type`. It logs a
 * structured record so handlers in downstream services can subscribe
 * by tag.
 */
import type {
    DomainEvent,
    EventPublisher,
} from '../../application/ports/event-publisher.js';

export interface InProcessEventPublisherOptions {
    logger?: { info: (obj: unknown, msg?: string) => void };
}

export class InProcessEventPublisher implements EventPublisher {
    constructor(
        private readonly opts: InProcessEventPublisherOptions = {},
    ) {}

    async publish(event: DomainEvent): Promise<void> {
        // The logger is optional — boot smoke tests construct the
        // publisher without a logger. We never throw on missing logger
        // so the consumer-facing API is uniform.
        this.opts.logger?.info(
            { event_type: event.type, event },
            'aadhaar-vault.event.published',
        );
    }
}