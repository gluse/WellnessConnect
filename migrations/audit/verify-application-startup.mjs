// Bounded, nonprivileged read-only metadata verification. No startup, sessions or writes.
import { loadPrivateConfiguration } from './execute-runtime-setup.mjs';
import { privatePreflight, privateRead, readSettings, client, connect, emit, safeCode } from './runtime-support.mjs';
import { verifyWorkspacePricingDatabaseReadiness, WORKSPACE_PRICING_APPLICATION_READINESS_KEYS } from '../workspace-pricing/application-readiness.mjs';
import { verifyCurrencyDatabaseReadiness } from '../currencies/application-readiness.mjs';

let connection;
try {
  const { cas } = loadPrivateConfiguration();
  const text = privateRead('.env', privatePreflight());
  const settings = readSettings(text.split(/\r?\n/).filter(line => /^\s*(?:export\s+)?DATABASE_URL\s*=/.test(line)).join('\n'));
  connection = await client(settings.DATABASE_URL, 'source', cas.source, 'fmt_app_dev');
  await connect(connection);
  await connection.query('BEGIN READ ONLY');
  await verifyCurrencyDatabaseReadiness((sql, values) => connection.query(sql, values));
  await verifyWorkspacePricingDatabaseReadiness((sql, values) => connection.query(sql, values));
  await connection.query('ROLLBACK');
  emit('application-startup-readiness', { passed: true, currencyChecks: 2, integratedChecks: WORKSPACE_PRICING_APPLICATION_READINESS_KEYS.length,
    restrictedApplicationPrincipal: true, readOnly: true, auditParserChainExact: true, writes: false, backupTaken: false });
} catch (error) {
  if (connection) await connection.query('ROLLBACK').catch(() => {});
  emit('application-startup-readiness', { passed: false, code: error?.code ?? safeCode(error), checks: error?.checks, automaticRetry: false });
  process.exitCode = 1;
} finally { if (connection) await connection.end(); }
