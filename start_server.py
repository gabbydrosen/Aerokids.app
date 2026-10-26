# Runs a little web server so the browser can load the 3D models.
# Run it with: python3 start_server.py   then open http://127.0.0.1:8000
import http.server
import os
import webbrowser

os.chdir(os.path.dirname(os.path.abspath(__file__)))
http.server.SimpleHTTPRequestHandler.extensions_map[".js"] = "text/javascript"
http.server.SimpleHTTPRequestHandler.extensions_map[".mjs"] = "text/javascript"
http.server.SimpleHTTPRequestHandler.extensions_map[".wasm"] = "application/wasm"

server = http.server.ThreadingHTTPServer(("127.0.0.1", 8000), http.server.SimpleHTTPRequestHandler)
print("AeroKids is running at http://127.0.0.1:8000 (Ctrl+C to stop)")
webbrowser.open("http://127.0.0.1:8000")
server.serve_forever()
