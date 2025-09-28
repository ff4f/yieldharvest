GOAL: Demo-proof stability.

TASKS:
1) Unit Tests (Jest): HFS, HTS, HCS services; Mirror parsers.
2) API Tests (Supertest): POST /invoices, GET /invoices, PATCH status.
3) E2E (Playwright/Cypress):
   - Flow: connect wallet → upload & mint → investor fund → release/paid.
4) Seeder:
   - Script seeding 3–5 sample invoices (1 funded ready to release).
5) Demo Runbook (README section):
   - Pre-req: testnet account, wallet, seed.
   - Step-by-step clicks with callouts.
   - A curated list of proof links (HashScan/HFS/HCS) per step.

ACCEPTANCE:
- Adequate coverage, all tests pass; seeder creates deterministic demo data.
- Runbook can be followed by anyone.
