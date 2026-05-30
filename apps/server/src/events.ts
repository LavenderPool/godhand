import { EventEmitter } from "events";
import type { AppEvent } from "@godhand/shared";

export const eventBus = new EventEmitter();

export function emitEvent(type: string, payload: unknown) {
  const event: AppEvent = { type, payload, timestamp: Date.now() };
  eventBus.emit("event", event);
  eventBus.emit(type, payload);
}
