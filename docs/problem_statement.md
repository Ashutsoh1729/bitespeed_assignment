# Problem Statement

## Bitespeed Identity Reconciliation — Clear Problem Statement

### What You're Building

A single REST API endpoint `POST /identify` that links a customer's multiple contact details (email/phone) into one unified identity.

---

### Database Table: `Contact`

| Field          | Type                    | Notes                              |
| -------------- | ----------------------- | ---------------------------------- |
| id             | Int                     | Primary key                        |
| phoneNumber    | String?                 | Nullable                           |
| email          | String?                 | Nullable                           |
| linkedId       | Int?                    | Points to the primary contact's id |
| linkPrecedence | "primary" / "secondary" | Oldest = primary                   |
| createdAt      | DateTime                |                                    |
| updatedAt      | DateTime                |                                    |
| deletedAt      | DateTime?               | Nullable                           |

---

### The Endpoint

**Request:** `POST /identify`

```json
{ "email": "string or null", "phoneNumber": "string or null" }
```

**Response:**

```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["primary_email", "...other emails"],
    "phoneNumbers": ["primary_phone", "...other phones"],
    "secondaryContactIds": [2, 3]
  }
}
```

---

### Core Logic — 4 Cases

**Case 1: No match found**
→ Create a new `primary` contact. Return it with empty `secondaryContactIds`.

**Case 2: Exact match (both email & phone already exist together)**
→ No new row created. Just return the consolidated contact.

**Case 3: Partial match (one field matches, other is new)**
→ Create a new `secondary` contact linked to the existing primary. Return consolidated view.

**Case 4: Two separate primaries get linked (email matches one, phone matches another)**
→ The _older_ contact stays `primary`. The _newer_ primary is downgraded to `secondary` (update its `linkPrecedence` and set `linkedId`). Return consolidated view.

---

### Key Rules

- A contact group is identified by a **shared email or phone** across any rows.
- The **oldest** contact in a group is always the `primary`.
- Response arrays always have the **primary's** email/phone as the **first element**.
- A new row is only created when **new information** appears — not on duplicate requests.
