"""Run with: python -m unittest discover -s tests -v"""
import os
import tempfile
import unittest
from pathlib import Path

# Use a temporary isolated SQLite database, not the reviewer's demo data.
_temp = tempfile.TemporaryDirectory()
os.environ['DOCSPACE_DB'] = str(Path(_temp.name) / 'test.sqlite3')
from fastapi.testclient import TestClient  # noqa: E402
from server import app  # noqa: E402


class DocumentFlowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def req(self, method, path, actor='alex', **kwargs):
        return self.client.request(method, '/api' + path, headers={'X-Demo-User': actor}, **kwargs)

    def test_health_and_frontend(self):
        self.assertEqual(self.client.get('/api/health').status_code, 200)
        self.assertIn('DocSpace Lite', self.client.get('/').text)
        self.assertEqual(self.client.get('/static/app.js').status_code, 200)

    def test_lifecycle_permissions_and_persistence(self):
        created = self.req('POST', '/documents', json={'title': 'Launch notes', 'content': '<p>Hi <strong>team</strong></p>'})
        self.assertEqual(created.status_code, 201)
        did = created.json()['id']
        self.assertEqual(self.req('GET', '/documents/' + did, actor='sam').status_code, 404)
        self.assertEqual(self.req('PATCH', '/documents/' + did, actor='sam', json={'title':'bad'}).status_code, 404)
        self.assertEqual(self.req('POST', '/documents/' + did + '/shares',json={'user_id':'sam'}).status_code, 201)
        viewed = self.req('GET', '/documents/' + did, actor='sam')
        self.assertEqual(viewed.status_code, 200)
        self.assertFalse(viewed.json()['can_edit'])
        self.assertIn('<strong>team</strong>', viewed.json()['content'])
        self.assertEqual(self.req('PATCH','/documents/'+did,actor='sam',json={'content':'<p>hacked</p>'}).status_code,404)
        self.assertEqual(self.req('POST','/documents/'+did+'/shares',actor='sam',json={'user_id':'jordan'}).status_code,404)
        self.assertEqual(self.req('GET','/documents/'+did,actor='jordan').status_code,404)
        self.assertEqual(len(self.req('GET','/documents',actor='sam').json()['shared']),1)
        renamed = self.req('PATCH','/documents/'+did,json={'title':'Launch version 2','content':'<h2>Heading</h2><p>done</p>'})
        self.assertEqual(renamed.status_code,200)
        self.assertEqual(self.req('GET','/documents/'+did).json()['title'],'Launch version 2')
        self.assertIn('<h2>Heading</h2>',self.req('GET','/documents/'+did).json()['content'])
        self.assertEqual(self.req('DELETE','/documents/'+did+'/shares/sam').status_code,200)
        self.assertEqual(self.req('GET','/documents/'+did,actor='sam').status_code,404)
        self.assertEqual(self.req('DELETE','/documents/'+did).status_code,200)
        self.assertEqual(self.req('GET','/documents/'+did).status_code,404)

    def test_file_import_validation_and_html_safety(self):
        bad = self.req('POST','/documents/import',json={'filename':'bad.docx','content':'test'})
        self.assertEqual(bad.status_code,415)
        imported = self.req('POST','/documents/import',json={'filename':'ideas.txt','content':'Hello <script>alert(1)</script>\nSecond line'})
        self.assertEqual(imported.status_code,201)
        content = self.req('GET','/documents/'+imported.json()['id']).json()['content']
        self.assertIn('&lt;script&gt;',content)
        self.assertIn('Second line',content)
        created = self.req('POST','/documents',json={'title':'X','content':'<p onclick="alert(1)">A</p><script>evil()</script>'})
        saved = self.req('GET','/documents/'+created.json()['id']).json()['content']
        self.assertNotIn('onclick',saved)
        self.assertNotIn('<script>',saved)
        self.assertEqual(self.req('POST','/documents',json={'title':'   '}).status_code,422)
        self.assertEqual(self.req('GET','/documents').status_code,200)
        self.assertEqual(self.client.get('/api/documents').status_code,401)


if __name__=='__main__':
    unittest.main()
