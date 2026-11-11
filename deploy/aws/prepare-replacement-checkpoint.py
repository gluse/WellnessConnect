"""Prepare a CurrentUser-DPAPI encrypted release checkpoint; never delete or deploy."""
import hashlib
import importlib.util
from io import StringIO
import json
from pathlib import Path
import re
import subprocess
import sys
from datetime import datetime, timezone
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import boto3
from botocore.config import Config
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
SNAPSHOT = ROOT / 'outputs/aws-staging-build/source-c68nNM'
CHECKPOINT = ROOT / '.env.aws-staging-release-checkpoint-20261109.local'
BASELINE = '8a3596cc579dda6acdf1c4e540e5c865a710a0642a525f574e49026e9cae16c0'


def require(ok, code):
    if not ok:
        raise ValueError(code)


def digest(data):
    return hashlib.sha256(json.dumps(data, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()


def dpapi(value, encrypt):
    # Secrets enter/leave this child only through captured stdin/stdout pipes.
    script = r'''
$ErrorActionPreference='Stop'
try {
 Add-Type -AssemblyName System.Security
 $bytes=[Convert]::FromBase64String([Console]::In.ReadToEnd())
 $scope=[Security.Cryptography.DataProtectionScope]::CurrentUser
 if ($env:FMT_DPAPI_MODE -eq 'protect') {
  $result=[Security.Cryptography.ProtectedData]::Protect($bytes,$null,$scope)
 } else {
  $result=[Security.Cryptography.ProtectedData]::Unprotect($bytes,$null,$scope)
 }
 [Console]::Out.Write([Convert]::ToBase64String($result))
} catch { exit 1 }
'''
    import base64
    import os
    result = subprocess.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', script],
        input=base64.b64encode(value), capture_output=True,
        env=dict(os.environ, FMT_DPAPI_MODE='protect' if encrypt else 'unprotect'))
    require(result.returncode == 0, 'DPAPI_OPERATION_FAILED')
    return base64.b64decode(result.stdout, validate=True)


def main():
    try:
        require(not CHECKPOINT.exists(), 'CHECKPOINT_EXISTS_DO_NOT_OVERWRITE')
        require(subprocess.run(['git.exe', 'check-ignore', '--', CHECKPOINT.name], cwd=ROOT, capture_output=True).returncode == 0, 'CHECKPOINT_NOT_IGNORED')
        config = Config(retries={'total_max_attempts': 1}, connect_timeout=5, read_timeout=20)
        session = boto3.Session(profile_name='fitsmytime', region_name='eu-north-1')
        require(session.client('sts', config=config).get_caller_identity()['Account'] == '674200807170', 'WRONG_PROJECT')
        services = session.client('lightsail', config=config).get_container_services()['containerServices']
        require(len(services) == 1 and services[0]['containerServiceName'] == 'fitsmytime-staging', 'SERVICE_INVENTORY_CHANGED')
        service = services[0]
        require(service['isDisabled'] and service['state'] == 'DISABLED' and not service.get('nextDeployment')
            and service['power'] == 'micro' and service['scale'] == 1 and service['currentDeployment']['version'] == 8, 'DISABLED_BASELINE_REQUIRED')
        require(not service.get('publicDomainNames'), 'CUSTOM_DOMAIN_REVIEW_REQUIRED')
        deployment = service['currentDeployment']
        spec = {'containers': deployment['containers'], 'publicEndpoint': deployment['publicEndpoint']}
        require(hashlib.sha256(json.dumps(spec, sort_keys=True, separators=(',', ':')).encode()).hexdigest() == BASELINE, 'BASELINE_CHANGED')
        receipt_path = SNAPSHOT / 'db-release-preflight-2026-11-09.json'
        receipt = json.loads(receipt_path.read_text())
        require(receipt.get('state') == 'passed' and receipt.get('allConnectionsClosed') is True
            and receipt.get('writes') is False and receipt.get('claims') is False and receipt.get('applicationChecks') == 38, 'PREFLIGHT_REQUIRED')
        app = spec['containers']['app']['environment']
        worker = spec['containers']['audit-worker']['environment']
        database = {'AUDIT_CAPTURE_DATABASE_URL': app['AUDIT_CAPTURE_DATABASE_URL'], 'AUDIT_DATABASE_URL': worker['AUDIT_DATABASE_URL'],
            'AUDIT_SOURCE_DATABASE_URL': worker['AUDIT_SOURCE_DATABASE_URL'], 'DATABASE_URL': app['DATABASE_URL']}
        require(digest(database) == receipt['runtimeDatabaseSha256'], 'DATABASE_INPUTS_CHANGED')
        loader = importlib.util.spec_from_file_location('staging_acl', ROOT / 'deploy/aws/deploy-staging.py')
        acl = importlib.util.module_from_spec(loader)
        loader.loader.exec_module(acl)
        acl.private_acl(ROOT / '.env')
        keys = ['AUDIT_EXPORT_USER_IDS', 'AUDIT_PRODUCER_CONTRACT', 'AUDIT_READER_DATABASE_URL', 'AUDIT_READER_USER_IDS']
        lines = []
        for line in (ROOT / '.env').read_text(encoding='utf-8').splitlines():
            match = re.match(r'^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=', line)
            if match and match.group(1) in keys:
                lines.append(line)
        settings = dotenv_values(stream=StringIO('\n'.join(lines)), interpolate=False)
        require(len(lines) == 4 and set(settings) == set(keys), 'AUDIT_SELECTION_CHANGED')
        reader = urlsplit(settings['AUDIT_READER_DATABASE_URL'])
        query = dict(parse_qsl(reader.query, keep_blank_values=True))
        query['sslrootcert'] = '/app/certs/supabase-ca.crt'
        settings['AUDIT_READER_DATABASE_URL'] = urlunsplit((reader.scheme, reader.netloc, reader.path, urlencode(query), reader.fragment))
        audit = {key: settings[key] for key in keys}
        require(digest(audit) == receipt['auditSettingsSha256'], 'AUDIT_INPUTS_CHANGED')
        build = json.loads((SNAPSHOT / 'local-build-result.json').read_text())
        require(build['SourceManifestSha256'] == receipt['sourceManifestSha256'] and build['IsolatedProxyAndArtifactsPassed']
            and build['ApplicationStarted'] is False, 'BUILT_IMAGE_REQUIRED')
        value = {'format': 1, 'project': '674200807170', 'region': 'eu-north-1', 'oldService': 'fitsmytime-staging',
            'oldOrigin': service['url'].rstrip('/'), 'oldVersion': 8, 'baselineFingerprint': BASELINE, 'spec': spec,
            'auditSettings': audit, 'runtimeDatabaseSha256': receipt['runtimeDatabaseSha256'],
            'auditSettingsSha256': receipt['auditSettingsSha256'], 'sourceManifestSha256': receipt['sourceManifestSha256'],
            'imageId': build['ImageId'], 'preparedAt': datetime.now(timezone.utc).isoformat()}
        plaintext = json.dumps(value, separators=(',', ':'), ensure_ascii=False).encode()
        encrypted = dpapi(plaintext, True)
        require(dpapi(encrypted, False) == plaintext, 'CHECKPOINT_ROUNDTRIP_FAILED')
        acl.private_acl(CHECKPOINT, create=True)
        CHECKPOINT.write_bytes(encrypted)
        require(dpapi(CHECKPOINT.read_bytes(), False) == plaintext, 'SAVED_CHECKPOINT_ROUNDTRIP_FAILED')
        result = {'prepared': True, 'checkpointFile': CHECKPOINT.name, 'encryption': 'Windows DPAPI CurrentUser',
            'ciphertextSha256': hashlib.sha256(encrypted).hexdigest(), 'roundtripVerified': True,
            'baselineFingerprint': BASELINE, 'sourceManifestSha256': receipt['sourceManifestSha256'],
            'privateSettingsPrinted': False, 'awsMutations': False, 'databaseConnections': False,
            'deletionAuthorizedBeforeReplacement': False, 'preparedAt': value['preparedAt']}
        (SNAPSHOT / 'encrypted-checkpoint-result.json').write_text(json.dumps(result, indent=2))
        print(json.dumps(result))
        return 0
    except Exception as error:
        message = str(error)
        print(json.dumps({'error': message if re.fullmatch(r'[A-Z_]+', message) else type(error).__name__, 'retryPerformed': False}), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
