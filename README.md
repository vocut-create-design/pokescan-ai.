# POKÉSCAN AI – Beta 1.0

Mobile, installierbare Web-App ohne eigenen Server.

## Starten
Die Dateien auf GitHub Pages oder einen anderen HTTPS-Webhost hochladen. Anschließend die veröffentlichte URL am Smartphone öffnen und zum Home-Bildschirm hinzufügen. Lokal kann man mit `python -m http.server 8000` testen (localhost).

## Enthalten
- Kamera und Foto-Upload
- Optionale browserseitige OCR der Kartennummer, sofern TextDetector verfügbar ist
- Katalogsuche via TCGdex in 8 Sprachen; Treffer müssen manuell verifiziert werden
- Lokale Sammlung mit JSON-Import/Export
- PWA mit Offline-App-Shell

## Einschränkungen
- Keine vollautomatische Bildidentifikation auf allen Geräten; manuelle Eingabe ist der verlässliche Fallback.
- Keine Live-Marktwerte und keine Grading-Prognose in Beta 1.0.
- Für die Kartensuche ist Internet erforderlich.
- Fotos werden nur lokal angezeigt und nicht dauerhaft gespeichert.
- Kartennummernsuche liefert potenziell viele Treffer, da eine Nummer in mehreren Sets vorkommen kann.
