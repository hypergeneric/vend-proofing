# Vend agent guidance

Read [docs/README.md](docs/README.md) for the documentation map, [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the runtime and engineering rules, and [docs/VEND-MODERNIZATION.md](docs/VEND-MODERNIZATION.md) for the active phase. Read [the storage strategy](docs/VEND-STORAGE-STRATEGY.md) before changing persistence. The [audit](docs/VEND-PRODUCT-DISCOVERY-AND-TECHNICAL-AUDIT.md) is background evidence, not a mandate to rewrite the application.

This is a greenfield application with no deployed users or legacy data to migrate. Build the current behavior directly; do not add compatibility endpoints, URL aliases, or upgrade migrations for superseded development implementations.

Work one bounded phase at a time. Preserve existing user interactions, JavaScript architecture, SUIDs, URLs, and meaningful storage contracts. Protect unrelated working-tree changes. Use synthetic or sanitized fixtures; do not run integration side effects against live data. Record what was changed, tested, and left open in the modernization log.

Keep agent procedure here, developer instructions in `docs/DEVELOPMENT.md`, and photographer/customer guidance in `docs/MANUAL.md`. Link across documents instead of duplicating detailed rules. Add a skill under `.agents/` only when a repeated task has a stable, tested workflow; keep its instructions aligned with these documents.

For script/style tasks, start with [Front-end asset build](docs/DEVELOPMENT.md#front-end-asset-build) and the newest asset checkpoint in the modernization log. Older PHP assembly instructions in historical records are superseded; honor the documented pause boundary before continuing vendor cleanup.

Current state: PHP 8.4, unified SQLite persistence, and static CSS/JavaScript builds are implemented; consult the modernization log for qualification still open. Dashboard Users supports multiple accounts and stores admin/manager types with identical access for now; permission differences are deferred. Only the signed-in user can edit their username/email/password. Media and disposable derivatives stay as files. Match the existing tab-indented code style in touched PHP and JavaScript; save broad reformatting for a separate pass.
