# CounselScribe Accessibility Fix

- [x] Identify every rendered `DialogContent` and confirm it has an associated `DialogTitle`.
- [x] Patch any intermediary dialog wrapper that renders content without accessible naming.
- [x] Reproduce the original interaction path with the browser console open.
- [x] Run TypeScript checks, unit tests, and the production build.
- [x] Save and deliver a verified checkpoint.

## Expanded Pilot Foundation

- [x] Document the privacy boundary between browser, hosted backend, and local Mac mini processing.
- [x] Upgrade the project to authenticated full-stack infrastructure with database and file storage.
- [x] Define and apply the initial CounselScribe database migration, then verify database connectivity.
- [x] Wire authenticated application behavior and verify protected access plus logout.
- [x] Implement and verify secure audio and document upload storage using stored object references.
- [x] Add firm, user, matter, session, transcript, segment, correction, glossary, template, comparison, and audit models.
- [x] Build matter profiles with case-specific people, organizations, experts, statutes, and approved terminology.
- [x] Add audio upload and live-recording intake with honest processing-mode labels.
- [x] Link transcript segments and review suggestions to audio timestamps.
- [x] Learn approved corrections by attorney, matter, and firm scope.
- [x] Implement explicit voice commands for punctuation, formatting, correction, and navigation.
- [x] Save sessions, document versions, accepted or rejected changes, and auditable restoration events.
- [x] Generate Word-ready DOCX files from reusable legal document templates.
- [x] Add Dragon comparison, word-error-rate inputs, legal-term accuracy, correction burden, and time-saved reporting.
- [x] Add firm administration, attorney and administrator roles, retention settings, and encryption-status controls.
- [x] Scaffold and document the Mac mini local-transcription companion service without claiming it is deployed.
- [x] Verify end-to-end workflows, privacy copy, accessibility, responsive behavior, tests, and production build.
- [x] Save and deliver the expanded pilot checkpoint.

### Final Validation Gaps

- [x] Exercise logout in the browser and verify protected routes return to the sign-in screen, then sign back in.
- [x] Persist authenticated live microphone recordings as backend sessions with an explicit processing mode.
- [x] Wire spoken correction commands into live session learning and implement explicit review navigation commands.
- [x] Re-run tests, build, end-to-end checks, and responsive verification after closing these gaps.
- [x] Run a deterministic authenticated live-audio persistence fixture and verify the stored session, source type, processing mode, and audio object reference in the database and UI.
- [x] Run a deterministic MediaRecorder start-stop-blob-cleanup test and verify its metadata feeds the same authenticated live-session persistence payload.

## AI Matter Intelligence and Billing Copilot

- [x] Document the billing evidence rule: AI may classify work and draft narratives, but time must come from an explicit attorney statement or a running timer.
- [x] Add source documents, AI analysis runs, billing timers, billing entries, approvals, and export history to the database.
- [x] Add protected backend procedures for document intake, transcript analysis, timer control, billing review, approval, rejection, and export.
- [x] Implement structured AI extraction for summaries, facts, people, dates, deadlines, action items, vocabulary, and candidate billable work with source quotations.
- [x] Let attorneys paste matter text or analyze an existing transcript and review every extracted item before saving it to the matter.
- [x] Add matter-linked live timers with one active timer per attorney and exact elapsed-time capture.
- [x] Detect explicit billing statements in dictation, including stated duration, task category, narrative, client, and matter.
- [x] Mark AI-detected work without explicit time as `needs duration` instead of inventing billable time.
- [x] Create a billing review ledger with draft, approved, rejected, and exported states plus duplicate detection.
- [x] Add CSV billing export with client, matter, attorney, activity, duration, narrative, source, and approval metadata.
- [x] Add navigation and dashboards for Matter AI and Billing Copilot while preserving the Litigator’s Desk design.
- [x] Verify source grounding, timer calculations, billing guardrails, duplicate prevention, authorization, responsive behavior, tests, and production build.
- [x] Save and deliver the AI billing-copilot checkpoint.
- [x] Keep AI-extracted findings and billing candidates staged as proposed records until an attorney accepts or rejects each item.
- [x] Create a billing-ledger entry only when an attorney accepts a staged billing candidate; reject without linking it.
- [x] Validate pasted-text and transcript review decisions end to end and confirm staged, accepted, and rejected persistence in both the UI and database.

## Real Transcript Validation and Firm Billing Codes

