# Filament Shelf

Ein leichtes, statisches Filament-Inventar für den Bambu Lab P2S Combo. HTML, CSS und Vanilla JavaScript, ohne Backend, API-Keys, Frameworks, npm-Abhängigkeiten oder Build-Schritt.

## Version 1.1

- Helles, responsives Dashboard mit farbigen CSS-Spulen, Instrument Sans und IBM Plex Mono.
- **16 Ausgangsrollen / 16 kg**: 12 PLA, 4 PETG; Purple als Refill, Navy Blue als Geschenk (0 €). Alle Rollen starten bei 1.000 g und Status „Neu“.
- Lokaler offizieller Bambu-Studio-Katalog mit **318 Einträgen**, abgerufen am 31.10.2026. `10301` erkennt Bambu Lab / PLA Basic / Pumpkin Orange / `#FF9016FF`.
- Fünfstellige Farbcodes werden exakt gesucht. Mehrere Treffer sind auswählbar. Unbekannte Codes lassen sich mit Material, Farbname und HEX selbst anlegen. Auch andere Materialien/Hersteller können manuell erfasst werden; das Farbcodeformat bleibt fünfstellig.
- Jede physische Rolle hat eine eigene ID, auch bei derselben Farbe.
- Rollen hinzufügen, bearbeiten, Verbrauch buchen, archivieren, wiederherstellen oder nach Bestätigung löschen.
- Grammwerte mit bis zu zwei Dezimalstellen, Status Neu/Angebrochen/Leer, Kaufdatum, Preis und Notizen.
- Suche nach englischem/deutschem Katalognamen, Material oder Farbcode; Materialgruppe, Untertyp, Farbfamilie und Status als Filter; vier Sortierungen.
- Statistiken zu Gewicht, Rollen, Materialgruppen/-untertypen, Farben sowie den letzten 30 Verbrauchsbuchungen.
- Wunschliste mit Farbcode-Erkennung, Menge, Notizen und Übernahme gekaufter Rollen ins Inventar.
- Validierter JSON-Import mit Vorschau, Ergänzen/Ersetzen, Export und Rückkehr zum Stand vor dem letzten Import.

## Sofort lokal starten

Im Projektordner:

```sh
python3 -m http.server 8080
```

Dann `http://localhost:8080` öffnen. Alternativ einen vorhandenen statischen HTTP-Server verwenden. `index.html` nicht per `file://` doppelklicken: ES-Module benötigen einen HTTP(S)-Server. Node wird nur für Tests und das optionale Katalog-Update verwendet, nicht zum Betrieb.

## GitHub Pages

Repository: https://github.com/ieeks/filament-shelf

Pages verwendet **main → /(root)**. Änderungen an `main` werden automatisch veröffentlicht. Die aktuelle Website-Adresse steht im Repository unter **Settings → Pages**. Bei einer benutzerdefinierten Pages-Domain kann die Projektseite über diese Domain erreichbar sein.

Alle Assetpfade sind relativ. Dadurch funktioniert die App sowohl unter `/filament-shelf/` als auch auf einer eigenen Domain. `.nojekyll` liegt bei; keine eigene Actions-/Build-Pipeline nötig.

Immer dieselbe Website-Adresse nutzen: localStorage ist an die Domain gebunden. Vor einem Domainwechsel auf der bisherigen Adresse ein JSON-Backup exportieren und auf der neuen Adresse importieren.

### Weiterentwickeln

```sh
git clone https://github.com/ieeks/filament-shelf.git
cd filament-shelf
node --test tests/*.test.js
```

Nach Änderungen passende Tests ausführen, committen und nach `main` pushen. Kein Build und keine Paketinstallation erforderlich. Den Fortschritt der Veröffentlichung zeigt GitHub unter **Actions → pages build and deployment**.

## Bedienung

### Neue Rolle

