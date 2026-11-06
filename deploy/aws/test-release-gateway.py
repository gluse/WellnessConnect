"""Offline release-receipt guards. No private inputs, clients or service calls."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch
from contextlib import redirect_stderr
from io import StringIO
from tempfile import TemporaryDirectory
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location('gateway_release', Path(__file__).with_name('release-gateway.py'))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)

def receipt():
    values = []
    for role, limit in [('app',5), ('capture',2), ('worker',2), ('writer',2)]:
        values.append({'stage':'capacity', 'kind':role, 'otherConnectionsAtSnapshot':0})
        values.append({'stage':role, 'passed':True, 'tlsVerified':True, 'readOnly':True, 'connectionLimit':limit, 'otherConnectionsAtSnapshot':0})
    values.append({'stage':'complete', 'passed':True, 'capacityOnly':True, 'allConnectionsClosed':True, 'writes':False, 'claims':False, 'capacityAuthorization':'TASK-036-REFERRER-MANUAL-FLAGS-2026-11-06'})
    return values

class ReleaseReceiptTests(unittest.TestCase):
    def validate(self, values):
        release.validate_manual_capacity('\n'.join(json.dumps(value) for value in values), 0)

    def test_exact_reviewed_four_role_receipt(self):
        self.validate(receipt())

    def test_stale_authorization_missing_role_and_duplicate_completion(self):
        stale = receipt(); stale[-1]['capacityAuthorization'] = 'consumed-token'
        for invalid in [stale, receipt()[1:], receipt() + [receipt()[-1]]]:
            with self.subTest(case=invalid), self.assertRaises(ValueError):
                self.validate(invalid)

    def test_nonzero_connections_tls_caps_and_mutation_flags(self):
        for index, field, value in [(0,'otherConnectionsAtSnapshot',1), (0,'otherConnectionsAtSnapshot',False), (1,'tlsVerified',False), (1,'readOnly',False), (1,'connectionLimit',99), (-1,'writes',True), (-1,'claims',True), (-1,'allConnectionsClosed',False)]:
            invalid = copy.deepcopy(receipt()); invalid[index][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                self.validate(invalid)

    def test_failed_process_and_malformed_output(self):
        with self.assertRaises(ValueError):
            release.validate_manual_capacity('', 1)
        with self.assertRaises(ValueError):
            release.validate_manual_capacity('not-json', 0)

    def test_manual_capacity_without_user_flag_stops_before_clients(self):
        diagnostic = StringIO()
        with patch('sys.argv', ['release-gateway.py', 'not-a-snapshot', 'manual-capacity']), patch.object(release.boto3, 'Session') as session, redirect_stderr(diagnostic):
            self.assertEqual(release.main(), 1)
            session.assert_not_called()
        self.assertIn('MANUAL_USER_CONFIRMATION_REQUIRED', diagnostic.getvalue())

    def test_full_manual_mode_launches_once_and_blocks_second_attempt(self):
        temporary_base = Path(__file__).resolve().parents[2] / 'outputs/aws-staging-build'
        with TemporaryDirectory(prefix='gateway-release-test-', dir=temporary_base) as folder:
            root = Path(folder).resolve()
            self.assertTrue(root.is_relative_to(temporary_base.resolve()))
            self.assertTrue(root.name.startswith('gateway-release-test-'))
            snapshot = root / 'outputs/aws-staging-build/source-gateway-mock'
            snapshot.mkdir(parents=True)
            (root / '.env.aws-staging.local').write_text('NOTIFICATIONS_ENABLED=false\n')
            original = {'version':5, 'state':'INACTIVE', 'containers':{name:{'image':':fitsmytime-staging.app.1', 'command':['node','original'], 'environment':{}} for name in ['app','gateway','audit-worker']}, 'publicEndpoint':{'containerName':'gateway','containerPort':8080}}
            maintenance = {**original, 'version':6, 'state':'ACTIVE', 'containers':release.maintenance_spec(original)}
            service = {'power':'micro', 'scale':1, 'state':'RUNNING', 'isDisabled':False, 'currentDeployment':maintenance}
            (snapshot / 'gateway-release-baseline.json').write_text(json.dumps({'version':5,'fingerprint':release.fingerprint(original)}))
            (snapshot / 'maintenance-result.json').write_text(json.dumps({'version':6}))
            (snapshot / 'maintenance-ready.json').write_text(json.dumps({'maintenanceVersion':6,'checkedAt':(datetime.now(timezone.utc)-timedelta(seconds=60)).isoformat()}))
            sts = SimpleNamespace(get_caller_identity=lambda:{'Account':'674200807170'})
            lightsail = SimpleNamespace(get_container_services=lambda **kwargs:{'containerServices':[service]}, get_container_service_deployments=lambda **kwargs:{'deployments':[original,maintenance]})
            session = SimpleNamespace(client=lambda name, **kwargs:sts if name == 'sts' else lightsail)
            checked = SimpleNamespace(returncode=0, stdout='\n'.join(json.dumps(value) for value in receipt()))
            with patch.object(release,'ROOT',root), patch.object(release.boto3,'Session',return_value=session), patch.object(release.subprocess,'run',return_value=checked) as child, patch('sys.argv',['release-gateway.py',str(snapshot),'manual-capacity','--manual-user-run']), patch('sys.stdout',new_callable=StringIO), patch('sys.stderr',new_callable=StringIO) as diagnostic:
                self.assertEqual(release.main(),0,diagnostic.getvalue())
                child.assert_called_once()
                self.assertTrue(json.loads((snapshot / 'capacity-release.json').read_text())['passed'])
                self.assertEqual(release.main(),1)
                child.assert_called_once()
                self.assertIn('CAPACITY_ALREADY_ATTEMPTED_CONTACT_DB_OWNER',diagnostic.getvalue())
                (root / '.env.aws-staging.local').write_text('NOTIFICATIONS_ENABLED=true\n')
                diagnostic.truncate(0); diagnostic.seek(0)
                with patch.object(release.boto3,'Session') as forbidden_client:
                    self.assertEqual(release.main(),1)
                    forbidden_client.assert_not_called()
                child.assert_called_once()
                self.assertIn('UNAPPROVED_WORKER_OR_PROVIDER_FLAG',diagnostic.getvalue())

if __name__ == '__main__':
    unittest.main()
