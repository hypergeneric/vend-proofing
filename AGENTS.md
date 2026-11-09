# Vend agent guidance

Read [docs/README.md](docs/README.md) for the documentation map, [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the runtime and engineering rules, and [docs/VEND-MODERNIZATION.md](docs/VEND-MODERNIZATION.md) for the active phase. The [audit](docs/VEND-PRODUCT-DISCOVERY-AND-TECHNICAL-AUDIT.md) is background evidence, not a mandate to rewrite the application.

Work one bounded phase at a time. Preserve existing user interactions, JavaScript architecture, SUIDs, URLs, and meaningful storage contracts. Protect unrelated working-tree changes. Use synthetic or sanitized fixtures; do not run integration side effects against live data. Record what was changed, tested, and left open in the modernization log.

Keep agent procedure here, developer instructions in `docs/DEVELOPMENT.md`, and photographer/customer guidance in `docs/MANUAL.md`. Link across documents instead of duplicating detailed rules. Add a skill under `.agents/` only when a repeated task has a stable, tested workflow; keep its instructions aligned with these documents.

Current sequence: the Phase 2A representative PHP 8.4 baseline is complete; Phase 2B authentication and access is next, followed by Phase 3 SQLite assessment/implementation. Do not mix later-phase implementation into the active phase.
