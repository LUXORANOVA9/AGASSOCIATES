# AG Associates - Authentication & Authorization Architecture

This document outlines the authentication and authorization strategy for the AG Associates Bank Partner Portal. The system utilizes Supabase Auth for frictionless access and strictly enforces data isolation via PostgreSQL Row-Level Security (RLS) policies.

## 1. Frictionless Authentication (Passwordless Magic Links)

To streamline onboarding for high-tier banking partners and eliminate credential management friction, we use **Supabase Passwordless Magic Links**.

### The Flow

1. **Initiation**: A Bank Viewer (e.g., an employee at Axis Finance) enters their corporate email address on the AG Associates Portal login page.
2. **Request**: The frontend invokes `supabase.auth.signInWithOtp({ email })`.
3. **Delivery**: Supabase securely emails a unique, short-lived Magic Link to the provided address.
4. **Verification**: The user clicks the link, redirecting them back to the portal. Supabase validates the embedded token and establishes a secure session.

*Benefits*: High conversion rate, zero forgotten passwords, and inherent validation of the user's corporate email domain.

## 2. JWT Custom Claims Injection

To enforce strict multi-tenancy without complex middle-tier logic, authorization data is embedded directly into the user's JWT at the moment of authentication.

### Supabase Custom Access Token Hooks

We utilize a Supabase Auth Hook (implemented as a Postgres function, e.g., `public.custom_access_token_hook`) that executes right before the JWT is minted.

**Injection Logic**:
- The hook receives the `user_id`.
- It queries the database to determine which organization (`org_id`) this user belongs to.
- It injects `app_org_id` and `bank_allowed_access` into the `app_metadata` section of the JWT claims.

**Resulting JWT Snippet**:
```json
{
  "aud": "authenticated",
  "sub": "user-uuid",
  "email": "user@axisbank.com",
  "app_metadata": {
    "provider": "email",
    "app_org_id": "org-uuid-for-axis",
    "bank_allowed_access": true
  }
}
```

## 3. PostgreSQL Row-Level Security (RLS)

With `app_org_id` securely embedded in the JWT, PostgreSQL can autonomously enforce data isolation at the database layer.

### Implementation

The `cases` table has RLS enabled. The read policy ensures users can only `SELECT` rows where the `org_id` matches their token's `app_org_id`:

```sql
CREATE POLICY "Bank Viewer can read their own organization's cases"
ON cases
FOR SELECT
USING (
  org_id = (auth.jwt() -> 'app_metadata' ->> 'app_org_id')::UUID
);
```

### Why this architecture?

- **Security**: The database itself rejects unauthorized queries. Even if the Node.js API Gateway or Next.js API Routes have a vulnerability, data leakage across banks is impossible.
- **Performance**: Pushing authorization down to the database avoids pulling excessive data into memory only to filter it application-side.
- **Simplicity**: Developers write standard `supabase.from('cases').select('*')` queries without manually appending `WHERE org_id = ?` clauses. The DB handles it automatically.
