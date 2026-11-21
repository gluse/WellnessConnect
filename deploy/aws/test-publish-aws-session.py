"""Offline boundary tests. No boto3 import, private files, network or databases."""
import copy
import importlib.util
from pathlib import Path
import re
import unittest
from datetime import datetime, timedelta, timezone

loader = importlib.util.spec_from_file_location('publish_session', Path(__file__).with_name('publish-aws-session.py'))
module = importlib.util.module_from_spec(loader)
loader.loader.exec_module(module)


def baseline():
    origin = 'https://fixture.eu-north-1.cs.amazonlightsail.com'
    app = dict(NODE_ENV='production', PORT='5000', APP_URL=origin, SUPABASE_URL='https://hbkooiknruimukkhshrk.supabase.co',
        DATABASE_URL='fixture', AUDIT_CAPTURE_DATABASE_URL='fixture', SUPABASE_PUBLISHABLE_KEY='fixture', SUPABASE_SECRET_KEY='fixture', SESSION_SECRET='x' * 32,
        OPENAI_API_KEY='fixture', SUPABASE_STORAGE_BUCKET='fixture', AUDIT_ENABLED='true', AUDIT_WORKER_ENABLED='false', AUDIT_ENVIRONMENT='development',
        AUDIT_SERVICE_VIEWS_ENABLED='true', AUDIT_AUTH_EVENTS_ENABLED='false', AUDIT_PRODUCER_CONTRACT='completion-0008', AUDIT_EXPORT_USER_IDS='', AUDIT_READER_USER_IDS='', AUDIT_READER_DATABASE_URL='fixture',
        NOTIFICATIONS_ENABLED='false', NOTIFICATIONS_AUTOMATION_ENABLED='false', NOTIFICATIONS_VERIFICATION_ENABLED='false', PRODUCT_ACTIVITY_ENABLED='false')
    worker = dict(NODE_ENV='production', AUDIT_WORKER_ENABLED='true', AUDIT_ENVIRONMENT='development', AUDIT_SERVICE_VIEWS_ENABLED='true', AUDIT_AUTH_EVENTS_ENABLED='false', AUDIT_DATABASE_URL='fixture', AUDIT_SOURCE_DATABASE_URL='fixture')
    gateway = dict(NODE_ENV='production', STAGING_ORIGIN=origin, STAGING_PASSWORD_SHA256='a' * 64, STAGING_SESSION_SECRET='b' * 64)
    commands = {'app': ['node', 'dist/index.js'], 'audit-worker': ['node', 'dist/audit-worker.js'], 'gateway': ['node', 'staging-proxy.mjs']}
    containers = {name: {'command': commands[name], 'environment': env, 'image': ':fixture'} for name, env in [('app', app), ('audit-worker', worker), ('gateway', gateway)]}
    return dict(arn='arn:aws:lightsail:eu-north-1:674200807170:ContainerService/fixture', containerServiceName=module.SERVICE, power='micro', scale=1, state='RUNNING', isDisabled=False, url=origin,
        currentDeployment={'state': 'ACTIVE', 'version': 1, 'containers': containers, 'publicEndpoint': {'containerName': 'gateway', 'containerPort': 8080, 'healthCheck': {'path': '/health/ready'}}})


