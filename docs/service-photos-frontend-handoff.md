# TASK-048 frontend service pictures

## Authority and scope

8 November 2026: `/root` assigned `/root/service_photos_frontend` as Front End
Developer for the user's requested Pro service pictures and left/right viewing.
Owner accepted local frontend implementation, translations and isolated mocked
checks under AGENTS.md standing cooperation. The frontend practices skill and
its development/security, localization, devices/accessibility and testing
references were applied. On resume, owner specifically delegated root local
review/fixes within these TASK-048 frontend files and tests, retaining owner
review. No connected database/service, credentials, deployment or spending.

## Implemented and reviewed

- Service drafts send ordered `imageUrls` and synchronized cover `imageUrl`.
  Legacy records with absent/empty `imageUrls` fall back to their cover; new clears
  empty both fields. This matches DB old-application compatibility.
- Editor shows previews, selected cover, make-cover and removal controls, count
  and existing 10 MiB per-picture guidance. Pro permits ten pictures; Free one.
  Existing galleries survive expiry, with removal/cover changes available and
  no additions while over the applicable limit. The scoped notification
  capabilities query supplies UI entitlement; server independently authorizes it.
- Both search and standard service details use the same gallery. It supports
  touch swipes, 44px previous/next controls, left/right keys, an announced position,
  accessible image text, bounded edges, and single-picture legacy display.
  Reopening details resets to the cover. Failed images show a fallback and
  navigation remains available. Vertical pan/pinch gestures are preserved.
- Uploads retain existing type/size checks and cookie-free signed PUT behavior.
  Duplicate starts are locked; save actions wait for pending uploads. A component
  unmount prevents late completion from attaching to another editor/workspace.
- New `servicePictures` messages are maintained in all eleven supported resources.
  Verification covers only en/lv/ru. Other locales were updated without claiming
  native-language review or fresh coverage.

Frontend files: `client/src/lib/service-images.ts`,
`client/src/components/service-image-gallery.tsx`, `ImageUploader.tsx`, provider
`service-draft.ts`, `service-media-fields.tsx`, `service-editor.tsx`, the two
details layouts, and the new locale blocks. Unrelated dirty work is preserved.

## Verification

Passed:

- `node --import tsx scripts/test-service-pictures-frontend.mjs`: legacy/empty-list
  compatibility, clear, deduplication/bounds, draft cover sync and en/lv/ru messages.
- `node --import tsx scripts/test-service-pictures-browser.mjs`: Chrome en/lv/ru at
  390px and 1280px. Both details layouts/reopen reset, buttons/keyboard, actual CDP
  touch swipe both directions, no-wrap edges and touch cancellation, failed-image
  recovery, no horizontal overflow, editor cover/removal, pending/failed uploads,
  no credential leakage to signed upload, zero/oversize rejection, exact 10 MiB
  acceptance, Pro ten/Free one, retained downgrade, pending-save lock and ignored
  late workspace completion. Mocked PATCH assertions verify ordered gallery and
  selected cover; rejected saves retain the entire draft. Exit 0; no unexpected
  requests, uncaught exceptions, connected writes or external network.
- `node output/build-service-pictures.mjs`: isolated frontend Vite build, no env
  loading. Existing Browserslist age and bundle-size warnings remain.
- Root's `tsc --project output/service-photos-typecheck.json` includes the changed
  application/gallery and passed, excluding unrelated concurrent native proof
  directories. Full-project type-check state belongs to the integration handoff.

Default-sandbox Chrome startup failed in Crashpad before tests; the same isolated
suite then passed outside the sandbox through approved execution. Test fixture
APIs/uploads/saves are intercepted in memory, with external requests blocked.
No live application server, storage object or database session was used.

Screenshots, also visually reviewed by root:

- `output/service-pictures-check/search-mobile.png`
- `output/service-pictures-check/editor-pro-mobile.png`

The search gallery and editor fit the 390px viewport with visible controls and
count/help text. Physical devices, screen readers, virtual keyboards and native
language quality were not verified. Firefox/WebKit tooling was unavailable:
`FORMS_PLAYWRIGHT_MODULE` is unset and the historical `fits-task022-tools`
Playwright module/browser paths no longer exist. No downloads were attempted.
ar (including RTL), zh, fr, de, hi, ja, pt and es verification remains deferred.

## Recovery and next action

Owner final review found no unresolved frontend security issue introduced within
this scope. Revert only the listed TASK-048 changes/new files and the
`servicePictures` locale blocks; preserve unrelated edits. Generated fixtures,
screenshots and isolated build outputs can be removed by their attributable paths.
Root integrates backend/DB evidence. Gallery persistence requires the prepared DB
migration to be applied under separately authorized exact-target execution; this
frontend task did not apply it or deploy the feature.
