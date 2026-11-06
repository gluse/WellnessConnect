"""TASK-036 gateway-only release; preserve live app/worker configuration in memory."""
import argparse
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import secrets
import sys
import subprocess
from datetime import datetime, timezone
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
SERVICE = 'fitsmytime-staging'
REGION = 'eu-north-1'
SECRET = ROOT / '.env.aws-staging-gateway.local'
CAPACITY_AUTHORIZATION = 'TASK-036-REFERRER-MANUAL-FLAGS-2026-11-06'
IDLE = ['node', '-e', 'setInterval(()=>{},1000)']
MAINTENANCE = ['node', '-e', "require('node:http').createServer((q,s)=>{q.resume();const ready=q.url==='/health/ready'&&['GET','HEAD'].includes(q.method);s.writeHead(ready?200:503,{'Content-Type':'application/json','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive'});s.end(q.method==='HEAD'?undefined:JSON.stringify({status:ready?'maintenance':'updating'}))}).listen(8080,'0.0.0.0')"]

def maintenance_spec(original):
    containers = copy.deepcopy(original['containers'])
    containers['app']['command'] = IDLE
    containers['audit-worker']['command'] = IDLE
    containers['gateway']['command'] = MAINTENANCE
    return containers

def require(ok, code):
    if not ok:
        raise ValueError(code)

def fingerprint(deployment):
    value = {'containers': deployment['containers'], 'publicEndpoint': deployment['publicEndpoint']}
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()

