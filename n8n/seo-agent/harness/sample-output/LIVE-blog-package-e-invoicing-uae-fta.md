# E-Invoicing UAE FTA Guide: Find Your Phase, Deadline and Readiness Plan

E-invoicing UAE FTA rules now set fixed dates for businesses carrying out B2B and B2G transactions. Most of the work sits in your finance system and master data. This guide covers four steps in order. First, find your phase. Second, get your ASP appointment and go-live dates. Third, follow a dated 12-week readiness plan. Fourth, score Accredited Service Providers on a printable scorecard. Rules link to UAE government sources where a public page exists. Dates link to the named advisory sources that report them. For background, see our [complete guide to e-invoicing in the UAE](https://techand.ai/e-invoicing-in-uae/).

**Quick answer:** Yes. UAE e-invoicing is becoming mandatory for B2B and B2G transactions. Voluntary adoption starts on 1 July 2026. Businesses with annual revenue of [Price] million or more must appoint an Accredited Service Provider (ASP) by 30 October 2026 and start issuing e-invoices from 1 January 2027. All other businesses follow from 1 July 2027.

Dates checked against the sources linked in this guide as of September 2026.

## Is e-invoicing mandatory in the UAE?

Yes, in phases. The UAE electronic invoicing system applies to B2B and B2G transactions. B2C transactions are not in the current phases, and no B2C date has been published.

The voluntary start is reported by [Hawksford](https://www.hawksford.com/insights-and-guides/uae-e-invoicing). The mandatory dates are reported by [GFLO](https://gflolaw.com/en/uae-e-invoicing-2026-guide/) and [ClearTax](https://www.cleartax.com/ae/e-invoicing-uae).

Two authorities have separate roles. The UAE Ministry of Finance (MoF) sets policy and issues the legislation. The UAE Federal Tax Authority (FTA) receives and administers the tax data.

### Is a PDF invoice a valid e-invoice in the UAE?

No. PDFs, Word files, scanned copies and emailed invoices are not valid e-invoices. The legal invoice is the structured XML file in PINT-AE format exchanged through an accredited ASP. You may still share a readable copy alongside it for convenience.

PINT-AE is the UAE version of the Peppol International invoice specification. Electronic invoices travel over the Peppol network through Accredited Service Providers. The tax data is reported to the FTA in near real time ([VATupdate](https://www.vatupdate.com/2026/06/09/uae-publishes-updated-electronic-invoicing-guidelines-version-1-1-june-2026/)).

A PDF that contains every required field still fails. No system can validate it field by field or exchange it as structured data.

### The legislation behind the mandate

The e-invoicing framework rests on these texts, issued by the UAE Ministry of Finance:

- Ministerial Decision No. 243 of 2025 establishes the electronic invoicing system ([u.ae](https://u.ae/en/information-and-services/business/important-digital-services/digital-invoicing)).
- Ministerial Decision No. 244 of 2025 governs implementation, including phases and dates.
- Ministerial Decision No. 64 of 2025 sets the accreditation requirements for ASPs.
- Cabinet Decision No. 106 of 2025 defines violations and administrative penalties.

The FTA's e-invoicing guidance is on [tax.gov.ae](https://tax.gov.ae/en/taxes/Vat/uae.einvoicing.aspx).

## What is the deadline for e-invoicing in the UAE? Find your phase

For businesses with annual revenue of [Price] million or more, the deadline to appoint an ASP is 30 October 2026. E-invoicing becomes mandatory for them on 1 January 2027. Businesses below [Price] million must go live from 1 July 2027.

[Image: UAE e-invoicing timeline showing the voluntary phase from 1 July 2026, the ASP deadline of 30 October 2026 and mandatory go-live on 1 January 2027 for [Price] million+ businesses]

The rollout is phased by annual revenue. The pilot programme and voluntary implementation open on 1 July 2026 ([Tally](https://tallysolutions.com/mena/uae-vat/uae-e-invoicing-timeline-2026-2027-complete-phase-by-phase-implementation-guide/?srsltid=AU7gw4XwYkwOSmZ8OnwEFd5peBCLGehBFxY4ROZEBOjW53X4jzCq3Z-E)).

### UAE e-invoicing timeline at a glance

Which UAE e-invoicing phase are you in?

| Business profile | Annual revenue | ASP appointment deadline | Mandatory go-live | What to do now | Source |
|---|---|---|---|---|---|
| Voluntary or pilot adopter | Any | None | Optional from 1 July 2026 | Use the pilot to test ERP output | [Hawksford](https://www.hawksford.com/insights-and-guides/uae-e-invoicing) |
| Large business | [Price] million or more | 30 October 2026 | 1 January 2027 | Map data and appoint an ASP now | [ClearTax](https://www.cleartax.com/ae/e-invoicing-uae) |
| All other businesses | Under [Price] million | Not yet confirmed in our sources | 1 July 2027 | Clean master data and shortlist ASPs | [GFLO](https://gflolaw.com/en/uae-e-invoicing-2026-guide/) |

We have left out VAT groups, free zone, non-resident and government profiles because their dates could not be confirmed in the sources checked.

### Businesses under [Price] million: your Phase 2 dates

Mandatory go-live for businesses under [Price] million is 1 July 2027 ([GFLO](https://gflolaw.com/en/uae-e-invoicing-2026-guide/)). The ASP appointment deadline for this group is not confirmed in our sources. Treat any date you see elsewhere as provisional until the MoF text confirms it.

Plan to the earliest date that could apply to you. ASP onboarding, ERP configuration and testing all need calendar time.

### How to work out which revenue figure counts

The legislation links your phase to annual revenue. Agree the exact measure and reference period with your tax adviser and keep that decision on file.

One mistake to avoid is using a single entity's revenue when a group figure applies. If you do, you could plan for the wrong phase.

> Key dates: 1 July 2026, voluntary start · 30 October 2026, ASP deadline ([Price] million or more) · 1 January 2027, go-live ([Price] million or more) · 1 July 2027, go-live (under [Price] million)

## Who is eligible for e-invoicing, and who must comply?

The UAE e-invoicing system covers businesses carrying out B2B and B2G transactions in the UAE, including VAT groups. Businesses with revenue of [Price] million or more go first, and others follow from 1 July 2027. B2C is not yet included.

TRN means Tax Registration Number. TIN means Tax Identification Number. Both identify the seller and buyer on the e-invoice.

### VAT groups and multi-entity businesses

- If you are a VAT group, each member needs a separate endpoint connection with the ASP while using the group TRN ([PwC](https://www.pwc.com/m1/en/tax/documents/2024/uae-e-invoicing-newsletter.pdf)).
- Store an endpoint ID on each Business Central company or Dynamics 365 Finance & Operations legal entity. Put the group TRN on every invoice.
- Avoid using one endpoint for the whole group. Member invoices will not route correctly.

### Free zone, non-resident and non-VAT-registered businesses

Our sources do not confirm specific treatment for these profiles. Take specialist advice before you plan against the phase table.

### Overseas customers and B2C

- If your customer is overseas, they have no UAE Peppol ID. The MoF guidelines set a fallback endpoint ID for this case.
- If you sell only to consumers, B2C is not yet in scope.

## How the 5-corner Peppol model works: what the FTA sees and what your buyer sees

The UAE uses a Decentralised Continuous Transaction Control and Exchange (DCTCE) model built on the Peppol 5-corner model ([PwC](https://www.pwc.com/m1/en/tax/documents/2024/uae-e-invoicing-newsletter.pdf)). Your invoice travels between two ASPs, and the tax data goes to the UAE Federal Tax Authority. The FTA is rolling out this Peppol-based system in phases ([GTAG](https://www.gtag.ae/post/uae-e-invoicing-2026)).

[Image: Diagram of the UAE DCTCE 5-corner Peppol e-invoicing model showing the seller, seller's ASP, buyer's ASP, buyer and the FTA]

### Corner by corner: from your ERP to the FTA

1. Corner 1: your ERP creates the invoice data from the posted sales document.
2. Corner 2: your ASP validates the data, converts it to PINT-AE XML and sends it over Peppol.
3. Corner 3: the buyer's ASP receives the e-invoice.
4. Corner 4: the buyer's ERP ingests it as structured data.
5. Corner 5: the FTA receives the tax data that the ASPs report in near real time ([VATupdate](https://www.vatupdate.com/2026/06/09/uae-publishes-updated-electronic-invoicing-guidelines-version-1-1-june-2026/)).

Your buyer receives the full structured e-invoice. The FTA receives a tax data set. It does not clear the invoice before the buyer gets it, unlike the KSA clearance approach.

Credit notes follow the same flow and must reference the original invoice. Every document passes through an ASP, so you cannot avoid appointing one.

### What the FTA does not do for you

The FTA does not issue your invoices, host them or act as your ASP. Your business stays responsible for accuracy and retention. ASPs check format, but they cannot correct a wrong customer TRN in your master data.

The 5-corner model moves errors upstream to your ERP, and that is where you fix them.

## What are the requirements for an FTA invoice in the UAE?

A UAE e-invoice must be a structured XML file in PINT-AE format. It is exchanged over the Peppol network through an MoF-accredited ASP, with tax data reported to the FTA. It must contain the mandatory fields, including seller and buyer TRN or TIN, endpoint IDs, line items and the VAT breakdown. PDFs are not valid.

[Image: Annotated sample of UAE PINT-AE e-invoice fields grouped into seller data, buyer data, invoice lines and VAT totals]

The requirements are:

- PINT-AE XML format.
- Transmission through an accredited service provider (ASP) over Peppol.
- The mandatory data fields set by the MoF.
- Seller and buyer identification: TRN or TIN, plus a Peppol endpoint ID.
- A VAT breakdown by rate and category.
- Record retention by your business.

### Annotated sample: the fields in a PINT-AE e-invoice

This e invoicing UAE FTA sample is illustrative. Check it against the MoF's UAE Electronic Invoice Mandatory Field Requirements before you build.

| Group | Field | Illustrative value | Source in your ERP |
|---|---|---|---|
| Seller master data | Legal name, address | Example Trading LLC, Dubai | Company information |
| Seller master data | TRN or TIN | 100123456700003 | Company VAT registration number |
| Seller master data | Endpoint ID | Issued at ASP onboarding | Company record |
| Buyer master data | Name, TRN or TIN | Example Buyer LLC, 100987654300003 | Customer card |
| Buyer master data | Endpoint ID or fallback ID | Buyer's Peppol ID | New field on customer master |
| Invoice header | Number, issue date | INV-2027-0001, 15 January 2027 | Number series, document date |
| Invoice header | Type code, currency | Tax invoice or credit note, AED | Document type, currency code |
| Lines | Description, quantity, unit price | Consulting services, 10, [Price] | Sales lines |
| Lines | VAT rate and category | 5%, standard, zero or exempt | VAT posting set-up |
| Totals | Net, VAT, gross | [Price] [Price] [Price] | Calculated by the ERP |

A PDF of the same data is only a picture of it. The XML is an electronic invoice that the ASP can validate field by field and report.

### Is there an FTA e-invoice template or PDF?

No official FTA e-invoice template is available to download. ASPs and ERPs generate the XML. Use the field layout above as your practical alternative.

### Credit notes, advance payments, withholding tax and retention (Version 1.1)

The MoF published Electronic Invoicing Guidelines Version 1.1 in June 2026 ([VATupdate](https://www.vatupdate.com/2026/06/09/uae-publishes-updated-electronic-invoicing-guidelines-version-1-1-june-2026/)). Test these cases with your ASP:

- Credit notes: make the original invoice reference a required field on ERP credit memos.
- Advance payments: agree when the e-invoice is issued and how the final invoice nets it off.
- Withholding tax: check which fields carry the amounts and whether your ERP populates them.
- Contract retentions: check how retained amounts appear on the invoice and on later releases.

## How to choose an Accredited Service Provider (ASP)

### Do I need an Accredited Service Provider for UAE e-invoicing?

Yes. Businesses in scope must use a Ministry of Finance-accredited ASP to validate, convert and exchange e-invoices over Peppol and report the data to the FTA. You cannot submit directly to the FTA. Large businesses must appoint their ASP by 30 October 2026 ([ClearTax](https://www.cleartax.com/ae/e-invoicing-uae)).

### Where to find the official list of accredited ASPs

Use the official accredited list published by the UAE Ministry of Finance rather than a copy, because the list changes. Check the provider's status again on the day you sign. The MoF also publishes "Considerations for Selecting an Accredited Service Provider".

> Disclosure: Tech& is a Microsoft partner that integrates Dynamics 365 and Business Central with the ASP you choose. Check the accreditation of any provider, including those we work with, on the MoF list.

### ASP selection scorecard

Score each accredited service provider ASP candidate from 1 to 5 on each criterion, then multiply by its weight.

| Criterion | Weight | What good looks like | Score (1–5) |
|---|---|---|---|
| Accreditation status | ×3 | On the MoF accredited list today | |
| ERP connector | ×3 | Native for Dynamics 365 F&O, Business Central, SAP or your ERP | |
| VAT-group and multi-entity handling | ×2 | One endpoint per member under the group TRN | |
| Validation and error handling | ×2 | Rejections returned before submission, with clear reasons | |
| Onboarding time to production | ×2 | A written plan with dated milestones | |
| Support hours, language and SLA | ×1 | UAE hours, Arabic and English, defined response times | |
| Pricing model | ×1 | Per invoice, tiered or annual, with all fees stated | |
| Data residency, security, archiving | ×2 | Stated hosting location and retention period | |

Disqualify any provider that scores 1 on accreditation, however well it scores elsewhere.

### Questions to ask on every ASP call

1. Can you show your entry on the MoF accredited list?
2. Can you demonstrate your connector with our ERP version?
3. How do you set up endpoints for each member of a VAT group?
4. Which sandbox scenarios can we test before go-live?
5. What happens to an invoice your validation rejects?

Watch for these red flags: no proof of accreditation, "PDF plus QR" offerings, no sandbox, and vague answers on VAT groups. For product features, read [Peppol e-invoicing software features every UAE CFO should check](https://techand.ai/insights/top-peppol-e-invoicing-software-features-every-uae-cfo-must-look-for).

## Your 12-week UAE e-invoicing readiness plan

Start 12 weeks before your ASP deadline. For businesses with [Price] million or more, that is 7 August 2026. For smaller businesses, the date is provisional until the ASP deadline is published. Start no later than 8 April 2027, 12 weeks before the 1 July 2027 go-live. If your start date has passed, run weeks 1–8 in parallel and appoint your ASP first.

[Image: 12-week UAE e-invoicing readiness checklist for finance teams, from ERP data mapping to ASP testing and go-live]

### Weeks 1–4: scope, mapping and gap analysis

- [ ] Weeks 1–2 (Tax): confirm your phase and deadline using the table above.
- [ ] Weeks 1–2 (Finance): list every invoice type, including tax invoice, credit note, self-billing and exports. List every legal entity.
- [ ] Weeks 3–4 (IT/ERP): map your invoice data to the PINT-AE fields and record each gap.

### Weeks 5–8: master data and ASP appointment

- [ ] Weeks 5–6 (Finance): validate customer TRNs and TINs, and capture buyer Peppol endpoint IDs.
- [ ] Weeks 5–6 (Procurement): clean supplier master data for inbound invoices.
- [ ] Weeks 7–8 (Finance and Procurement): score ASPs and appoint one.

### Weeks 9–12: integration, testing and go-live

- [ ] Weeks 9–10 (IT/ERP): build the ERP-to-ASP integration and configure endpoints for VAT-group members.
- [ ] Week 11 (all owners): run sandbox tests with an advance payment, a credit note and an overseas customer.
- [ ] Week 12 (Finance): sign off go-live readiness, train staff and agree the reconciliation process.

For integration detail, read our [technical guide to upgrading your ERP for Peppol PINT-AE](https://techand.ai/insights/upgrading-your-erp-for-uae-peppol-pint-ae-compliance-a-technical-integration-guide). If you run a legacy system, our work on [Business Central implementation in the UAE](https://techand.ai/business-central-implementation-uae) is relevant.

Tech& is a Microsoft partner delivering Dynamics 365 Finance & Operations and Business Central across the GCC. We treat an e invoicing UAE FTA project as a finance-system project first.

### What changes in your month-end close

| Step | Before | After |
|---|---|---|
| Sales invoices | PDFs emailed to customers | XML exchanged through the ASP |
| Errors | Found by customers weeks later | Rejection queue cleared daily |
| VAT return | Manual reconciliation | Figures must match data the FTA already holds |
| Supplier invoices | Keyed in by hand from email | Structured inbound e-invoices |
| Credit notes | Free-text reference | Mandatory link to the original invoice |

## What are the penalties for not complying with UAE e-invoicing under the FTA?

The amounts are set in Cabinet Decision No. 106 of 2025 on violations and administrative penalties under the electronic invoicing system. Read the decision text, published by the UAE Ministry of Finance, before relying on any figure. The FTA's e-invoicing guidance is on [tax.gov.ae](https://tax.gov.ae/en/taxes/Vat/uae.einvoicing.aspx).

Treat your deadlines as firm. Penalties attach to your business, not to your ASP. For a summary of the decision, see [UAE e-invoicing penalties explained](https://techand.ai/uae-e-invoicing-penalties/).

## Sources

Primary sources: [tax.gov.ae](https://tax.gov.ae/en/taxes/Vat/uae.einvoicing.aspx) and [u.ae](https://u.ae/en/information-and-services/business/important-digital-services/digital-invoicing). Dates are reported by [Hawksford](https://www.hawksford.com/insights-and-guides/uae-e-invoicing), [ClearTax](https://www.cleartax.com/ae/e-invoicing-uae), [GFLO](https://gflolaw.com/en/uae-e-invoicing-2026-guide/) and [Tally](https://tallysolutions.com/mena/uae-vat/uae-e-invoicing-timeline-2026-2027-complete-phase-by-phase-implementation-guide/?srsltid=AU7gw4XwYkwOSmZ8OnwEFd5peBCLGehBFxY4ROZEBOjW53X4jzCq3Z-E). Other secondary sources are linked in each section.

## Frequently Asked Questions

Q1: Is e-invoicing mandatory in the UAE?
A1: Yes, in phases, for B2B and B2G transactions. Voluntary adoption starts on 1 July 2026. Businesses with annual revenue of [Price] million or more must issue e-invoices from 1 January 2027, and all other businesses from 1 July 2027. B2C transactions are not yet in scope, and no B2C date has been published.

Q2: What is the deadline for e-invoicing in the UAE?
A2: Businesses with annual revenue of [Price] million or more must appoint an ASP by 30 October 2026 and go live on 1 January 2027. Businesses below that threshold go live from 1 July 2027. Their ASP appointment deadline has not been confirmed in our sources, so plan to appoint well before go-live.

Q3: What are the requirements for an FTA invoice in the UAE?
A3: The invoice must be structured XML in PINT-AE format, exchanged over Peppol through an accredited ASP, with tax data reported to the FTA. It must carry the mandatory fields: seller and buyer TRN or TIN, endpoint IDs, invoice number, date, type code, line items and a VAT breakdown. A PDF does not meet these requirements.

Q4: Who is eligible for e-invoicing?
A4: Businesses carrying out B2B and B2G transactions in the UAE are in scope, including VAT groups. In a VAT group, each member needs its own ASP endpoint under the group TRN. Businesses with revenue of [Price] million or more go first, and others follow from 1 July 2027. B2C is not yet included in any phase.

Q5: Is a PDF or emailed invoice a valid e-invoice in the UAE?
A5: No. PDFs, Word files, scanned copies and emailed invoices are not valid e-invoices, even when they contain every field. The legal invoice is the PINT-AE XML file exchanged through an accredited ASP. You may send a readable copy alongside it for your customer's convenience, but that copy has no legal status.

Q6: Can I submit e-invoices directly to the FTA without an ASP?
A6: No. Under the 5-corner Peppol model, every e-invoice passes through an MoF-accredited ASP, which validates, converts and exchanges it and reports the tax data to the FTA. The FTA does not issue or host invoices for you. Your business remains responsible for the accuracy of the data your ERP sends.

Q7: How do I choose an Accredited Service Provider, and where is the list of accredited ASPs?
A7: Use the official list published by the UAE Ministry of Finance and check status on the day you sign. Score each shortlisted provider on accreditation, ERP connector, VAT-group handling, validation, onboarding time, support and SLA, pricing model, and data residency. Treat missing accreditation proof or a "PDF plus QR" offer as grounds to disqualify.

Q8: What are the penalties for not issuing e-invoices in the UAE?
A8: The violations and penalty amounts are set in Cabinet Decision No. 106 of 2025 on administrative penalties under the electronic invoicing system. Read the decision text published by the Ministry of Finance before relying on any figure. Penalties fall on your business, not your ASP, so treat your deadlines as firm.

## Book a free e-invoicing UAE FTA readiness check

In one session, our team does three things:

- confirms your phase and deadline
- reviews your ERP invoice data against the PINT-AE fields
- gives you an ASP shortlist using our scorecard

[Get my free readiness check](https://techand.ai/contact-us)
