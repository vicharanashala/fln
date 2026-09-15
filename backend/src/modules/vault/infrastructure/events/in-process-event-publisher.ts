/**
 * In-process EventPublisher adapter (ported verbatim from
 * src/infrastructure/events/in-process-event-publisher.ts).
 *
 * Fire-and-forget within the request lifetime — events are emitted to
 * the supplied logger at info level. There is no delivery guarantee
 * beyond "the publish() Promise resolves when the logger accepts the
 * line". A future queue-backed adapter can be added without touching
 * command code.
 *
 * Domain purity: the adapter never inspects `event.type`. It logs a
 * structured record so handlers in downstream services can subscribe
 * by tag.
 */
import type {
  DomainEvent,
  EventPublisher,
} from '../../application/ports/event-publisher';

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
      'vault.event.published',
    );
  }
}
