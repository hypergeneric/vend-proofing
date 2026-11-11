# Vend agent guidance

Read [docs/README.md](docs/README.md) for the documentation map, [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the runtime and engineering rules, and [docs/VEND-MODERNIZATION.md](docs/VEND-MODERNIZATION.md) for the active phase. Read [the storage strategy](docs/VEND-STORAGE-STRATEGY.md) before changing persistence. The [audit](docs/VEND-PRODUCT-DISCOVERY-AND-TECHNICAL-AUDIT.md) is background evidence, not a mandate to rewrite the application.

Work one bounded phase at a time. Preserve existing user interactions, JavaScript architecture, SUIDs, URLs, and meaningful storage contracts. Protect unrelated working-tree changes. Use synthetic or sanitized fixtures; do not run integration side effects against live data. Record what was changed, tested, and left open in the modernization log.

Keep agent procedure here, developer instructions in `docs/DEVELOPMENT.md`, and photographer/customer guidance in `docs/MANUAL.md`. Link across documents instead of duplicating detailed rules. Add a skill under `.agents/` only when a repeated task has a stable, tested workflow; keep its instructions aligned with these documents.

Current sequence: the Phase 2A representative PHP 8.4 baseline is complete. Phase 2B has a working single-admin login and still needs Gateway/file-access review. The old hub/membership authentication path is retired. The next persistence phase will consolidate administrator accounts, administrator sessions, customer proofing records, and other mutable application records into one SQLite database. Media and disposable derivatives stay as files. Multiple administrators are a later extension. Match the existing tab-indented code style in touched PHP and JavaScript; save broad reformatting for a separate pass.
