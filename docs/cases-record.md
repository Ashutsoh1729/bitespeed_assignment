# Cases Record — `/identify` Endpoint

Tracking all cases, implementation details, edge cases, and improvements.

**Reference:** [`logic.ts`](file:///Users/ashutoshhota/Coding/play_ground/assignments/bitscale_assignment/src/logic.ts) | [`problem_statement.md`](file:///Users/ashutoshhota/Coding/play_ground/assignments/bitscale_assignment/docs/problem_statement.md)

---

## Cases Overview

### Case 1: No Match Found → New Primary

| Item | Details |
|------|---------|
| **Trigger** | `existingContacts.length === 0` |
| **Action** | Create a new `primary` contact with the given email/phone |
| **Response** | Single primary, empty `secondaryContactIds` |
| **Status** | ✅ Resolved |

---

### Case 2: Exact Match → No New Row

| Item | Details |
|------|---------|
| **Trigger** | `primaryContacts.length === 1` AND a row exists with both same email AND same phone |
| **Action** | No insert. Return existing contacts as-is |
| **Response** | Consolidated view of the contact group |
| **Status** | ✅ Resolved |

**Edge Case Identified:**
- The variable `isPrimaryData` is misleadingly named — it actually checks *all* rows (primary + secondary) for an exact match, not just the primary. The logic is correct but the name should be clarified.

---

### Case 3: Partial Match → New Secondary

| Item | Details |
|------|---------|
| **Trigger** | `primaryContacts.length === 1` AND no row has both email+phone together |
| **Action** | Create a new `secondary` contact linked to the existing primary |
| **Response** | Consolidated view including the new secondary |
| **Status** | ✅ Resolved |

---

### Case 4: Two Separate Primaries Get Linked

| Item | Details |
|------|---------|
| **Trigger** | `primaryContacts.length >= 2` (email matches one primary, phone matches another) |
| **Action** | Older primary stays. Newer primary downgraded to secondary (`linkPrecedence` updated, `linkedId` set). All secondaries of the newer primary are re-linked to the older primary. |
| **Response** | Re-queried consolidated view of the merged group |
| **Status** | ✅ Resolved |

---

## Edge Cases Handled

### 1. Primary Contact Mis-identification in Response

- **Problem:** `result[0]!.id` was used as `primaryContactId`, assuming the first row is always the primary. DB queries without `ORDER BY` return rows in arbitrary order.
- **Fix:** Replaced with `result.find(c => c.linkPrecedence === "primary")!` and placed primary's email/phone first in the response arrays.
- **RCA:** [`rca_primary_contact_ordering.md`](file:///Users/ashutoshhota/Coding/play_ground/assignments/bitscale_assignment/docs/errors/rca_primary_contact_ordering.md)

### 2. Missing Parent Primary in Query Results

- **Problem:** When a request matched *only* secondary contacts (e.g., same phone as a secondary but different email from its primary), the parent primary wasn't in the result set. This caused `primaryContacts.length === 0`, falling into the Case 4 `else` branch and crashing.
- **Fix:** After the initial query, collect `linkedId` values from matched secondaries and fetch their parent primaries via `inArray`. Merge them into `existingContacts` (deduped by id).
- **RCA:** [`rca_missing_primary_edge_case.md`](file:///Users/ashutoshhota/Coding/play_ground/assignments/bitscale_assignment/docs/errors/rca_missing_primary_edge_case.md)

---

## Potential Improvements ( Future Improvements )

### 1. Incomplete Contact Chain in Response (Cases 2 & 3)

Cases 2 and 3 return `existingContacts` directly — which only contains rows matched by the `WHERE email = ? OR phoneNumber = ?` query (plus resolved parents). **Other secondaries in the group that don't match the query fields are missing from the response.**

**How the DB state is built (step by step):**

```
Request 1: { email: "alice@example.com", phone: "1111111111" }
  → Case 1 → Creates Primary A (alice@example.com, 1111111111)

Request 2: { email: "alice@example.com", phone: "2222222222" }
  → Matches A on email → Case 3
  → Creates Secondary B (alice@example.com, 2222222222, linkedId=A)

Request 3: { email: "carol@example.com", phone: "2222222222" }
  → Matches B on phone → parent A resolved → Case 3
  → Creates Secondary C (carol@example.com, 2222222222, linkedId=A)
```

**Resulting DB state:**

| id | email | phone | linkPrecedence | linkedId |
|----|-------|-------|----------------|----------|
| A | alice@example.com | 1111111111 | primary | NULL |
| B | alice@example.com | 2222222222 | secondary | A |
| C | carol@example.com | 2222222222 | secondary | A |

**Incoming request:** `{ email: "alice@example.com", phone: "1111111111" }`

**Query:** `WHERE email = 'alice@example.com' OR phone = '1111111111'`
- Matches **A** (both fields) and **B** (email) — but **not C** (`carol@example.com` ≠ `alice@example.com` AND `2222222222` ≠ `1111111111`)

**Generated response:** `emails: [alice@example.com], phones: [1111111111, 2222222222], secondaryIds: [B]`
**Expected response:** `emails: [alice@example.com, carol@example.com], phones: [1111111111, 2222222222], secondaryIds: [B, C]`

→ **C is missing** even though it's a legitimate secondary of A (linked via B's shared phone `2222222222`).

**Fix:** After resolving the case logic, do a final re-query: `WHERE id = primary.id OR linkedId = primary.id` (same approach already used in Case 4).

### 2. Duplicate Values in Response Arrays

Multiple contacts can share the same email (e.g., primary and a secondary both have `alice@example.com`). The response arrays would contain duplicates. Deduplication (e.g., `[...new Set(emails)]`) would produce cleaner output.

### 3. `isPrimaryData` Naming

The variable name suggests it only checks primary contacts, but it uses `existingContacts.some(...)` which checks all rows. A clearer name would be `isExactMatch` or `isDuplicateRequest`.
