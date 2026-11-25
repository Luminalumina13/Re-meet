/**
 * A source splits one search into several upstream calls (hour windows, date chunks). When some of
 * them fail, the list it returns is incomplete: fine to show, but not proof that a flight is gone.
 * The flag rides on the array itself so the provider interface stays `Promise<Itinerary[]>`.
 */
const PARTIAL = Symbol("partial");

export function markPartial<T>(list: T[], partial: boolean): T[] {
  if (partial) Object.defineProperty(list, PARTIAL, { value: true, enumerable: false });
  return list;
}

export function isPartial(list: readonly unknown[]): boolean {
  return (list as unknown as Record<symbol, unknown>)[PARTIAL] === true;
}

/** Status fields for a source whose list may be incomplete. */
export function partialFields(list: readonly unknown[]): { partial?: true } {
  return isPartial(list) ? { partial: true } : {};
}
