# Developing Vend

Vend is a PHP application with a customer storefront and a separate JavaScript administration interface. Preserve its established UI and behavior while modernizing the runtime and security boundaries. The [audit](VEND-PRODUCT-DISCOVERY-AND-TECHNICAL-AUDIT.md) maps the architecture; the [modernization log](VEND-MODERNIZATION.md) records current phase decisions and results.

## Local runtime

The main Lando app is configured in `.lando.yml`. Run `lando start`, then use the HTTPS URLs reported by `lando info`. Application data lives under `vend-proofing-data/`; keep existing data and credentials out of commits. The Lando `lamp` recipe includes a database service, but Vend's current application records remain flat files.

For an isolated PHP 8.4 smoke check, run `bash scripts/phase1-smoke.sh`. It creates synthetic records under `/tmp`, runs the cached PHP 8.4 container without network access, and removes the fixture afterward. For a disposable interactive site, run `bash scripts/phase1-dev.sh` and open `http://127.0.0.1:8048/`; it disables PHP mail and network client functions. Neither script uses the live data directory.

## Development rules

- Keep changes small and test the contract of the affected subsystem.
- Preserve gallery SUIDs, public URL structure, row formats, visual design, and low-friction email proofing unless a specific defect requires change.
- Do not treat order totals, payment status, or delivery eligibility supplied by a browser as authoritative.
- Do not run mail, payment, Dropbox, or destructive migration operations against live data during tests.
- Update [VEND-MODERNIZATION.md](VEND-MODERNIZATION.md) with decisions, tests, limitations, and the next step when a phase changes.
- Keep user-facing instructions in the [manual](MANUAL.md); agent workflow belongs in [AGENTS.md](../AGENTS.md).

## Current sequence

Phase 1 established a PHP 8.4 smoke runtime and focused first-party fixes. Phase 2A is real-world compatibility using sanitized copies of representative data. Phase 2B is administrative authentication and access control. SQLite migration is reserved for Phase 3 after a tested persistence call graph and behavioral baseline exist. The modernization log is the source of truth for progress within each phase.
