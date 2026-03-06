# RCA: Missing Primary Contact in Query Results (Edge Case)

**Date:** 2026-03-06  
**Severity:** High  
**File:** `src/logic.ts`

---

## Summary

When a request matched **only secondary contacts** (not their parent primary), the `existingContacts` array contained zero primaries. The downstream logic assumed at least one primary would always be present, leading to a runtime crash.

## Root Cause

The initial query searches by `email OR phoneNumber`:

```sql
WHERE email = ? OR phoneNumber = ?
```

This is a flat lookup — it does **not** follow the `linkedId` chain. A secondary contact can have a different email/phone combination than its parent primary, so the primary may not appear in the results.

### Example

| id | email | phone | linkPrecedence | linkedId |
|----|-------|-------|----------------|----------|
| 1 | alice@example.com | 1111111111 | primary | NULL |
| 2 | alice@example.com | 2222222222 | secondary | 1 |

Request: `{ email: "bob@example.com", phoneNumber: "2222222222" }`

- Matches **only row 2** (on phone). Row 1 has no matching field.
- `primaryContacts = []` → falls into Case 4's `else` branch → 💥 crash on `sortedPrimaries[0]!.id`

## Fix Applied

Added a parent-primary resolution step after the initial query. If any matched contacts are secondary, their `linkedId` values are collected and used to fetch the missing parent primaries:

```ts
const secondaryLinkedIds = existingContacts
    .filter(c => c.linkPrecedence === "secondary" && c.linkedId !== null)
    .map(c => c.linkedId!);

if (secondaryLinkedIds.length > 0) {
    const parentPrimaries = await tx
        .select().from(contacts)
        .where(inArray(contacts.id, secondaryLinkedIds));

    const existingIds = new Set(existingContacts.map(c => c.id));
    for (const p of parentPrimaries) {
        if (!existingIds.has(p.id)) existingContacts.push(p);
    }
}
```

This guarantees `primaryContacts.length >= 1` in every super-case path, with no changes to the existing branching logic.

## Prevention

- Any query that matches contacts should resolve the full contact chain (primary + secondaries), not just do a flat field lookup.
