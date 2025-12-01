import os
import sys
import time
import webbrowser
import re
import http.server
import socketserver

class RangeRequestHandler(http.server.SimpleHTTPRequestHandler):
    range = None
    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()
        try:
            f = open(path, 'rb')
        except OSError:
            self.send_error(404, 'File not found')
            return None
        fs = os.fstat(f.fileno())
        size = fs.st_size
        ctype = self.guess_type(path)
        rh = self.headers.get('Range')
        if rh:
            m = re.match(r'bytes=(\d+)-(\d*)', rh)
            if m:
                start = int(m.group(1))
                end = m.group(2)
                end = int(end) if end else size - 1
                if start >= size:
                    self.send_error(416, 'Requested Range Not Satisfiable')
                    f.close()
                    return None
                self.send_response(206)
                self.send_header('Content-type', ctype)
                self.send_header('Accept-Ranges', 'bytes')
                self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
                self.send_header('Content-Length', str(end - start + 1))
                self.end_headers()
                f.seek(start)
                self.range = (start, end)
                return f
        self.send_response(200)
        self.send_header('Content-type', ctype)
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Length', str(size))
        self.end_headers()
        self.range = None
        return f
    def copyfile(self, source, outputfile):
        if self.range:
            start, end = self.range
            remain = end - start + 1
            bs = 64 * 1024
            while remain > 0:
                chunk = source.read(min(bs, remain))
                if not chunk:
                    break
                outputfile.write(chunk)
                remain -= len(chunk)
        else:
            super().copyfile(source, outputfile)

def main():
    base = os.path.join(os.path.dirname(__file__), 'example')
    port = 5500
    no_open = False
    for a in sys.argv[1:]:
        if a.strip() == '--no-open':
            no_open = True
        else:
            try:
                port = int(a)
            except Exception:
                pass
    chosen = None
    Handler = lambda *args, **kwargs: RangeRequestHandler(*args, directory=base, **kwargs)
    for p in range(port, port + 20):
        try:
            with socketserver.TCPServer(('', p), Handler) as httpd:
                chosen = p
                url = f'http://localhost:{chosen}/anime-neon/index.html'
                print(url)
                if not no_open:
                    try:
                        webbrowser.open(url)
                    except Exception:
                        pass
                try:
                    httpd.serve_forever()
                except KeyboardInterrupt:
                    pass
                break
        except Exception:
            time.sleep(0.2)
            continue

if __name__ == '__main__':
    main()