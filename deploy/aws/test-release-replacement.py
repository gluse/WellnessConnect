"""Synthetic release safety checks; no private files, database or AWS access."""
import copy
from datetime import datetime, timezone, timedelta
import importlib.util
from pathlib import Path
import unittest

loader = importlib.util.spec_from_file_location('replacement', Path(__file__).with_name('release-replacement.py'))
release = importlib.util.module_from_spec(loader)
loader.loader.exec_module(release)


def receipt():
    return {'authorization': release.CAPACITY, 'passed': True, 'state': 'passed', 'allConnectionsClosed': True,
        'capacityOnly': True, 'writes': False, 'claims': False, 'retry': False,
        'newService': release.NEW, 'oldServiceAbsent': True, 'newServiceReadyEmpty': True, 'deleteFirstAuthorized': True,
        'environmentAuditPassed': True, 'checkpointSha256': 'ef020e3668689fa5388992a5944cc667d00ec3297207880cd42ece0a330bf5c6',
        'sourceManifestSha256': 'manifest', 'runtimeDatabaseSha256': 'database', 'auditSettingsSha256': 'audit',
        'completedAt': datetime.now(timezone.utc).isoformat(),
        'roles': [{'kind': kind, 'passed': True, 'tlsVerified': True, 'readOnly': True, 'otherConnections': 0, 'connectionLimit': cap}
            for kind, cap in [('app', 5), ('capture', 2), ('worker', 2), ('writer', 2), ('reader', 2)]]}


class ReplacementTests(unittest.TestCase):
    def test_capacity_rejects_stale_wrong_target_or_unsafe_roles(self):
        value = {'sourceManifestSha256': 'manifest', 'runtimeDatabaseSha256': 'database', 'auditSettingsSha256': 'audit'}
        release.validate_capacity(receipt(), value)
        for key, invalid in [('authorization', 'consumed-token'), ('writes', True), ('claims', True), ('retry', True),
            ('allConnectionsClosed', False), ('newService', 'other'), ('oldServiceAbsent', False), ('checkpointSha256', 'other'),
            ('runtimeDatabaseSha256', 'other'), ('auditSettingsSha256', 'other'),
            ('sourceManifestSha256', 'other'), ('completedAt', (datetime.now(timezone.utc) - timedelta(minutes=16)).isoformat())]:
            altered = receipt(); altered[key] = invalid
            with self.subTest(key=key), self.assertRaises(ValueError):
                release.validate_capacity(altered, value)
        for key, invalid in [('tlsVerified', False), ('readOnly', False), ('otherConnections', 1), ('otherConnections', False), ('connectionLimit', 99)]:
            altered = receipt(); altered['roles'][0][key] = invalid
            with self.subTest(key=key), self.assertRaises(ValueError):
                release.validate_capacity(altered, value)
        for roles in [receipt()['roles'][:-1], receipt()['roles'][:-1] + [receipt()['roles'][0]]]:
            altered = receipt(); altered['roles'] = roles
            with self.assertRaises(ValueError):
                release.validate_capacity(altered, value)

    def test_complete_deployment_preserves_secrets_holds_commands_and_endpoint(self):
        value = {'spec': {'containers': {
            'app': {'image': 'old-app', 'command': ['node', 'dist/index.js'], 'environment': {'APP_URL': 'https://old.example', 'DATABASE_URL': 'synthetic-app', 'SESSION_SECRET': 'synthetic-session', 'NOTIFICATIONS_ENABLED': 'false', 'PRODUCT_ACTIVITY_ENABLED': 'false', 'AUDIT_AUTH_EVENTS_ENABLED': 'false', 'GOOGLE_MAPS_API_KEY': 'synthetic-map'}, 'ports': {'5000': 'HTTP'}},
            'audit-worker': {'image': 'old-worker', 'command': ['node', 'dist/audit-worker.js'], 'environment': {'AUDIT_DATABASE_URL': 'synthetic-writer', 'AUDIT_WORKER_ENABLED': 'true'}},
            'gateway': {'image': 'old-gateway', 'command': ['node', 'staging-proxy.mjs'], 'environment': {'STAGING_ORIGIN': 'https://old.example', 'STAGING_PASSWORD_SHA256': 'synthetic-verifier', 'STAGING_SESSION_SECRET': 'synthetic-signer'}, 'ports': {'8080': 'HTTP'}}},
            'publicEndpoint': {'containerName': 'gateway', 'containerPort': 8080, 'healthCheck': {'path': '/health/ready'}}},
            'auditSettings': {'AUDIT_READER_DATABASE_URL': 'synthetic-reader', 'AUDIT_READER_USER_IDS': 'synthetic-user', 'AUDIT_EXPORT_USER_IDS': 'synthetic-user', 'AUDIT_PRODUCER_CONTRACT': 'completion-0008'}}
        original = copy.deepcopy(value)
        origin = 'https://fitsmytime-staging-20261109.abc.eu-north-1.cs.amazonlightsail.com'
        candidate = release.deployment_spec(value, ':fitsmytime-staging-20261109.app.4', origin)
        self.assertEqual(value, original)
        expected = copy.deepcopy(value['spec'])
        for container in expected['containers'].values(): container['image'] = ':fitsmytime-staging-20261109.app.4'
        expected['containers']['app']['environment'].update(value['auditSettings'], APP_URL=origin)
        expected['containers']['gateway']['environment']['STAGING_ORIGIN'] = origin
        self.assertEqual(candidate, expected)
        self.assertNotIn('AUDIT_READER_DATABASE_URL', candidate['containers']['audit-worker']['environment'])
        for image, target in [('old-app', origin), (':other.app.4', origin), (':fitsmytime-staging-20261109.app.4', 'http://unapproved.example')]:
            with self.assertRaises(ValueError): release.deployment_spec(value, image, target)


if __name__ == '__main__':
    unittest.main()
