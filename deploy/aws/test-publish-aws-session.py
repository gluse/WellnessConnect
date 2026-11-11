"""Offline boundary tests. No boto3 import, private files, network or databases."""
import copy
import importlib.util
from pathlib import Path
import re
import unittest

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


if __name__ == '__main__':
    unittest.main()
