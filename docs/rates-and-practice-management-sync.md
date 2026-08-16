# Lawyer Rates and Practice-Management Sync

## Product boundary

CounselScribe calculates fees from **verified duration × the lawyer rate effective on the work date**. Rate changes are prospective: every billing entry stores an immutable rate and fee snapshot so historical totals never change when an administrator updates a lawyer’s future rate.

No entry is sent to Clio or MyCase automatically. Only an attorney-approved entry with a mapped external matter and lawyer may be synchronized, and every synchronization requires an explicit confirmation action. CSV export remains available when either vendor connection is unavailable.

## Rate rules

| Rule | Behavior |
|---|---|
| Rate owner | A rate belongs to one active firm membership and therefore one lawyer within one firm. |
| Effective dating | `effectiveFrom` is required; `effectiveTo` is optional. Overlapping active ranges for the same lawyer are rejected. |
| Currency | Rates are stored as integer cents and currently limited to USD for Clio/MyCase parity. |
| Duration | CounselScribe preserves exact seconds. No billing increment is silently applied. |
| Fee calculation | `feeCents = round(durationSeconds × rateCents ÷ 3600)`. Integer cents are persisted on the entry. |
| Missing data | Missing duration remains `needs duration`; missing lawyer rate remains `needs rate`. Neither can be approved or synchronized. |
| Historical immutability | Each entry snapshots `rateCents`, `feeCents`, `rateCardId`, `rateEffectiveFrom`, and the calculation timestamp. |
| Overrides | Administrators may apply a disclosed manual rate override before approval; the override reason is audited. |

## External synchronization contract

| Provider | Official authorization | Time-entry write contract | CounselScribe mapping |
|---|---|---|---|
| Clio Manage | OAuth 2.0 authorization-code flow. A developer app supplies the client key, secret, redirect URI, and least-privilege scopes. Access tokens are sent as `Authorization: Bearer …`; refresh tokens must be stored encrypted.[1][2] | `POST https://app.clio.com/api/v4/activities.json`. A `TimeEntry` accepts ISO date, duration in **seconds** on current API versions, matter ID, user ID, note, price, and an optional activity description/UTBMS mapping.[3] | `workDate → date`; `durationSeconds → quantity`; lawyer snapshot → `price`; narrative → `note`; mapped matter/user IDs → associations; firm-code UTBMS IDs → `activity_description` when required. |
| MyCase | OAuth 2.0 authorization-code flow. MyCase Support provisions client credentials and the callback URI. Access tokens last 24 hours, refresh tokens last two weeks, and the documented limit is 25 requests/second/client.[4] | `POST https://external-integrations.mycase.com/v1/time_entries`. Required fields include activity name, entry date, rate, hours, case ID, and staff ID; optional UTBMS activity/task codes are supported when LEDES billing is enabled.[5] | code label → `activity_name`; narrative → `description`; `durationSeconds ÷ 3600 → hours`; lawyer snapshot → `rate`; mapped matter/staff IDs → associations; UTBMS strings → optional code fields. |

## Idempotency and audit behavior

Each outbound attempt receives a CounselScribe idempotency key derived from provider, firm, billing-entry ID, and entry revision. A successful remote record ID is stored against the local entry. The UI will not resend the same revision unless an administrator explicitly starts a resynchronization after a recorded failure or the local entry has changed. Request metadata and response status are audited, but OAuth tokens and privileged narrative text are never written to audit metadata.

## Required setup

The production callback URLs are:

- `https://counselscrib-aew9tbrz.manus.space/api/integrations/clio/callback`
- `https://counselscrib-aew9tbrz.manus.space/api/integrations/mycase/callback`

Clio requires a developer application with the smallest read/write permissions needed for users, matters, activities, activity descriptions, and UTBMS codes. MyCase requires an Advanced-tier account, MyCase-provisioned OAuth credentials, and an authorizing user permitted to manage firm preferences, billing, and payments.[2][4][6]

The user must provide the real lawyer names/rates and the real firm billing-code list. CounselScribe must not invent either dataset.

## References

[1]: https://docs.developers.clio.com/api-docs/clio-manage/authorization/ "Clio Manage Authorization"
[2]: https://docs.developers.clio.com/api-docs/clio-manage/applications/ "Create a Clio Developer Application"
[3]: https://docs.developers.clio.com/clio-manage/api-reference/ "Clio Manage API v4 Reference"
[4]: https://mycaseapi.stoplight.io/docs/mycase-api-documentation/k5xpc4jyhkom7-getting-started "MyCase API Getting Started"
[5]: https://mycaseapi.stoplight.io/docs/mycase-api-documentation/45d79e837bc9e-create-a-time-entry "MyCase Create a Time Entry"
[6]: https://supportcenter.mycase.com/en/articles/9370198-open-api "MyCase Open API Availability"
