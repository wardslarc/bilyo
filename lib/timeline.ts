import type { EventType, EventActor } from '@/types';

export interface TimelineEvent {
  id: string;
  quotationId?: string;
  type: EventType;
  actor: EventActor;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export function getEventTitle(type: EventType): string {
  switch (type) {
    case 'CREATED':
      return 'Quotation Created';
    case 'SENT':
      return 'Sent to Client';
    case 'VIEWED':
      return 'Viewed by Client';
    case 'ACCEPTED':
      return 'Quotation Accepted';
    case 'DECLINED':
      return 'Quotation Declined';
    case 'MARKED_PAID':
      return 'Marked as Paid';
    case 'UNMARKED_PAID':
      return 'Payment Status Cleared';
    case 'LINK_REVOKED':
      return 'Public Link Revoked';
    default:
      return type;
  }
}

export function getActorLabel(actor: EventActor, metadata?: Record<string, unknown>): string {
  switch (actor) {
    case 'OWNER':
      return 'You';
    case 'CLIENT': {
      const name = metadata?.respondedByName as string | undefined;
      return name ? `Client (${name})` : 'Client';
    }
    case 'ADMIN':
      return 'Platform Admin';
    case 'SYSTEM':
      return 'System';
    default:
      return actor;
  }
}

export function formatTimelineUrl(publicCode: string, origin?: string): string {
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/q/${publicCode}`;
}

export function sortEventsChronological<T extends { createdAt: string | Date }>(events: T[]): T[] {
  return [...events].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeEvent(event: any): TimelineEvent {
  return {
    id: String(event._id),
    quotationId: String(event.quotationId),
    type: event.type,
    actor: event.actor,
    metadata: (event.metadata as Record<string, unknown>) || {},
    createdAt:
      event.createdAt instanceof Date
        ? event.createdAt.toISOString()
        : new Date(event.createdAt).toISOString(),
  };
}
