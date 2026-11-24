import base64
import hashlib
from html.parser import HTMLParser
from pathlib import Path
import time
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, urlsplit

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from flask import Flask
import jwt
from jwt.algorithms import OKPAlgorithm

from app.api_auth import api_auth_bp
from app.auth import _jwks_clients, create_session_token, verify_media_token
from app.auth_routes import auth_bp
from app.camera import Camera, CameraManager
from app.routes import main_bp


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.links = []
        self.stack = []
        self.nesting_errors = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if 'id' in attributes:
            self.ids.append(attributes['id'])
        if tag == 'a':
            self.links.append(attributes.get('href', ''))
        if tag not in {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}:
            self.stack.append(tag)

    def handle_endtag(self, tag):
        if not self.stack or self.stack[-1] != tag:
            self.nesting_errors.append(tag)
        else:
            self.stack.pop()


class WebTemplateTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask('app', root_path=str(Path(__file__).resolve().parents[1] / 'app'))
        self.app.config.update(TESTING=True, SECRET_KEY='template-test-key')
        self.app.register_blueprint(main_bp)
        self.app.register_blueprint(auth_bp)
        self.client = self.app.test_client()
        with self.client.session_transaction() as session:
            session['logged_in'] = True
            session['username'] = 'Test User'

    def test_pages_render_for_zero_one_and_four_cameras(self):
        for count in (0, 1, 4):
            cameras = {
                f'cam{index}': {'name': f'Camera {index}', 'state': 'offline', 'type': 'rtsp'}
                for index in range(count)
            }
            statuses = [
                {'camera_id': camera_id, 'name': camera['name'], 'state': 'offline', 'type': 'RTSPCamera', 'last_error': None}
                for camera_id, camera in cameras.items()
            ]
            with patch.object(CameraManager, 'get_cameras_dict', return_value=cameras), \
                 patch.object(CameraManager, 'get_all_status', return_value=statuses), \
                 patch.object(Camera, 'get_camera_info', return_value={}):
                for route in ('/', '/recordings', '/settings', '/devices'):
                    with self.subTest(cameras=count, route=route):
                        response = self.client.get(route)
                        self.assertEqual(response.status_code, 200)
                        html = response.get_data(as_text=True)
                        self.assertIn('css/home.css', html)
                        self.assertIn('home-navigation', html)
                        self.assertNotIn('fonts.googleapis.com', html)
                        self.assertNotIn('mockups/', html)
                        parser = PageParser()
                        parser.feed(html)
                        self.assertEqual(len(parser.ids), len(set(parser.ids)))
                        self.assertEqual(parser.nesting_errors, [])
                        self.assertEqual(parser.stack, [])
                        self.assertNotIn('/alerts', parser.links)
                        self.assertIn('/#recent-activity', parser.links)
                        self.assertEqual(html.count('js/common.js'), 1)
                        if route == '/' and count == 0:
                            self.assertIn('No cameras configured', html)

    def test_unauthenticated_requests_still_require_login(self):
        client = self.app.test_client()
        self.assertEqual(client.get('/').status_code, 302)
        self.assertEqual(client.get('/api/cameras').status_code, 401)
        self.assertEqual(client.get('/api/storage/stats').status_code, 401)

    def test_login_uses_local_design_assets(self):
        response = self.app.test_client().get('/login')
        self.assertEqual(response.status_code, 200)
        html = response.get_data(as_text=True)
        self.assertIn('css/home.css', html)
        self.assertNotIn('fonts.googleapis.com', html)
        self.assertIn('autocomplete="current-password"', html)

    def test_disk_usage_extends_existing_storage_response(self):
        stats = {'recordings_count': 3, 'total_size_bytes': 200, 'per_camera': []}
        with patch.object(CameraManager, 'get_storage_stats', return_value=stats.copy()), \
             patch('app.routes.shutil.disk_usage', return_value=SimpleNamespace(total=1000, used=400, free=600)):
            response = self.client.get('/api/storage/stats')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['recordings_count'], 3)
        self.assertEqual(data['total_size_bytes'], 200)
        self.assertEqual(data['disk_usage'], {'total_bytes': 1000, 'used_bytes': 400, 'free_bytes': 600})

    def test_disk_usage_failure_preserves_recording_statistics(self):
        stats = {'recordings_count': 0, 'total_size_bytes': 0, 'per_camera': []}
        with patch.object(CameraManager, 'get_storage_stats', return_value=stats), \
             patch('app.routes.shutil.disk_usage', side_effect=OSError('Unavailable')):
            response = self.client.get('/api/storage/stats')
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.get_json()['disk_usage'])
        self.assertEqual(response.get_json()['recordings_count'], 0)


