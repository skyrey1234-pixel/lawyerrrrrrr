# CounselScribe Expanded Pilot Architecture

## Product boundary

CounselScribe remains an **attorney-controlled drafting and review system**. It may transcribe speech, normalize approved terminology, surface cleanup suggestions, and prepare documents, but it must not present legal judgment as automated fact. Raw audio, raw transcript, reviewed transcript, and exported document are separate artifacts with separate histories.

## Deployment approaches

| Approach | Experience | Tradeoffs | Cost profile | Setup complexity |
|---|---|---|---|---|
| Hosted pilot | Attorneys sign in, create matters, upload audio, review timestamped transcripts, teach vocabulary, compare output, and export Word-ready drafts from one managed web application. | Fastest route to a working multi-user pilot. Uploaded audio is processed by the hosted transcription service and therefore must not be described as fully local. | Managed usage with no additional local hardware service required. | Lower |
| Hybrid local pilot | The same authenticated workspace sends transcription jobs to a firm-controlled Mac mini companion. The companion returns timestamped text while the web application handles review, history, templates, and reporting. | Stronger data-control story and better fit for privileged work, but installation, certificates, device health, model storage, and office-network access must be configured and supported. | Existing Mac mini plus operational support; no claim of deployment until installed and validated at the firm. | Higher |

The shared web foundation is built first because both approaches require the same matters, sessions, review workflow, vocabulary, audit trail, templates, and analytics. The processing mode is explicit on every session: `Browser demo`, `Hosted transcription`, or `Local companion`.

## Privacy boundaries

| Zone | Permitted responsibility | Prohibited claim |
|---|---|---|
| Browser | Capture audio, upload approved files, display source-linked segments, collect attorney decisions, and keep temporary interface state. | The browser alone must not be called local processing when it invokes a browser or hosted speech service. |
| Hosted application | Authenticate users, isolate firm records, store file references, persist matters and audit events, generate exports, and coordinate hosted or local jobs. | Hosted processing must not be represented as on-premise or privilege-certified without separate legal and security review. |
| Mac mini companion | Accept authenticated firm-local jobs, run the selected speech model, return timestamped results, and report health. | A scaffold or disconnected service must never be shown as active, secure, or installed. |
| Attorney review | Approve corrections, reject cleanup, verify source audio, select templates, and authorize export. | CounselScribe must not silently remove substantive language or make autonomous legal conclusions. |

## Core domain model

| Entity | Purpose | Ownership boundary |
|---|---|---|
| Firm | Retention, processing mode, security posture, and administration settings. | Firm |
| Membership | User role within a firm: attorney, administrator, or reviewer. | Firm and user |
| Matter | Jurisdiction, practice area, parties, experts, terminology, and templates. | Firm |
| Session | One live dictation or uploaded recording with processing mode and status. | Matter |
| Audio asset | Storage key, duration, format, checksum, and retention state; never database bytes. | Session |
| Transcript segment | Timestamped source text, confidence, speaker, and sequence. | Session |
| Document version | Raw, normalized, reviewed, or exported text snapshot. | Session |
| Review decision | Accepted, rejected, restored, or manually edited change with actor and timestamp. | Document version |
| Learned term | Heard phrase, approved form, scope, source decision, use count, and active state. | User, matter, or firm |
| Template | Word-ready document structure, heading style, letterhead choice, and field mapping. | Firm |
| Comparison run | Dragon text, CounselScribe text, reference text, legal-term results, and measured correction burden. | Matter or firm |
| Audit event | Append-only record of access, uploads, processing, review, export, administration, and restoration. | Firm |

## Expanded pilot success criteria

The pilot is ready for firm testing when an authenticated attorney can create a synthetic matter, upload or record supported audio, receive timestamped segments, play audio from a selected segment, review every proposed change, teach a correction at the right scope, save and restore versions, export a Word-compatible document, and compare the result against a Dragon transcript. The interface must continuously disclose whether processing is browser-based, hosted, or actually connected to the local companion.

## Mac mini companion contract

The local service exposes a narrow authenticated contract: health status, model metadata, transcription job submission, progress, cancellation, and timestamped result retrieval. It stores no web credentials, accepts only configured firm identifiers, verifies signed requests, restricts cross-origin access, and writes structured logs without transcript content by default. Installation, service management, model download, TLS or secure tunnel, and office-network validation remain deployment work—not frontend claims.

