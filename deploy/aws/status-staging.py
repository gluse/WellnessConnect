"""Read-only, filtered Lightsail status and optional gateway verification."""
import argparse
import base64
import json
from pathlib import Path
import sys
from http.cookies import SimpleCookie
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import boto3
from botocore.config import Config
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--logs', action='store_true')
    parser.add_argument('--verify', action='store_true')
    args = parser.parse_args()
    try:
        config = Config(retries={'total_max_attempts': 1, 'mode': 'standard'}, connect_timeout=5, read_timeout=15)
        session = boto3.Session(profile_name='fitsmytime', region_name='eu-north-1')
        if session.client('sts', config=config).get_caller_identity()['Account'] != '674200807170':
            raise ValueError('WRONG_PROJECT')
        client = session.client('lightsail', config=config)
        service = client.get_container_services(serviceName='fitsmytime-staging')['containerServices'][0]
        def deployment(value):
            if not value:
                return None
            return {'version': value['version'], 'state': value['state'], 'images': {key: item['image'] for key, item in value['containers'].items()},
                    'endpoint': {key: value.get('publicEndpoint', {}).get(key) for key in ['containerName', 'containerPort']}}
        result = {key: service.get(key) for key in ['containerServiceName', 'state', 'power', 'scale', 'url', 'stateDetail']}
        result.update(current=deployment(service.get('currentDeployment')), next=deployment(service.get('nextDeployment')))
        if args.logs:
            summaries = {}
            log_start = (service.get('nextDeployment') or service.get('currentDeployment') or {}).get('createdAt')
            for container in ['app', 'gateway', 'audit-worker']:
                params = {'serviceName':'fitsmytime-staging', 'containerName':container}
                if log_start:
                    params['startTime'] = log_start
                events = client.get_container_log(**params).get('logEvents', [])
                summary = {'eventCount': len(events)}
                for event in sorted(events, key=lambda item: str(item.get('createdAt', ''))):
                    message = event.get('message', '').strip()
                    if 'serving on port 5000' in message:
                        summary['listening'] = True
                    if 'Application startup refused:' in message:
                        # Fixed diagnostic codes are inspected in memory, never dump arbitrary logs.
                        summary['startupRefused'] = True
                    if 'RUNTIME_UNAVAILABLE' in message:
                        summary['runtimeUnavailable'] = True
                    try:
                        value = json.loads(message)
                        if value.get('type') == 'audit-worker-health':
                            summary['workerHealth'] = value.get('status') if value.get('status') in ['healthy', 'attention', 'unavailable'] else 'unknown'
                            summary['healthTime'] = str(event.get('createdAt'))
                            summary['failures'] = {key: value.get('metrics', {}).get(key) for key in ['sourceFailures', 'destinationFailures', 'captureGaps']}
                    except (ValueError, AttributeError):
                        pass
                summaries[container] = summary
            result['logs'] = summaries
        if args.verify:
            if service.get('currentDeployment', {}).get('state') != 'ACTIVE' or service.get('nextDeployment'):
                raise ValueError('ACTIVE_REQUIRED')
            access = dict(dotenv_values(ROOT / '.env.aws-staging-access.local', interpolate=False))
            origin = service['url'].rstrip('/')
            if access.get('STAGING_ORIGIN') != origin:
                raise ValueError('ACCESS_ORIGIN_MISMATCH')
            token = base64.b64encode((access['STAGING_USERNAME'] + ':' + access['STAGING_PASSWORD']).encode()).decode()
            checks = []
            def get(route, authenticated=False, cookie=None):
                headers = {'Authorization': 'Basic ' + token} if authenticated else {}
                if cookie:
                    headers['Cookie'] = cookie
                request = Request(origin + route, headers=headers)
                try:
                    with urlopen(request, timeout=15) as response:
                        return response.status, response.headers, response.read(2_000_000)
                except HTTPError as response:
                    return response.code, response.headers, response.read(10000)
            for route in ['/', '/login', '/api/auth/user', '/assets/staging-probe.js', '/privacy-policy.html', '/health/live', '/health/ready?probe=1']:
                code, headers, _ = get(route)
                if code != 401 or not headers.get('WWW-Authenticate', '').startswith('Basic '):
                    raise ValueError('GATEWAY_RESTRICTION_FAILED')
                checks.append({'path': route, 'authenticated': False, 'status': code})
            code, headers, body = get('/health/ready')
            if code != 200 or json.loads(body) != {'status': 'ready'} or headers.get('Set-Cookie'):
                raise ValueError('READINESS_PRIVACY_FAILED')
            checks.append({'path': '/health/ready', 'authenticated': False, 'status': code, 'sanitized': True})
            for route in ['/', '/login']:
                code, headers, body = get(route, True)
                if code != 200 or b'<html' not in body.lower() or headers.get('X-Robots-Tag') != 'noindex, nofollow, noarchive' or not headers.get('Strict-Transport-Security'):
                    raise ValueError('AUTHENTICATED_PAGE_FAILED')
                checks.append({'path': route, 'authenticated': True, 'status': code})
            cookies = SimpleCookie()
            for value in headers.get_all('Set-Cookie', []):
                cookies.load(value)
            gate = cookies.get('__Host-fmt-staging')
            if not gate or not gate['secure'] or not gate['httponly'] or gate['path'] != '/' or gate['domain'] or gate['samesite'] != 'Lax' or gate['max-age'] != '3600':
                raise ValueError('GATEWAY_SESSION_FLAGS_FAILED')
            cookie = '__Host-fmt-staging=' + gate.value
            code, headers, _ = get('/api/auth/user', cookie=cookie)
            if code != 401 or headers.get('WWW-Authenticate'):
                raise ValueError('APP_AUTH_STATUS_FAILED')
            checks.append({'path':'/api/auth/user', 'cookieOnly':True, 'status':code, 'noBrowserChallenge':True})
            code, headers, body = get('/', cookie=cookie)
            if code != 200 or b'<html' not in body.lower():
                raise ValueError('GATEWAY_SESSION_AFTER_APP_DENIAL_FAILED')
            checks.append({'path':'/', 'cookieOnly':True, 'status':code, 'afterApp401':True})
            tampered = cookie[:-1] + ('B' if cookie[-1] == 'A' else 'A')
            code, _, _ = get('/', cookie=tampered)
            if code != 401:
                raise ValueError('TAMPERED_COOKIE_ACCEPTED')
            checks.append({'path':'/', 'tamperedCookie':True, 'status':code})
            result['gatewayChecks'] = checks
            result['verified'] = True
            (ROOT / 'outputs/aws-staging-build/live-gateway-session-result.json').write_text(json.dumps(result, indent=2, default=str))
        print(json.dumps(result, default=str))
        return 0
    except Exception as error:
        # SDK/HTTP exception text can contain private request data; expose type only.
        message = str(error)
        code = message if message.isupper() and message.replace('_', '').isalpha() else type(error).__name__
        print(json.dumps({'error': code, 'retryPerformed': False}), file=sys.stderr)
        return 1

if __name__ == '__main__':
    sys.exit(main())
