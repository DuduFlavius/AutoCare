export function logoDestination(
  session: { user?: { emailVerified?: boolean } } | null | undefined,
) {
  return session?.user &&
    (process.env.AUTOCARE_REQUIRE_EMAIL_VERIFICATION !== 'true' || session.user.emailVerified)
    ? '/cont?tab=Dashboard'
    : '/';
}
