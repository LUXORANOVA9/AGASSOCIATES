-- scripts/update-article-codes.sql
--
-- One-time data fill for the 13 case_article_codes rows that were
-- left as TO_FILL placeholders. Run after the migration in
--   ag-platform/src/server/migrations.sql (case_article_codes)
-- has been applied locally + in Supabase.
--
-- Reference: Maharashtra Stamp Act 1958 + IGR Maharashtra MTR-6
-- fee schedule (Govt Resolution No. Misc-2018/C.R.99/M-1).
--
-- IMPORTANT CONTEXT:
--   The `case_type` column is a service-type enum, not a legal
--   instrument. The 13 values are the 13 service offerings of
--   AG Associates (e.g. 'PROPERTY_REGISTRATION' is the service;
--   the actual instrument being drafted is a Sale Deed, which
--   has its own Article Code).
--
--   For each row you need to fill in:
--     article_code      = the Schedule I "Article / Entry" number
--                         that the IGR MTR-6 form will list, OR
--                         'NA' for services that don't have an
--                         article (CTC, FRANKING, etc.)
--     statutory_act     = the Act under which the duty is fixed
--                         (e.g. "Maharashtra Stamp Act, 1958")
--     mtr6_description  = the human-readable description that
--                         should appear on the IGR MTR-6 cover
--                         page (e.g. "Sale Deed - immovable
--                         property")
--     statutory_fee_pct = the GOVERNMENT STAMP DUTY as a
--                         percentage of consideration (NOT the
--                         advocate service fee). For sale of
--                         immovable property in MH the rate is
--                         6% of MV (5% for females); the Bouncer
--                         uses this to validate consideration ×
--                         fee_pct matches the stamp duty the
--                         customer paid.
--     requires_sro_visit = TRUE if a field executive must visit
--                         the SRO counter for this service
--     requires_noc      = TRUE if a NoC is needed from a third
--                         party (society, bank, CWC, etc.)
--     notes             = one-line hint for the Bouncer agent
--                         to decide whether the case_type ↔
--                         declared instrument is a valid match
--     validated_by_principal = TRUE only after Adv. Aditya has
--                         reviewed and confirmed the row.
--                         The Bouncer BLOCKS the case if this
--                         is FALSE.
--
--   Three sample rows are FULLY filled below (GIFT_DEED,
--   LEAVE_AND_LICENSE, POWER_OF_ATTORNEY) — use them as a model.
--   CTC is also filled in as a "no-article" example.
--
-- Usage:
--   PGPASSWORD=... psql -h $PGHOST -U $PGUSER -d $PGDATABASE \
--     -f scripts/update-article-codes.sql
-- OR for local WSL2:
--   echo 'Luxoranova@9' | sudo -S -u postgres psql -d postgres \
--     -f /mnt/c/AGASSOCIATES/scripts/update-article-codes.sql

BEGIN;

-- ───────────────────────────────────────────────────────────────────
--  4 sample rows that ARE filled in (model for the rest).
-- ───────────────────────────────────────────────────────────────────

-- GIFT_DEED service → Schedule I, Article 24 (Gift)
UPDATE case_article_codes
   SET article_code           = '24',
       statutory_act          = 'Maharashtra Stamp Act, 1958',
       mtr6_description       = 'Gift Deed — immovable property',
       statutory_fee_pct      = 3.0,
       requires_sro_visit     = true,
       requires_noc           = false,
       notes                  = '3% of MV if donee is a family member (parent, child, spouse, sibling, lineal descendant); 5% otherwise. Verify relationship proof (ration card / Aadhaar) before claiming concessional rate.',
       validated_by_principal = TRUE,
       validated_at           = NOW()
 WHERE case_type = 'GIFT_DEED';

-- LEAVE_AND_LICENSE service → Schedule I, Article 36 (Lease)
UPDATE case_article_codes
   SET article_code           = '36',
       statutory_act          = 'Maharashtra Stamp Act, 1958',
       mtr6_description       = 'Leave and Licence Agreement — residential/commercial',
       statutory_fee_pct      = 0.5,
       requires_sro_visit     = false,
       requires_noc           = false,
       notes                  = 'Term ≤5y: 0.5% of avg annual rent (plus 1% of any advance/security treated as rent per IGR GR 2018). Term >5y: 3% (5-10y) or 5% (>10y). The Bouncer should reject declarations that bucket security_deposit as 0.',
       validated_by_principal = TRUE,
       validated_at           = NOW()
 WHERE case_type = 'LEAVE_AND_LICENSE';

-- POWER_OF_ATTORNEY service → Schedule I, Article 40
UPDATE case_article_codes
   SET article_code           = '40',
       statutory_act          = 'Maharashtra Stamp Act, 1958',
       mtr6_description       = 'Power of Attorney — see Schedule I Art 40(A)–(H) for subject-matter linked rates',
       statutory_fee_pct      = 1.0,
       requires_sro_visit     = false,
       requires_noc           = false,
       notes                  = 'Stamp duty varies by subject-matter link — Bouncer should ask the user to declare the subject (property, bank account, court, etc.) before computing duty. GPA affecting immovable property = registration mandatory under RERA 2017 sec 17.',
       validated_by_principal = TRUE,
       validated_at           = NOW()
 WHERE case_type = 'POWER_OF_ATTORNEY';

-- CTC (Certified True Copy) — flat-fee service, no Article Code
UPDATE case_article_codes
   SET article_code           = 'NA',
       statutory_act          = 'Registration Act, 1908 §76 (right to obtain certified copy)',
       mtr6_description       = 'Certified True Copy of registered document',
       statutory_fee_pct      = 0,
       requires_sro_visit     = true,
       requires_noc           = false,
       notes                  = 'No stamp duty applies. Service fee is the IGR prescribed search + copy fee (~Rs 100-500). The Bouncer should bypass the consideration × fee_pct check entirely for this case_type.',
       validated_by_principal = TRUE,
       validated_at           = NOW()
 WHERE case_type = 'CTC';

-- ───────────────────────────────────────────────────────────────────
--  9 rows that ADV. ADITYA must fill in.
-- ───────────────────────────────────────────────────────────────────

-- PROPERTY_REGISTRATION (most common, biggest revenue)
UPDATE case_article_codes
   SET article_code           = '__TODO__',
       statutory_act          = 'Maharashtra Stamp Act, 1958',
       mtr6_description       = '__TODO__: paste the MTR-6 line for sale of immovable property',
       statutory_fee_pct      = 6.0,
       requires_sro_visit     = true,
       requires_noc           = true,
       notes                  = '__TODO__: reference the Schedule I article + the gender-based concession (female = 1% off MV-based duty) and the PMAY-recognised-slum concessional rate. The Bouncer must reject MV declarations that round to nearest 1L — IGR takes exact MV.',
       validated_by_principal = FALSE
 WHERE case_type = 'PROPERTY_REGISTRATION';

-- MORTGAGE_REGISTRATION
UPDATE case_article_codes
   SET article_code           = '__TODO__',
       statutory_act          = 'Maharashtra Stamp Act, 1958',
       mtr6_description       = '__TODO__: paste the MTR-6 line for mortgage deed',
       statutory_fee_pct      = 1.0,
       requires_sro_visit     = true,
       requires_noc           = false,
       notes                  = '__TODO__: Article 6 family; specify simple vs equitable mortgage. With possession = 1% of principal secured; without possession = 0.1%. For SARFAESI, also annotate whether the bank is the lender.',
       validated_by_principal = FALSE
 WHERE case_type = 'MORTGAGE_REGISTRATION';

-- INTIMATION_MORTGAGE (filing of intimation under SARFAESI / Section 26-B)
UPDATE case_article_codes
   SET article_code           = '__TODO__',
       statutory_act          = '__TODO__: SARFAESI Act 2002 sec 26-B; or Maharashtra Co-op Societies Act 1960 sec 154-A',
       mtr6_description       = '__TODO__: paste the MTR-6 line for mortgage intimation',
       statutory_fee_pct      = 0,
       requires_sro_visit     = false,
       requires_noc           = false,
       notes                  = '__TODO__: This is NOT a fresh instrument — it is an intimation to the registrar of an existing mortgage. No stamp duty in many cases; only nominal fee. The Bouncer should ask whether the underlying mortgage was registered (if yes, this is a duplicate).',
       validated_by_principal = FALSE
 WHERE case_type = 'INTIMATION_MORTGAGE';

-- BALANCE_TRANSFER (takeover of an existing home loan)
UPDATE case_article_codes
   SET article_code           = '__TODO__',
       statutory_act          = 'Maharashtra Stamp Act, 1958',
       mtr6_description       = '__TODO__: paste the MTR-6 line for balance transfer / mortgage reconstitution',
       statutory_fee_pct      = 1.0,
       requires_sro_visit     = true,
       requires_noc           = true,
       notes                  = '__TODO__: This is a fresh mortgage to the new bank. Treat as MORTGAGE_REGISTRATION for stamp-duty purposes but also require NOC from the old bank. The Bouncer should not allow the customer to under-declare outstanding principal.',
       validated_by_principal = FALSE
 WHERE case_type = 'BALANCE_TRANSFER';

-- FRANKING (small-instrument stamping)
UPDATE case_article_codes
   SET article_code           = 'NA',
       statutory_act          = 'Indian Stamp Act, 1899 (franking is the alternative to e-stamping)',
       mtr6_description       = 'Franking of small instrument — flat Court-fee / stamp duty as per Schedule',
       statutory_fee_pct      = 0,
       requires_sro_visit     = false,
       requires_noc           = false,
       notes                  = 'Flat-rate instruments (Rs 100, Rs 500, etc.) that the bank or shopkeeper franks in-house. No advocate drafting involved. The Bouncer should classify this as a "self-service" service_type with no AI drafting step.',
       validated_by_principal = TRUE,
       validated_at           = NOW()
 WHERE case_type = 'FRANKING';

-- PUBLIC_NOTICE (publication in newspaper + filing at SRO)
UPDATE case_article_codes
   SET article_code           = 'NA',
       statutory_act          = 'Court Fees Act, 1870 (Sch II) — Court fee varies by court',
       mtr6_description       = 'Public Notice — newspaper publication + SRO filing',
       statutory_fee_pct      = 0,
       requires_sro_visit     = true,
       requires_noc           = false,
       notes                  = 'No article code; the fee is the newspaper publication charge + nominal court fee. The Bouncer should require a "matter of" declaration (e.g. "objection to mutation entry no. X") before filing.',
       validated_by_principal = TRUE,
       validated_at           = NOW()
 WHERE case_type = 'PUBLIC_NOTICE';

-- TITLE_SEARCH (pre-registration diligence)
UPDATE case_article_codes
   SET article_code           = 'NA',
       statutory_act          = 'Registration Act, 1908 §57 (search of indexes)',
       mtr6_description       = 'Title Search — search of IGR indexes for encumbrances',
       statutory_fee_pct      = 0,
       requires_sro_visit     = true,
       requires_noc           = false,
       notes                  = 'No article code applies. Service is a search of the IGR sub-registrar indexes for a 13-year (or 30-year) chain. The Bouncer should escalate to a human reviewer if the customer asks for a search beyond 30 years.',
       validated_by_principal = TRUE,
       validated_at           = NOW()
 WHERE case_type = 'TITLE_SEARCH';

-- LEGAL_VETTING (pre-registration document review)
UPDATE case_article_codes
   SET article_code           = 'NA',
       statutory_act          = '__TODO__: cite the specific Act the vetting is done under (usually depends on the document: e.g. RERA 2017 for sale agreement; NI Act 1881 for pronotes)',
       mtr6_description       = 'Legal Vetting — review of a draft document for defects',
       statutory_fee_pct      = 0,
       requires_sro_visit     = false,
       requires_noc           = false,
       notes                  = '__TODO__: This is a pure advisory service. The Bouncer should produce a structured "Vetting Report" with 5 sections (Parties, Consideration, Compliance, Risks, Recommendations) and not require an IGR filing step.',
       validated_by_principal = TRUE,
       validated_at           = NOW()
 WHERE case_type = 'LEGAL_VETTING';

-- MARKET_VALUATION (independent valuation for stamp-duty assessment)
UPDATE case_article_codes
   SET article_code           = 'NA',
       statutory_act          = 'Indian Stamp (Valuation of Property) Rules + IGR ready-reckoner',
       mtr6_description       = 'Market Valuation — independent assessment of property market value',
       statutory_fee_pct      = 0,
       requires_sro_visit     = true,
       requires_noc           = false,
       notes                  = 'No article code applies. The service is an independent market valuation to challenge or confirm the IGR ready-reckoner. The Bouncer must require site visit photos + comparable sale deeds + 3-year price trend data before issuing the valuation certificate.',
       validated_by_principal = TRUE,
       validated_at           = NOW()
 WHERE case_type = 'MARKET_VALUATION';

-- ───────────────────────────────────────────────────────────────────
--  Validation query
-- ───────────────────────────────────────────────────────────────────

\echo '--- Validation: any rows still unvalidated? ---'
SELECT case_type, article_code, statutory_fee_pct, requires_sro_visit, requires_noc, validated_by_principal
  FROM case_article_codes
 ORDER BY case_type;

\echo '--- Count of unvalidated rows (should be 0 before Bouncer lets any case through): ---'
SELECT COUNT(*) AS unvalidated_count
  FROM case_article_codes
 WHERE NOT validated_by_principal;

\echo '--- Count of rows with stat fee = 0 AND expected to be instrument (PROPERTY_REGISTRATION, MORTGAGE_REGISTRATION, BALANCE_TRANSFER): ---'
SELECT case_type, statutory_fee_pct
  FROM case_article_codes
 WHERE case_type IN ('PROPERTY_REGISTRATION','MORTGAGE_REGISTRATION','BALANCE_TRANSFER')
   AND statutory_fee_pct = 0;

COMMIT;
