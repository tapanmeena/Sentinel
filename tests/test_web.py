from html.parser import HTMLParser
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from flask import Flask

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


if __name__ == '__main__':
    unittest.main()
