// Forgejo reports the Actions identity as user ID -2.
const ACTIONS_USER_ID = -2;

export function isForgejoActionsUser(
  user: { id?: number | null | undefined } | null | undefined,
): boolean {
  return user?.id === ACTIONS_USER_ID;
}