1. Im Schnellfeld z. B. `10301` eingeben → **Erkennen**.
2. Angaben prüfen, **Spule** oder **Refill** wählen, optional Gewicht/Kaufdaten/Notizen ergänzen.
3. **Rolle hinzufügen**. Jeder bewusste neue Eintrag ist eine zusätzliche physische Rolle; gleicher Farbcode ist ausdrücklich erlaubt. Doppelte Klicks während des Speicherns werden blockiert.

Bei einem unbekannten Code die Felder manuell füllen. Bei mehreren Katalogtreffern einen auswählen. HEX-Werte können sechs oder acht Stellen enthalten, mehrere Farben werden durch Komma getrennt. Beim Ändern eines Farbcodes werden alte Farbangaben geleert, um versehentliche falsche Zuordnungen zu verhindern.

### Wunschliste

Unter **Wunschliste → Wunsch hinzufügen** einen Farbcode erkennen oder manuelle Angaben eingeben. Gewünschte Menge (1–99), Spule/Refill und Notizen speichern. Wünsche zählen noch nicht zum Bestand. Über **⋯** lassen sie sich bearbeiten oder löschen.

**1 Rolle ins Regal** öffnet die Angaben für eine gekaufte Rolle. Beim Speichern entsteht eine eigenständige Inventarrolle; die Wunschmenge sinkt gleichzeitig um eins. Der letzte erfüllte Wunsch verschwindet aus der Liste. Bestand und Wunschliste werden gemeinsam gespeichert, auch im JSON-Backup.

### Verbrauch und Bearbeitung

- **− Verbrauch** auf der Karte: Grammzahl oder Vorgabe wählen, optional Projekt angeben, speichern. Das Restgewicht wird automatisch abgezogen; negative Werte oder Verbrauch über dem Bestand sind unzulässig.
- **⋯** öffnet die Bearbeitung. Start-/Restgewicht können korrigiert werden, etwa nach dem Wiegen. Dafür das reine Filamentgewicht ohne Leergewicht der Spule verwenden.
- 0 g → **Leer**, Teilgewicht → **Angebrochen**, volles Gewicht → **Neu** oder manuell **Angebrochen**. Die Auswahl „Neu“ setzt das Restgewicht auf das Startgewicht; „Leer“ auf 0 g. Die Werte werden vor dem Speichern sichtbar aktualisiert.
- Leere Rollen sind standardmäßig ausgeblendet. Über Status **Leer** oder **Im Regal · alle** anzeigen. Archivierte Rollen werden nur im **Archiv** angezeigt und können zurückgeholt werden. Auch gefüllte Rollen dürfen bewusst archiviert werden.
- Löschen entfernt die Rolle samt Verbrauchsprotokoll nach Bestätigung. Zum Aufbewahren der Historie archivieren.

### Statistikdefinitionen

Die Kennzahlen beziehen sich immer auf **alle gespeicherten Rollen inklusive Archiv**; Kartenfilter ändern die Gesamtzahlen nicht. „Farben im Bestand“ zählt Kombinationen aus Hersteller, Material, Farbcode und Farbdarstellung mit positivem Restgewicht. Zwei Rollen derselben Variante zählen als eine Farbe. Weiß in unterschiedlichen Materialien zählt getrennt. Farbfamilien werden aus dem HEX-Farbton abgeleitet und sind eine praktische Näherung.

„Verbraucht“ = Summe aus Startgewicht minus Restgewicht. Manuelle Gewichtskorrekturen ändern diese Kennzahl, sind aber keine neuen Verbrauchsbuchungen. Gelöschte Rollen entfallen aus allen Statistiken. Das Protokoll zeigt ausschließlich tatsächlich gebuchte Verbräuche.

## Speicherung und Backups – wichtig

**Version 1 speichert nur im localStorage des jeweiligen Browsers auf der jeweiligen Domain. Es gibt KEINE automatische Synchronisierung zwischen iPhone, iPad und Desktop.** Auch ein anderer Browser oder eine andere Domain hat einen eigenen Datenbestand. Der erste Aufruf eines neuen Browsers legt wieder den Ausgangsbestand an.

