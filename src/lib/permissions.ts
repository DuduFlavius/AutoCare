/** Server configuration is the only authority for the unique founder identity. */
export function founderId() {
  return process.env.AUTOCARE_FOUNDER_USER_ID?.trim() || null;
}
export function effectiveRole(uid: string, storedRole: string) {
  if (founderId() === uid) return 'founder';
  return ['admin', 'assistant'].includes(storedRole) ? storedRole : 'user';
}
export function isFounder(uid: string) {
  return !!founderId() && founderId() === uid;
}