def validate_manual_capacity(stdout, returncode):
    require(returncode == 0, 'CAPACITY_FAILED_CONTACT_DB_OWNER')
    records = [json.loads(line) for line in stdout.splitlines() if line.strip()]
    require(all(isinstance(item, dict) and item.get('passed') is not False for item in records), 'MALFORMED_CAPACITY_OUTPUT')
    completed = [item for item in records if item.get('stage') == 'complete']
    require(len(completed) == 1, 'CAPACITY_COMPLETION_REQUIRED')
    done = completed[0]
    require(done.get('capacityAuthorization') == CAPACITY_AUTHORIZATION and all(done.get(key) is True for key in ['passed', 'capacityOnly', 'allConnectionsClosed']) and done.get('writes') is False and done.get('claims') is False, 'CAPACITY_AUTHORIZATION_MISMATCH')
    limits = {'app':5, 'capture':2, 'worker':2, 'writer':2}
    roles = [item for item in records if item.get('stage') in limits]
    counts = [item for item in records if item.get('stage') == 'capacity']
    require(len(roles) == len(counts) == 4 and {item['stage'] for item in roles} == set(limits) and {item.get('kind') for item in counts} == set(limits), 'FOUR_ROLE_CAPACITY_REQUIRED')
    require(all(type(item.get('otherConnectionsAtSnapshot')) is int and item['otherConnectionsAtSnapshot'] == 0 for item in counts), 'CAPACITY_NOT_DRAINED')
    require(all(item.get('passed') is True and item.get('tlsVerified') is True and item.get('readOnly') is True and item.get('connectionLimit') == limits[item['stage']] and type(item.get('otherConnectionsAtSnapshot')) is int and item['otherConnectionsAtSnapshot'] == 0 for item in roles), 'ROLE_CAPACITY_FAILED')

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('snapshot')
    parser.add_argument('mode', choices=['prepare', 'stop', 'deploy', 'start', 'resume-original', 'maintenance', 'maintenance-ready', 'manual-capacity', 'deploy-maintenance', 'verify'])
    parser.add_argument('--manual-user-run', action='store_true')
    args = parser.parse_args()
    try:
        require(args.mode != 'manual-capacity' or args.manual_user_run, 'MANUAL_USER_CONFIRMATION_REQUIRED')
        snapshot = (ROOT / args.snapshot).resolve()
        require(snapshot.parent == ROOT / 'outputs/aws-staging-build' and snapshot.name.startswith('source-gateway-'), 'SNAPSHOT_SCOPE')
        if args.mode == 'manual-capacity':
            local_flags = dotenv_values(ROOT / '.env.aws-staging.local', interpolate=False)
            require(all(local_flags.get(key) != 'true' for key in ['NOTIFICATIONS_ENABLED', 'NOTIFICATIONS_AUTOMATION_ENABLED', 'NOTIFICATIONS_VERIFICATION_ENABLED', 'PRODUCT_ACTIVITY_ENABLED']), 'UNAPPROVED_WORKER_OR_PROVIDER_FLAG')
        receipt = snapshot / 'gateway-release-baseline.json'
        release_file = snapshot / 'gateway-release-result.json'
        config = Config(retries={'total_max_attempts': 1, 'mode': 'standard'}, connect_timeout=5, read_timeout=20)
        session = boto3.Session(profile_name='fitsmytime', region_name=REGION)
        require(session.client('sts', config=config).get_caller_identity()['Account'] == '674200807170', 'WRONG_PROJECT')
        client = session.client('lightsail', config=config)
        service = client.get_container_services(serviceName=SERVICE)['containerServices'][0]
        require(service['power'] == 'micro' and service['scale'] == 1, 'CAPACITY_CHANGED')
        current = service['currentDeployment']
        require(set(current['containers']) == {'app', 'gateway', 'audit-worker'}, 'CONTAINERS_CHANGED')
        require(current['publicEndpoint']['containerName'] == 'gateway' and current['publicEndpoint']['containerPort'] == 8080, 'PUBLIC_ENDPOINT_CHANGED')
        if args.mode == 'prepare':
            require(service['state'] == 'RUNNING' and current['state'] == 'ACTIVE' and not service.get('nextDeployment'), 'STABLE_RELEASE_REQUIRED')
            require(all(current['containers'][name]['image'] == ':fitsmytime-staging.app.1' for name in ['app', 'audit-worker']), 'BASE_IMAGE_CHANGED')
            require(re.fullmatch(r':fitsmytime-staging\.app\.\d+', current['containers']['gateway']['image']), 'UNKNOWN_GATEWAY_IMAGE')
            history = client.get_container_service_deployments(serviceName=SERVICE)['deployments']
            original = next(item for item in history if item['version'] == 1)
            app = current['containers']['app']['environment']
            approved_app = original['containers']['app']['environment']
            for key in ['DATABASE_URL', 'AUDIT_CAPTURE_DATABASE_URL', 'SUPABASE_URL', 'AUDIT_ENVIRONMENT', 'AUDIT_ENABLED', 'AUDIT_SERVICE_VIEWS_ENABLED', 'AUDIT_WORKER_ENABLED', 'AUDIT_AUTH_EVENTS_ENABLED']:
                require(app.get(key) == approved_app.get(key), 'DATABASE_OR_AUDIT_CONTRACT_CHANGED')
            require(current['containers']['audit-worker'] == original['containers']['audit-worker'], 'WORKER_CONTRACT_CHANGED')
            require(all(app.get(key) != 'true' for key in ['NOTIFICATIONS_ENABLED', 'NOTIFICATIONS_AUTOMATION_ENABLED', 'NOTIFICATIONS_VERIFICATION_ENABLED', 'PRODUCT_ACTIVITY_ENABLED']), 'ACTIVATION_HOLD_CHANGED')
            publication = json.loads((snapshot / 'published-image-result.json').read_text())
            require(publication['published'] and publication['serviceName'] == SERVICE, 'PUBLICATION_REQUIRED')
            spec = importlib.util.spec_from_file_location('staging_private_acl', ROOT / 'deploy/aws/deploy-staging.py')
            acl = importlib.util.module_from_spec(spec); spec.loader.exec_module(acl)
            if not SECRET.exists():
                require(subprocess.run(['git.exe', 'check-ignore', '--', SECRET.name], cwd=ROOT, capture_output=True).returncode == 0, 'SECRET_NOT_IGNORED')
                acl.private_acl(SECRET, create=True)
                SECRET.write_text('STAGING_SESSION_SECRET=' + secrets.token_hex(32) + '\n', encoding='utf-8')
            acl.private_acl(SECRET)
            private = dict(dotenv_values(SECRET, interpolate=False))
            require(set(private) == {'STAGING_SESSION_SECRET'} and re.fullmatch('[a-f0-9]{64}', private['STAGING_SESSION_SECRET']), 'INVALID_SESSION_SECRET')
            current_key = current['containers']['gateway']['environment'].get('STAGING_SESSION_SECRET')
            require(not current_key or current_key == private['STAGING_SESSION_SECRET'], 'EXISTING_SESSION_KEY_MISMATCH')
            baseline = {'service': SERVICE, 'version': current['version'], 'fingerprint': fingerprint(current), 'newImage': publication['image'], 'newDigest': publication['digest'], 'origin': service['url'].rstrip('/')}
            receipt.write_text(json.dumps(baseline, indent=2))
            print(json.dumps({**baseline, 'prepared': True, 'secretStoredWithOwnerOnlyAcl': True}))
            return 0
        baseline = json.loads(receipt.read_text())
        if args.mode in ['maintenance', 'maintenance-ready', 'manual-capacity', 'deploy-maintenance', 'verify']:
            history = client.get_container_service_deployments(serviceName=SERVICE)['deployments']
            original = next(item for item in history if item['version'] == baseline['version'])
            require(fingerprint(original) == baseline['fingerprint'], 'BASELINE_CHANGED')
        if args.mode == 'maintenance':
            require(service['state'] == 'RUNNING' and not service['isDisabled'] and not service.get('nextDeployment') and current['version'] == baseline['version'] and fingerprint(current) == baseline['fingerprint'], 'STABLE_ORIGINAL_REQUIRED')
            result = client.create_container_service_deployment(serviceName=SERVICE, containers=maintenance_spec(original), publicEndpoint=original['publicEndpoint'])['containerService']
            candidate = result.get('nextDeployment') or result['currentDeployment']
            public = {'version':candidate['version'], 'state':candidate['state'], 'zeroDatabaseCommands':True}
            (snapshot / 'maintenance-result.json').write_text(json.dumps(public, indent=2)); print(json.dumps(public)); return 0
        if args.mode in ['maintenance-ready', 'manual-capacity', 'deploy-maintenance']:
            maintenance = json.loads((snapshot / 'maintenance-result.json').read_text())
            require(service['state'] == 'RUNNING' and not service['isDisabled'] and not service.get('nextDeployment') and current['state'] == 'ACTIVE' and current['version'] == maintenance['version'], 'ACTIVE_MAINTENANCE_REQUIRED')
            require(current['containers'] == maintenance_spec(original) and current['publicEndpoint'] == original['publicEndpoint'], 'MAINTENANCE_COMMANDS_CHANGED')
            require(all(item['state'] == 'INACTIVE' for item in history if item['version'] < current['version']), 'PRIOR_DEPLOYMENT_NOT_INACTIVE')
            if args.mode == 'maintenance-ready':
                ready = {'maintenanceVersion':current['version'], 'active':True, 'allPreviousInactive':True, 'allCommandsDatabaseFree':True, 'checkedAt':datetime.now(timezone.utc).isoformat()}
                (snapshot / 'maintenance-ready.json').write_text(json.dumps(ready, indent=2))
                print(json.dumps(ready)); return 0
            if args.mode == 'manual-capacity':
                ready = json.loads((snapshot / 'maintenance-ready.json').read_text())
                require(ready['maintenanceVersion'] == current['version'] and (datetime.now(timezone.utc) - datetime.fromisoformat(ready['checkedAt'])).total_seconds() >= 30, 'DRAIN_GRACE_REQUIRED')
                attempt = snapshot / 'manual-capacity-attempt.json'
                require(not attempt.exists(), 'CAPACITY_ALREADY_ATTEMPTED_CONTACT_DB_OWNER')
                attempt.write_text(json.dumps({'attemptedAt':datetime.now(timezone.utc).isoformat(), 'maintenanceVersion':current['version']}))
                checked = subprocess.run(['node', '--import', 'tsx', 'scripts/aws-staging-pc-db-preflight.mjs', '--execute-capacity=' + CAPACITY_AUTHORIZATION], cwd=ROOT, capture_output=True, text=True)
                try:
                    decoded = [json.loads(line) for line in checked.stdout.splitlines() if line.strip()]
                    summary = [{key:item[key] for key in ['stage','kind','passed','safeCode','otherConnectionsAtSnapshot'] if key in item} for item in decoded if isinstance(item, dict)]
                except ValueError:
                    summary = [{'stage':'output', 'safeCode':'MALFORMED_CAPACITY_OUTPUT'}]
                attempt.write_text(json.dumps({'maintenanceVersion':current['version'], 'exitCode':checked.returncode, 'summary':summary}, indent=2))
                validate_manual_capacity(checked.stdout, checked.returncode)
                released = {'passed':True, 'oldVersion':baseline['version'], 'maintenanceVersion':current['version'], 'capacityAuthorization':CAPACITY_AUTHORIZATION, 'writes':False, 'claims':False}
                (snapshot / 'capacity-release.json').write_text(json.dumps(released, indent=2))
                print(json.dumps(released)); return 0
        if args.mode == 'verify':
            release = json.loads(release_file.read_text())
            require(service['state'] == 'RUNNING' and current['state'] == 'ACTIVE' and current['version'] == release['version'] and not service.get('nextDeployment'), 'TARGET_NOT_ACTIVE')
            require(current['containers']['app'] == original['containers']['app'] and current['containers']['audit-worker'] == original['containers']['audit-worker'] and current['publicEndpoint'] == original['publicEndpoint'], 'APPLICATION_CONFIGURATION_CHANGED')
            gateway = copy.deepcopy(original['containers']['gateway'])
            gateway['image'] = baseline['newImage']
            gateway['environment']['STAGING_SESSION_SECRET'] = dict(dotenv_values(SECRET, interpolate=False))['STAGING_SESSION_SECRET']
            require(current['containers']['gateway'] == gateway, 'GATEWAY_CONFIGURATION_CHANGED')
            print(json.dumps({'version':current['version'], 'active':True, 'gatewayImage':baseline['newImage'], 'applicationWorkerAndEndpointPreserved':True, 'gatewayConfigurationVerified':True})); return 0
        if args.mode in ['stop', 'deploy', 'resume-original']:
            require(current['version'] == baseline['version'] and fingerprint(current) == baseline['fingerprint'] and not service.get('nextDeployment'), 'LIVE_CONFIGURATION_CHANGED')
        if args.mode == 'stop':
            require(service['state'] == 'RUNNING' and not service['isDisabled'], 'RUNNING_REQUIRED')
            result = client.update_container_service(serviceName=SERVICE, isDisabled=True)['containerService']
            print(json.dumps({'mode': 'stop', 'state': result['state'], 'disabled': result['isDisabled'], 'version': current['version']}))
        elif args.mode in ['deploy', 'deploy-maintenance']:
            if args.mode == 'deploy':
                require(service['state'] == 'DISABLED' and service['isDisabled'], 'STOPPED_SERVICE_REQUIRED')
            # Caller must first run the delegated one-shot DB drain check.
            drain = json.loads((snapshot / 'capacity-release.json').read_text())
            require(drain.get('passed') is True and drain.get('oldVersion') == baseline['version'], 'CAPACITY_RELEASE_REQUIRED')
            if args.mode == 'deploy-maintenance':
                require(drain.get('maintenanceVersion') == current['version'], 'MAINTENANCE_CAPACITY_REQUIRED')
            private = dict(dotenv_values(SECRET, interpolate=False))
            require(re.fullmatch('[a-f0-9]{64}', private.get('STAGING_SESSION_SECRET', '')), 'INVALID_SESSION_SECRET')
            images = client.get_container_images(serviceName=SERVICE)['containerImages']
            require(any(image['image'] == baseline['newImage'] and image['digest'] == baseline['newDigest'] for image in images), 'PUBLISHED_IMAGE_CHANGED')
            containers = copy.deepcopy(original['containers'] if args.mode == 'deploy-maintenance' else current['containers'])
            containers['gateway']['image'] = baseline['newImage']
            containers['gateway']['environment']['STAGING_SESSION_SECRET'] = private['STAGING_SESSION_SECRET']
            result = client.create_container_service_deployment(serviceName=SERVICE, containers=containers, publicEndpoint=current['publicEndpoint'])['containerService']
            deployment = result.get('nextDeployment') or result['currentDeployment']
            public = {'version': deployment['version'], 'state': deployment['state'], 'serviceState': result['state'], 'disabled': result['isDisabled'], 'gatewayImage': baseline['newImage'], 'appWorkerConfigurationPreserved': True}
            release_file.write_text(json.dumps(public, indent=2)); print(json.dumps(public))
        elif args.mode == 'resume-original':
            require(service['isDisabled'] and service['state'] == 'DISABLED', 'STOPPED_SERVICE_REQUIRED')
            result = client.update_container_service(serviceName=SERVICE, isDisabled=False)['containerService']
            print(json.dumps({'mode':'resume-original', 'state':result['state'], 'disabled':result['isDisabled'], 'version':baseline['version']}))
        elif args.mode == 'start':
            release = json.loads(release_file.read_text())
            require(service['isDisabled'], 'SERVICE_ALREADY_ENABLED')
            candidate = service.get('nextDeployment') or current
            require(candidate['version'] == release['version'] and candidate['containers']['gateway']['image'] == baseline['newImage'], 'CANDIDATE_CHANGED')
            result = client.update_container_service(serviceName=SERVICE, isDisabled=False)['containerService']
            print(json.dumps({'mode': 'start', 'state': result['state'], 'disabled': result['isDisabled'], 'version': release['version']}))
        return 0
    except ClientError as error:
        print(json.dumps({'mode':args.mode, 'error':error.response.get('Error', {}).get('Code', 'AWS_ERROR'), 'retryPerformed':False}), file=sys.stderr)
        return 1
    except Exception as error:
        message = str(error)
        print(json.dumps({'mode':args.mode, 'error':message if re.fullmatch('[A-Z_]+', message) else type(error).__name__, 'retryPerformed':False}), file=sys.stderr)
        return 1

if __name__ == '__main__':
    sys.exit(main())
