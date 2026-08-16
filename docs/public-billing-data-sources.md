# Public Billing Taxonomy and Rate Benchmarks

**Author:** Manus AI  
**Prepared:** August 16, 2026

CounselScribe may preload public industry standards as a **starter library**, but it must never represent those standards as a law firm’s private outside-counsel guidelines or negotiated fee schedule. Active firm rates remain administrator-approved, effective-dated records tied to a specific lawyer.

## Billing-code taxonomy

The American Bar Association describes UTBMS as a toolkit for communicating engagement deliverables, fees, and success criteria. Its Litigation Code Set is intended for contested matters, including judicial litigation, arbitration, and regulatory or administrative proceedings.[1] The LEDES Oversight Committee states that the original 1997 ABA Litigation Code Set contains five phases and 29 task codes and publishes an ABA-authorized spreadsheet.[2] The committee separately publishes the original 11 ABA Activity Codes.[3]

| Dataset | Planned use | Product label |
|---|---|---|
| ABA UTBMS Litigation Codes 1997 | Public task-code starter library for litigation matters | **UTBMS starter — not firm-customized** |
| ABA UTBMS Activity Codes 1997 | Public activity mapping for actions such as research, drafting, review, and communication | **UTBMS activity — public standard** |

No code will be silently activated as a private firm code. An administrator must review and adopt the starter library, and may edit, deactivate, or replace it.

## Florida rate benchmark

Clio’s Florida benchmark page was updated in March 2026 and reports 2025 aggregated, anonymized data from tens of thousands of U.S. legal professionals. It lists a **$353 average hourly lawyer rate in Florida**, a **$305 blended law-firm rate**, and a **$324 average for civil litigation**.[4] These are market observations—not a fee recommendation and not a contracted rate for any lawyer.

| Benchmark | Published value | CounselScribe treatment |
|---|---:|---|
| Florida lawyer average | $353/hour | Display-only benchmark |
| Florida civil-litigation average | $324/hour | Display-only practice benchmark |
| Florida blended law-firm average | $305/hour | Display-only context |

> Public benchmark rates are never applied to client billing automatically. An administrator must explicitly create a lawyer rate card. That action snapshots the chosen rate on future entries while preserving historical totals.

## References

[1]: https://www.americanbar.org/groups/litigation/resources/uniform-task-based-management-system/ "American Bar Association — Uniform Task-Based Management System"
[2]: https://utbms.com/aba-litigation-codes/ "LEDES Oversight Committee — ABA Litigation Codes"
[3]: https://utbms.com/aba-activity-codes/ "LEDES Oversight Committee — ABA Activity Codes"
[4]: https://www.clio.com/resources/legal-trends/compare-lawyer-rates/fl/ "Clio — How Much Should I Charge as a Lawyer in Florida?"

## Rendered validation

The authenticated Firm Controls page displays the three sourced Florida benchmarks as context, and only the two lawyer-specific values offer **Use as form draft**. No benchmark creates an active rate without selecting a firm member and submitting an effective-dated rate card. The billing-code panel exposes a deliberate **Load 29-code UTBMS starter** action with the LEDES source link. Clio and MyCase display **Credentials required** and remain disconnected because no provider-issued OAuth secrets were supplied.

## Extraction and import evidence

The administrator imported **29 active UTBMS litigation task codes**; a direct database check confirmed all 29 records carry the public ABA/LEDES attribution. Matter AI then processed the authorized uploaded legal-news transcript as analysis run `300001`. It produced 27 grounded matter findings, including six facts and four future/action items, and **zero billing candidates**, preserving the completed-work guardrail.

A separate controlled work note produced analysis run `330001`. Matter AI selected exact imported task codes **L120 — Analysis/Strategy** for 18 minutes and **L320 — Document Production** for 11 minutes. The requested future appellate brief remained an action item and did not become billable work. At the published Florida civil-litigation benchmark of **$324/hour**, the deterministic fee examples are **$97.20**, **$59.40**, and **$156.60 total**; these remain benchmark calculations only until a firm administrator adopts an effective-dated lawyer rate.
