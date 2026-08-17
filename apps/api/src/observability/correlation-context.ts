import { AsyncLocalStorage } from "node:async_hooks";

interface CorrelationStore {
  correlationId: string;
}

const storage = new AsyncLocalStorage<CorrelationStore>();

export function runWithCorrelationId<T>(correlationId: string, fn: () => T): T {
  return storage.run({ correlationId }, fn);
}

/**
 * Returns the correlation_id for the currently executing request. Throws if
 * called outside a request context — every request must have one, per
 * FND-010's minimum-subset propagation requirement.
 */
export function getCorrelationId(): string {
  const store = storage.getStore();
  if (!store) {
    throw new Error("getCorrelationId() called outside a request context");
  }
  return store.correlationId;
}
