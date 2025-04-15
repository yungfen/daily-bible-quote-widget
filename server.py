from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import os
from dotenv import load_dotenv
import sys
from urllib.parse import parse_qs, urlparse
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import time
import threading
import datetime

# Load environment variables
load_dotenv()

# Check for API key
api_key = os.getenv('BIBLE_API_KEY')
if not api_key:
    print("Error: BIBLE_API_KEY not found in .env file")
    sys.exit(1)
else:
    print("API key loaded successfully")


# Function to fetch a new Bible verse (replace with your actual logic)
def fetch_new_verse():
    # This is a placeholder. You should implement the actual logic
    # to fetch a new Bible verse using the API and return it as a dictionary.
    # Example:
    # return {"verse": "John 3:16", "text": "For God so loved the world..."}
    # For now, we'll return a dummy verse:
    return {"verse": "Psalm 23:1", "text": "The Lord is my shepherd; I shall not want."}

# Global variable to store the current verse and date
current_verse = fetch_new_verse()
current_date = datetime.date.today()

class SecureHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)
        
        # Handle API key request
        if parsed_path.path == '/api/key':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            # Only send API key to localhost requests
            if self.client_address[0] in ['127.0.0.1', 'localhost']:
                print(f"Serving API key to {self.client_address[0]}")
                response = {'apiKey': os.getenv('BIBLE_API_KEY', '')}
            else:
                print(f"Unauthorized request from {self.client_address[0]}")
                response = {'error': 'Unauthorized'}
            
            self.wfile.write(json.dumps(response).encode())
            return

        # Handle verse of the day request
        if parsed_path.path == '/api/verse':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()

            # Return the current verse
            response = {
                "verse": current_verse['verse'],
                "text": current_verse['text']
            }
            self.wfile.write(json.dumps(response).encode())
        
        # Serve static files
        return SimpleHTTPRequestHandler.do_GET(self)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        # Add cache control headers to prevent caching
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

class FileChangeHandler(FileSystemEventHandler):
    def __init__(self, server):
        self.server = server
        self.restart_timer = None
        self.lock = threading.Lock()

    def on_modified(self, event):
        if event.src_path.endswith(('.py', '.html', '.js', '.css', '.env')):
            with self.lock:
                if self.restart_timer:
                    self.restart_timer.cancel()
                # Debounce restart to prevent multiple restarts
                self.restart_timer = threading.Timer(0.5, self.restart_server)
                self.restart_timer.start()

    def restart_server(self):
        print("\n Changes detected! Restarting server...")
        self.server.shutdown()

def update_verse_daily():
    global current_verse, current_date
    while True:
        today = datetime.date.today()
        if today > current_date:
            print("Updating the Bible verse for the new day.")
            current_verse = fetch_new_verse()
            current_date = today
        # Check every hour if the day has changed
        time.sleep(3600)  





def run_server(port=8000):
    while True:
        server = HTTPServer(('localhost', port), SecureHandler)
        print(f"\nServer running on http://localhost:{port}")
        print(f"Serving files from: {os.getcwd()}")
        print("Watching for file changes... (Ctrl+C to quit)")

        # Set up file watcher
        observer = Observer()
        handler = FileChangeHandler(server)
        observer.schedule(handler, path='.', recursive=True)
        observer.start()
        
        # Start the daily verse update in a separate thread
        daily_update_thread = threading.Thread(target=update_verse_daily, daemon=True)
        daily_update_thread.start()


        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")
            observer.stop()
            server.socket.close()
            observer.join()
            sys.exit(0)
        except Exception as e:
            print(f"Error: {str(e)}")
            observer.stop()
            observer.join()
            sys.exit(1)

        print("Restarting server...")

if __name__ == '__main__':
    run_server()
