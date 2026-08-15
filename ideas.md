# CounselScribe AI — Design Direction

## Three distinct approaches

### Theme Name: The Litigator’s Desk
**Very Brief Intro:** A premium editorial workspace inspired by legal briefs, acoustic equipment, and a senior partner’s private desk. Dark navy architecture, warm paper surfaces, precise gold annotation, and strong asymmetric work zones make the product feel serious and review-led.
**Probability:** 0.032

### Theme Name: Sunlit Chambers
**Very Brief Intro:** A warm, modernist interface built from limestone, cream paper, forest green, and restrained vermilion. It feels approachable and human—closer to a quiet Florida courthouse library than enterprise software.
**Probability:** 0.071

### Theme Name: Evidence Lab
**Very Brief Intro:** A cool, highly technical visual language of frosted white, cobalt, graphite, and precise data overlays. It presents transcription as forensic evidence processing rather than conventional document editing.
**Probability:** 0.018

## Chosen Approach: The Litigator’s Desk

### Design Movement
**Contemporary editorial luxury with legal-document modernism.** The interface combines the measured hierarchy of a well-typeset brief, the tactile warmth of cream paper, and the precision of professional audio equipment.

### Core Principles
1. **Review before automation:** Every correction and cleanup action is visible, reversible, and anchored to the source transcript.
2. **Document, not dashboard:** The transcript is the primary artifact; metrics and controls orbit it rather than competing with it.
3. **Quiet authority:** Deep ink, parchment, and gold communicate confidence without neon, excessive glow, or generic SaaS gradients.
4. **Asymmetric work zones:** A narrow matter rail, broad dictation desk, and focused review column preserve a realistic attorney workflow.

### Color Philosophy
The application uses **deep ink navy** to create privacy and concentration, while **warm parchment** gives the transcript the psychological familiarity of a document under review. Gold appears only on decisive moments—recording state, approved terms, signature actions, and the CounselScribe mark—so it remains ownable rather than decorative. Rust red is reserved for rejected or legally sensitive changes. The palette inherits The Finnese Group’s black, navy, gold, blue, and white, but adapts them into a legal-work product rather than a corporate landing page.

### Layout Paradigm
The desktop experience is a **three-zone counsel table** rather than a centered card grid. A compact left rail holds the active matter and privacy controls. The center is a broad paper-like transcript editor with live audio state anchored low in the composition. The right column is a vertical “Review Docket” containing proposed cleanups, glossary hits, and confidence flags. On mobile, the docket becomes a bottom sheet and the matter rail condenses into a horizontal header.

### Signature Elements
- **Docket tabs:** Thin gold-labeled tabs identify `RAW`, `REVIEWED`, and `EXPORT` states like indexed exhibits.
- **Argument rule:** A fine double rule and tiny uppercase mono labels separate the document’s procedural zones.
- **Acoustic seal:** A circular waveform/quill emblem appears as the product mark, record control, favicon, and empty-state watermark.

### Interaction Philosophy
High-frequency work must feel instant and deliberate. Recording uses one unmistakable control and keyboard shortcut. Suggestions never vanish automatically; `Accept`, `Keep original`, and `Teach term` behave like legal markup decisions. Hover and focus states sharpen borders and reveal explanatory copy without shifting layout.

### Animation
The waveform responds while recording through a restrained amplitude pulse. The record control uses a 140ms press response and a slow breathing ring only while active. Review items enter with a 50ms stagger and fade/translate no more than 8px. Accept/reject actions crossfade the item into an audit state rather than removing it abruptly. All motion respects reduced-motion preferences and stays under 280ms except the recording breath.

### Typography System
- **Display and document headings:** `Cormorant Garamond`, 600–700 weight, used sparingly for product and document titles.
- **Interface and body:** `DM Sans`, 400–700 weight, optimized for controls and readable transcript prose.
- **Procedural labels:** `Space Mono`, 400–700 weight, uppercase with generous tracking for matter IDs, timestamps, and docket statuses.
- Transcript body uses a comfortable 18–20px DM Sans line with generous leading. The legal phrase itself may be highlighted with a subtle Cormorant italic accent only when explaining a glossary match.

### Brand Essence
**CounselScribe is the attorney-controlled dictation desk for law firms that need faster drafts without surrendering legal meaning or privacy.**

Personality: **authoritative, discreet, exacting.**

### Brand Voice
Headlines sound composed and specific. Calls to action use verbs attorneys understand—`Begin dictation`, `Review changes`, `Teach this term`, `Export draft`. Microcopy explains consequences without hype.

Example lines:
- **“Say the argument. Keep the authority.”**
- **“Every correction remains yours to approve.”**

### Wordmark & Logo
The wordmark combines a custom high-contrast `CS` monogram with a single continuous waveform that resolves into a fountain-pen nib inside a protective circle. `Counsel` is set in Cormorant Garamond semibold and `Scribe` in tracked Space Mono. The product mark is independent of the name and remains recognizable at favicon size. The Finnese Group circle monogram appears as a discreet maker seal in the header, not as the primary product mark.

### Signature Brand Color
**Counsel Gold — `#D6B65D`**. It signals approved authority and is reserved for recording, approval, and product identity.

## Product Scope Contract

The first build is a browser proof of concept using synthetic sample content only. It includes microphone transcription where the browser supports speech recognition, an always-available scripted demo fallback, a Florida legal term normalizer, reviewable filler/restart suggestions, a user-taught term dictionary stored in local browser storage, copy/download export, and a clear non-production privacy notice. It does not claim fully local processing, legal accuracy, privileged-data readiness, mobile app distribution, or autonomous legal judgment.

## Style Decisions

- The **acoustic seal** is the primary product signature and must combine writing-instrument geometry with waveform behavior. It appears in the header, empty document, privacy explanation, record control, and favicon; a generic legal crest alone is not sufficient.
- Status colors outside Counsel Gold remain desaturated and visually subordinate. Safety is communicated mainly through copy, iconography, and procedural labels rather than a competing cybersecurity-green identity.
- The transcript surface always reads as a living legal brief, including a red review margin, double rules, folio labels, line structure, and attorney-review marks even before dictation begins.
- The wordmark treats `Counsel` as editorial authority in Cormorant Garamond and `SCRIBE` as procedural technology in Space Mono.

## File-Level Style Reminder

Every page and styling file must reinforce **The Litigator’s Desk**: asymmetric three-zone layout, deep ink architecture, parchment transcript surface, disciplined Counsel Gold, visible review control, Cormorant/DM Sans/Space Mono typography, and no generic centered SaaS cards, purple gradients, uniform rounded corners, or excessive glow.
