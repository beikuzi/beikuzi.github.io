import os
import sys
import time
import webbrowser
import re
import http.server
import socketserver
from threading import Thread

class RangeRequestHandler(http.server.SimpleHTTPRequestHandler):
    """支持 Range 请求的 HTTP 处理器"""
    
    def __init__(self, *args, **kwargs):
        self.range_request = None  # 实例变量而不是类变量
        super().__init__(*args, **kwargs)
    
    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()
        try:
            f = open(path, 'rb')
        except OSError:
            self.send_error(404, 'File not found')
            return None
        
        try:
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
                    self.range_request = (start, end)
                    return f
            
            self.send_response(200)
            self.send_header('Content-type', ctype)
            self.send_header('Accept-Ranges', 'bytes')
            self.send_header('Content-Length', str(size))
            self.end_headers()
            self.range_request = None
            return f
        except Exception:
            f.close()
            raise
    
    def copyfile(self, source, outputfile):
        try:
            if self.range_request:
                start, end = self.range_request
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
        finally:
            source.close()
    
    def log_message(self, format, *args):
        # 静默常见请求，只记录错误
        if args and len(args) > 1:
            status = str(args[1])
            if status.startswith('2') or status.startswith('3'):
                return  # 静默成功请求
        super().log_message(format, *args)


class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    """多线程 TCP 服务器，支持地址重用"""
    allow_reuse_address = True
    daemon_threads = True  # 主线程退出时子线程也退出
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.socket.settimeout(30)  # 设置超时


def main():
    base = os.path.dirname(os.path.abspath(__file__))
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
    
    Handler = lambda *args, **kwargs: RangeRequestHandler(*args, directory=base, **kwargs)
    
    for p in range(port, port + 20):
        try:
            httpd = ThreadedTCPServer(('', p), Handler)
            url = f'http://localhost:{p}/index.html'
            print(f'服务器启动在: {url}')
            print(f'按 Ctrl+C 停止服务器')
            
            if not no_open:
                try:
                    webbrowser.open(url)
                except Exception:
                    pass
            
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                print('\n正在关闭服务器...')
            finally:
                httpd.shutdown()
                httpd.server_close()
            break
        except OSError as e:
            if e.errno == 10048 or 'Address already in use' in str(e):
                # 端口被占用，尝试下一个
                time.sleep(0.1)
                continue
            raise
        except Exception:
            time.sleep(0.2)
            continue
    else:
        print(f'错误: 无法在端口 {port}-{port+19} 范围内启动服务器')
        sys.exit(1)


if __name__ == '__main__':
    main()