- [x] Locate an authorized user-provided transcript sample and record its source boundary for the validation run.
- [x] Add firm billing codes with unique code, label, category, description, default narrative, display order, and active status.
- [x] Restrict billing-code creation, editing, activation, and reordering to firm administrators.
- [x] Add protected billing-code list and administration APIs with duplicate-code validation.
- [x] Build a Firm Billing Codes settings panel with create, edit, activate, deactivate, and ordering controls.
- [x] Replace fixed billing activities in timers, manual drafts, voice billing, AI candidates, review rows, and CSV exports with firm-defined codes while preserving legacy fallbacks.
- [x] Test the real transcript through Matter AI and verify source-grounded findings, future-work separation, explicit-duration handling, and staged billing candidates.
- [x] Accept and reject selected real-transcript findings and verify only accepted candidates enter the billing ledger.
- [x] Verify administrator permissions, duplicate-code prevention, inactive-code behavior, mobile layout, tests, production build, and fresh runtime logs.
- [x] Save and deliver the real-transcript and firm-billing-code checkpoint.
- [x] Display the mapped firm billing code on staged Matter AI and transcript billing candidates before attorney acceptance.
- [x] Validate an AI-generated billing candidate through firm-code mapping, attorney acceptance or rejection, ledger persistence, and export metadata.
- [x] Run a transcript-derived explicit-duration work sample, confirm its staged billing card displays the mapped firm code, and preserve UI plus database evidence.
- [x] Reject a firm-code-mapped staged billing candidate and verify no billing ledger row is created or linked.
- [x] Deactivate CS-REV, confirm it is unavailable for new timers, manual drafts, and AI candidate acceptance, and confirm historical CS-REV ledger and export records still display correctly before reactivation.

## Lawyer Rates and Practice-Management Sync

- [x] Document rate precedence, effective dates, historical rate snapshots, rounding rules, and attorney-approval boundaries.
- [x] Add lawyer rate cards with hourly rate, currency, effective date, active status, and administrator-only management.
- [x] Snapshot the applied lawyer rate and calculated fee on every billing entry so later rate changes do not rewrite history.
- [x] Apply rates and exact fee calculations to timers, explicit-duration drafts, AI candidates, manual entries, ledger totals, and CSV exports.
- [x] Preserve the firm’s private billing-code import path without fabricating private data; use the attributable public UTBMS starter until the firm supplies its custom list.
- [x] Map imported public UTBMS codes to AI extraction, timers, manual drafts, staged review, historical records, and exports while preserving private-code import support.
- [x] Retest Matter AI with an authorized transcript and controlled work note; verify exact UTBMS mapping, explicit duration, benchmark fee math, future-work separation, and attorney staging.
- [x] Inspect current connector availability and official Clio and MyCase integration requirements before choosing the supported connection path.
- [x] Add encrypted Clio connection settings, matter mapping, approved time-entry sync, idempotency keys, sync states, and audit history.
- [x] Add encrypted MyCase connection settings, matter mapping, approved time-entry sync, idempotency keys, sync states, and audit history.
- [x] Require explicit attorney confirmation before each external Clio or MyCase synchronization action.
- [x] Verify permissions, rate math, historical immutability, code mapping, duplicate prevention, sync failure handling, responsive layouts, tests, build, and fresh runtime logs.
- [x] Save and deliver the lawyer-rate, public UTBMS starter, and Clio/MyCase integration-foundation checkpoint.
- [x] Source an authoritative public UTBMS or LEDES litigation billing-code taxonomy and preserve source URLs and publication context.
- [x] Import the public billing taxonomy as a clearly labeled starter library, never as a claim about the firm’s private custom codes.
- [x] Source current published attorney-rate benchmark data relevant to the firm’s geography or practice context and document methodology and limitations.
- [x] Store any public rate value as a benchmark recommendation requiring administrator adoption, never as an active lawyer rate by default.
- [x] Retest Matter AI against the authorized transcript using the imported public code taxonomy and verify attorney-controlled mapping.
- [x] Keep actual lawyer rate cards unset until approved names and rates are supplied; expose public benchmarks only as non-activating form drafts.
- [x] Keep live Clio OAuth and remote posting disabled while credentials are absent; ship and test the encrypted connection, mapping, payload, confirmation, idempotency, and audit foundation.
- [x] Keep live MyCase OAuth and remote posting disabled while credentials are absent; ship and test the encrypted connection, mapping, payload, confirmation, idempotency, and audit foundation.
