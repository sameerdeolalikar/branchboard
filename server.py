"""Loopback-only application server and optimistic SQLite persistence."""
import argparse,json,sqlite3,uuid
from pathlib import Path
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from core import validate,analyze

class Conflict(ValueError): pass
class Store:
    def __init__(self,path):
        self.path=str(path);Path(path).parent.mkdir(parents=True,exist_ok=True)
        with sqlite3.connect(self.path) as c:c.execute("CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY, title TEXT, revision INTEGER, body TEXT)")
    def list(self):
        with sqlite3.connect(self.path) as c:return [dict(zip(["id","title","revision"],r)) for r in c.execute("SELECT id,title,revision FROM documents ORDER BY title,id")]
    def get(self,key):
        with sqlite3.connect(self.path) as c:r=c.execute("SELECT revision,body FROM documents WHERE id=?",(key,)).fetchone()
        if not r:raise ValueError("Document not found.")
        return {"id":key,"revision":r[0],"document":json.loads(r[1])}
    def save(self,raw):
        doc=validate(raw.get("document"));rev=raw.get("revision");key=raw.get("id")
        if type(rev) is not int or rev<0:raise ValueError("Invalid revision.")
        if key is not None and not isinstance(key,str):raise ValueError("Invalid document ID.")
        with sqlite3.connect(self.path) as c:
            c.execute("BEGIN IMMEDIATE")
            if key:
                row=c.execute("SELECT revision FROM documents WHERE id=?",(key,)).fetchone()
                if not row or row[0]!=rev:raise Conflict("A newer saved revision exists. Export your draft, then reopen before saving.")
            else:
                if rev!=0:raise ValueError("New documents start at revision zero.")
                if c.execute("SELECT COUNT(*) FROM documents").fetchone()[0]>=100:raise ValueError("Library limit is 100 documents.")
                key=uuid.uuid4().hex
            c.execute("INSERT OR REPLACE INTO documents VALUES(?,?,?,?)",(key,doc["title"],rev+1,json.dumps(doc)))
        return {"id":key,"revision":rev+1,"document":doc}

def main():
    parser=argparse.ArgumentParser();parser.add_argument("--port",type=int,default=7431);parser.add_argument("--data",default=".local-data/library.sqlite3");args=parser.parse_args()
    store=Store(args.data);origin=f"http://127.0.0.1:{args.port}";root=Path(__file__).parent
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args):pass
        def setup(self):super().setup();self.connection.settimeout(10)
        def send(self,status,body,kind="application/json"):
            payload=(json.dumps(body).encode() if kind=="application/json" else body)
            self.send_response(status);self.send_header("Content-Type",kind+"; charset=utf-8");self.send_header("Content-Length",str(len(payload)));self.send_header("Cache-Control","no-store");self.send_header("X-Content-Type-Options","nosniff");self.send_header("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");self.end_headers();self.wfile.write(payload)
        def allowed(self):return self.headers.get("Host")==f"127.0.0.1:{args.port}"
        def do_GET(self):
            if not self.allowed():return self.send(403,{"error":"Use the printed loopback address."})
            try:
                assets={"/":("web/index.html","text/html"),"/app.js":("web/app.js","text/javascript"),"/style.css":("web/style.css","text/css")}
                if self.path in assets:
                    file,kind=assets[self.path];return self.send(200,(root/file).read_bytes(),kind)
                if self.path=="/api/sample":return self.send(200,json.loads((root/"examples/sample.json").read_text()))
                if self.path=="/api/documents":return self.send(200,store.list())
                if self.path.startswith("/api/documents/"):return self.send(200,store.get(self.path.removeprefix("/api/documents/")))
                self.send(404,{"error":"Not found."})
            except ValueError as e:self.send(400,{"error":str(e)})
        def do_POST(self):
            if not self.allowed() or self.headers.get("Origin")!=origin or self.headers.get("X-Requested-With")!="Workspace":return self.send(403,{"error":"Use the local workspace to make changes."})
            try:
                length=int(self.headers.get("Content-Length",0))
                if not 0<length<=256000:raise ValueError("Requests must contain 1–256000 bytes.")
                raw=json.loads(self.rfile.read(length))
                if not isinstance(raw,dict):raise ValueError("Expected an object.")
                if self.path=="/api/validate":
                    doc=validate(raw);return self.send(200,{"document":doc,"analysis":analyze(doc)})
                if self.path=="/api/save":return self.send(200,store.save(raw))
                self.send(404,{"error":"Unknown operation."})
            except Conflict as e:self.send(409,{"error":str(e)})
            except (ValueError,TypeError,KeyError,OverflowError) as e:self.send(400,{"error":str(e)})
            except (OSError,sqlite3.Error):self.send(500,{"error":"Storage failed. Your draft is still available; export it before closing."})
    print("BranchBoard: "+origin,flush=True)
    ThreadingHTTPServer(("127.0.0.1",args.port),Handler).serve_forever()
if __name__=="__main__":main()
