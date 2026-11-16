# Dropbox and digital delivery assessment

Source review: 2026-11-15. The historical findings below describe the pre-restoration code. Authorization and manual gallery sync have since been implemented; see the latest [modernization checkpoint](VEND-MODERNIZATION.md) and [connection steps](MANUAL.md#dropbox-connection-and-gallery-sync). Invoice delivery is now implemented behind `Downloads` and `DropboxDelivery`; real-account acceptance remains open. Runtime guidance remains in [DEVELOPMENT.md](DEVELOPMENT.md); phase status and validation are in the [modernization log](VEND-MODERNIZATION.md).

## Recommendation

Preserve the Dropbox photographer workflow: put originals into a gallery folder, sync affordable previews into Vend, sell originals or web-size downloads, and prepare delivery from the invoice. Separate the source of images from order fulfillment. Dropbox remains valuable for its desktop folder workflow and provider-generated previews even when local storage is affordable.

Keep the first restoration to originals and web-size delivery. The developer clarified that crop/color processing is optional future work. Large original images should not need decoding to deliver them unchanged. Do not add transformation infrastructure just to restore downloads.

## What the source actually does

| Concern | Evidence and behavior |
|---|---|
| Gallery import | [Dropboxer.php](../dist/vend-proofing-core/php/classes/simpleadmin/Dropboxer.php), `syncFolder()` and `parseFolderMeta()`, recursively list `/<gallery SUID>`, accepting JPEG/PNG. It accepts either root images or categories, rejecting a mixture. Categories use the immediate parent folder name, so separate nested folders with identical names collide. |
| Previews | `processNextChunk()` requests `getThumbnail(path, "huge", "jpeg")`. The bundled SDK maps `huge` to `w1024h768`. Vend caches the preview and builds gallery derivatives from it; it does not download the full original for gallery rendering. |
| Digital products | [downloads.json](../dist/vend-proofing-core/defaults/downloads.json) supports original/web versions, individual/all-image purchases, and flat/per-image bulk pricing. The storefront assigns download profiles only to Dropbox sets. [CheckoutQuote.php](../dist/vend-proofing-core/php/classes/simpleadmin/CheckoutQuote.php) explicitly rejects downloads for other gallery types. |
| Invoice preparation | `getImageData()` selects purchased `-d` rows. High quality uses Dropbox copy references; low quality uploads the cached local preview. Output goes into `/orders/<order>/files[/quality/...]`, with numbered folders for larger purchases. |
| Archive delivery | `getShareLinks()` makes public folder links with `dl=1`; Dropbox handles folder download packaging. Vend does not build a ZIP here. The code's 1 GB split threshold is a historical assumption, not a verified current provider limit. |
| Crop/color | This delivery path never invokes `Graphic` crop/resample or color processing. `Graphic` does contain rendering transforms, but those are not a purchased-original processing pipeline. The 2018 baseline `e5e12a63` has the same original-copy/preview-upload behavior. |
| Basic/upload sets | The 2018 storefront already labels download configuration “dropbox only”; other types use disabled defaults. No local paid-download fulfillment path was found. Current upload/category sets therefore need explicit support to offer downloads. |
| Payment boundary | [Payments.php](../dist/vend-proofing-core/php/classes/simpleadmin/Payments.php) records digital entitlement in SQLite; process/download calls require paid entitlement plus the matching authorized order session. Preserve this boundary and existing invoice URLs. |
| Progress and cleanup | Progress, link issuance count, and part count live in remote `info.txt`; a local text file lists pending copies. The invoice calls Dropbox while rendering. Cron purges remote order folders using `info.txt` modification time. |

The screenshot's `Apps/vend files`, `8602`, and `orders` are consistent with the historical layout. Only the screenshot was inspected; neither account contents nor application registration/credentials were verified. Root `info.txt` contents are unknown. Browser login alone does not establish that Vend has API authorization.

## Problems to resolve before restoring delivery

- Sync allocates fresh image keys and [Records::replaceDropboxImages()](../dist/vend-proofing-core/php/classes/simpleadmin/Records.php) deletes proofing sessions, gallery images, and categories. Repeat sync must instead retain identity and selections for unchanged or renamed files. Source deletion needs an unavailable state for purchased images, not loss of the order's source reference.
- Listing errors can become partial or empty results. Missing purchased originals are silently skipped. Neither condition can become a successful complete package.
- Order preparation consults the current gallery index and current remote paths. Snapshot provider connection, file identity, revision, selected rendition, and output name with the purchase; never silently substitute a different revision. Provider revision retention is finite: unavailable purchased content needs a visible fulfillment error or a retained copy.
- Remote text flags and scratch manifests are unsuitable authoritative job records. Concurrent starts, abandoned browser tabs, retries, and crashes need durable SQLite state and exclusive job claims.
- The three-download restriction is primarily invoice UI logic and counts link issuance, not completed transfers. A public shared link can be reused outside Vend. Define issuance/expiry policy explicitly; do not promise exact completed-download counts or recall of files already delivered.
- Current authentication exchanges a pasted code and stores one access token, with no refresh lifecycle. The inherited SDK is constrained to `^0.4.1`; qualify or replace this dependency within the integration phase.
- `getOrderFlags()` writes defaults on any read error, and invoice rendering can trigger that write. Read-only invoice status must not create remote delivery state. Cleanup must use tracked artifact ownership/expiry, not enumerate old account folders and infer ownership.

## Small boundaries, with provider capabilities

These are proposed responsibilities, not a broad filesystem framework:

| Component | Contract |
|---|---|
| Image source | Resolve metadata and fetch an exact original version into a stream/private file. References include connection, provider identity, revision and display path. Implement local files and Dropbox as the first real cases. |
| Optional source capabilities | Provider-generated previews, incremental listing and server-side copying. Dropbox can use these without requiring local files or a future object store to emulate them. |
| Gallery sync | Turn source listings into stable gallery records and local previews. Own category mapping, changes and missing-source handling. Keep this out of invoice code. |
| Download service | `prepare(orderId)`, `status(orderId)`, `delivery(orderId, partId)` and controlled retry. Enforce entitlement and authorized access, build the purchased manifest, and report progress/parts/errors independently of the source provider. |
| Package builder/delivery backend | Build or arrange the manifest's exact files, publish completed artifacts, issue delivery access, and expire only owned output. A local ZIP implementation and a Dropbox copy/folder implementation can share the service contract while using different mechanisms. |

Invoices should call the download service, not each storage provider's create/extract methods. Extraction is not required for the existing workflow. Source and destination may eventually differ, but begin with local → local and Dropbox → Dropbox rather than implementing every combination.

SQLite should own order preparation progress, errors, artifact references and expiry. Start with the existing browser-driven chunks and a small per-order progress record; introduce job claims or workers only for a demonstrated need. Actual originals, previews, scratch files and packages remain files. Keep entitlement separate from build state: current `Payments::canDownload()` expects fulfillment `ready`; changing it to `building` would accidentally revoke access. Extend the fresh-install schema directly as needed, with no legacy migration/import layer.

Use short claim/commit transactions around bounded work, never a database write lock over a network request. A CLI/cron runner is an optional later addition if preparation must continue after the invoice tab closes. Stage output privately, validate all manifest entries, then publish; failed or incomplete work stays unavailable. Retry identity should include the immutable order manifest and output policy. Validate filenames, contain filesystem paths, and resolve files from server-owned records.

For web-size delivery, keep using provider previews where they meet the product's defined quality. Record actual dimensions and format; today's cached JPEG can retain a source `.png` filename, which should not become a misleading delivered extension. Other providers can use a local derivative pipeline when needed. Preserve the distinction between a gallery preview and a promised purchased rendition.

## Current provider evidence

Dropbox supports scoped OAuth, app-folder/full-account access, short-lived access tokens and offline refresh tokens. Use an administrator-bound authorization flow with validated state and protected server-side credentials. App-folder access fits the old layout, but a newly registered app must not be assumed to access the previous app's folder. The distribution model and ownership of the Dropbox app registration still need a decision before shipping. [OAuth guide](https://docs.dropboxapi.com/dropbox-api/docs/oauth).

Dropbox file IDs survive moves/renames; revisions identify content versions. The API supports thumbnail generation, so retaining originals remotely while caching small previews is still viable. The current API specification documents a 20 MB source limit for thumbnail generation; the implementation reports that limit. Real-file qualification is still required, especially before promising larger-original support. [File access guide](https://docs.dropboxapi.com/dropbox-api/docs/file-access).

Saved listing cursors support incremental sync, including deletion records; expired cursors require rebuilding the listing. Start with an explicit Sync action, add scheduled polling if needed, and defer webhooks until there is a reason for automatic updates. [Change detection guide](https://developers.dropbox.com/detecting-changes-guide).

Shared-link delivery is subject to account bandwidth limits and can be suspended. Cheap storage does not alone settle delivery cost, bandwidth, processing, or reliability. Benchmark representative gallery sizes before choosing a default delivery backend. [Dropbox sharing limits](https://help.dropbox.com/share/banned-links).

If full-resolution crops/color variants are introduced later, measure decoded pixel memory and working buffers rather than compressed JPEG size. Run transforms outside interactive PHP requests with explicit resource limits. ImageMagick supports memory, disk, dimension and execution-time policies; using Imagick alone does not remove resource pressure. [ImageMagick resources](https://imagemagick.org/resources/).

## Bounded implementation sequence

1. **Dropbox connection and safe sync.** Replace token handling; implement a small client with mocked transport. Preserve image keys using provider IDs/revisions and stage complete listings before applying changes. Test pagination, rename, deletion, duplicate folder names, partial failures, token refresh and preview errors. Qualify a disposable synthetic Dropbox gallery separately; never run the old verifier/purger against the surviving archive.
2. **Restore invoice delivery behind the service.** Preserve original/web products and invoice interactions. Replace remote flags with durable jobs, use exact purchased references, and retain Dropbox server-side copy/preview reuse. Test interrupted work, simultaneous requests, missing originals, byte-identical original delivery, package completeness, denied/refunded access and expiry. Verify actual Dropbox folder-download behavior and limits before retaining its split policy.
3. **Add local upload/category downloads.** Use the same invoice service with local originals and ZIP output. Expose download settings and update trusted quoting deliberately. Test retained original bytes, web-rendition policy, large packages and access isolation. This provides a second implementation that tests whether the abstraction is useful.

Full-resolution transformations, another cloud provider, automatic webhooks, generalized storage management and pricing/payment cleanup remain separate phases. Connection plus non-destructive sync is now implemented. The developer reinforced simplicity and no compatibility/migration work; prefer the existing browser-driven chunks over the more general job machinery originally considered here.

## Validation

Reviewed current source and the named 2018 baseline, plus current primary provider documentation. Ran `bash scripts/basic-set-smoke.sh`: passed, including relational Dropbox metadata/category rollback, cached-image rendering/resizing, upload sets, proofing, configured quotes and offline invoice behavior. This fixture has no provider access and does not establish that OAuth, remote sync, copy, sharing or cleanup works. No account files, application settings, credentials or runtime code were changed.

## Invoice implementation checkpoint (2026-11-16)

The service/adapter phase is implemented. See the [development contract](DEVELOPMENT.md#invoice-download-development) and [operator workflow](MANUAL.md#dropbox-invoice-downloads). Historical source findings above describe the removed `Dropboxer`, not the current implementation. There is no legacy text-flag import or old-order compatibility path.

Current provider qualification: the [official API specification](https://github.com/dropbox/dropbox-api-spec/blob/main/files.stone) defines `GetCopyReferenceArg.path` as `ReadPath`, permitting a revision reference, and `copy_reference/save` writes the referenced content to the destination. The adapter checks returned identity/revision and uses content hashes to recognize an interrupted successful copy. Web-size delivery requests the saved revision's thumbnail and uploads a JPEG. No original bytes pass through PHP. The [Dropbox folder-download guidance](https://help.dropbox.com/sync/download-entire-folders) specifies folders below 250 GB and fewer than 10,000 files. Vend's roughly 1 GB/1,000-file parts are a conservative usability policy, not that provider limit; a single larger original can occupy its own part below the provider ceiling. Real shared-link download behavior, account bandwidth and revision availability remain to be exercised on the connected account.
