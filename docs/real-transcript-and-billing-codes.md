# Real Transcript Validation and Firm Billing Codes

## Authorized validation sample

The validation source is existing **user-uploaded session 90001**, titled `hhhhh`, processed as a hosted upload on August 15, 2026. Its preserved reviewed transcript is a public-facing legal-news interview about the Take Care of Maya civil trial, jury deliberations, punitive damages, false imprisonment, battery, and appellate procedure. It is a real speech transcript rather than a synthetic fixture.

The test may submit the preserved transcript snapshot to the managed Matter AI service because the user explicitly requested real-transcript processing. Results remain staged as proposed records. The run must not be described as client work, and no extracted item may enter a billing ledger without an attorney decision.

## Firm billing-code model

| Field | Rule |
|---|---|
| `firmId` | Every code is isolated to one firm. |
| `code` | Required, uppercase-normalized, unique within the firm, and immutable in historical exports. |
| `label` | Required attorney-facing name. |
| `category` | Firm-defined grouping used to map AI and voice activity categories. |
| `description` | Optional internal guidance explaining when the code should be used. |
| `defaultNarrative` | Optional starting narrative; attorneys may edit it before approval. |
| `displayOrder` | Integer controlling dropdown and settings order. |
| `active` | Inactive codes remain visible on historical records but cannot be selected for new work. |

Only firm administrators may create, edit, reorder, activate, or deactivate codes. Codes with historical references are never hard-deleted. Existing billing records retain their legacy `activityCode` string, while new timers and entries may additionally reference the firm billing-code row.

## Workflow rules

Active firm codes replace fixed activity choices in timers and manual drafts. Voice commands and AI candidates first classify the work into a broad category, then map to the first active firm code in that category. If no firm code matches, CounselScribe preserves the legacy category and clearly labels it as a fallback. CSV exports include both the stable firm code and the attorney-facing label when available.

## Rendered settings validation

The authenticated Firm Controls route renders the administrator-only billing-code form with code, label, category, display order, internal description, default narrative, and active-status controls. The empty state clearly explains that legacy activity labels remain available until the firm defines its first active code.

## Real transcript extraction result

The authorized uploaded transcript was processed as analysis run `210001`. The completed run produced **11 grounded facts, 10 people or organizations, 2 date references, 4 action items, and 7 vocabulary items**. Each item preserved an exact quotation from the transcript and remained in `proposed` status pending attorney review.

The first model pass incorrectly treated courtroom commentary—“based on the evidence we've been watching you present”—as billable work. A deterministic completed-work guardrail now rejects media or evidentiary discussion unless the quotation contains an explicit duration or a recognized actor plus a completed-work verb. The clean repeat run produced **zero billing candidates**, correctly leaving the client billing ledger unchanged for this public legal-news interview.

The rendered Matter AI workspace displays the real transcript’s executive summary and source-grounded findings with independent Accept and Reject controls. The accepted firm code `CS-REV · Review and analysis` has separately been verified through the server timer, database reference, ledger display, and code-aware export columns.

Attorney review was exercised on the real run: one entity finding was accepted, one fact was rejected, and the database preserved `1 accepted`, `1 rejected`, and all remaining items as proposed. The real run remained linked to **zero billing entries**.

A controlled follow-up note with **12 explicit minutes of completed transcript review** and one future drafting request was submitted to verify the complete firm-code path. The active firm code is database row `1`, `CS-REV · Review and analysis`, category `REVIEW`; the analysis is expected to stage the completed review under that code while leaving the future letter as an action item rather than billing.

The controlled run completed as analysis `240001`. It staged exactly one `REVIEW` billing candidate with 12 explicit minutes, displayed `CS-REV · Review and analysis` before acceptance, and placed the requested future follow-up letter only in Action Items. The candidate card explicitly states that acceptance will enter the ledger as `CS-REV · Review and analysis`.

Attorney acceptance created ledger entry `180001` with source `analysis_item:180013`, exact duration `720` seconds, firm billing-code row `1`, code `CS-REV`, and label `Review and analysis`. No billing row was created for the future follow-up letter. The accepted entry was then approved and exported as export `30001`. Direct inspection of the stored CSV confirmed the row contains `CS-REV`, `Review and analysis`, category `REVIEW`, historical activity `CS-REV`, duration `720`, and exact hours `0.2000`.

The protected duplicate-code integration fixture attempted to create lowercase `cs-rev`; normalization converted it to `CS-REV`, the API rejected it with `Billing code CS-REV already exists for this firm`, and the single original active code remained intact.

Transcript-derived analysis `270001` used preserved reviewed session `120001`. It staged two completed-work candidates without materializing either one: a 4-minute `COMMUNICATION` item displayed as a legacy fallback because no active communication code exists, and a 9-minute `REVIEW` item visibly mapped to `CS-REV · Review and analysis`. The future witness-outline request remained an action item rather than billable work.

The attorney rejected the mapped transcript-derived `REVIEW` candidate (`analysis item 210007`). The UI retained the `CS-REV · Review and analysis` mapping beside the rejected state, and database verification confirmed the item status is `rejected`, no row exists with source `analysis_item:210007`, and analysis run `270001` is linked to zero billing entries.

For inactive-code validation, the administrator deactivated `CS-REV`; Firm Controls changed its status to **Historical only**. Billing Copilot immediately removed it from both new timer and manual-draft selectors and displayed `REVIEW · legacy fallback` instead. Existing timer rows, the exported 12-minute AI entry, and prior export history continued to display `CS-REV · Review and analysis`, proving historical records preserve the inactive code.

Matter AI was then reloaded with `CS-REV` inactive. The transcript-derived review candidate no longer offered or displayed the inactive code; its candidate selector and disposition label changed to `REVIEW · legacy fallback` / `WILL PRESERVE LEGACY ACTIVITY REVIEW`. This proves inactive firm codes cannot be selected for new AI candidate acceptance while historical ledger and export rows retain their original code reference.

After the inactive workflow check, the administrator reactivated `CS-REV`; Firm Controls returned it to **Active for new work** so the validated code remains available for the next attorney timer, AI review, and export.
