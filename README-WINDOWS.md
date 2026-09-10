# Budgetplaneraren för Windows

Budgetplaneraren använder Tauri v2 för att paketera den befintliga HTML/CSS/JavaScript-appen som ett vanligt Windows-program. Appen körs i ett eget fönster med Windows WebView2, utan Chrome, Edge eller en webbadress. Budgetar och tema sparas lokalt med `localStorage`.

## Förutsättningar

- Windows 10 eller Windows 11
- Node.js 22 eller senare
- Rust med MSVC-toolchain från [rustup.rs](https://rustup.rs/)
- Microsoft WebView2 Runtime
- Visual Studio Build Tools med Desktop development with C++

Installera Rust och starta sedan om VS Code:

```powershell
winget install Rustlang.Rustup
rustup default stable-msvc
```

## Testa appen

```powershell
npm install
npm run tauri:dev
```

Det öppnar Budgetplaneraren i ett eget Windows-fönster.

## Bygg installationsprogrammet

```powershell
npm install
npm run build:windows
```

Tauri bygger en NSIS-installationsfil i:

```text
src-tauri\target\release\bundle\nsis\Budgetplaneraren_1.0.0_x64-setup.exe
```

Med updater-konfigurationen skapas dessutom signaturen bredvid installationsfilen:

```text
src-tauri\target\release\bundle\nsis\Budgetplaneraren_1.0.0_x64-setup.exe.sig
```

Installationsprogrammet skapar en Start-meny-post och en skrivbordsgenväg med Budgetplanerarens ikon.

## Automatiska uppdateringar via GitHub Releases

Updater-provider är konfigurerad för repositoryt:

```text
https://github.com/Wallahia/MyBudgetplan
```

Appen hämtar alltid metadata från:

```text
https://github.com/Wallahia/MyBudgetplan/releases/latest/download/latest.json
```

Detta är Tauri v2:s rekommenderade statiska updater-format. GitHub Release måste därför innehålla en asset med exakt namnet `latest.json`.

### Filer som ska publiceras i en Release

För version `1.0.1` laddas dessa tre filer upp till samma GitHub Release, exempelvis Release-taggen `v1.0.1`:

```text
Budgetplaneraren_1.0.1_x64-setup.exe
Budgetplaneraren_1.0.1_x64-setup.exe.sig
latest.json
```

Ladda inte upp `budgetplaneraren.key`, `.tauri`-mappen eller någon annan privat nyckelfil.

### Innehållet i latest.json

Skapa filen `latest.json` lokalt. Använd den signerade texten från `.sig`-filen som värde för `signature` och använd den exakta GitHub Release-URL:en till installeraren som värde för `url`:

```json
{
	"version": "1.0.1",
	"notes": "Förbättringar och buggfixar.",
	"pub_date": "2026-09-03T12:00:00Z",
	"platforms": {
		"windows-x86_64": {
			"signature": "INNEHÅLLET_FRÅN_Budgetplaneraren_1.0.1_x64-setup.exe.sig",
			"url": "https://github.com/Wallahia/MyBudgetplan/releases/download/v1.0.1/Budgetplaneraren_1.0.1_x64-setup.exe"
		}
	}
}
```

`signature` får inte vara filnamnet eller en hash. Det ska vara hela texten i `.sig`-filen. `latest.json` ska laddas upp som en vanlig Release asset på samma Release som installeraren och `.sig`-filen. JSON-filen ska inte laddas upp till repositoryts vanliga filstruktur.

### Skapa version 1.0.1

Ändra versionen från `1.0.0` till `1.0.1` i dessa filer:

```text
package.json
src-tauri\tauri.conf.json
src-tauri\Cargo.toml
```

Kör sedan builden från PowerShell. Den privata nyckeln ska hållas lokalt; använd helst en miljövariabel för både nyckeln och lösenordet i samma PowerShell-session:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content -Raw "src-tauri/.tauri/budgetplaneraren.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "DITT_LOKALA_NYCKEL-LÖSENORD"
npm run build:windows
```

Efteråt finns installeraren och `.sig`-filen i:

```text
src-tauri\target\release\bundle\nsis\
```

### GitHub-guide från början till slut

1. Skapa ett publikt repository på GitHub med namnet `MyBudgetplan` under användaren `Wallahia`.
2. Ladda upp projektfilerna, men inte `src-tauri/.tauri/budgetplaneraren.key`, `.pub`-filen eller `.tauri`-mappen. `.gitignore` ignorerar redan `.tauri`.
3. Ändra versionsnumret till `1.0.1` i `package.json`, `src-tauri/tauri.conf.json` och `src-tauri/Cargo.toml`.
4. Kör `npm install` och bygg med `npm run build:windows` efter att signeringsvariablerna satts.
5. Hitta `Budgetplaneraren_1.0.1_x64-setup.exe` och motsvarande `.sig` i `src-tauri\target\release\bundle\nsis\`.
6. Skapa en GitHub Release med taggen `v1.0.1`.
7. Ladda upp installeraren och dess `.sig`-fil som Release assets.
8. Skapa `latest.json` med formatet ovan och klistra in hela innehållet från `.sig` i `signature`.
9. Ladda upp `latest.json` som en tredje Release asset med exakt det namnet.
10. Kontrollera att denna URL kan öppnas utan inloggning och visar JSON: `https://github.com/Wallahia/MyBudgetplan/releases/latest/download/latest.json`.
11. Installera först version `1.0.0`, skapa och spara en testbudget, starta sedan appen igen och välj `Uppdatera nu` när version `1.0.1` hittas.
12. Kontrollera efter omstart att appen visar version `1.0.1` och att budgetarna finns kvar.

Updatern verifierar `.sig` mot public key i `src-tauri\tauri.conf.json` innan installation. Den privata nyckeln används endast när builden signeras och finns aldrig i installeraren, `latest.json`, GitHub eller projektets publika filer. Appuppdateringen ersätter programfilerna och rör inte appens `localStorage`, där budgetarna sparas.

### Automatisk release med GitHub Actions

Workflow-filen `.github/workflows/release.yml` körs när en semver-tagg pushas, exempelvis `v1.0.3`. Den kontrollerar att taggen matchar versionen i `package.json`, bygger den signerade Windows-installern, skapar `latest.json` från samma `.exe` och `.sig`, och publicerar alla tre filerna i samma GitHub Release.

Lägg dessa GitHub Actions secrets under repositoryts **Settings > Secrets and variables > Actions**:

- `TAURI_SIGNING_PRIVATE_KEY`: hela innehållet från den privata Tauri-nyckeln.
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: lösenordet till nyckeln.

Den privata nyckeln ska aldrig committas till repositoryt.

Updatern kontrollerar vid appstart och därefter var sjätte timme. När en ny version hittas laddas den ner i bakgrunden medan appen kan fortsätta användas. När nedladdningen är klar väljer användaren när den signerade uppdateringen ska installeras. På Windows startar Tauri den signerade NSIS-installern och appen startas om efter installationen.

### Ny release

1. Ändra versionen i `package.json`, `src-tauri/tauri.conf.json` och `src-tauri/Cargo.toml`.
2. Commita och pusha ändringen.
3. Skapa och pusha en matchande tagg:

```powershell
git tag v1.0.3
git push origin v1.0.3
```

GitHub Actions bygger och publicerar releasen automatiskt. Befintliga användare hämtar metadata från `latest.json`; Tauri verifierar `.sig` mot public key innan installation. Uppdateringen ersätter bara programfilerna och lämnar `localStorage` orörd.

## Efter ändringar

Ändra bara den gemensamma webbkoden. Kör därefter:

```powershell
npm run build:windows
```

Tauri bäddar in `index.html`, `budget.html`, `profile.html`, `script.js`, `style.css` och den lokala Chart.js-filen i den nya installeraren.

## Mobilprojekt

Android- och iOS-konfigurationen används inte längre av projektets npm-skript. Windows-versionen byggs enbart från `src-tauri/` och den gemensamma webbkoden.