- Änderungen werden sofort beim Speichern/Buchen/Archivieren persistiert. Nicht gespeicherte Formulareingaben sind keine gespeicherten Bestandsänderungen.
- Der Ausgangsbestand wird nur angelegt, wenn der Speicherschlüssel `filament-shelf:v1` überhaupt nicht existiert. Eine gespeicherte leere Rollenliste bleibt leer.
- Neuladen löscht nichts. Das Löschen von Browser-/Websitedaten, private Tabs, Speicherbereinigung durch das Betriebssystem oder ein Geräteverlust können lokale Daten jedoch entfernen. Deshalb regelmäßig **Backup → JSON exportieren**.
- Kein Datentransfer zum Drucker, Bambu-Konto oder einem Backend. Google Fonts werden extern geladen; bei Ausfall greifen Systemschriften. Der Katalog selbst ist vollständig lokal. Ein vollständiger Offline-Start der Website ist ohne Service Worker nicht garantiert.
- Speicherfehler werden angezeigt; der sichtbare Bestand wird erst nach erfolgreichem Schreiben aktualisiert. Ungültige Bestandsdaten werden niemals automatisch durch den Startbestand ersetzt.
- Bei beschädigten Daten: zuerst **Rohdaten sichern**, danach ein gültiges Backup über **Backup** importieren. Der beschädigte Originaltext bleibt zusätzlich unter `filament-shelf:damaged-original:v1` erhalten. Speicher- oder Sicherheitsblockaden müssen im Browser behoben werden.
- Bei parallelen Tabs verhindert ein Vergleich des gespeicherten Standes das Überschreiben veralteter Daten. Unterstützte Browser verwenden zusätzlich Web Locks. Nach einer Änderung im anderen Tab neu laden. Ohne Web-Locks-Unterstützung können exakt gleichzeitige Schreibvorgänge technisch nicht vollständig serialisiert werden; am besten nur einen Bearbeitungstab verwenden.
- JSON-Backups enthalten auch Kaufpreise und Notizen. Sie werden nicht automatisch in ein GitHub-Repository hochgeladen.

### Import

**Ergänzen**: Nur unbekannte Rollen- und Wunsch-IDs hinzufügen. Existierende IDs bleiben unverändert, selbst wenn das Backup andere Gewichte enthält. Ein zweimal importiertes Backup verdoppelt deshalb keine Rollen. Unabhängig angelegte reale Rollen derselben Farbe haben unterschiedliche IDs und bleiben erhalten.

**Ersetzen**: Den gesamten Bestand und die Wunschliste durch den Backup-Stand ersetzen, mit zweiter Bestätigung. Für den Wechsel auf ein anderes Gerät meistens sinnvoll, weil dort bereits die 16 Startrollen vorhanden sein können. Vorher wird der bisherige Stand lokal gesichert. Über **Stand vor letztem Import wiederherstellen** lässt er sich erneut als Ersetzungsimport prüfen und zurückholen. Auch eine Wiederherstellung legt den vorherigen Stand ab.

Schema `app: "filament-shelf"`, `version: 2`; maximal 5 MB, 5.000 Rollen und 5.000 Wünsche. Alte Backups und gespeicherte Daten mit Version 1 werden ohne erneuten Startimport übernommen. Beim Ergänzen eines alten Backups bleiben vorhandene Wünsche erhalten; beim Ersetzen wird dessen fehlende Wunschliste als leer übernommen (mit Warnung). Der localStorage-Schlüssel bleibt absichtlich unverändert. Validiert werden unter anderem IDs, Dubletten-IDs, Gewicht/Status, Farbcode, HEX, Datum, Preise und Verbrauchseinträge. Ungültige Dateien ändern den Bestand nicht. Ein gültiges Backup mit `rolls: []` ist zulässig. Unbekannte Zusatzfelder werden verworfen. Import auch durch Einfügen von JSON möglich.

