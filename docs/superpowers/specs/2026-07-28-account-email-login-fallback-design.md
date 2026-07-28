# Account Alias Login Fallback Design

## Goal

Allow users to sign in by entering only an account alias. The backend must resolve
the alias against the supported domains in order: `@cantho.gov.vn`, then `@vnpt.vn`.

## Scope and behavior

- A full email address continues to authenticate exactly as supplied after
  normalization.
- An alias is resolved to the first existing account among the two supported
  domain candidates.
- The resolved email, rather than the raw alias or the default-domain guess, is
  used for account lock checks, Supabase password verification, failed-login
  recording, successful-login recording, and the returned account data.
- If neither candidate exists, the endpoint retains its existing generic invalid
  credentials response and does not create a failed attempt for a nonexistent
  account.
- Signup, account administration, schemas, and explicit full-email inputs retain
  their current behavior.

## Implementation shape

Add a small account-email candidate helper that normalizes an input and returns
the ordered candidate emails. The login handler will query the accounts table for
those candidates, select the first match in domain order, and pass the resolved
email through the existing authentication and security-policy flow.

The frontend remains unchanged because the login API already accepts the input
and the resolution belongs next to the account lookup.

## Testing

- Unit tests cover ordered candidates for aliases, preservation of full emails,
  and domain normalization.
- Backend login tests cover selecting the Can Tho account first, falling back to
  the VNPT account, and preserving the existing full-email path.
- Run the focused helper/handler tests, then the backend test suite and relevant
  type/lint checks.
