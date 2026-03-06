# RCA: Primary Contact Mis-identification in `/identify` Response

**Date:** 2026-03-06  
**Severity:** Medium  
**File:** `src/logic.ts`

---

## Summary

The response builder in `handleRequest` assumed `result[0]` was always the primary contact. Since database queries had no `ORDER BY` clause, a secondary contact could appear first — returning the wrong `primaryContactId` and incorrect ordering of emails/phone numbers.

## Root Cause

After the transaction, the response was built using:

```ts
primaryContactId: result[0]!.id,
```

The `result` array was populated by raw `SELECT` queries (via Drizzle's `.select().from(contacts).where(...)`) that **do not guarantee row order**. PostgreSQL (and most databases) may return rows in any order when no `ORDER BY` is specified.

### Affected Code Paths

| Case | How `result` was built | Ordered? |
|------|------------------------|----------|
| Case 1 (new primary) | Single-row `INSERT … RETURNING` | ✅ Only one row |
| Case 2 (exact match) | `existingContacts` from `WHERE` | ❌ No `ORDER BY` |
| Case 3 (partial match) | `[...existingContacts, ...newContact]` spread | ❌ No guarantee primary is first |
| Case 4 (merge primaries) | Re-queried `updatedContacts` | ❌ No `ORDER BY` |

## Impact

- `primaryContactId` in the API response could be a secondary contact's ID.
- `emails` and `phoneNumbers` arrays would not have the primary's values first.
- Downstream consumers relying on `primaryContactId` would link to the wrong contact.

## Fix Applied

Replaced the positional assumption with an explicit lookup:

```diff
- primaryContactId: result[0]!.id,
- emails: result.map(c => c.email)…
+ const primary = result.find(c => c.linkPrecedence === "primary")!;
+ primaryContactId: primary.id,
+ emails: [primary.email, ...result.filter(c => c.id !== primary.id).map(c => c.email)]…
```

The primary contact's email and phone number are now always placed first in the response arrays regardless of database row order.

## Prevention

- Avoid relying on array position for semantic meaning from database results.
- Unit tests in `logic.test.ts` should assert `primaryContactId` matches a contact with `linkPrecedence === "primary"`, not just check `isInteger`.
