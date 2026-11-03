/**
 * Habit screens take the id as a query param (`/habit?id=…`) rather than a
 * path segment, so each is one static page the service worker can cache and
 * open offline for any habit.
 */
export function habitHref(id: string) {
  return `/habit?id=${encodeURIComponent(id)}`;
}

export function editHabitHref(id: string) {
  return `/habit/edit?id=${encodeURIComponent(id)}`;
}
