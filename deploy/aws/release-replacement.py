"""Approved delete-first staging replacement; private inputs never enter output."""
import argparse
import copy
from datetime import datetime, timezone
import hashlib
import importlib.util
from io import StringIO
import json
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
SNAPSHOT = ROOT / 'outputs/aws-staging-build/source-c68nNM'
OLD = 'fitsmytime-staging'
NEW = 'fitsmytime-staging-20261109'
REGION = 'eu-north-1'
PROJECT = '674200807170'
CAPACITY = 'TASK-036-DELETEFIRST-CAPACITY-2026-11-09'
ACCESS = '.env.aws-staging-access-20261109.local'


def require(ok, code):
    if not ok:
        raise ValueError(code)


def module(name, filename):
    loader = importlib.util.spec_from_file_location(name, ROOT / 'deploy/aws' / filename)
    result = importlib.util.module_from_spec(loader)
    loader.loader.exec_module(result)
    return result


def write(name, value, exclusive=False):
    with (SNAPSHOT / name).open('x' if exclusive else 'w', encoding='utf-8') as target:
        json.dump(value, target, indent=2)


def compact_hash(value):
    return hashlib.sha256(json.dumps(value, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()


def fingerprint(value):
    return hashlib.sha256(json.dumps({'containers': value['containers'], 'publicEndpoint': value['publicEndpoint']},
        sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def private(name, acl, selected=None):
    require(subprocess.run(['git.exe', 'check-ignore', '--', name], cwd=ROOT, capture_output=True).returncode == 0, 'PRIVATE_FILE_NOT_IGNORED')
    acl.private_acl(ROOT / name)
    lines, keys = [], []
    for line in (ROOT / name).read_text(encoding='utf-8').splitlines():
        match = re.match(r'^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=', line)
        if match and (selected is None or match.group(1) in selected):
            keys.append(match.group(1))
            lines.append(line)
    require(len(keys) == len(set(keys)), 'DUPLICATE_ENV_KEY')
    return dict(dotenv_values(stream=StringIO('\n'.join(lines)), interpolate=False))


def load_checkpoint():
    helper = module('checkpoint_helper', 'prepare-replacement-checkpoint.py')
    acl = module('staging_acl', 'deploy-staging.py')
    acl.private_acl(helper.CHECKPOINT)
    ciphertext = helper.CHECKPOINT.read_bytes()
    result = json.loads((SNAPSHOT / 'encrypted-checkpoint-result.json').read_text())
    require(hashlib.sha256(ciphertext).hexdigest() == result['ciphertextSha256'] and result['roundtripVerified'] is True, 'CHECKPOINT_HASH_CHANGED')
    value = json.loads(helper.dpapi(ciphertext, False))
    require(value['project'] == PROJECT and value['region'] == REGION and value['oldService'] == OLD
        and value['oldVersion'] == 8 and fingerprint(value['spec']) == helper.BASELINE == value['baselineFingerprint'], 'CHECKPOINT_TARGET_CHANGED')
    build = json.loads((SNAPSHOT / 'local-build-result.json').read_text())
    require(build['ImageId'] == value['imageId'] and build['SourceManifestSha256'] == value['sourceManifestSha256']
        and build['IsolatedProxyAndArtifactsPassed'] is True and build['ApplicationStarted'] is False, 'BUILT_IMAGE_CHANGED')
    return value, result, acl


def audit_settings(acl):
    keys = ['AUDIT_EXPORT_USER_IDS', 'AUDIT_PRODUCER_CONTRACT', 'AUDIT_READER_DATABASE_URL', 'AUDIT_READER_USER_IDS']
    values = private('.env', acl, keys)
    require(set(values) == set(keys), 'AUDIT_SELECTION_MISSING')
    reader = urlsplit(values['AUDIT_READER_DATABASE_URL'])
    query = dict(parse_qsl(reader.query, keep_blank_values=True))
    query['sslrootcert'] = '/app/certs/supabase-ca.crt'
    values['AUDIT_READER_DATABASE_URL'] = urlunsplit((reader.scheme, reader.netloc, reader.path, urlencode(query), reader.fragment))
    return {key: values[key] for key in keys}


def environment_check(value, checkpoint, acl, service):
    require(service['state'] == 'DISABLED' and service['isDisabled'] and not service.get('nextDeployment')
        and service['currentDeployment']['version'] == 8 and fingerprint(service['currentDeployment']) == value['baselineFingerprint'], 'OLD_BASELINE_CHANGED')
    spec = value['spec']
    require(set(spec['containers']) == {'app', 'audit-worker', 'gateway'}, 'CONTAINER_CONTRACT_CHANGED')
    app = spec['containers']['app']['environment']
    worker = spec['containers']['audit-worker']['environment']
    gateway = spec['containers']['gateway']['environment']
    local_app = private('.env.aws-staging.local', acl)
    local_worker = private('.env.aws-staging-worker.local', acl)
    original_access = private('.env.aws-staging-access.local', acl)
    signer = private('.env.aws-staging-gateway.local', acl)
    audit = audit_settings(acl)
    require(compact_hash(audit) == value['auditSettingsSha256'] and audit == value['auditSettings'], 'AUDIT_INPUTS_CHANGED')
    required = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'SESSION_SECRET', 'OPENAI_API_KEY', 'SUPABASE_STORAGE_BUCKET']
    missing = [key for key in required if not isinstance(app.get(key), str) or not app[key].strip()]
    if missing:
        print(json.dumps({'missingOrEmptyAppSettingNames': missing}), file=sys.stderr)
    require(not missing, 'REQUIRED_APP_ENV_MISSING')
    require(isinstance(app.get('APP_ADMIN_USER_IDS'), str), 'EXPLICIT_ADMIN_SELECTION_REQUIRED')
    require(all(local_app.get(key) == app.get(key) for key in required + ['AUDIT_CAPTURE_DATABASE_URL', 'APP_ADMIN_USER_IDS']), 'STAGING_APP_INPUT_CHANGED')
    require(all(local_worker[key] == worker.get(key) for key in local_worker if key != 'NODE_ENV'), 'STAGING_WORKER_INPUT_CHANGED')
    require(app['NODE_ENV'] == worker['NODE_ENV'] == gateway['NODE_ENV'] == 'production' and app['PORT'] == '5000', 'PRODUCTION_SETTINGS_CHANGED')
    require(len(app['SESSION_SECRET']) >= 32 and app['SUPABASE_URL'] == 'https://hbkooiknruimukkhshrk.supabase.co', 'APP_SECURITY_INPUT_CHANGED')
    require(app['APP_URL'].rstrip('/') == gateway['STAGING_ORIGIN'].rstrip('/') == value['oldOrigin'], 'ORIGIN_BINDING_CHANGED')
    require(app.get('AUDIT_ENABLED') == 'true' and app.get('AUDIT_WORKER_ENABLED') == 'false' and worker.get('AUDIT_WORKER_ENABLED') == 'true'
        and app.get('AUDIT_ENVIRONMENT') == worker.get('AUDIT_ENVIRONMENT') == 'development'
        and app.get('AUDIT_SERVICE_VIEWS_ENABLED') == worker.get('AUDIT_SERVICE_VIEWS_ENABLED') == 'true', 'AUDIT_FLAGS_CHANGED')
    holds = ['NOTIFICATIONS_ENABLED', 'NOTIFICATIONS_AUTOMATION_ENABLED', 'NOTIFICATIONS_VERIFICATION_ENABLED', 'PRODUCT_ACTIVITY_ENABLED']
    require(all(app.get(key) == 'false' for key in holds) and app.get('AUDIT_AUTH_EVENTS_ENABLED') == worker.get('AUDIT_AUTH_EVENTS_ENABLED') == 'false', 'ACTIVATION_HOLD_CHANGED')
    require(all(app.get(key) in ['true', 'false'] for key in ['SUPABASE_GOOGLE_ENABLED', 'SUPABASE_APPLE_ENABLED', 'SUPABASE_FACEBOOK_ENABLED', 'SUPABASE_MICROSOFT_ENABLED']), 'PROVIDER_FLAGS_MISSING')
    require(not any(key in app for key in ['AUDIT_SOURCE_DATABASE_URL', 'AUDIT_DATABASE_URL', 'PGBINARY'])
        and not any(key in worker for key in ['DATABASE_URL', 'AUDIT_CAPTURE_DATABASE_URL', 'AUDIT_READER_DATABASE_URL', 'SUPABASE_SECRET_KEY', 'SESSION_SECRET', 'OPENAI_API_KEY']), 'CREDENTIAL_BOUNDARY_CHANGED')
    require(not any(key.startswith('STRIPE_') or key.startswith('BILLING_') for key in app), 'BILLING_ACTIVATION_REVIEW_REQUIRED')
    require(original_access['STAGING_USERNAME'] == gateway['STAGING_USERNAME'] == 'staging'
        and hashlib.sha256(original_access['STAGING_PASSWORD'].encode()).hexdigest() == gateway['STAGING_PASSWORD_SHA256']
        and signer['STAGING_SESSION_SECRET'] == gateway['STAGING_SESSION_SECRET']
        and re.fullmatch('[a-f0-9]{64}', gateway['STAGING_SESSION_SECRET']), 'GATEWAY_SECRET_MISMATCH')
    result = {'passed': True, 'checkedAt': datetime.now(timezone.utc).isoformat(), 'baselineFingerprint': value['baselineFingerprint'],
        'checkpointSha256': checkpoint['ciphertextSha256'], 'sourceManifestSha256': value['sourceManifestSha256'],
        'requiredAppInputsPresent': True, 'localStagingCredentialsMatchLive': True, 'checkpointMatchesLive': True,
        'gatewaySecretsMatch': True, 'auditSelectedInputsMatch': True, 'credentialBoundariesPass': True,
        'activationHoldsPreserved': True, 'appKeyCount': len(app), 'workerKeyCount': len(worker), 'gatewayKeyCount': len(gateway),
        'auditKeysToAdd': list(audit), 'originKeysToRewrite': ['APP_URL', 'STAGING_ORIGIN'],
        'mapsConfigured': bool(app.get('GOOGLE_MAPS_API_KEY')), 'separateGeocodingKeyConfigured': bool(app.get('GOOGLE_GEOCODING_API_KEY')),
        'globalAdminSelectionEmpty': not bool(app['APP_ADMIN_USER_IDS'].strip()),
        'providerFlags': {key: app[key] for key in app if re.fullmatch('SUPABASE_(GOOGLE|APPLE|FACEBOOK|MICROSOFT)_ENABLED', key)},
        'heldFlags': {key: app[key] for key in holds + ['AUDIT_AUTH_EVENTS_ENABLED']},
        'localAppDifferencesPreservedFromLive': sorted(key for key in set(local_app) | set(app) if local_app.get(key) != app.get(key)),
        'secretValuesPrinted': False, 'databaseConnections': False, 'awsMutations': False}
    write('environment-audit-result.json', result)
    return result


def public_service(service):
    result = {key: service.get(key) for key in ['containerServiceName', 'state', 'isDisabled', 'power', 'scale', 'url']}
    for key in ['currentDeployment', 'nextDeployment']:
        item = service.get(key)
        result[key] = None if not item else {'version': item['version'], 'state': item['state'], 'images': {name: c['image'] for name, c in item['containers'].items()}}
    return result


def validate_capacity(receipt, value):
    require(receipt.get('authorization') == CAPACITY and receipt.get('passed') is True and receipt.get('state') == 'passed'
        and receipt.get('allConnectionsClosed') is True and receipt.get('capacityOnly') is True
        and receipt.get('writes') is False and receipt.get('claims') is False and receipt.get('retry') is False
        and receipt.get('newService') == NEW and receipt.get('oldServiceAbsent') is True
        and receipt.get('newServiceReadyEmpty') is True and receipt.get('deleteFirstAuthorized') is True
        and receipt.get('environmentAuditPassed') is True
        and receipt.get('checkpointSha256') == 'ef020e3668689fa5388992a5944cc667d00ec3297207880cd42ece0a330bf5c6'
        and receipt.get('sourceManifestSha256') == value['sourceManifestSha256']
        and receipt.get('runtimeDatabaseSha256') == value['runtimeDatabaseSha256']
        and receipt.get('auditSettingsSha256') == value['auditSettingsSha256'], 'CAPACITY_RECEIPT_REJECTED')
    limits = {'app': 5, 'capture': 2, 'worker': 2, 'writer': 2, 'reader': 2}
    roles = receipt.get('roles', [])
    require(len(roles) == 5 and {role['kind'] for role in roles} == set(limits)
        and all(role.get('passed') is True and role.get('tlsVerified') is True and role.get('readOnly') is True
            and type(role.get('otherConnections')) is int and role['otherConnections'] == 0 and role.get('connectionLimit') == limits[role['kind']] for role in roles), 'FIVE_ROLE_CAPACITY_REQUIRED')
    age = (datetime.now(timezone.utc) - datetime.fromisoformat(receipt['completedAt'].replace('Z', '+00:00'))).total_seconds()
    require(0 <= age <= 15 * 60, 'FRESH_CAPACITY_REQUIRED')


def deployment_spec(value, image, origin):
    require(re.fullmatch(r':fitsmytime-staging-20261109\.app\.\d+', image), 'REPLACEMENT_IMAGE_REJECTED')
    require(re.fullmatch(r'https://fitsmytime-staging-20261109\.[a-z0-9]+\.eu-north-1\.cs\.amazonlightsail\.com', origin), 'REPLACEMENT_ORIGIN_REJECTED')
    spec = copy.deepcopy(value['spec'])
    for container in spec['containers'].values():
        container['image'] = image
    spec['containers']['app']['environment'].update(value['auditSettings'], APP_URL=origin)
    spec['containers']['gateway']['environment']['STAGING_ORIGIN'] = origin
    return spec


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['envcheck', 'delete-old', 'create', 'status', 'capacity-proof', 'deploy', 'verify', 'disable'])
    args = parser.parse_args()
    stage = args.mode
    try:
        value, checkpoint, acl = load_checkpoint()
        config = Config(retries={'total_max_attempts': 1}, connect_timeout=5, read_timeout=20)
        session = boto3.Session(profile_name='fitsmytime', region_name=REGION)
        require(session.client('sts', config=config).get_caller_identity()['Account'] == PROJECT, 'WRONG_PROJECT')
        client = session.client('lightsail', config=config)
        services = {item['containerServiceName']: item for item in client.get_container_services()['containerServices']}
        old, new = services.get(OLD), services.get(NEW)
        if args.mode == 'envcheck':
            require(old is not None, 'OLD_SERVICE_REQUIRED')
            result = environment_check(value, checkpoint, acl, old)
        elif args.mode == 'delete-old':
            require(old is not None and new is None, 'DELETE_FIRST_INVENTORY_CHANGED')
            environment_check(value, checkpoint, acl, old)
            write('delete-old-attempt.json', {'service': OLD, 'authorizedDeleteFirst': True, 'baselineFingerprint': value['baselineFingerprint'], 'startedAt': datetime.now(timezone.utc).isoformat()}, True)
            client.delete_container_service(serviceName=OLD)
            result = {'deletionSubmitted': True, 'service': OLD, 'supabaseResourcesChanged': False, 'retryPerformed': False}
            write('delete-old-result.json', result)
        elif args.mode == 'create':
            require(old is None and new is None, 'BOTH_SERVICES_ABSENT_REQUIRED')
            require(json.loads((SNAPSHOT / 'delete-old-result.json').read_text())['deletionSubmitted'] is True, 'CONTROLLED_DELETE_REQUIRED')
            write('replacement-create-attempt.json', {'service': NEW, 'authorizedAfterOldDeletion': True, 'startedAt': datetime.now(timezone.utc).isoformat()}, True)
            new = client.create_container_service(serviceName=NEW, power='micro', scale=1)['containerService']
            result = public_service(new)
            write('replacement-create-result.json', result)
        elif args.mode == 'status':
            result = {'old': None if old is None else public_service(old), 'replacement': None if new is None else public_service(new)}
        elif args.mode == 'capacity-proof':
            require(old is None and new is not None and new['state'] == 'READY' and not new['isDisabled']
                and new['power'] == 'micro' and new['scale'] == 1 and not new.get('currentDeployment') and not new.get('nextDeployment'), 'OLD_ABSENT_NEW_EMPTY_READY_REQUIRED')
            require(json.loads((SNAPSHOT / 'environment-audit-result.json').read_text())['passed'] is True, 'ENVIRONMENT_AUDIT_REQUIRED')
            result = {'region': REGION, 'project': PROJECT, 'verifiedAt': datetime.now(timezone.utc).isoformat(),
                'deleteFirstAuthorized': True, 'environmentAuditPassed': True, 'checkpointSha256': checkpoint['ciphertextSha256'],
                'oldService': {'name': OLD, 'absent': True},
                'newService': {'name': NEW, 'state': 'READY', 'isDisabled': False, 'power': 'micro', 'scale': 1, 'current': None, 'next': None}}
            write('replacement-capacity-ready.json', result)
        elif args.mode == 'deploy':
            require(old is None and new is not None and new['state'] == 'READY' and not new['isDisabled']
                and not new.get('currentDeployment') and not new.get('nextDeployment') and new['power'] == 'micro' and new['scale'] == 1, 'NEW_EMPTY_READY_REQUIRED')
            validate_capacity(json.loads((SNAPSHOT / 'db-replacement-capacity-2026-11-09.json').read_text()), value)
            require(audit_settings(acl) == value['auditSettings'], 'AUDIT_SELECTION_CHANGED')
            publication = json.loads((SNAPSHOT / 'published-image-result.json').read_text())
            require(publication.get('published') is True and publication.get('serviceName') == NEW and publication.get('region') == REGION
                and publication.get('sourceManifest') == value['sourceManifestSha256'] and publication.get('localImageId') == value['imageId'], 'EXACT_IMAGE_PUBLICATION_REQUIRED')
            images = client.get_container_images(serviceName=NEW)['containerImages']
            require(any(item['image'] == publication['image'] and item['digest'] == publication['digest'] for item in images), 'IMAGE_DIGEST_CHANGED')
            origin = new['url'].rstrip('/')
            spec = deployment_spec(value, publication['image'], origin)
            access = private('.env.aws-staging-access.local', acl)
            access['STAGING_ORIGIN'] = origin
            if (ROOT / ACCESS).exists():
                require(private(ACCESS, acl) == access, 'EXISTING_ACCESS_HANDOFF_CHANGED')
            else:
                require(subprocess.run(['git.exe', 'check-ignore', '--', ACCESS], cwd=ROOT, capture_output=True).returncode == 0, 'NEW_ACCESS_NOT_IGNORED')
                acl.private_acl(ROOT / ACCESS, create=True)
                (ROOT / ACCESS).write_text(''.join(key + '=' + val + '\n' for key, val in access.items()), encoding='utf-8')
            planned = {'service': NEW, 'origin': origin, 'image': publication['image'], 'digest': publication['digest'],
                'sourceManifestSha256': value['sourceManifestSha256'], 'specFingerprint': fingerprint(spec),
                'accessFile': ACCESS, 'startedAt': datetime.now(timezone.utc).isoformat()}
            write('replacement-deploy-attempt.json', planned, True)
            response = client.create_container_service_deployment(serviceName=NEW, **spec)['containerService']
            deployment = response.get('nextDeployment') or response.get('currentDeployment')
            result = {**planned, 'version': deployment['version'], 'deploymentState': deployment['state'], 'serviceState': response['state']}
            write('replacement-deploy-result.json', result)
        elif args.mode == 'verify':
            expected = json.loads((SNAPSHOT / 'replacement-deploy-result.json').read_text())
            require(old is None and new is not None and new['state'] == 'RUNNING' and not new['isDisabled'] and not new.get('nextDeployment')
                and new['currentDeployment']['state'] == 'ACTIVE' and new['currentDeployment']['version'] == expected['version']
                and fingerprint(new['currentDeployment']) == expected['specFingerprint'], 'EXACT_ACTIVE_REPLACEMENT_REQUIRED')
            result = {**public_service(new), 'verified': True, 'specFingerprint': expected['specFingerprint'], 'oldServiceAbsent': True}
            write('replacement-spec-verified.json', result)
        else:
            require(old is None and new is not None, 'REPLACEMENT_ONLY_REQUIRED')
            client.update_container_service(serviceName=NEW, isDisabled=True)
            result = {'disabledSubmitted': True, 'service': NEW}
        print(json.dumps(result, default=str))
        return 0
    except Exception as error:
        message = str(error)
        code = error.response.get('Error', {}).get('Code', 'AWS_ERROR') if isinstance(error, ClientError) else message
        print(json.dumps({'stage': stage, 'error': code if re.fullmatch(r'[A-Za-z_]+', code) else type(error).__name__, 'retryPerformed': False}), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