class AuthKitAuthenticationTests(unittest.TestCase):
    ISSUER = 'https://auth.tapanmeena.com'
    KID = 'ak_test_ed25519_key'

    @classmethod
    def setUpClass(cls):
        cls.private_key = Ed25519PrivateKey.generate()
        public_jwk_dict = OKPAlgorithm.to_jwk(cls.private_key.public_key(), as_dict=True)
        public_jwk_dict.update({
            'kid': cls.KID,
            'alg': 'EdDSA',
            'use': 'sig',
        })
        cls.signing_key = jwt.PyJWK.from_dict(public_jwk_dict)

    def setUp(self):
        _jwks_clients.clear()
        self.app = Flask('app', root_path=str(Path(__file__).resolve().parents[1] / 'app'))
        self.app.config.update(
            TESTING=True,
            SECRET_KEY='authkit-test-secret-key',
            AUTHKIT_ISSUER_URL=self.ISSUER,
            AUTHKIT_JWKS_URL='',
            AUTHKIT_POOL_SLUG='one-auth',
            AUTHKIT_CLIENT_ID='sentinel-web',
            SENTINEL_ALLOWED_EMAILS='',
            SENTINEL_LOCAL_AUTH_ENABLED=False,
        )
        self.app.register_blueprint(main_bp)
        self.app.register_blueprint(auth_bp)
        self.app.register_blueprint(api_auth_bp)
        self.client = self.app.test_client()

    def _mint_token(
        self,
        *,
        email='owner@tapanmeena.com',
        pool='one-auth',
        client_id='sentinel-mobile',
        email_verified=True,
        issuer=None,
        exp_offset=900,
    ):
        now = int(time.time())
        claims = {
            'iss': issuer or self.ISSUER,
            'sub': 'user_123',
            'aud': [f'pool:{pool}', f'app:{client_id}'],
            'pool': pool,
            'azp': client_id,
            'sid': 'sess_123',
            'email': email,
            'email_verified': email_verified,
            'iat': now,
            'exp': now + exp_offset,
        }
        return jwt.encode(
            claims,
            self.private_key,
            algorithm='EdDSA',
            headers={'kid': self.KID, 'typ': 'JWT'},
        )

    def test_valid_authkit_eddsa_token_authenticates_api_and_media_token(self):
        token = self._mint_token(email='owner@tapanmeena.com')
        headers = {'Authorization': f'Bearer {token}'}

        with patch.object(jwt.PyJWKClient, 'get_signing_key_from_jwt', return_value=self.signing_key):
            me_resp = self.client.get('/api/auth/me', headers=headers)
            self.assertEqual(me_resp.status_code, 200)
            self.assertEqual(me_resp.get_json()['username'], 'owner@tapanmeena.com')

            media_resp = self.client.post('/api/auth/media-token', headers=headers)
            self.assertEqual(media_resp.status_code, 200)
            media_token = media_resp.get_json()['token']
            with self.app.app_context():
                self.assertEqual(verify_media_token(media_token), 'owner@tapanmeena.com')

            # Media tokens must never authorize non-media API endpoints.
            self.assertEqual(self.client.get(f'/api/auth/me?token={media_token}').status_code, 401)
            # Media tokens DO authorize read-only media endpoints like /embed/stream/<cam>.
            with patch.object(CameraManager, 'get', return_value=SimpleNamespace(name='Camera 2')):
                self.assertEqual(self.client.get(f'/embed/stream/cam2?token={media_token}').status_code, 200)

            logout_resp = self.client.post('/api/auth/logout', headers=headers)
            self.assertEqual(logout_resp.status_code, 200)

    def test_rejects_wrong_pool_and_unverified_email(self):
        wrong_pool_token = self._mint_token(pool='other-pool')
        unverified_token = self._mint_token(email_verified=False)

        with patch.object(jwt.PyJWKClient, 'get_signing_key_from_jwt', return_value=self.signing_key):
            self.assertEqual(
                self.client.get(
                    '/api/auth/me',
                    headers={'Authorization': f'Bearer {wrong_pool_token}'},
                ).status_code,
                401,
            )
            self.assertEqual(
                self.client.get(
                    '/api/auth/me',
                    headers={'Authorization': f'Bearer {unverified_token}'},
                ).status_code,
                401,
            )

    def test_enforces_sentinel_allowed_emails_and_custom_jwks_url(self):
        self.app.config['SENTINEL_ALLOWED_EMAILS'] = 'owner@tapanmeena.com, family@tapanmeena.com'
        self.app.config['AUTHKIT_JWKS_URL'] = 'http://127.0.0.1:7583/.well-known/jwks.json'

        allowed_token = self._mint_token(email='Family@tapanmeena.com')
        denied_token = self._mint_token(email='guest@tapanmeena.com')

        with patch.object(jwt.PyJWKClient, 'get_signing_key_from_jwt', return_value=self.signing_key):
            ok_resp = self.client.get(
                '/api/auth/me',
                headers={'Authorization': f'Bearer {allowed_token}'},
            )
            self.assertEqual(ok_resp.status_code, 200)
            self.assertIn('http://127.0.0.1:7583/.well-known/jwks.json', _jwks_clients)

            denied_resp = self.client.get(
                '/api/auth/me',
                headers={'Authorization': f'Bearer {denied_token}'},
            )
            self.assertEqual(denied_resp.status_code, 401)

    def test_disables_legacy_login_when_local_auth_disabled(self):
        login_page = self.client.get('/login')
        self.assertEqual(login_page.status_code, 200)
        html = login_page.get_data(as_text=True)
        self.assertIn('Sign in with One Auth', html)
        self.assertIn('/auth/oidc/login', html)
        self.assertNotIn('autocomplete="current-password"', html)

        self.assertEqual(
            self.client.post('/login', data={'username': 'admin', 'password': 'sentinel'}).status_code,
            403,
        )
        self.assertEqual(
            self.client.post('/api/auth/login', json={'username': 'admin', 'password': 'sentinel'}).status_code,
            403,
        )

        with self.app.app_context():
            legacy_token = create_session_token('admin')
        self.assertEqual(
            self.client.get('/api/auth/me', headers={'Authorization': f'Bearer {legacy_token}'}).status_code,
            401,
        )

    def test_oidc_pkce_login_and_callback_flow(self):
        # 1. Start OIDC login after saving a requested destination
        with self.client.session_transaction() as sess:
            sess['next_url'] = '/recordings'

        start_resp = self.client.get('/auth/oidc/login')
        self.assertEqual(start_resp.status_code, 302)
        redirect_location = start_resp.headers['Location']
        parsed = urlsplit(redirect_location)
        self.assertEqual(f'{parsed.scheme}://{parsed.netloc}{parsed.path}', f'{self.ISSUER}/oauth/authorize')
        query = parse_qs(parsed.query)
        self.assertEqual(query['response_type'], ['code'])
        self.assertEqual(query['client_id'], ['sentinel-web'])
        self.assertEqual(query['redirect_uri'], ['http://localhost/auth/callback'])
        self.assertEqual(query['code_challenge_method'], ['S256'])

        with self.client.session_transaction() as sess:
            verifier = sess['oidc_code_verifier']
            state = sess['oidc_state']

        expected_challenge = (
            base64.urlsafe_b64encode(hashlib.sha256(verifier.encode('ascii')).digest())
            .rstrip(b'=')
            .decode('ascii')
        )
        self.assertEqual(query['code_challenge'], [expected_challenge])
        self.assertEqual(query['state'], [state])

        # 2. Callback exchanges authorization code + PKCE verifier and logs user in
        minted_access_token = self._mint_token(
            email='owner@tapanmeena.com',
            client_id='sentinel-web',
        )
        fake_token_resp = MagicMock(ok=True, status_code=200)
        fake_token_resp.json.return_value = {
            'access_token': minted_access_token,
            'refresh_token': 'rt_123',
            'token_type': 'Bearer',
            'expires_in': 900,
        }

        with patch('app.auth_routes.requests.post', return_value=fake_token_resp) as mock_post, \
             patch.object(jwt.PyJWKClient, 'get_signing_key_from_jwt', return_value=self.signing_key):
            cb_resp = self.client.get(f'/auth/callback?code=auth_code_xyz&state={state}')

        self.assertEqual(cb_resp.status_code, 302)
        self.assertTrue(cb_resp.headers['Location'].endswith('/recordings'))
        mock_post.assert_called_once()
        posted_url = mock_post.call_args[0][0]
        posted_json = mock_post.call_args[1]['json']
        self.assertEqual(posted_url, f'{self.ISSUER}/oauth/token')
        self.assertEqual(posted_json['grant_type'], 'authorization_code')
        self.assertEqual(posted_json['client_id'], 'sentinel-web')
        self.assertEqual(posted_json['code'], 'auth_code_xyz')
        self.assertEqual(posted_json['code_verifier'], verifier)
        self.assertEqual(posted_json['redirect_uri'], 'http://localhost/auth/callback')

        with self.client.session_transaction() as sess:
            self.assertTrue(sess.get('logged_in'))
            self.assertEqual(sess.get('username'), 'owner@tapanmeena.com')

    def test_oidc_callback_rejects_mismatched_state(self):
        self.client.get('/auth/oidc/login')
        bad_resp = self.client.get('/auth/callback?code=auth_code_xyz&state=tampered-state')
        self.assertEqual(bad_resp.status_code, 400)


if __name__ == '__main__':
    unittest.main()