class ContractTests(unittest.TestCase):
    def recovery_session(self):
        original = baseline()
        context = {'releaseId': '00000000-0000-4000-8000-000000000001', 'project': module.PROJECT, 'region': module.REGION, 'service': module.SERVICE,
            'sourceManifestSha256': 'a' * 64, 'image': ':' + module.SERVICE + '.src' + 'e' * 24 + '.5', 'digest': 'sha256:' + 'f' * 64,
            **module.validate_runtime(original)}
        historical = copy.deepcopy(original['currentDeployment']); historical['state'] = 'INACTIVE'
        current = copy.deepcopy(original)
        current['currentDeployment'] = {**module.maintenance_spec(module.specification(historical)), 'version': 2, 'state': 'ACTIVE'}
        history = [historical, current['currentDeployment']]
        session = module.Session.__new__(module.Session)
        session.baseline = None; session.candidate_version = None; session.maintenance_version = None
        session.recovery = None; session.mutations = set(); session.service = lambda: current
        class Client:
            def get_container_service_deployments(self, **unused):
                return {'deployments': history}
        session.lightsail = Client()
        request = {'operation': 'inspect-maintenance-recovery', 'originalContext': context, 'maintenanceVersion': 2,
            'maintenanceFingerprint': module.fingerprint(module.specification(current['currentDeployment'])),
            'recoveryId': '00000000-0000-4000-8000-000000000002', 'approvalReference': 'docs/recovery.md#approved',
            'expiresAt': (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(timespec='milliseconds').replace('+00:00', 'Z')}
        return session, request, current, history

    def test_recovery_reconstructs_exact_historical_baseline_without_mutation(self):
        session, request, current, history = self.recovery_session()
        before = copy.deepcopy(current)
        result = session.dispatch(request)
        self.assertEqual(result['baselineFingerprint'], request['originalContext']['baselineFingerprint'])
        self.assertEqual(session.baseline_version, 1); self.assertEqual(session.maintenance_version, 2)
        self.assertEqual(current, before)
        self.assertEqual(session.dispatch({'operation': 'migration-binding', 'baselineFingerprint': result['baselineFingerprint'], 'baselineVersion': 1}),
            {'applicationDatabaseUrlSha256': module.hashlib.sha256(b'fixture').hexdigest()})
        with self.assertRaises(ValueError):
            session.dispatch(request)

    def test_recovery_rejects_history_spec_origin_and_state_drift(self):
        for fault in ['missing-history', 'active-history', 'other-active', 'runtime-hash', 'private-environment', 'pending', 'wrong-version', 'wrong-fingerprint', 'expired', 'same-id']:
            with self.subTest(fault=fault):
                session, request, current, history = self.recovery_session()
                if fault == 'missing-history': history.pop(0)
                if fault == 'active-history': history[0]['state'] = 'ACTIVE'
                if fault == 'other-active': history.append({'version': 3, 'state': 'ACTIVE'})
                if fault == 'runtime-hash': request['originalContext']['runtimeDatabaseSha256'] = '0' * 64
                if fault == 'private-environment': current['currentDeployment']['containers']['app']['environment']['DATABASE_URL'] = 'changed-private'
                if fault == 'pending': current['nextDeployment'] = {'version': 3}
                if fault == 'wrong-version': current['currentDeployment']['version'] = 3
                if fault == 'wrong-fingerprint': request['maintenanceFingerprint'] = '0' * 64
                if fault == 'expired': request['expiresAt'] = '2020-01-01T00:00:00.000Z'
                if fault == 'same-id': request['recoveryId'] = request['originalContext']['releaseId']
                with self.assertRaises(ValueError): session.dispatch(request)
                self.assertIsNone(session.baseline)

    def test_recovery_preflight_transfer_bound_to_new_approval_and_managed_policy(self):
        for fault in [None, 'wrong-id', 'wrong-approval', 'wrong-expiry', 'missing-policy', 'broad-policy', 'extra-policy', 'bool-version', 'unlinked-policy-ref', 'changed-maintenance']:
            with self.subTest(fault=fault):
                session, request, current, history = self.recovery_session()
                session.dispatch(request)
                _, input_request = self.migration_session('preflight')
                grant = input_request['executionGrant']
                grant.update(context={**request['originalContext'], 'releaseId': request['recoveryId']},
                    approvalReference=request['approvalReference'], expiresAt=request['expiresAt'],
                    managedAdminPolicy={'version': 1, 'name': 'supabase-admin-idle-v1', 'sourceProject': 'hbkooiknruimukkhshrk',
                        'maxConnections': 2, 'approvalReference': 'docs/recovery.md#selected-policy'})
                if fault == 'wrong-id': grant['context']['releaseId'] = 'other'
                if fault == 'wrong-approval': grant['approvalReference'] = 'other'
                if fault == 'wrong-expiry': grant['expiresAt'] = '2099-01-01T00:00:00.000Z'
                if fault == 'missing-policy': grant.pop('managedAdminPolicy')
                if fault == 'broad-policy': grant['managedAdminPolicy']['maxConnections'] = 3
                if fault == 'extra-policy': grant['managedAdminPolicy']['skip'] = True
                if fault == 'bool-version': grant['managedAdminPolicy']['version'] = True
                if fault == 'unlinked-policy-ref': grant['managedAdminPolicy']['approvalReference'] = 'docs/not-a-document'
                if fault == 'changed-maintenance': current['currentDeployment']['containers']['app']['command'] = ['unsafe']
                if fault:
                    with self.assertRaises(ValueError): session.dispatch(input_request)
                else:
                    self.assertEqual(session.dispatch(input_request), {'applicationDatabaseUrl': 'fixture'})
                    with self.assertRaises(ValueError): session.dispatch(input_request)

    def test_published_image_inspection_is_exact_and_read_only(self):
        image = ':fitsmytime-staging-20261109.src' + 'a' * 24 + '.5'
        digest = 'sha256:' + 'b' * 64
        class Client:
            def get_container_images(self, **parameters):
                self.parameters = parameters
                return {'containerImages': [{'image': image, 'digest': digest}]}
        session = module.Session.__new__(module.Session)
        session.lightsail = Client()
        self.assertEqual(session.dispatch({'operation': 'inspect-published-image', 'image': image, 'digest': digest}),
            {'image': image, 'digest': digest, 'registered': True})
        self.assertEqual(session.lightsail.parameters, {'serviceName': module.SERVICE})
        for request in [dict(operation='inspect-published-image', image=image, digest='sha256:' + 'c' * 64),
                dict(operation='inspect-published-image', image=image + '.0', digest=digest),
                dict(operation='inspect-published-image', image=image, digest=digest, private='extra')]:
            with self.assertRaises(ValueError):
                session.dispatch(request)

    def test_build_only_inspection_never_reads_or_retains_environment(self):
        class PrivateEnvironment(dict):
            def __getitem__(self, key):
                raise AssertionError('build-only inspection must not read environment values')
            def get(self, *unused):
                raise AssertionError('build-only inspection must not read environment values')
        service = baseline()
        for container in service['currentDeployment']['containers'].values():
            container['environment'] = PrivateEnvironment()
        session = module.Session.__new__(module.Session)
        session.baseline = None
        session.maintenance_version = None
        session.candidate_version = None
        session.service = lambda: service
        result = session.dispatch({'operation': 'inspect-build-target'})
        self.assertEqual(result, {'serviceArn': service['arn'], 'baselineVersion': 1, 'origin': service['url']})
        self.assertIsNone(session.baseline)
        with self.assertRaisesRegex(ValueError, 'BASELINE_REQUIRED'):
            session.dispatch({'operation': 'maintenance', 'baselineFingerprint': 'fixture'})

    def test_build_only_public_target_drift_rejects(self):
        for key, value in [('arn', 'arn:aws:lightsail:eu-west-1:674200807170:ContainerService/fixture'),
                ('containerServiceName', 'other'), ('power', 'large'), ('scale', 2), ('isDisabled', True), ('nextDeployment', {'version': 2})]:
            with self.subTest(field=key):
                service = baseline(); service[key] = value
                with self.assertRaises(ValueError):
                    module.validate_build_target(service)

    def test_inspection_filters_all_environment_values(self):
        result = module.validate_runtime(baseline())
        self.assertEqual(set(result), {'baselineFingerprint', 'baselineVersion', 'runtimeDatabaseSha256', 'auditSettingsSha256', 'origin'})

    def test_runtime_drift_fails_closed(self):
        cases = [('scale', 2), ('state', 'DISABLED'), ('isDisabled', True), ('containerServiceName', 'other')]
        for key, value in cases:
            with self.subTest(key=key):
                service = baseline()
                service[key] = value
                with self.assertRaises(ValueError):
                    module.validate_runtime(service)

    def test_environment_drift_fails_closed(self):
        for key, value in [('AUDIT_ENABLED', 'false'), ('SESSION_SECRET', 'short'), ('PORT', '3000'), ('AUDIT_RUNTIME_PROFILE', 'local-docker'), ('NOTIFICATIONS_ENABLED', 'true'), ('PGBINARY', '1'), ('AUDIT_PRODUCER_CONTRACT', 'other'), ('OPENAI_API_KEY', '')]:
            with self.subTest(key=key):
                service = baseline()
                service['currentDeployment']['containers']['app']['environment'][key] = value
                with self.assertRaises(ValueError):
                    module.validate_runtime(service)

    def test_maintenance_changes_only_commands_without_database_imports(self):
        original = module.specification(baseline()['currentDeployment'])
        frozen = copy.deepcopy(original)
        maintenance = module.maintenance_spec(original)
        self.assertEqual(original, frozen)
        for name in original['containers']:
            self.assertEqual(maintenance['containers'][name]['environment'], original['containers'][name]['environment'])
            self.assertEqual(maintenance['containers'][name]['image'], original['containers'][name]['image'])
        self.assertEqual(maintenance['containers']['app']['command'], module.IDLE)
        self.assertEqual(maintenance['containers']['audit-worker']['command'], module.IDLE)
        self.assertNotIn('dist/', str(maintenance['containers']['gateway']['command']))

    def test_actual_python_status_timestamp_matches_db_receipt_contract(self):
        session = module.Session.__new__(module.Session)
        session.baseline = module.specification(baseline()['currentDeployment'])
        session.maintenance_version = 2
        session.candidate_version = None
        service = baseline()
        service['currentDeployment'].update(module.maintenance_spec(session.baseline), version=2)
        session.service = lambda: service
        class FakeLightsail:
            def get_container_service_deployments(self, **unused):
                return {'deployments': [service['currentDeployment'], {'version': 1, 'state': 'INACTIVE'}]}
        session.lightsail = FakeLightsail()
        result = session.dispatch({'operation': 'status', 'version': 2})
        self.assertTrue(result['active'])
        self.assertRegex(result['quiescentVerifiedAt'], r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$')

    def test_unknown_operation_and_duplicate_mutation_reject(self):
        session = module.Session.__new__(module.Session)
        session.mutations = set()
        session.once('deploy')
        with self.assertRaisesRegex(ValueError, 'OPERATION_ALREADY_ATTEMPTED'):
            session.once('deploy')
        with self.assertRaisesRegex(ValueError, 'OPERATION_REJECTED'):
            session.dispatch({'operation': 'delete'})

    def capacity_session(self):
        session = module.Session.__new__(module.Session)
        session.baseline = module.specification(baseline()['currentDeployment'])
        session.maintenance_version = 2
        session.candidate_version = None
        session.mutations = set()
        service = baseline()
        service['currentDeployment'].update(module.maintenance_spec(session.baseline), version=2)
        session.service = lambda: service
        class FakeLightsail:
            def get_container_service_deployments(self, **unused):
                return {'deployments': [service['currentDeployment'], {'version': 1, 'state': 'INACTIVE'}]}
        session.lightsail = FakeLightsail()
        return session

    def test_private_capacity_payload_exact_shape_single_use(self):
        session = self.capacity_session()
        request = {'operation': 'capacity-input', 'quiescentVersion': 2, 'quiescentFingerprint': module.fingerprint(module.maintenance_spec(session.baseline))}
        original = copy.deepcopy(session.baseline)
        result = session.dispatch(request)
        self.assertEqual(set(result), {'connectionUrls', 'auditSettings'})
        self.assertEqual(set(result['connectionUrls']), {'app', 'capture', 'worker', 'writer', 'reader'})
        self.assertEqual(list(result['auditSettings']), ['AUDIT_EXPORT_USER_IDS', 'AUDIT_PRODUCER_CONTRACT', 'AUDIT_READER_DATABASE_URL', 'AUDIT_READER_USER_IDS'])
        self.assertEqual(session.baseline, original)
        self.assertNotIn('SESSION_SECRET', str(result))
        with self.assertRaisesRegex(ValueError, 'OPERATION_ALREADY_ATTEMPTED'):
            session.dispatch(request)

    def test_private_payload_rejects_wrong_or_missing_maintenance(self):
        session = self.capacity_session()
        request = {'operation': 'capacity-input', 'quiescentVersion': 2, 'quiescentFingerprint': 'f' * 64}
        with self.assertRaisesRegex(ValueError, 'QUIESCENCE_CHANGED'):
            session.dispatch(request)
        self.assertNotIn('capacity-input', session.mutations)
        session.maintenance_version = None
        with self.assertRaisesRegex(ValueError, 'QUIESCENCE_REQUIRED'):
            session.dispatch(request)

    def test_private_payload_rejects_candidate_started_or_config_changed(self):
        session = self.capacity_session()
        request = {'operation': 'capacity-input', 'quiescentVersion': 2, 'quiescentFingerprint': module.fingerprint(module.maintenance_spec(session.baseline))}
        session.candidate_version = 3
        with self.assertRaisesRegex(ValueError, 'QUIESCENCE_REQUIRED'):
            session.dispatch(request)
        session.candidate_version = None
        service = session.service()
        service['currentDeployment']['containers']['app']['command'] = ['node', 'dist/index.js']
        session.service = lambda: service
        with self.assertRaisesRegex(ValueError, 'MAINTENANCE_SPEC_CHANGED'):
            session.dispatch(request)

    def migration_session(self, phase):
        original = baseline()
        context = {'releaseId': 'synthetic-migration', 'project': module.PROJECT, 'region': module.REGION, 'service': module.SERVICE,
            'sourceManifestSha256': 'a' * 64, 'image': ':' + module.SERVICE + '.src' + 'e' * 24 + '.1', 'digest': 'sha256:' + 'f' * 64,
            **module.validate_runtime(original)}
        grant = {'version': 1, 'purpose': 'hosted-schema-execution', 'context': context, 'executor': '/root/db-fixture', 'approver': 'synthetic-user',
            'approvalReference': 'synthetic-approved-input', 'expiresAt': (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(timespec='milliseconds').replace('+00:00', 'Z'),
            'operations': ['preflight'] if phase == 'preflight' else ['migrate-0024', 'activate-0025', 'verify-current42'],
            'applicationDatabaseUrlSha256': module.hashlib.sha256(b'fixture').hexdigest(),
            'setupSource': {'file': '.env.audit-setup.local', 'key': 'AUDIT_SETUP_SOURCE_DATABASE_URL', 'recipient': 'scripts/aws-hosted-migrate.mjs'},
            'recovery': 'stop-and-inspect', 'retry': False}
        session = self.capacity_session() if phase == 'migrate' else module.Session.__new__(module.Session)
        session.baseline = module.specification(original['currentDeployment'])
        session.baseline_hash = context['baselineFingerprint']
        session.baseline_version = 1
        session.candidate_version = None
        if phase == 'preflight':
            session.maintenance_version = None
            session.mutations = set()
            session.service = lambda: original
        request = {'operation': 'migration-input', 'phase': phase, 'executionGrant': grant}
        if phase == 'migrate':
            request.update(quiescentVersion=2, quiescentFingerprint=module.fingerprint(module.maintenance_spec(session.baseline)))
        return session, request

    def test_migration_input_exact_recipient_and_single_use_both_phases(self):
        for phase in ['preflight', 'migrate']:
            with self.subTest(phase=phase):
                session, request = self.migration_session(phase)
                original = copy.deepcopy(session.baseline)
                self.assertEqual(session.dispatch(request), {'applicationDatabaseUrl': 'fixture'})
                self.assertEqual(session.baseline, original)
                with self.assertRaisesRegex(ValueError, 'OPERATION_ALREADY_ATTEMPTED'):
                    session.dispatch(request)

    def test_public_migration_binding_prepares_grant_without_url_transfer(self):
        session, unused = self.migration_session('preflight')
        request = {'operation': 'migration-binding', 'baselineFingerprint': session.baseline_hash, 'baselineVersion': 1}
        result = session.dispatch(request)
        self.assertEqual(result, {'applicationDatabaseUrlSha256': module.hashlib.sha256(b'fixture').hexdigest()})
        with self.assertRaisesRegex(ValueError, 'OPERATION_ALREADY_ATTEMPTED'):
            session.dispatch(request)
        session, unused = self.migration_session('preflight')
        request['baselineVersion'] = 2
        with self.assertRaisesRegex(ValueError, 'MIGRATION_BASELINE_CHANGED'):
            session.dispatch(request)
        self.assertEqual(session.mutations, set())

    def test_migration_input_wrong_scope_payload_binding_and_expiry_reject(self):
        mutations = [lambda r: r.update(extra='fixture-private'),
            lambda r: r['executionGrant']['setupSource'].update(recipient='other.mjs'),
            lambda r: r['executionGrant']['setupSource'].update(key='AUDIT_SETUP_DESTINATION_DATABASE_URL'),
            lambda r: r['executionGrant'].update(operations=['other']),
            lambda r: r['executionGrant'].update(expiresAt='2000-01-01T00:00:00.000Z'),
            lambda r: r['executionGrant'].update(applicationDatabaseUrlSha256='0' * 64),
            lambda r: r['executionGrant']['context'].update(baselineFingerprint='0' * 64),
            lambda r: r['executionGrant']['context'].update(baselineVersion=2),
            lambda r: r['executionGrant']['context'].update(runtimeDatabaseSha256='0' * 64),
            lambda r: r['executionGrant']['context'].update(auditSettingsSha256='0' * 64),
            lambda r: r['executionGrant']['context'].update(project='other'),
            lambda r: r['executionGrant']['context'].update(region='other')]
        for phase in ['preflight', 'migrate']:
            for index, mutate in enumerate(mutations):
                with self.subTest(phase=phase, mutation=index):
                    session, request = self.migration_session(phase)
                    mutate(request)
                    with self.assertRaises(ValueError):
                        session.dispatch(request)
                    self.assertEqual(session.mutations, set())

    def test_migration_input_checks_actual_live_state_and_expiry_after_read(self):
        for phase in ['preflight', 'migrate']:
            session, request = self.migration_session(phase)
            original_service = session.service
            def expire():
                request['executionGrant']['expiresAt'] = '2000-01-01T00:00:00.000Z'
                return original_service()
            session.service = expire
            with self.assertRaisesRegex(ValueError, 'MIGRATION_GRANT_EXPIRED'):
                session.dispatch(request)
            self.assertEqual(session.mutations, set())
        session, request = self.migration_session('preflight')
        session.maintenance_version = 2
        with self.assertRaisesRegex(ValueError, 'MIGRATION_PREFLIGHT_BASELINE_REQUIRED'):
            session.dispatch(request)
        session, request = self.migration_session('migrate')
        request['quiescentFingerprint'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'QUIESCENCE_CHANGED'):
            session.dispatch(request)
        session, request = self.migration_session('migrate')
        session.candidate_version = 3
        with self.assertRaisesRegex(ValueError, 'MIGRATION_BASELINE_REQUIRED'):
            session.dispatch(request)


if __name__ == '__main__':
    unittest.main()
