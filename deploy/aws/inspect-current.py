"""Read-only public release metadata; never print runtime settings or commands."""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
from io import StringIO
import json
from pathlib import Path
import re
import sys
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import boto3
from botocore.config import Config
from dotenv import dotenv_values


def main():
    try:
        parser = argparse.ArgumentParser()
        parser.add_argument('--disabled-proof')
        parser.add_argument('--validate-preflight')
        args = parser.parse_args()
        config = Config(retries={'total_max_attempts': 1}, connect_timeout=5, read_timeout=20)
        session = boto3.Session(profile_name='fitsmytime', region_name='eu-north-1')
        if session.client('sts', config=config).get_caller_identity()['Account'] != '674200807170':
            raise ValueError('WRONG_PROJECT')
        client = session.client('lightsail', config=config)
        service = client.get_container_services(serviceName='fitsmytime-staging')['containerServices'][0]
        deployment = service['currentDeployment']
        containers = deployment['containers']
        spec = {'containers': containers, 'publicEndpoint': deployment['publicEndpoint']}
        result = {
            'state': service['state'], 'disabled': service['isDisabled'],
            'version': deployment['version'], 'deploymentState': deployment['state'],
            'pending': bool(service.get('nextDeployment')),
            'fingerprint': hashlib.sha256(json.dumps(spec, sort_keys=True, separators=(',', ':')).encode()).hexdigest(),
            'containers': {},
        }
        idle = ['node', '-e', 'setInterval(()=>{},1000)']
        for name, container in containers.items():
            command = container.get('command')
            expected = {'app': ['node', 'dist/index.js'], 'audit-worker': ['node', 'dist/audit-worker.js'], 'gateway': ['node', 'staging-proxy.mjs']}
            result['containers'][name] = {
                'image': container['image'],
                'commandKind': 'idle' if command == idle else 'runtime' if command == expected.get(name) else 'other',
                'environmentKeys': sorted(container.get('environment', {})),
            }
        if args.disabled_proof:
            root = Path(__file__).resolve().parents[2]
            snapshot = (root / args.disabled_proof).resolve()
            if snapshot.parent != root / 'outputs/aws-staging-build' or not snapshot.name.startswith('source-') or not snapshot.is_dir():
                raise ValueError('SNAPSHOT_SCOPE')
            if not service['isDisabled'] or service['state'] != 'DISABLED' or service.get('nextDeployment'):
                raise ValueError('DISABLED_SERVICE_REQUIRED')
            proof = {
                'service': 'fitsmytime-staging', 'region': 'eu-north-1',
                'isDisabled': True, 'serviceState': 'DISABLED',
                'currentVersion': deployment['version'], 'noPending': True,
                'fingerprint': result['fingerprint'],
                'verifiedAt': datetime.now(timezone.utc).isoformat(),
            }
            (snapshot / 'disabled-ready.json').write_text(json.dumps(proof, indent=2), encoding='utf-8')
            result['disabledProofSaved'] = True
        if args.validate_preflight:
            root = Path(__file__).resolve().parents[2]
            snapshot = (root / args.validate_preflight).resolve()
            if snapshot.parent != root / 'outputs/aws-staging-build' or not snapshot.name.startswith('source-'):
                raise ValueError('SNAPSHOT_SCOPE')
            receipt = json.loads((snapshot / 'db-release-preflight-2026-11-09.json').read_text())
            proof = json.loads((snapshot / 'disabled-ready.json').read_text())
            manifest = json.loads((snapshot / 'manifest.json').read_text())
            if not service['isDisabled'] or service['state'] != 'DISABLED' or service.get('nextDeployment') or deployment['version'] != 8 or result['fingerprint'] != proof['fingerprint']:
                raise ValueError('DISABLED_BASELINE_CHANGED')
            if receipt.get('state') != 'passed' or receipt.get('authorization') != 'TASK-036-PUBLISH-2026-11-09' or receipt.get('sourceManifestSha256') != manifest['sha256'] or receipt.get('applicationChecks') != 38 or receipt.get('allConnectionsClosed') is not True or receipt.get('writes') is not False or receipt.get('claims') is not False:
                raise ValueError('PREFLIGHT_RECEIPT_REJECTED')
            app = containers['app']['environment']
            worker = containers['audit-worker']['environment']
            values = {
                'AUDIT_CAPTURE_DATABASE_URL': app['AUDIT_CAPTURE_DATABASE_URL'],
                'AUDIT_DATABASE_URL': worker['AUDIT_DATABASE_URL'],
                'AUDIT_SOURCE_DATABASE_URL': worker['AUDIT_SOURCE_DATABASE_URL'],
                'DATABASE_URL': app['DATABASE_URL'],
            }
            digest = lambda data: hashlib.sha256(json.dumps(data, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()
            if digest(values) != receipt['runtimeDatabaseSha256']:
                raise ValueError('LIVE_DATABASE_INPUTS_DIFFER_FROM_PREFLIGHT')
            if any(app.get(key) == 'true' for key in ['NOTIFICATIONS_ENABLED', 'NOTIFICATIONS_AUTOMATION_ENABLED', 'NOTIFICATIONS_VERIFICATION_ENABLED', 'PRODUCT_ACTIVITY_ENABLED']) or app.get('AUDIT_AUTH_EVENTS_ENABLED') != 'false' or worker.get('AUDIT_AUTH_EVENTS_ENABLED') != 'false':
                raise ValueError('ACTIVATION_HOLD_CHANGED')
            spec_loader = importlib.util.spec_from_file_location('staging_acl', root / 'deploy/aws/deploy-staging.py')
            acl = importlib.util.module_from_spec(spec_loader)
            spec_loader.loader.exec_module(acl)
            acl.private_acl(root / '.env')
            keys = ['AUDIT_EXPORT_USER_IDS', 'AUDIT_PRODUCER_CONTRACT', 'AUDIT_READER_DATABASE_URL', 'AUDIT_READER_USER_IDS']
            lines = []
            for line in (root / '.env').read_text(encoding='utf-8').splitlines():
                match = re.match(r'^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=', line)
                if match and match.group(1) in keys:
                    lines.append(line)
            audit = dotenv_values(stream=StringIO('\n'.join(lines)), interpolate=False)
            if len(lines) != 4 or set(audit) != set(keys) or audit['AUDIT_PRODUCER_CONTRACT'] != 'completion-0008':
                raise ValueError('SELECTED_AUDIT_FIELDS_CHANGED')
            reader = urlsplit(audit['AUDIT_READER_DATABASE_URL'])
            query = dict(parse_qsl(reader.query, keep_blank_values=True))
            query['sslrootcert'] = '/app/certs/supabase-ca.crt'
            audit['AUDIT_READER_DATABASE_URL'] = urlunsplit((reader.scheme, reader.netloc, reader.path, urlencode(query), reader.fragment))
            if digest({key: audit[key] for key in keys}) != receipt['auditSettingsSha256']:
                raise ValueError('SELECTED_AUDIT_FIELDS_DIFFER_FROM_PREFLIGHT')
            validation = {'validated': True, 'sourceManifestSha256': manifest['sha256'], 'baselineVersion': 8,
                'baselineFingerprint': result['fingerprint'], 'liveDatabaseInputsMatchPreflight': True,
                'selectedAuditInputsMatchPreflight': True, 'activationHoldsPreserved': True,
                'checkedAt': datetime.now(timezone.utc).isoformat(), 'awsMutations': False, 'databaseConnections': False}
            (snapshot / 'release-input-validation.json').write_text(json.dumps(validation, indent=2), encoding='utf-8')
            result['releaseInputValidation'] = validation
        print(json.dumps(result))
        return 0
    except Exception as error:
        message = str(error)
        code = message if re.fullmatch(r'[A-Z_]+', message) else type(error).__name__
        print(json.dumps({'error': code, 'retryPerformed': False}), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
