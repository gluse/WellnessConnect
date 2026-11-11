# TASK-064 local Storage copy — 9 November 2026

Status: **local Storage copy and verification completed**. Executor `/root/local_copy_storage`, delegated
CI/CD scope from Root after the user selected an independent Docker copy.
DB owner explicitly delegated local bucket creation, upload metadata writes and
verification on `http://127.0.0.1:54321`; hosted Storage remains read-only.

The new `scripts/local-supabase-storage-copy.mjs` imports no application startup
or dotenv configuration. `--self-test` is offline; `--inventory` reads bounded
hosted bucket/object listings without downloading contents; `--apply` uses the existing
protected source `.env` URL/secret only and protected local status credentials.
It pins source `hbkooiknruimukkhshrk` and exact loopback destination; guarded
requests reject source mutations and redirects. Listing POSTs are read-only.
Bucket and recursive object pagination are bounded. It refuses a populated
target, creates matching buckets, uploads without overwrite, downloads local
bytes again and compares SHA256/size/content type. Final source and target
manifests must match the initial source listing.

`node scripts/local-supabase-storage-copy.mjs --self-test` passed18 offline
checks covering source mutation/foreign-target rejection, private bucket options,
nested directory traversal, >100-object pagination and redirect/timeout controls.
`git diff --check` passed for the owned files. The first connected read-only
inventory ran with network sandbox escalation and passed: **1 bucket,32 objects,
13,145,565 bytes**. These counts describe Storage at inspection, not a completed
copy by itself.

The authorized `--apply` command completed once from11:45:57.286Z to11:46:11.532Z
on9November2026 (13:45–13:46 Europe/Riga). All **32 objects /13,145,565bytes**
were copied into the matching private local bucket and re-downloaded locally.
All32 SHA256 digests, byte lengths and content types matched. Matching final
source/target manifests and source bucket settings passed; no hosted writes.
The attempt receipt remains consumed and must not be rerun against this target.

Aggregate receipt: `output/supabase-local-copy-2026-11-09/storage-result.json`.
Content-manifest digest:
`1e25f52860273c6f9627866584146f756e8320c6bc8e6ef4b3c735d9c7399c24`.
Private per-object manifests/hashes/receipt remain under the protected directory.

Separate local-only read verification confirmed **two anonymous-access denials**:
authenticated download with the anonymous key and the public-object URL both
deny access to a representative object in the private bucket. No source API
access or writes occur in this check. The repeatable command is
`node scripts/local-supabase-storage-copy.mjs --verify-privacy`.

Root requested a post-restart persistence check. Prepared local-only command:
`node scripts/local-supabase-storage-copy.mjs --verify-persistence`.
It reads only protected local status and original private copy manifests/hash
receipt; it does not read hosted `.env` or create a hosted client. Its separate
`local-read` transport rejects hosted targets and all writes while permitting
read-only listing POSTs. It re-downloads every local object, compares SHA256,
size/content type, checks exact bucket/object lists and settings, then repeats
anonymous privacy denials. Success saves aggregate
`output/supabase-local-copy-2026-11-09/storage-persistence-result.json` without
overwriting prior evidence.

## Post-restart persistence acceptance — 10 November 2026

Root released the command after its managed Docker stop/start completed
successfully, all eight local services were healthy, and the DB owner confirmed
matching original database fingerprints,38 readiness gates,five restricted roles
and unchanged32-object Storage metadata. Root and DB evidence are recorded in
the [integrated copy handoff](supabase-local-copy-2026-11-09.md).

The local-only `--verify-persistence` command ran once from
10:59:27.788Z to10:59:28.478Z on10November (12:59 Europe/Riga), exit0. It verified
**32/32 image byte hashes,13,145,565bytes**, matching sizes/content types, exact
bucket/object lists and private bucket settings against the original protected
copy manifests. The content-manifest digest still matches the original receipt:
`1e25f52860273c6f9627866584146f756e8320c6bc8e6ef4b3c735d9c7399c24`.
Both anonymous download paths were denied with recognized access-denial status
codes. **No hosted configuration/source API access and no writes** occurred.

Public aggregate acceptance receipt:
`output/supabase-local-copy-2026-11-09/storage-persistence-result.json`.
Original copy manifests/receipts remain unchanged.28 offline checks previously
passed for the final verifier, including local-only mutation/host rejection and
changed bytes/content type/evidence rejection. No implementation changes or
broad test reruns were needed for this acceptance. Storage copy and persistence
scope is complete; no remaining Storage dependency or check is held.

## Local host-port repair — 10 November 2026

Root delegated the minimal Storage verification compatibility change after the
user's local startup failed: Root found Windows reserved host ports54310–54409
and moved the existing local containers/volumes to API
**`http://127.0.0.1:15421`**, preserving credentials. This follow-up changes only
the local read verifier and its receipt path; hosted configuration, original copy
execution and historical receipts remain unchanged. No image copy/reset/delete
or source operation is part of the repair.

The original receipt's destination54321 remains explicitly pinned as historical
copy evidence. A separate `LOCAL_RUNTIME` origin pins local-only verification to
15421. Its `local-read` transport rejects the retired54321 origin, hostname
aliases, hosted URLs and mutations; guarded listing POSTs remain read-only.
`node scripts/local-supabase-storage-copy.mjs --self-test` passed30 focused
Storage checks, including the repaired-origin guards. Syntax and scoped diff
checks passed. No application/browser/language matrix was rerun by this owner.

Root confirmed the repaired local API healthy and released:
`node scripts/local-supabase-storage-copy.mjs --verify-port-repair`.
It ran once from14:19:18.339Z to14:19:18.947Z on10November2026
(16:19 Europe/Riga), exit0. **32/32 images /13,145,565bytes** matched the original
SHA256 hashes, byte sizes and content types through15421. Exact bucket/object
lists, private bucket settings and both anonymous-access denials also passed.
Manifest digest remains
`1e25f52860273c6f9627866584146f756e8320c6bc8e6ef4b3c735d9c7399c24`.
The verifier read only protected local status and original manifests/hash
receipt: **sourceAccess=false,writes=false**.

New distinct aggregate receipt:
`output/supabase-local-copy-2026-11-09/storage-port-repair-result.json`.
The original `storage-result.json`, `storage-persistence-result.json` and private
copy evidence were preserved. This owner's port-repair acceptance is complete;
Root/Backend/DB own the remaining integrated local-start acceptance.

Application image references use `/objects/<owner>/<uuid>.<type>` rather than
hosted Storage URLs; preserving keys lets the local app resolve copied objects
through its own configured local Storage service. External social-provider
avatar URLs are separate and are not rewritten by this Storage copy.

Private paths, object keys, metadata and hashes stay in the verified owner-only
`outputs/supabase-local-private/` directory. Public evidence contains aggregate
counts/bytes/hash only. No source writes, deletes, source bucket configuration,
Auth calls or AWS operations occur. No SQL Storage metadata restore is needed;
the local API generates its own object metadata for the copied bytes.

Recovery: preserve partial local target and receipt on failure; do not rerun or
overwrite populated target. Hosted data is untouched. Stop local containers to
retain volumes. Cleanup requires an explicit scoped choice. Copied local files
are independent and never synchronize back automatically.

Language matrix is inapplicable to byte-copy checks; application checks cover
en/lv/ru only. ar/RTL,zh,fr,de,hi,ja,pt,es remain deferred.

References used: [Storage file listing](https://supabase.com/docs/reference/javascript/file-buckets-list),
[bucket listing](https://supabase.com/docs/reference/javascript/file-buckets-listbuckets),
and installed `@supabase/storage-js`2.117.3 implementation.
