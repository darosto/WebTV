from flask import Flask, render_template, jsonify, Response, stream_with_context
import requests

app = Flask(__name__)

# Config für deinen TVheadend Server
TVH_HOST = "http://your-host:9981"
TVH_USER = "none"       # Falls erforderlich, sonst None
TVH_PASS = "none"       # Falls erforderlich, sonst None

# Cache für Kanal- und EPG-Daten
CHANNELS_CACHE = {"data": None, "last_updated": 0}
EPG_CACHE = {"data": None, "last_updated": 0}

def get_tvh_auth():
    if TVH_USER and TVH_PASS:
        return requests.auth.HTTPDigestAuth(TVH_USER, TVH_PASS)
    return None

@app.route('/')
def index():
    # Lädt die HTML-Seite
    return render_template('index.html')
    
@app.route('/api/channels')
def get_channels():
    import time
    # Cache für 1 Stunde (3600 Sekunden)
    if CHANNELS_CACHE["data"] and (time.time() - CHANNELS_CACHE["last_updated"] < 3600):
        return jsonify(CHANNELS_CACHE["data"])

    # Begrenzung auf 400, da du ca. 300 Sender hast
    tvh_url = f"{TVH_HOST}/api/channel/grid?start=0&limit=400&sort=number&dir=ASC"
    
    try:
        req = requests.get(tvh_url, auth=get_tvh_auth(), timeout=5)
        data = req.json()
        CHANNELS_CACHE["data"] = data
        CHANNELS_CACHE["last_updated"] = time.time()
        return jsonify(data)
    except Exception as e:
        print(f"Fehler beim Laden der Kanäle: {e}")
        return jsonify({"entries": []}), 500

@app.route('/api/epg')
def get_epg():
    import time
    # EPG-Cache für 5 Minuten (300 Sekunden)
    if EPG_CACHE["data"] and (time.time() - EPG_CACHE["last_updated"] < 300):
        return jsonify(EPG_CACHE["data"])

    try:
        # Fragt die EPG-Daten für die Kanäle ab
        url = f"{TVH_HOST}/api/epg/events/grid"
        # limit=300 sollte bei 300 Sendern reichen, um die aktuellen Events zu holen
        params = {'limit': 300}
        res = requests.get(url, auth=get_tvh_auth(), params=params, timeout=5)
        data = res.json()
        EPG_CACHE["data"] = data
        EPG_CACHE["last_updated"] = time.time()
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/stream/<channel_id>')
def stream_channel(channel_id):
    # Schicke dem Frontend den Link zu unserer EIGENEN Flask-Route!
    return jsonify({
        "stream_url": f"/video_proxy/{channel_id}"
    })
    
@app.route('/video_proxy/<channel_id>')
def video_proxy(channel_id):
    # 'pass' ist bei verschlüsselten Sendern am schnellsten, da TVheadend nicht zusätzlich codieren muss
    #tvh_url = f"{TVH_HOST}/stream/channel/{channel_id}?profile=pass"
    tvh_url = f"{TVH_HOST}/stream/channel/{channel_id}?profile=webtv-h264-aac-matroska"
    
    try:
        # Höherer Timeout (15 Sek), damit die Entschlüsselung (Oscam/Softcam) Zeit hat
        req = requests.get(
            tvh_url, 
  #          auth=('admin', 'admin'), # Deine TVH-Zugangsdaten
            stream=True, 
            timeout=15
        )
        
        if req.status_code != 200:
            print(f"TVheadend Fehler: {req.status_code}")
            return f"TVheadend Fehler: {req.status_code}", req.status_code

        # Generator für die Videodaten
        def generate():
            try:
                # Warten auf den ersten Datenblock (Entschlüsselung abwarten)
                for chunk in req.iter_content(chunk_size=1024 * 32):
                    if chunk:
                        yield chunk
            except (GeneratorExit, requests.exceptions.RequestException, ConnectionResetError):
                # Wenn der User den Sender wechselt, Verbindung zu TVH sofort schließen
                print("Stream vom Client getrennt.")
            finally:
                req.close()

        # Content-Type von TVheadend (meist video/mp2t oder video/mp4) weitergeben
        content_type = req.headers.get('Content-Type', 'video/mp2t')

        return Response(
            stream_with_context(generate()),
            content_type=content_type,
            headers={
                'Accept-Ranges': 'none',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Connection': 'keep-alive'
            }
        )

    except requests.exceptions.Timeout:
        print("Entschlüsselung hat zu lange gedauert (Timeout)!")
        return "Sender konnte nicht rechtzeitig entschlüsselt werden.", 504
    except Exception as e:
        print(f"Proxy-Fehler: {e}")
        return f"Proxy-Fehler: {str(e)}", 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0' , port=5000)
