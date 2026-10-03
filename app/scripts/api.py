"""Tiny client for the app API (smoke tests from the host, no Node needed): python3 scripts/api.py is imported by the smoke scripts."""
import http.cookiejar, json, urllib.request, urllib.error

class Api:
    def __init__(self, base='http://localhost:4000'):
        self.base = base.rstrip('/')
        self.jar = http.cookiejar.CookieJar()
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar), urllib.request.ProxyHandler({}))

    def call(self, method, path, body=None, raw=False):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, method=method)
        req.add_header('accept', 'application/json')
        if method != 'GET': req.add_header('x-requested-with', 'fetch')
        if data is not None: req.add_header('content-type', 'application/json')
        try:
            with self.op.open(req, timeout=120) as r:
                b = r.read()
                return r.status, (b if raw else (json.loads(b) if b else None))
        except urllib.error.HTTPError as e:
            b = e.read()
            try: return e.code, json.loads(b)
            except Exception: return e.code, b[:300]

    get = lambda self, p, **k: self.call('GET', p, **k)
    post = lambda self, p, b=None: self.call('POST', p, b if b is not None else {})
    patch = lambda self, p, b: self.call('PATCH', p, b)
    put = lambda self, p, b: self.call('PUT', p, b)
    delete = lambda self, p: self.call('DELETE', p)
