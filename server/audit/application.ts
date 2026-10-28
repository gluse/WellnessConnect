import { assertAuditActivation, auditApplicationConnection } from "./config.ts";
import { AuditCaptureUnavailable, type AuditPool } from "./capture.ts";

/** Checked against the actual server connection, not just a configured URI. */
export function assertAuditApplicationRole(rows: Record<string, unknown>[]): void {
  const row = rows[0];
  if (rows.length !== 1 || row.principal !== "fmt_app_dev" || row.rolcanlogin !== true || row.rolinherit !== true ||
    row.rolconnlimit !== 5 || ["app_member", "capture_member", "may_enqueue"].some(key => row[key] !== true) ||
    ["rolsuper", "rolbypassrls", "rolcreaterole", "rolcreatedb", "rolreplication", "extra_role", "membership_admin",
      "owns_objects", "permanent_ddl", "audit_base_access"].some(key => row[key] !== false)) throw new AuditCaptureUnavailable();
}

export async function verifyAuditApplicationPool(pool: AuditPool, environment: Record<string, string | undefined>): Promise<void> {
  assertAuditActivation(environment);
  if (environment.AUDIT_ENABLED !== "true") return;
  auditApplicationConnection(environment.DATABASE_URL); // Refuse stale ambient owner configuration before any socket.
  let client: Awaited<ReturnType<AuditPool["connect"]>>;
  try { client = await pool.connect(); }
  catch { throw new AuditCaptureUnavailable(); }
  let failed = true;
  try {
    const stream = (client as unknown as { connection?: { stream?: { encrypted?: boolean; authorized?: boolean } } }).connection?.stream;
    if (stream?.encrypted !== true || stream.authorized !== true) throw new AuditCaptureUnavailable();
    const result = await client.query(`SELECT current_user AS principal,r.rolcanlogin,r.rolinherit,r.rolconnlimit,
      r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb,r.rolreplication,
      pg_has_role(current_user,'fm_app_runtime','USAGE') AS app_member,
      pg_has_role(current_user,'fm_audit_capture','USAGE') AS capture_member,
      has_function_privilege(current_user,'audit_capture.enqueue(text,text,text)','EXECUTE') AS may_enqueue,
      EXISTS(SELECT 1 FROM pg_roles g WHERE g.rolname NOT IN (current_user,'fm_app_runtime','fm_audit_capture')
        AND pg_has_role(current_user,g.oid,'MEMBER')) AS extra_role,
      EXISTS(SELECT 1 FROM pg_auth_members m WHERE m.member=r.oid AND m.admin_option) AS membership_admin,
      EXISTS(SELECT 1 FROM pg_class c WHERE c.relowner=r.oid) OR
        EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspowner=r.oid) AS owns_objects,
      EXISTS(SELECT 1 FROM pg_namespace n WHERE has_schema_privilege(current_user,n.oid,'CREATE')) OR
        has_database_privilege(current_user,current_database(),'CREATE') AS permanent_ddl,
      has_table_privilege(current_user,'audit_capture.audit_outbox','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS audit_base_access
      FROM pg_roles r WHERE r.rolname=current_user`);
    assertAuditApplicationRole(result.rows);
    failed = false;
  } catch { throw new AuditCaptureUnavailable(); }
  finally { client.release(failed); }
}
