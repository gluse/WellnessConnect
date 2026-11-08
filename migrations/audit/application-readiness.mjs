// Current application metadata contract. Historical migration profiles stay frozen.
// No private configuration, files, connections or SQL execute on import.
import { EXPECTED_BILLING_PARSERS } from '../billing/application-readiness.mjs';
export const EXPECTED_COMPLETION_AUDIT_PARSERS = Object.freeze([
  Object.freeze({ name: 'parse_event', hash: '13bf91808224587d7f2e0ce0293e3a3b053b4109804843aa83fae0cf5906c816' }),
  Object.freeze({ name: 'parse_event_before_completion', hash: EXPECTED_BILLING_PARSERS.find(parser => parser.name === 'parse_event').hash }),
  ...EXPECTED_BILLING_PARSERS.filter(parser => parser.name !== 'parse_event'),
]);
