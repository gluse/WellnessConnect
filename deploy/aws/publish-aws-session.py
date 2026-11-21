"""Private AWS state stays in this pipe-only process, never in release files/argv."""
import copy
from datetime import datetime, timezone
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path
from urllib.parse import urlsplit

PROJECT = '674200807170'
REGION = 'eu-north-1'
SERVICE = 'fitsmytime-staging-20261109'
ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / 'outputs/aws-staging-build'
IDLE = ['node', '-e', 'setInterval(()=>{},1000)']
MAINTENANCE = ['node', '-e', "require('http').createServer((q,s)=>{s.writeHead(q.url==='/health/ready'?200:503,{'Content-Type':'application/json','Cache-Control':'no-store'});s.end(q.url==='/health/ready'?'{\"status\":\"ready\"}':'{\"status\":\"maintenance\"}')}).listen(8080,'0.0.0.0')"]


def require(value, code):
    if not value:
        raise ValueError(code)


def digest(value, canonical=False):
    return hashlib.sha256(json.dumps(value, sort_keys=canonical, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()


def specification(deployment):
    return {key: copy.deepcopy(deployment[key]) for key in ['containers', 'publicEndpoint']}


def fingerprint(spec):
    return digest(spec, True)


def validate_build_target(service):
    # Image publication needs target identity/status, not a private runtime spec.
    # The separate deployment inspection retains all of its existing checks.
    require(re.fullmatch(f'arn:aws:lightsail:{REGION}:{PROJECT}:ContainerService/[A-Za-z0-9-]+', service['arn']), 'WRONG_SERVICE_PROJECT')
    require(service['containerServiceName'] == SERVICE and service['power'] == 'micro' and service['scale'] == 1, 'SERVICE_TARGET_CHANGED')
    require(service['state'] == 'RUNNING' and not service['isDisabled'] and not service.get('nextDeployment'), 'STABLE_RUNNING_SERVICE_REQUIRED')
    current = service['currentDeployment']
    require(current['state'] == 'ACTIVE' and type(current['version']) is int and current['version'] > 0, 'ACTIVE_BASELINE_REQUIRED')
    commands = {'app': ['node', 'dist/index.js'], 'audit-worker': ['node', 'dist/audit-worker.js'], 'gateway': ['node', 'staging-proxy.mjs']}
    require(set(current['containers']) == set(commands) and all(current['containers'][key].get('command') == value for key, value in commands.items()), 'BASELINE_COMMANDS_CHANGED')
    endpoint = current['publicEndpoint']
    require(endpoint['containerName'] == 'gateway' and endpoint['containerPort'] == 8080 and endpoint['healthCheck']['path'] == '/health/ready', 'PRIVATE_ENDPOINT_CHANGED')
    origin = service['url'].rstrip('/')
    parsed = urlsplit(origin)
    require(parsed.scheme == 'https' and parsed.hostname and parsed.hostname.endswith(f'.{REGION}.cs.amazonlightsail.com')
            and not parsed.username and not parsed.password and not parsed.port and not parsed.path and not parsed.query and not parsed.fragment, 'ORIGIN_REJECTED')
    return {'serviceArn': service['arn'], 'baselineVersion': current['version'], 'origin': origin}


def validate_runtime(service):
    require(service['arn'].startswith(f'arn:aws:lightsail:{REGION}:{PROJECT}:'), 'WRONG_SERVICE_PROJECT')
    require(service['containerServiceName'] == SERVICE and service['power'] == 'micro' and service['scale'] == 1, 'SERVICE_TARGET_CHANGED')
    require(service['state'] == 'RUNNING' and not service['isDisabled'] and not service.get('nextDeployment'), 'STABLE_RUNNING_SERVICE_REQUIRED')
    current = service['currentDeployment']
    require(current['state'] == 'ACTIVE', 'ACTIVE_BASELINE_REQUIRED')
    containers = current['containers']
    require(set(containers) == {'app', 'audit-worker', 'gateway'}, 'CONTAINER_CONTRACT_CHANGED')
    commands = {'app': ['node', 'dist/index.js'], 'audit-worker': ['node', 'dist/audit-worker.js'], 'gateway': ['node', 'staging-proxy.mjs']}
    require(all(containers[key].get('command') == command for key, command in commands.items()), 'BASELINE_COMMANDS_CHANGED')
    app, worker, gateway = [containers[key]['environment'] for key in ['app', 'audit-worker', 'gateway']]
    require(all(env.get('NODE_ENV') == 'production' for env in [app, worker, gateway]), 'PRODUCTION_SETTINGS_REQUIRED')
    require('AUDIT_RUNTIME_PROFILE' not in app and 'AUDIT_RUNTIME_PROFILE' not in worker, 'LOCAL_PROFILE_REFUSED')
    require(app.get('SUPABASE_URL') == 'https://hbkooiknruimukkhshrk.supabase.co', 'SOURCE_TARGET_CHANGED')
    required = ['DATABASE_URL', 'AUDIT_CAPTURE_DATABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'SESSION_SECRET', 'OPENAI_API_KEY', 'SUPABASE_STORAGE_BUCKET']
    require(all(isinstance(app.get(key), str) and app[key].strip() for key in required), 'REQUIRED_APP_SETTING_MISSING')
    require(app.get('PORT') == '5000' and len(app['SESSION_SECRET']) >= 32, 'APP_RUNTIME_SETTINGS_CHANGED')
    require(app.get('AUDIT_ENABLED') == 'true' and all(env.get('AUDIT_ENVIRONMENT') == 'development' and env.get('AUDIT_SERVICE_VIEWS_ENABLED') == 'true' for env in [app, worker]), 'AUDIT_CONFIGURATION_CHANGED')
    require(app.get('AUDIT_PRODUCER_CONTRACT') == 'completion-0008' and all('PGBINARY' not in env for env in [app, worker]), 'AUDIT_PRODUCER_CONTRACT_CHANGED')
    require(app.get('AUDIT_WORKER_ENABLED') == 'false' and worker.get('AUDIT_WORKER_ENABLED') == 'true', 'WORKER_BOUNDARY_CHANGED')
    require(all(env.get('AUDIT_AUTH_EVENTS_ENABLED') == 'false' for env in [app, worker]), 'AUTH_EVENT_HOLD_CHANGED')
    require(all(app.get(key) == 'false' for key in ['NOTIFICATIONS_ENABLED', 'NOTIFICATIONS_AUTOMATION_ENABLED', 'NOTIFICATIONS_VERIFICATION_ENABLED', 'PRODUCT_ACTIVITY_ENABLED']), 'ACTIVATION_HOLD_CHANGED')
    require(not any(key.startswith(('STRIPE_', 'BILLING_')) for key in app), 'BILLING_REVIEW_REQUIRED')
    require(not any(key in worker for key in ['DATABASE_URL', 'AUDIT_CAPTURE_DATABASE_URL', 'SUPABASE_SECRET_KEY', 'SESSION_SECRET', 'OPENAI_API_KEY', 'AUDIT_READER_DATABASE_URL']), 'WORKER_CREDENTIAL_BOUNDARY_CHANGED')
    require(not any(key in app for key in ['AUDIT_DATABASE_URL', 'AUDIT_SOURCE_DATABASE_URL']), 'APP_CREDENTIAL_BOUNDARY_CHANGED')
    origin = service['url'].rstrip('/')
    parsed = urlsplit(origin)
    require(parsed.scheme == 'https' and parsed.hostname.endswith(f'.{REGION}.cs.amazonlightsail.com') and not parsed.path and not parsed.query and not parsed.fragment, 'ORIGIN_REJECTED')
    require(app.get('APP_URL', '').rstrip('/') == gateway.get('STAGING_ORIGIN') == origin, 'ORIGIN_BINDING_CHANGED')
    require(re.fullmatch('[a-f0-9]{64}', gateway.get('STAGING_PASSWORD_SHA256', '')) and re.fullmatch('[a-f0-9]{64}', gateway.get('STAGING_SESSION_SECRET', '')), 'GATEWAY_PROTECTION_REQUIRED')
    require(current['publicEndpoint']['containerName'] == 'gateway' and current['publicEndpoint']['containerPort'] == 8080 and current['publicEndpoint']['healthCheck']['path'] == '/health/ready', 'PRIVATE_ENDPOINT_CHANGED')
    runtime = {key: env[key] for key, env in [('AUDIT_CAPTURE_DATABASE_URL', app), ('AUDIT_DATABASE_URL', worker), ('AUDIT_SOURCE_DATABASE_URL', worker), ('DATABASE_URL', app)]}
    audit = {key: app[key] for key in ['AUDIT_EXPORT_USER_IDS', 'AUDIT_PRODUCER_CONTRACT', 'AUDIT_READER_DATABASE_URL', 'AUDIT_READER_USER_IDS']}
    return {'baselineFingerprint': fingerprint(specification(current)), 'baselineVersion': current['version'], 'runtimeDatabaseSha256': digest(runtime), 'auditSettingsSha256': digest(audit), 'origin': origin}


def maintenance_spec(baseline):
    result = copy.deepcopy(baseline)
    for name in ['app', 'audit-worker']:
        result['containers'][name]['command'] = IDLE
    result['containers']['gateway']['command'] = MAINTENANCE
    return result


def snapshot_path(value):
    result = Path(value).resolve()
    require(result.parent == ARTIFACTS and result.name.startswith('source-') and result.is_dir() and not result.is_symlink(), 'SNAPSHOT_SCOPE')
    return result


class Session:
    def __init__(self):
        import boto3
        from botocore.config import Config
        self.config = Config(retries={'total_max_attempts': 1, 'mode': 'standard'}, connect_timeout=5, read_timeout=30)
        self.session = boto3.Session(profile_name='fitsmytime', region_name=REGION)
        require(self.client('sts').get_caller_identity()['Account'] == PROJECT, 'WRONG_AWS_PROJECT')
        self.lightsail = self.client('lightsail')
        self.baseline = None
        self.baseline_version = None
        self.maintenance_version = None
        self.candidate_version = None
        self.cloud = None
        self.mutations = set()
        self.recovery = None

    def client(self, name):
        return self.session.client(name, config=self.config)

    def service(self):
        values = self.lightsail.get_container_services(serviceName=SERVICE)['containerServices']
        require(len(values) == 1, 'SERVICE_NOT_FOUND')
        return values[0]

    def once(self, key):
        require(key not in self.mutations, 'OPERATION_ALREADY_ATTEMPTED')
        self.mutations.add(key)

    def dispatch(self, request):
        operation = request['operation']
        if operation == 'inspect-build-target':
            require(set(request) == {'operation'} and self.baseline is None and self.maintenance_version is None and self.candidate_version is None, 'BUILD_TARGET_INSPECTION_REJECTED')
            return validate_build_target(self.service())
        if operation == 'inspect':
            require(self.baseline is None, 'ALREADY_INSPECTED')
            service = self.service()
            result = validate_runtime(service)
            self.baseline = specification(service['currentDeployment'])
            self.baseline_hash = result['baselineFingerprint']
            self.baseline_version = result['baselineVersion']
            return result
        if operation == 'inspect-maintenance-recovery':
            require(set(request) == {'operation', 'originalContext', 'maintenanceVersion', 'maintenanceFingerprint', 'recoveryId', 'approvalReference', 'expiresAt'}
                    and self.baseline is None, 'RECOVERY_INSPECTION_REJECTED')
            require(isinstance(request['recoveryId'], str) and re.fullmatch(r'[a-f0-9-]{36}', request['recoveryId'])
                    and isinstance(request['approvalReference'], str) and request['approvalReference'].startswith(('docs/', 'https://')), 'RECOVERY_APPROVAL_REQUIRED')
            require(re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z', request['expiresAt'])
                    and datetime.fromisoformat(request['expiresAt'].replace('Z', '+00:00')) > datetime.now(timezone.utc), 'RECOVERY_APPROVAL_EXPIRED')
            context = request['originalContext']
            require(isinstance(context, dict) and set(context) == {'releaseId', 'project', 'region', 'service', 'sourceManifestSha256',
                    'baselineFingerprint', 'runtimeDatabaseSha256', 'auditSettingsSha256', 'baselineVersion', 'image', 'digest', 'origin'}
                    and context['project'] == PROJECT and context['region'] == REGION and context['service'] == SERVICE
                    and request['recoveryId'] != context['releaseId'], 'RECOVERY_CONTEXT_REJECTED')
            service = self.service()
            history = self.lightsail.get_container_service_deployments(serviceName=SERVICE)['deployments']
            originals = [item for item in history if item['version'] == context['baselineVersion']]
            require(len(originals) == 1 and originals[0]['state'] == 'INACTIVE', 'RECOVERY_HISTORY_REQUIRED')
            original = copy.deepcopy(originals[0])
            original['state'] = 'ACTIVE'
            historical_service = copy.deepcopy(service)
            historical_service['currentDeployment'] = original
            # validate_runtime also checks the real service's stable state/holds.
            result = validate_runtime(historical_service)
            require(all(result[key] == context[key] for key in result), 'RECOVERY_ORIGINAL_FINGERPRINT_CHANGED')
            active = service['currentDeployment']
            require(type(request['maintenanceVersion']) is int and request['maintenanceVersion'] > context['baselineVersion']
                    and active['version'] == request['maintenanceVersion'] and active['state'] == 'ACTIVE'
                    and specification(active) == maintenance_spec(specification(original))
                    and fingerprint(specification(active)) == request['maintenanceFingerprint']
                    and all(item['state'] == 'INACTIVE' for item in history if item['version'] != active['version']), 'RECOVERY_MAINTENANCE_CHANGED')
            self.once('inspect-maintenance-recovery')
            self.baseline = specification(original)
            self.baseline_hash = result['baselineFingerprint']
            self.baseline_version = result['baselineVersion']
            self.maintenance_version = active['version']
            self.recovery = {'releaseId': request['recoveryId'], 'approvalReference': request['approvalReference'], 'expiresAt': request['expiresAt']}
            self.mutations.add('maintenance')
            return result
        if operation == 'inspect-published-image':
            require(set(request) == {'operation', 'image', 'digest'}, 'IMAGE_PARAMETERS_REJECTED')
            require(re.fullmatch(r':fitsmytime-staging-20261109\.src[a-f0-9]{24}\.[1-9][0-9]*', request['image'])
                    and re.fullmatch(r'sha256:[a-f0-9]{64}', request['digest']), 'IMAGE_PARAMETERS_REJECTED')
            require(any(item['image'] == request['image'] and item['digest'] == request['digest']
                        for item in self.lightsail.get_container_images(serviceName=SERVICE)['containerImages']), 'IMAGE_DIGEST_CHANGED')
            return {'image': request['image'], 'digest': request['digest'], 'registered': True}
        if operation == 'migration-binding':
            # Public hash lets an authorized inspector prepare the exact later
            # input grant without retrieving the raw URL into a public artifact.
            require(set(request) == {'operation', 'baselineFingerprint', 'baselineVersion'} and self.baseline is not None
                    and (self.maintenance_version is None or getattr(self, 'recovery', None)) and self.candidate_version is None, 'MIGRATION_BINDING_BASELINE_REQUIRED')
            require(request['baselineFingerprint'] == self.baseline_hash and request['baselineVersion'] == self.baseline_version, 'MIGRATION_BASELINE_CHANGED')
            if getattr(self, 'recovery', None):
                require(self.dispatch({'operation': 'status', 'version': self.maintenance_version})['active'], 'QUIESCENCE_CHANGED')
            else:
                live = validate_runtime(self.service())
                require(live['baselineFingerprint'] == self.baseline_hash and live['baselineVersion'] == self.baseline_version, 'MIGRATION_BASELINE_CHANGED')
            self.once('migration-binding')
            return {'applicationDatabaseUrlSha256': hashlib.sha256(self.baseline['containers']['app']['environment']['DATABASE_URL'].encode()).hexdigest()}
        if operation == 'migration-input':
            # Approved local DB-runner recipient only; no setup credentials live here.
            phase = request.get('phase')
            keys = {'operation', 'phase', 'executionGrant'}
            if phase == 'migrate':
                keys.update({'quiescentVersion', 'quiescentFingerprint'})
            require(set(request) == keys and phase in ['preflight', 'migrate'], 'MIGRATION_INPUT_SHAPE_REJECTED')
            grant = request['executionGrant']
            require(isinstance(grant, dict) and set(grant) in [{'version', 'purpose', 'context', 'executor', 'approver', 'approvalReference', 'expiresAt', 'operations', 'applicationDatabaseUrlSha256', 'setupSource', 'recovery', 'retry'},
                    {'version', 'purpose', 'context', 'executor', 'approver', 'approvalReference', 'expiresAt', 'operations', 'applicationDatabaseUrlSha256', 'setupSource', 'recovery', 'retry', 'managedAdminPolicy'}], 'MIGRATION_GRANT_REJECTED')
            if 'managedAdminPolicy' in grant:
                policy = grant['managedAdminPolicy']
                require(isinstance(policy, dict) and set(policy) == {'version', 'name', 'sourceProject', 'maxConnections', 'approvalReference'}
                        and type(policy['version']) is int and policy['version'] == 1 and policy['name'] == 'supabase-admin-idle-v1' and policy['sourceProject'] == 'hbkooiknruimukkhshrk'
                        and type(policy['maxConnections']) is int and policy['maxConnections'] == 2
                        and isinstance(policy['approvalReference'], str)
                        and re.fullmatch(r'(?:docs/[^\s#]+\.md(?:#[A-Za-z0-9_-]+)?|https://[^\s]+)', policy['approvalReference']), 'MANAGED_ADMIN_POLICY_REJECTED')
            require(grant['version'] == 1 and grant['purpose'] == 'hosted-schema-execution'
                    and grant['setupSource'] == {'file': '.env.audit-setup.local', 'key': 'AUDIT_SETUP_SOURCE_DATABASE_URL', 'recipient': 'scripts/aws-hosted-migrate.mjs'}
                    and grant['recovery'] == 'stop-and-inspect' and grant['retry'] is False, 'MIGRATION_RECIPIENT_REJECTED')
            require(grant['operations'] == (['preflight'] if phase == 'preflight' else ['migrate-0024', 'activate-0025', 'verify-current42']), 'MIGRATION_SCOPE_REJECTED')
            require(all(isinstance(grant[key], str) and grant[key].strip() for key in ['executor', 'approver', 'approvalReference']), 'MIGRATION_OWNER_REQUIRED')
            def unexpired():
                value = grant['expiresAt']
                require(isinstance(value, str) and re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z', value)
                        and datetime.fromisoformat(value.replace('Z', '+00:00')) > datetime.now(timezone.utc), 'MIGRATION_GRANT_EXPIRED')
            unexpired()
            context = grant['context']
            require(self.baseline is not None and self.candidate_version is None and isinstance(context, dict), 'MIGRATION_BASELINE_REQUIRED')
            require(context.get('project') == PROJECT and context.get('region') == REGION and context.get('service') == SERVICE
                    and context.get('baselineFingerprint') == self.baseline_hash and context.get('baselineVersion') == self.baseline_version, 'MIGRATION_BASELINE_CHANGED')
            if getattr(self, 'recovery', None):
                require(context.get('releaseId') == self.recovery['releaseId'] and grant['approvalReference'] == self.recovery['approvalReference']
                        and grant['expiresAt'] == self.recovery['expiresAt'] and 'managedAdminPolicy' in grant, 'RECOVERY_GRANT_CHANGED')
            app = self.baseline['containers']['app']['environment']
            worker = self.baseline['containers']['audit-worker']['environment']
            runtime = {key: env[key] for key, env in [('AUDIT_CAPTURE_DATABASE_URL', app), ('AUDIT_DATABASE_URL', worker), ('AUDIT_SOURCE_DATABASE_URL', worker), ('DATABASE_URL', app)]}
            audit = {key: app[key] for key in ['AUDIT_EXPORT_USER_IDS', 'AUDIT_PRODUCER_CONTRACT', 'AUDIT_READER_DATABASE_URL', 'AUDIT_READER_USER_IDS']}
            require(context.get('runtimeDatabaseSha256') == digest(runtime) and context.get('auditSettingsSha256') == digest(audit)
                    and grant['applicationDatabaseUrlSha256'] == hashlib.sha256(app['DATABASE_URL'].encode()).hexdigest(), 'MIGRATION_PRIVATE_BINDING_CHANGED')
            if phase == 'preflight':
                if getattr(self, 'recovery', None):
                    require(self.dispatch({'operation': 'status', 'version': self.maintenance_version})['active'], 'QUIESCENCE_CHANGED')
                else:
                    require(self.maintenance_version is None, 'MIGRATION_PREFLIGHT_BASELINE_REQUIRED')
                    live = validate_runtime(self.service())
                    require(live['baselineFingerprint'] == self.baseline_hash and live['baselineVersion'] == self.baseline_version, 'MIGRATION_BASELINE_CHANGED')
            else:
                require(self.maintenance_version is not None, 'QUIESCENCE_REQUIRED')
                status = self.dispatch({'operation': 'status', 'version': self.maintenance_version})
                require(status['active'] and request['quiescentVersion'] == status['quiescentVersion']
                        and request['quiescentFingerprint'] == status['quiescentFingerprint'], 'QUIESCENCE_CHANGED')
            unexpired()
            self.once('migration-input-' + phase)
            return {'applicationDatabaseUrl': app['DATABASE_URL']}
        if operation == 'registry-login':
            return self.lightsail.create_container_service_registry_login()['registryLogin']
        if operation == 'register':
            require(re.fullmatch('src[a-f0-9]{24}', request['label']) and re.fullmatch('sha256:[a-f0-9]{64}', request['digest']), 'IMAGE_PARAMETERS_REJECTED')
            self.once('register')
            return self.lightsail.register_container_image(serviceName=SERVICE, label=request['label'], digest=request['digest'])['containerImage']
        if operation == 'maintenance':
            require(self.baseline is not None and request['baselineFingerprint'] == self.baseline_hash, 'BASELINE_REQUIRED')
            require(validate_runtime(self.service())['baselineFingerprint'] == self.baseline_hash, 'BASELINE_CHANGED')
            self.once('maintenance')
            spec = maintenance_spec(self.baseline)
            result = self.lightsail.create_container_service_deployment(serviceName=SERVICE, **spec)['containerService']
            candidate = result.get('nextDeployment') or result['currentDeployment']
            self.maintenance_version = candidate['version']
            return {'version': self.maintenance_version}
        if operation == 'status':
            service = self.service()
            history = self.lightsail.get_container_service_deployments(serviceName=SERVICE)['deployments']
            version = request['version']
            selected = [item for item in history if item['version'] == version]
            require(len(selected) == 1, 'DEPLOYMENT_NOT_FOUND')
            candidate = selected[0]
            active = service.get('currentDeployment', {})
            exact = version == active.get('version') and active.get('state') == 'ACTIVE' and service['state'] == 'RUNNING' and not service.get('nextDeployment') and not service['isDisabled']
            result = {'version': version, 'state': candidate['state'], 'active': exact}
            if exact and version == self.maintenance_version:
                require(specification(active) == maintenance_spec(self.baseline), 'MAINTENANCE_SPEC_CHANGED')
                require(all(item['state'] == 'INACTIVE' for item in history if item['version'] != version), 'PREVIOUS_DEPLOYMENT_NOT_INACTIVE')
                result.update(quiescentVersion=version, quiescentFingerprint=fingerprint(specification(active)), quiescentVerifiedAt=datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z'), allPreviousDeploymentsInactive=True, noPendingDeployment=True, maintenanceCommandsVerified=True)
            if exact and version == self.candidate_version:
                require(specification(active) == self.candidate, 'DEPLOYED_SPEC_CHANGED')
            return result
        if operation == 'capacity-input':
            # User approved this exact pipe-only payload/recipient on 11 November.
            require(self.baseline is not None and self.maintenance_version is not None and self.candidate_version is None, 'QUIESCENCE_REQUIRED')
            status = self.dispatch({'operation': 'status', 'version': self.maintenance_version})
            require(status['active'] and request['quiescentVersion'] == status['quiescentVersion'] and request['quiescentFingerprint'] == status['quiescentFingerprint'], 'QUIESCENCE_CHANGED')
            self.once('capacity-input')
            app = self.baseline['containers']['app']['environment']
            worker = self.baseline['containers']['audit-worker']['environment']
            return {
                'connectionUrls': {'app': app['DATABASE_URL'], 'capture': app['AUDIT_CAPTURE_DATABASE_URL'], 'worker': worker['AUDIT_SOURCE_DATABASE_URL'], 'writer': worker['AUDIT_DATABASE_URL'], 'reader': app['AUDIT_READER_DATABASE_URL']},
                'auditSettings': {key: app[key] for key in ['AUDIT_EXPORT_USER_IDS', 'AUDIT_PRODUCER_CONTRACT', 'AUDIT_READER_DATABASE_URL', 'AUDIT_READER_USER_IDS']},
            }
        if operation == 'deploy':
            require(self.baseline is not None and self.maintenance_version is not None, 'MAINTENANCE_REQUIRED')
            service = self.service()
            require(not service.get('nextDeployment') and service['currentDeployment']['version'] == self.maintenance_version and service['currentDeployment']['state'] == 'ACTIVE' and specification(service['currentDeployment']) == maintenance_spec(self.baseline), 'MAINTENANCE_CHANGED')
            require(self.dispatch({'operation': 'status', 'version': self.maintenance_version})['active'], 'QUIESCENCE_REQUIRED')
            image = request['image']
            require(re.fullmatch(r':fitsmytime-staging-20261109\.src[a-f0-9]{24}\.\d+', image), 'IMAGE_REFERENCE_REJECTED')
            require(any(item['image'] == image and item['digest'] == request['digest'] for item in self.lightsail.get_container_images(serviceName=SERVICE)['containerImages']), 'IMAGE_DIGEST_CHANGED')
            self.candidate = copy.deepcopy(self.baseline)
            for value in self.candidate['containers'].values():
                value['image'] = image
            self.once('deploy')
            result = self.lightsail.create_container_service_deployment(serviceName=SERVICE, **self.candidate)['containerService']
            candidate = result.get('nextDeployment') or result['currentDeployment']
            self.candidate_version = candidate['version']
            return {'version': self.candidate_version}
        if operation == 'cloud-config':
            require(re.fullmatch('[a-zA-Z][a-zA-Z0-9-]{0,127}', request['stack']), 'STACK_NAME_REJECTED')
            stack = self.client('cloudformation').describe_stacks(StackName=request['stack'])['Stacks'][0]
            require(stack['StackId'].startswith(f'arn:aws:cloudformation:{REGION}:{PROJECT}:stack/') and stack['StackStatus'] in ['CREATE_COMPLETE', 'UPDATE_COMPLETE'], 'BUILDER_STACK_NOT_READY')
            output = {item['OutputKey']: item['OutputValue'] for item in stack['Outputs']}
            require(output.get('TargetServiceArn') == self.service()['arn'], 'BUILDER_SERVICE_ARN_CHANGED')
            self.cloud = {key: output[key] for key in ['BuildProject', 'SourceBucket', 'EncryptionKeyArn']}
            require(self.cloud['EncryptionKeyArn'].startswith(f'arn:aws:kms:{REGION}:{PROJECT}:key/'), 'BUILDER_KEY_TARGET_CHANGED')
            project = self.client('codebuild').batch_get_projects(names=[self.cloud['BuildProject']])['projects'][0]
            env = project['environment']
            variables = {item['name']: item['value'] for item in env.get('environmentVariables', [])}
            require(project['arn'].startswith(f'arn:aws:codebuild:{REGION}:{PROJECT}:project/') and project.get('concurrentBuildLimit') == 1 and project.get('autoRetryLimit', 0) == 0 and env['type'] == 'LINUX_CONTAINER' and env['computeType'] == 'BUILD_GENERAL1_SMALL' and env['image'] == 'aws/codebuild/standard:7.0' and env['privilegedMode'] is True and variables.get('TARGET_SERVICE') == SERVICE and variables.get('REGION') == REGION and project['source']['type'] == 'S3' and project['source']['location'] == self.cloud['SourceBucket'] + '/source/placeholder.zip' and project['artifacts']['type'] == 'NO_ARTIFACTS', 'BUILDER_CONTRACT_CHANGED')
            logs = project.get('logsConfig', {}).get('cloudWatchLogs', {})
            expected_buildspec = json.loads((ROOT / 'deploy/aws/publish-builder.template.json').read_text())['Resources']['BuildProject']['Properties']['Source']['BuildSpec']
            require(set(variables) == {'TARGET_SERVICE', 'REGION'} and all(item.get('type') == 'PLAINTEXT' for item in env['environmentVariables']) and project['source'].get('buildspec') == expected_buildspec and project.get('encryptionKey') == self.cloud['EncryptionKeyArn'] and project.get('timeoutInMinutes') == 30 and project.get('queuedTimeoutInMinutes') == 5, 'BUILDER_CONFIGURATION_DRIFTED')
            require(logs.get('status') == 'ENABLED' and logs.get('groupName') == f"/aws/codebuild/{request['stack']}-build", 'BUILDER_LOG_TARGET_CHANGED')
            log_groups = self.client('logs').describe_log_groups(logGroupNamePrefix=logs['groupName'])['logGroups']
            require(any(group['logGroupName'] == logs['groupName'] and group.get('kmsKeyId') == self.cloud['EncryptionKeyArn'] for group in log_groups), 'BUILDER_LOG_ENCRYPTION_CHANGED')
            s3 = self.client('s3')
            bucket = {'Bucket': self.cloud['SourceBucket'], 'ExpectedBucketOwner': PROJECT}
            block = s3.get_public_access_block(**bucket)['PublicAccessBlockConfiguration']
            require(all(block.get(key) is True for key in ['BlockPublicAcls', 'IgnorePublicAcls', 'BlockPublicPolicy', 'RestrictPublicBuckets']) and s3.get_bucket_versioning(**bucket).get('Status') == 'Enabled', 'SOURCE_BUCKET_PROTECTION_CHANGED')
            return {'buildProject': self.cloud['BuildProject']}
        if operation == 'cloud-start':
            require(self.cloud is not None, 'BUILDER_CONFIG_REQUIRED')
            snapshot = snapshot_path(request['snapshot'])
            manifest = json.loads((snapshot / 'manifest.json').read_text())
            require(manifest['sha256'] == request['sourceManifestSha256'], 'SOURCE_MANIFEST_CHANGED')
            archive = snapshot / 'source.zip'
            with zipfile.ZipFile(archive, 'x', compression=zipfile.ZIP_DEFLATED) as output:
                for item in manifest['files']:
                    source = (snapshot / 'context' / item['path']).resolve()
                    require(source.is_relative_to(snapshot / 'context') and not source.is_symlink() and hashlib.sha256(source.read_bytes()).hexdigest() == item['sha256'], 'SNAPSHOT_CHANGED')
                    output.write(source, item['path'])
                output.writestr('publish-source-manifest.json', json.dumps(manifest))
            self.once('cloud-start')
            key = f"source/{request['releaseId']}.zip"
            require(re.fullmatch(r'source/[a-zA-Z0-9-]{1,80}\.zip', key), 'SOURCE_KEY_REJECTED')
            s3 = self.client('s3')
            # put_object is deliberately single-part/single-attempt (no transfer retries).
            with archive.open('rb') as source:
                upload = s3.put_object(Bucket=self.cloud['SourceBucket'], Key=key, Body=source, ServerSideEncryption='aws:kms', SSEKMSKeyId=self.cloud['EncryptionKeyArn'], ExpectedBucketOwner=PROJECT)
            require(isinstance(upload.get('VersionId'), str), 'VERSIONED_SOURCE_REQUIRED')
            result = self.client('codebuild').start_build(projectName=self.cloud['BuildProject'], sourceTypeOverride='S3', sourceLocationOverride=f"{self.cloud['SourceBucket']}/{key}", sourceVersion=upload['VersionId'], environmentVariablesOverride=[{'name': key, 'value': value, 'type': 'PLAINTEXT'} for key, value in {'SOURCE_MANIFEST_SHA256': request['sourceManifestSha256'], 'IMAGE_LABEL': request['label']}.items()], idempotencyToken=request['releaseId'])
            self.build_id = result['build']['id']
            self.build_label = request['label']
            return {'id': self.build_id}
        if operation == 'cloud-status':
            require(request['id'] == self.build_id, 'BUILD_ID_CHANGED')
            build = self.client('codebuild').batch_get_builds(ids=[self.build_id])['builds'][0]
            result = {'id': self.build_id, 'state': build['buildStatus']}
            if result['state'] == 'SUCCEEDED':
                prefix = f':{SERVICE}.{self.build_label}.'
                images = [item for item in self.lightsail.get_container_images(serviceName=SERVICE)['containerImages'] if item['image'].startswith(prefix)]
                require(len(images) == 1, 'UNIQUE_CLOUD_IMAGE_REQUIRED')
                result['image'] = images[0]['image']
                result['digest'] = images[0]['digest']
            return result
        raise ValueError('OPERATION_REJECTED')


def main():
    session = None
    for line in sys.stdin:
        try:
            request = json.loads(line)
            if session is None:
                session = Session()
            result = session.dispatch(request)
            print(json.dumps({'ok': True, 'result': result}, default=str), flush=True)
        except Exception as error:
            # Raw SDK and validation payloads may contain credentials; emit code only.
            code = str(error)
            if not re.fullmatch('[A-Z_]+', code):
                code = getattr(error, 'response', {}).get('Error', {}).get('Code', type(error).__name__)
            print(json.dumps({'ok': False, 'error': code if re.fullmatch('[A-Za-z0-9_]+', code) else 'AWS_OPERATION_FAILED', 'retryPerformed': False}), flush=True)
            return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
