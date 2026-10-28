// Fixed TASK-014 development rehearsal. Pure data; no private access or I/O.
import {RUN_ID,EVENT_IDS,SCENARIOS,TARGETS,ROLES} from './runtime-contract.mjs';
export {RUN_ID,EVENT_IDS,SCENARIOS,TARGETS};
export const REHEARSAL_OWNER='fm_audit_rehearsal_owner';
export const TEST_ROLE=ROLES.test;
export const REHEARSAL_FILES=Object.freeze({destination:'0004_destination_rehearsal.sql',source:'0004_source_rehearsal.sql'});
export const REHEARSAL_VERSION=target=>`${target}-rehearsal-0004`;
export const REHEARSAL_APIS=Object.freeze([
 ['inspect','uuid'],['status',''],['record','uuid, boolean'],['finish','boolean'],
 ['queue_safe','boolean'],['all_absent',''],
]);
// Populated only after the concrete SQL is reviewed; execution fails on any drift.
export const REHEARSAL_MANIFEST=Object.freeze({
 '0004_destination_rehearsal.sql':'d16ee13570c5b9c4f2f02b248e305ec6f04c8513f1b268d1e655fe109a9786d0',
 '0004_source_rehearsal.sql':'eae81a53677e93991f992ef24d1c32c6322c545f48dc7adbbda3c1766303d5c9',
});