## Architektur – spätere Synchronisierung

| Datei | Aufgabe |
| --- | --- |
| `index.html`, `styles.css` | Oberfläche, responsive Gestaltung, native Dialoge |
| `js/app.js` | Ereignisse, Formularlogik, sichere DOM-Ausgabe |
| `js/core.js` | Reine Fachlogik, Katalog, Validierung, Import, Statistik |
| `js/storage.js` | Asynchroner Repository-Adapter für localStorage |
| `js/catalog-data.js` | Kompakter lokaler Katalog |
| `js/seed.js` | Verlässlicher Ausgangsbestand und Katalogfallback |
| `tests/*.test.js` | Automatisierte Tests ohne Zusatzpakete |
| `data/bambu-source.json` | Originaldaten für Nachvollziehbarkeit |
| `scripts/update-catalog.mjs` | Optionales manuelles Katalog-Update |

Die Oberfläche speichert über `repository.load()`, `save()`, `recovery()` und `recover()`, die Fachlogik bleibt von localStorage unabhängig. Für Firestore kann später ein zweiter Adapter mit denselben Rollen-IDs und Schemafeldern ergänzt werden. Authentifizierung, Konfliktlösung, Security Rules und Sync-Status müssten dann bewusst hinzugefügt werden. **Firebase ist jetzt nicht eingebunden.**

Für gemeinsamen Bestand auf mehreren Geräten ist der nächste Schritt Firestore mit Google-Anmeldung: Alle Geräte verwenden dasselbe Konto; Security Rules beschränken Lesen und Schreiben auf dessen Nutzer-ID. Der bestehende Browserbestand wird einmal ausdrücklich als Ausgangsstand übernommen, weitere Geräte laden den Cloud-Bestand statt erneut Startrollen anzulegen. Rollen und Wünsche bekommen getrennte Datensätze mit stabilen IDs; konkurrierende Änderungen und die Übernahme aus der Wunschliste müssen transaktional verarbeitet werden. Dafür werden ein Firebase-Projekt, aktiviertes Firestore/Google-Login und die öffentliche Web-App-Konfiguration benötigt. Keine Admin-Schlüssel oder Passwörter gehören ins Repository. Die Website kann weiter auf GitHub Pages liegen.

Benutzertexte werden mit `textContent` bzw. Formularwerten ausgegeben, niemals als HTML ausgewertet. Dynamische Farben werden streng validiert. Kein `eval`, keine Secrets, keine Remote-Katalogabfrage beim Start.

## Tests

Node.js 20+ (empfohlen: aktuelles LTS), ohne `npm install`:

```sh
npm test
# oder:
node --test tests/*.test.js
```

Details und Browser-QA siehe `TESTING.md`. Echte iOS-Safari-Hardwareprüfung steht aus; die schmalen Layouts wurden im Chromium-Browser bei 390/820 px geprüft.

## Katalog aktualisieren

Optional bei Bedarf, mit Node.js und Internetzugriff:

```sh
node scripts/update-catalog.mjs
npm test
```

Diff prüfen, Quellenstand in `NOTICE.md` aktualisieren und committen. Der Regressionstest zur aktuellen Anzahl von 318 Einträgen muss bei einer beabsichtigten Katalogerweiterung angepasst werden. Bestehende Rollen werden durch Katalog-Updates **nicht** verändert. Keine automatische Aktualisierung, keine Build-Pipeline.

## Bewusst außerhalb von V1

Kein Firebase, keine Drucker-/AMS-Verbindung, keine Benutzerkonten, keine Kaufpreis-Automatik, kein Dark Mode und kein Service Worker. Die App bleibt ein schneller, manuell gepflegter Bestand mit sicherem Backup.

Quelle, Farbbesonderheiten und Lizenz: [NOTICE.md](NOTICE.md), [LICENSE](LICENSE).
