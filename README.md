# WebTV Project 📺

Eine moderne WebTV-Plattform für das Streamen von Live-Inhalten und Video-on-Demand (VoD) direkt im Browser.

## 📝 Projektbeschreibung
Dieses Projekt ist eine webbasierte TV-Plattform (WebTV). Sie ermöglicht es Benutzern, Live-Streams anzusehen, Mediatheken zu durchsuchen und Video-Inhalte ohne zusätzliche Plugins oder Software abzuspielen. Die Anwendung ist vollständig responsiv und für Desktops, Tablets sowie Smartphones optimiert.

### Kernfunktionen
* **Live-Streaming:** Unterstützung von HLS/DASH-Streams für flüssige Live-Übertragungen.
* **Video-on-Demand (VoD):** Eine strukturierte Mediathek für aufgezeichnete Sendungen und Videos.
* **Elektronischer Programmführer (EPG):** Anzeige des aktuellen und kommenden TV-Programms.
* **Responsive Design:** Optimierte Benutzeroberfläche für alle Bildschirmgrössen.

## 🚀 Erste Schritte

### Voraussetzungen
TVHeadend muss installiert sein und alle Sender eingelesen

### Installation
1. Repository klonen:
   ```bash
   git clone https://github.com/darosto/WebTV.git
   ```
2. In das Projektverzeichnis wechseln:
   ```bash
   cd WebTV
   ```
3. Abhängigkeiten installieren:
   ```bash
   python3 -m venv .venv
   . .venv/bin/activate
   pip install -r requirements.txt
   ```

### Anwendung starten
Starten Sie den lokalen Entwicklungsserver:
```bash
python app.py
```

## 🛠️ Tech Stack
* **Frontend:** HTML5, CSS3, Flask
* **Video-Player:** Video.js / Hls.js
* **TVHeadend:** localhost oder im LAN
