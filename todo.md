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
