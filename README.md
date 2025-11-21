# CASAGATEWAY Proxy

Vercel Serverless Function als Proxy für die CASAGATEWAY API mit HMAC-Authentifizierung.

## Setup

1. **GitHub Repository erstellen**
   - Gehe auf GitHub und erstelle ein neues Repository
   - Lade diese Dateien hoch

2. **Auf Vercel deployen**
   - Gehe auf [vercel.com](https://vercel.com)
   - Klicke auf "Import Git Repository"
   - Wähle dein GitHub Repository aus
   - Klicke auf "Deploy"

3. **Environment Variables setzen**
   - Gehe zu deinem Projekt → Settings → Environment Variables
   - Füge hinzu:
     - `CASAGATEWAY_PRIVATE_KEY` = Dein Private Key
     - `CASAGATEWAY_API_KEY` = Dein Public/API Key
   - Klicke auf "Redeploy" nach dem Setzen der Variablen

## Verwendung

### Endpoint
```
https://dein-projekt.vercel.app/api/properties
```

### Query Parameter (optional)
- `format` - Format der Response (default: `swissrets:2.7`)
  - Beispiel: `?format=swissrets:2.7`
- `company` - Company Slug Filter
  - Beispiel: `?company=firma-slug`

### Beispiele

**Basis Request:**
```
GET https://dein-projekt.vercel.app/api/properties
```

**Mit Format:**
```
GET https://dein-projekt.vercel.app/api/properties?format=swissrets:2.7
```

**Mit Format und Company:**
```
GET https://dein-projekt.vercel.app/api/properties?format=swissrets:2.7&company=firma-slug
```

## Integration in Framer

### Mit AnySync Fetch Component:
1. Ziehe eine "Fetch" Komponente auf dein Canvas
2. Setze die URL: `https://dein-projekt.vercel.app/api/properties`
3. Optional: Füge Query Parameter hinzu

### Mit Code Override:
```typescript
export function FetchProperties(): Override {
    return {
        async onClick() {
            const response = await fetch(
                'https://dein-projekt.vercel.app/api/properties?format=swissrets:2.7'
            );
            const data = await response.text();
            console.log(data);
        }
    }
}
```

## Technische Details

- **HMAC-Authentifizierung:** SHA256-basiert wie im Postman Script
- **CORS:** Aktiviert für alle Origins
- **Memory:** 1024MB
- **Max Duration:** 10 Sekunden
- **Rate Limit:** Vercel Free Plan = 100.000 Requests/Monat

## Debugging

Logs kannst du in Vercel unter:
`Dein Projekt → Deployments → [Latest] → Function Logs`

## Sicherheit

⚠️ **Wichtig:** Private und Public Keys werden NUR in Vercel Environment Variables gespeichert und NIEMALS im Code committed!
