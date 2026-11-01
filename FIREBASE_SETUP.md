# Firebase für Filament Shelf

Projekt: **filament-shelf-fa409**. Die Web-Konfiguration ist eingebunden. Die Website bleibt auf GitHub Pages unter https://manuel.tools/filament-shelf/.

## Einmal in der Firebase-Konsole

1. Firestore Database erstellen: **Standard**, ID **(default)**, **europe-west3 / Frankfurt**, zunächst **Produktionsmodus**.
2. **Authentication → Anmeldemethode → Google** aktivieren, Support-E-Mail wählen und speichern.
3. **Authentication → Einstellungen → Autorisierte Domains**: `manuel.tools` hinzufügen. Kein `https://` und kein Pfad. Vorhandene Firebase-Domains behalten. Falls die Website auch direkt über `ieeks.github.io` genutzt werden soll, zusätzlich diese Domain eintragen. Für die normale Adresse `manuel.tools/filament-shelf/` genügt `manuel.tools`.
4. **Firestore Database → Regeln** öffnen. Den vollständigen Inhalt von [firestore.rules](firestore.rules) hineinkopieren und **Veröffentlichen**. Die Datei im GitHub-Repository allein veröffentlicht keine Firebase-Regeln. Kein Testmodus und keine pauschale Freigabe für alle Benutzer erforderlich.

Private Bestandsdaten bleiben für ein Google-Konto ausschließlich im eigenen Pfad `users/{uid}/shelf/inventory` erreichbar. Bewusst erstellte Leselinks erlauben zusätzlich nur den Lesezugriff auf eine getrennte öffentliche Kopie. Andere Konten haben eigene getrennte Regale. Client-Löschen und Auflisten von Nutzerdaten sind gesperrt. Vollständige Datenprüfung und Revisionskonflikte behandelt die App zusätzlich.

## Den richtigen Bestand übernehmen

1. Auf dem Gerät/Browser mit deinem aktuellsten Bestand **Backup → JSON exportieren**. Falls dein aktuellster Stand nur als Backup existiert, zuerst lokal importieren und prüfen.
2. **Sync → Mit Google anmelden**. Beim ersten Verbinden erscheint **Diesen Browserbestand übernehmen**, inklusive Rollen-/Wunschanzahl. Prüfen und bestätigen.
3. Auf weiteren Geräten dieselbe Website öffnen und mit **demselben Google-Konto** anmelden. Vorhandene Cloud-Daten werden geladen. Dortige lokale Startrollen werden nicht angehängt.
4. Kurz prüfen: auf Gerät A einen Wunsch hinzufügen, auf Gerät B dessen Erscheinen kontrollieren. Danach eine Rolle ändern und ebenfalls kontrollieren.

Lokale Daten werden nicht gelöscht. Abmelden zeigt wieder den separaten lokalen Bestand von vor der Cloud-Nutzung. Spätere lokale Änderungen werden nicht automatisch in die Cloud gemischt; dazu bewusst ein Backup ergänzen/importieren. Backups im Cloud-Modus sichern den angezeigten gemeinsamen Bestand.

Cloud-Speichern braucht Internet. Wenn ein anderes Gerät während einer offenen Bearbeitung speichert, bleiben die Eingaben erhalten, werden aber nicht über den neueren Stand geschrieben. Aktuellen Stand laden, dann die Änderung erneut eingeben. Keine automatische Konfliktzusammenführung und keine Offline-Schreibwarteschlange.

## Fehler beheben

- **Zugriff verweigert / permission-denied**: Regeln in genau diesem Firebase-Projekt veröffentlichen, danach in Sync **Verbindung erneut prüfen**.
- **unauthorized-domain**: `manuel.tools` in Authentication ergänzen.
- **operation-not-allowed**: Google-Anmeldung aktivieren.
- **Popup blockiert**: Website in Safari/Chrome öffnen, Pop-ups für sie erlauben und den Anmeldeknopf erneut selbst antippen. Kein In-App-Webview verwenden.
- **Cloud nicht erreichbar**: Verbindung prüfen, offene Eingaben noch nicht schließen. Erneut speichern oder Sync-Verbindung neu prüfen (letzteres schließt offene Bearbeitungen).
- **Zu großer Cloud-Bestand**: maximal 900 KB pro gemeinsamem Snapshot; ein JSON-Backup exportieren. Lokal bleibt das bisherige 5-MB-Importlimit erhalten.

Die öffentliche Web-Konfiguration ist kein Admin-Schlüssel. Keine Service-Account-Schlüssel oder Google-Passwörter ins Repository laden. Die Zugriffskontrolle übernehmen Anmeldung und die veröffentlichten Firestore-Regeln.

## Entwicklung und optionale Regeltests

Die Website braucht weiterhin weder npm-Pakete noch einen Build. Kern-/Adaptertests: `npm test`.

Für den lokalen Firestore-Regeltest einmal Java 21+ und die isolierten Testabhängigkeiten installieren:

```sh
npm install --prefix tests/firebase
npm --prefix tests/firebase test
```

Der Test startet ausschließlich den lokalen Emulator für `demo-filament-shelf`, prüft Eigentümerzugriff und Konflikte und beendet ihn wieder. Für ein späteres Regeln-Deployment per CLI muss das echte Zielprojekt ausdrücklich gewählt werden; die Emulator-Tests veröffentlichen nichts.

## Leselink für Familie und Freunde

**Wichtig bei Updates von V1.2:** Den vollständigen neuen Inhalt von `firestore.rules` unter **Firestore → Regeln** einsetzen und veröffentlichen. Die neuen Regeln sichern sowohl den privaten Bestand als auch Leselinks ab.

1. Eigenen Cloud-Bestand verbinden.
2. Auf **Teilen → Leselink erstellen** klicken.
3. **Link kopieren** und an die gewünschten Personen weitergeben. Sie müssen sich nicht anmelden.
4. Bei Bedarf **Teilen → Freigabe deaktivieren**. Ein späterer neuer Link ersetzt den alten und aktiviert ihn nicht wieder.

Geteilt werden nur Rollen im Regal: Material, Farbe/Farbcode, Farbwert, Gewicht, Spule/Refill und Status. Kaufdaten, Notizen, Verlauf, Archiv, Wunschliste und Kontodaten bleiben privat. Die Leseransicht aktualisiert sich bei gespeicherten Änderungen automatisch. Jeder mit dem Link kann ihn weitergeben; bereits betrachtete/gesicherte Inhalte können nicht rückwirkend gelöscht werden.

Falls Leselink-Erstellung oder Bestandsänderungen mit aktiver Freigabe an `permission-denied` scheitern, zuerst prüfen, ob die **vollständigen aktuellen** Regeln in genau diesem Firebase-Projekt veröffentlicht wurden. Ein fehlgeschlagener geteilter Schreibvorgang ändert auch den privaten Bestand nicht teilweise.
