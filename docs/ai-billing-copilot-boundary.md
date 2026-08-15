# CounselScribe AI Matter Intelligence and Billing Boundary

## Purpose

The AI copilot converts attorney-approved matter text and transcript content into **reviewable work product**. It may summarize, organize, classify, draft, and propose; it may not silently save substantive matter facts, invent elapsed time, approve billing, transmit an invoice, or make autonomous legal judgments.

## Matter intelligence output

Every AI analysis returns a typed result tied to one matter and one immutable source snapshot.

| Output | Required evidence | Attorney action |
|---|---|---|
| Executive summary | Source quotation for each major conclusion | Review before relying on it |
| Key facts | Exact quotation or transcript segment | Accept, edit, or reject |
| People and organizations | Exact name as written plus surrounding quotation | Add to matter vocabulary or ignore |
| Dates and deadlines | Quoted date language; deadline status remains `unverified` | Confirm date and legal significance |
| Action items | Supporting instruction, event, or attorney statement | Assign, edit, or reject |
| Vocabulary | Heard or written phrase and suggested approved form | Select user, matter, or firm scope |
| Candidate billable work | Activity evidence and explicit duration evidence when present | Add duration if missing, then approve or reject |

## Billing evidence rule

> **CounselScribe never invents billable time.** AI can recognize and classify work, draft a billing narrative, and associate it with the selected matter. Duration must come from a running timer, an explicit attorney statement, or a manual attorney entry.

| Time source | Example | System behavior |
|---|---|---|
| Running timer | Attorney starts a timer for a selected matter and stops it after drafting | Store exact elapsed seconds and mark the entry `draft` |
| Explicit spoken duration | “Bill 0.4 hours for reviewing discovery responses” | Parse the stated duration, preserve the source quotation, and mark the entry `draft` |
| Manual duration | Attorney enters 24 minutes while reviewing the candidate entry | Store the manual value with the attorney as actor |
| No duration evidence | “I reviewed the settlement proposal” | Draft the task and narrative, leave duration empty, and mark `needs_duration` |
| AI estimate | Model believes the task probably took 30 minutes | Prohibited; no duration may be saved |

## Approval boundary

Billing entries progress through `needs_duration`, `draft`, `approved`, `rejected`, and `exported`. Only an authenticated attorney or firm administrator may approve an entry. Export includes only approved entries selected by the user. Export does not create an invoice or post to an external billing system.

## Source and duplicate controls

Every generated item preserves a source type, source identifier, source quotation, analysis run, and model identifier. A deterministic fingerprint combines firm, matter, normalized activity, work date, duration, and source identifier. Matching fingerprints are flagged for review rather than automatically duplicated.

## Timer rules

An attorney may have only one active timer. Starting another timer requires stopping the existing timer. Timers store server timestamps, while the interface displays the continuously updated elapsed time. The final billing entry uses server-calculated elapsed seconds; the browser clock is presentation only.

## Privacy and model disclosure

The analysis screen identifies the active processing boundary. Hosted AI sends the selected text to the managed model service only after an explicit analysis action. Mac mini transcription remains separate and does not imply that downstream hosted AI analysis is local. No model response is treated as verified fact without attorney review.

