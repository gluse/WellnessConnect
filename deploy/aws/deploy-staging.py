"""TASK-036 restricted staging. Private inputs stay in memory; output is filtered."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
from urllib.parse import urlsplit

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
SERVICE = 'fitsmytime-staging'
REGION = 'eu-north-1'
PROJECT = '674200807170'
APP_KEYS = set('APP_ADMIN_USER_IDS AUDIT_AUTH_EVENTS_ENABLED AUDIT_CAPTURE_DATABASE_URL AUDIT_ENABLED AUDIT_ENVIRONMENT AUDIT_SERVICE_VIEWS_ENABLED AUDIT_WORKER_ENABLED DATABASE_URL NODE_ENV NOTIFICATIONS_AUTOMATION_ENABLED NOTIFICATIONS_ENABLED NOTIFICATIONS_VERIFICATION_ENABLED OPENAI_API_KEY PORT SESSION_SECRET SUPABASE_APPLE_ENABLED SUPABASE_FACEBOOK_ENABLED SUPABASE_GOOGLE_ENABLED SUPABASE_MICROSOFT_ENABLED SUPABASE_PUBLISHABLE_KEY SUPABASE_SECRET_KEY SUPABASE_STORAGE_BUCKET SUPABASE_URL'.split())
WORKER_KEYS = set('AUDIT_AUTH_EVENTS_ENABLED AUDIT_DATABASE_URL AUDIT_ENVIRONMENT AUDIT_SERVICE_VIEWS_ENABLED AUDIT_SOURCE_DATABASE_URL AUDIT_WORKER_ENABLED NODE_ENV'.split())
ACCESS = ROOT / '.env.aws-staging-access.local'

def require(condition, code):
    if not condition:
        raise ValueError(code)

def private_acl(path, create=False):
    # Create an EMPTY file, copy the validated current-user-only protected ACL,
    # verify it, and only then allow secret content to be written.
    script = r'''
$ErrorActionPreference='Stop'
try {
 Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
 $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User
 $source=Get-Acl -LiteralPath $env:FMT_ACL_SOURCE
 if ($env:FMT_ACL_CREATE -eq 'yes') {
  if (Test-Path -LiteralPath $env:FMT_ACL_TARGET) { throw 'exists' }
  New-Item -ItemType File -Path $env:FMT_ACL_TARGET | Out-Null
  Set-Acl -LiteralPath $env:FMT_ACL_TARGET -AclObject $source
 }
 $item=Get-Item -LiteralPath $env:FMT_ACL_TARGET
 if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'link' }
 $acl=Get-Acl -LiteralPath $item.FullName
 $rules=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
 if (-not $acl.AreAccessRulesProtected -or $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid.Value -or
 $rules.Count -ne 1 -or $rules[0].IdentityReference.Value -ne $sid.Value -or $rules[0].AccessControlType -ne 'Allow' -or
 $rules[0].IsInherited -or $rules[0].FileSystemRights -ne [Security.AccessControl.FileSystemRights]::FullControl) { throw 'acl' }
 exit 0
} catch { exit 1 }
'''
    environment = dict(os.environ, FMT_ACL_SOURCE=str(ROOT / '.env.aws-staging.local'), FMT_ACL_TARGET=str(path), FMT_ACL_CREATE='yes' if create else 'no')
    result = subprocess.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', script], env=environment, capture_output=True)
    require(result.returncode == 0, 'PRIVATE_ACL_FAILED')

def private_settings(name, keys):
    target = ROOT / name
    ignored = subprocess.run(['git.exe', 'check-ignore', '--', name], cwd=ROOT, capture_output=True)
    require(ignored.returncode == 0, 'PRIVATE_FILE_NOT_IGNORED')
    private_acl(target)
    values = dict(dotenv_values(target, interpolate=False))
    require(set(values) == keys and all(isinstance(v, str) for v in values.values()), 'PRIVATE_KEY_SET_CHANGED')
    return values

def gateway_session_secret():
    target = ROOT / '.env.aws-staging-gateway.local'
    if not target.exists():
        require(subprocess.run(['git.exe', 'check-ignore', '--', target.name], cwd=ROOT, capture_output=True).returncode == 0, 'GATEWAY_SECRET_NOT_IGNORED')
        private_acl(target, create=True)
        target.write_text('STAGING_SESSION_SECRET=' + secrets.token_hex(32) + '\n', encoding='utf-8')
    private_acl(target)
    values = dict(dotenv_values(target, interpolate=False))
    require(set(values) == {'STAGING_SESSION_SECRET'} and re.fullmatch('[a-f0-9]{64}', values['STAGING_SESSION_SECRET']), 'INVALID_GATEWAY_SECRET')
    return values['STAGING_SESSION_SECRET']

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('snapshot')
    parser.add_argument('--deploy', action='store_true')
    args = parser.parse_args()
    stage = 'validate'
    try:
        require(os.name == 'nt', 'WINDOWS_HANDOFF_REQUIRED')
        snapshot = (ROOT / args.snapshot).resolve()
        require(snapshot.parent == ROOT / 'outputs/aws-staging-build' and snapshot.name.startswith('source-'), 'SNAPSHOT_SCOPE')
        app = private_settings('.env.aws-staging.local', APP_KEYS)
        worker = private_settings('.env.aws-staging-worker.local', WORKER_KEYS)
        require(app['AUDIT_ENABLED'] == 'true' and app['AUDIT_WORKER_ENABLED'] == 'false' and app['AUDIT_SERVICE_VIEWS_ENABLED'] == 'true', 'APP_AUDIT_FLAGS')
        require(worker['AUDIT_WORKER_ENABLED'] == 'true', 'WORKER_AUDIT_FLAG')
        require(app['AUDIT_ENVIRONMENT'] == worker['AUDIT_ENVIRONMENT'] == 'development', 'AUDIT_ENVIRONMENT')
        require(app['AUDIT_AUTH_EVENTS_ENABLED'] == worker['AUDIT_AUTH_EVENTS_ENABLED'] == 'false', 'AUTH_EVENT_HOLD')
        require(all(app[key] == 'false' for key in ['NOTIFICATIONS_ENABLED', 'NOTIFICATIONS_AUTOMATION_ENABLED', 'NOTIFICATIONS_VERIFICATION_ENABLED']), 'NOTIFICATION_HOLD')
        require(len(app['SESSION_SECRET']) >= 32, 'SESSION_SECRET_LENGTH')
        config = Config(retries={'total_max_attempts': 1, 'mode': 'standard'}, connect_timeout=5, read_timeout=20)
        session = boto3.Session(profile_name='fitsmytime', region_name=REGION)
        stage = 'identity'
        require(session.client('sts', config=config).get_caller_identity()['Account'] == PROJECT, 'WRONG_AWS_PROJECT')
        lightsail = session.client('lightsail', config=config)
        service = lightsail.get_container_services(serviceName=SERVICE)['containerServices'][0]
        require(service['power'] == 'micro' and service['scale'] == 1 and not service['isDisabled'], 'SERVICE_CAPACITY_CHANGED')
        require(service['arn'].startswith(f'arn:aws:lightsail:{REGION}:{PROJECT}:'), 'SERVICE_TARGET_CHANGED')
        origin = service['url'].rstrip('/')
        parsed = urlsplit(origin)
        require(parsed.scheme == 'https' and parsed.hostname.endswith(f'.{REGION}.cs.amazonlightsail.com') and not parsed.path and not parsed.query and not parsed.fragment, 'ORIGIN_REJECTED')
        require(not service.get('currentDeployment') and not service.get('nextDeployment'), 'EXISTING_DEPLOYMENT_REVIEW_REQUIRED')
        app.update(NODE_ENV='production', PORT='5000', APP_URL=origin, PRODUCT_ACTIVITY_ENABLED='false')
        worker['NODE_ENV'] = 'production'
        if not args.deploy:
            print(json.dumps({'validated': True, 'serviceState': service['state'], 'origin': origin, 'appKeyCount': len(app), 'workerKeyCount': len(worker), 'appWorkerCredentialsSeparated': True, 'deployed': False}))
            return 0
        stage = 'image'
        require(service['state'] == 'READY', 'SERVICE_NOT_READY')
        publication = json.loads((snapshot / 'published-image-result.json').read_text())
        require(publication['published'] and publication['serviceName'] == SERVICE and publication['region'] == REGION, 'IMAGE_NOT_PUBLISHED')
        images = lightsail.get_container_images(serviceName=SERVICE)['containerImages']
        require(any(item['image'] == publication['image'] and item['digest'] == publication['digest'] for item in images), 'IMAGE_REFERENCE_CHANGED')
        stage = 'access-handoff'
        if ACCESS.exists():
            private_acl(ACCESS)
            access = dict(dotenv_values(ACCESS, interpolate=False))
            require(access.get('STAGING_ORIGIN') == origin and access.get('STAGING_USERNAME') == 'staging' and len(access.get('STAGING_PASSWORD', '')) >= 43, 'ACCESS_HANDOFF_MISMATCH')
        else:
            require(subprocess.run(['git.exe', 'check-ignore', '--', ACCESS.name], cwd=ROOT, capture_output=True).returncode == 0, 'ACCESS_FILE_NOT_IGNORED')
            private_acl(ACCESS, create=True)
            access = {'STAGING_ORIGIN': origin, 'STAGING_USERNAME': 'staging', 'STAGING_PASSWORD': secrets.token_urlsafe(32)}
            ACCESS.write_text(''.join(f'{key}={value}\n' for key, value in access.items()), encoding='utf-8')
        proxy = {'NODE_ENV': 'production', 'STAGING_ORIGIN': origin, 'STAGING_USERNAME': access['STAGING_USERNAME'], 'STAGING_PASSWORD_SHA256': hashlib.sha256(access['STAGING_PASSWORD'].encode()).hexdigest(), 'STAGING_SESSION_SECRET': gateway_session_secret()}
        image = publication['image']
        containers = {
            'app': {'image': image, 'command': ['node', 'dist/index.js'], 'environment': app, 'ports': {'5000': 'HTTP'}},
            'gateway': {'image': image, 'command': ['node', 'staging-proxy.mjs'], 'environment': proxy, 'ports': {'8080': 'HTTP'}},
            'audit-worker': {'image': image, 'command': ['node', 'dist/audit-worker.js'], 'environment': worker},
        }
        endpoint = {'containerName': 'gateway', 'containerPort': 8080, 'healthCheck': {'path': '/health/ready', 'intervalSeconds': 15, 'timeoutSeconds': 5, 'healthyThreshold': 2, 'unhealthyThreshold': 3, 'successCodes': '200'}}
        stage = 'deploy'
        response = lightsail.create_container_service_deployment(serviceName=SERVICE, containers=containers, publicEndpoint=endpoint)
        deployment = response['containerService'].get('nextDeployment') or response['containerService'].get('currentDeployment')
        # Raw response contains credentials. Persist only public release metadata.
        result = {'serviceName': SERVICE, 'region': REGION, 'origin': origin, 'image': image, 'digest': publication['digest'], 'version': deployment['version'], 'state': deployment['state'], 'publicContainer': 'gateway', 'containers': list(containers), 'accessFile': ACCESS.name}
        (snapshot / 'deployment-result.json').write_text(json.dumps(result, indent=2))
        print(json.dumps(result))
        return 0
    except ClientError as error:
        code = error.response.get('Error', {}).get('Code', 'AWS_ERROR')
        print(json.dumps({'stage': stage, 'error': code if re.fullmatch(r'[A-Za-z0-9_]+', code) else 'AWS_ERROR', 'retryPerformed': False}), file=sys.stderr)
        return 1
    except Exception as error:
        code = str(error)
        print(json.dumps({'stage': stage, 'error': code if re.fullmatch(r'[A-Z_]+', code) else type(error).__name__, 'retryPerformed': False}), file=sys.stderr)
        return 1

if __name__ == '__main__':
    sys.exit(main())
