const CryptoJS = require('crypto-js');
const { XMLParser } = require('fast-xml-parser');

module.exports = async (req, res) => {
  // 1. CORS Headers setzen
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 2. Keys holen
    const privateKey = process.env.CASAGATEWAY_PRIVATE_KEY;
    const apiKey = process.env.CASAGATEWAY_API_KEY;

    if (!privateKey || !apiKey) {
      throw new Error('API keys not configured in Vercel.');
    }

    // 3. Parameter vorbereiten
    // WICHTIG: Wir setzen hier Defaults, damit du sie in der URL nicht vergessen kannst
    
    // Wenn ?company= gesetzt ist, nimm das, sonst nimm hart "rudatestates"
    // Wir nennen den Parameter intern "provider", da Casasoft das meist so will
    const providerSlug = req.query.company || req.query.provider || 'rudatestates'; 
    
    const format = req.query.format || 'swissrets:2.7';
    const limit = req.query.limit || '500'; // Wir setzen das Limit hoch!
    const debugMode = req.query.debug === 'true'; // Neuer Debug Modus

    // Timestamp
    const timestamp = Date.now();

    // 4. Parameter für den HMAC Checkstring sammeln
    // Casasoft braucht key + value verkettet, alphabetisch nach key sortiert.
    
    const params = [];
    
    // Diese Parameter schicken wir an die API:
    params.push({ key: 'format', value: format });
    params.push({ key: 'limit', value: limit });
    params.push({ key: 'provider', value: providerSlug });
    
    // Optionale Parameter (nur wenn in URL vorhanden)
    if (req.query.availability) params.push({ key: 'availability', value: req.query.availability });
    if (req.query.type) params.push({ key: 'type', value: req.query.type });
    if (req.query.offset) params.push({ key: 'offset', value: req.query.offset });

    // ALPHABETISCH SORTIEREN (Entscheidend!)
    params.sort((a, b) => a.key.localeCompare(b.key));
    
    // String bauen: keyvaluekeyvalue...
    const optionsStr = params.reduce((acc, param) => {
      return `${acc}${param.key}${param.value}`;
    }, '');

    // 5. Hash berechnen
    // Schema: paramsString + privateKey + timestamp
    const hmacString = `${optionsStr}${privateKey}${timestamp}`;
    const hmac = CryptoJS.SHA256(hmacString).toString(CryptoJS.enc.Hex);

    // 6. URL Query String bauen
    const queryParams = new URLSearchParams();
    queryParams.append('apikey', apiKey);
    queryParams.append('timestamp', timestamp);
    queryParams.append('hmac', hmac);
    
    // Alle anderen Parameter anhängen
    params.forEach(p => queryParams.append(p.key, p.value));

    const apiUrl = `https://casagateway.ch/rest/publisher-properties?${queryParams.toString()}`;

    // 7. Request senden
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Casasoft API Error ${response.status}: ${errorText}`);
    }

    const xmlData = await response.text();

    // 8. DEBUG CHECK
    // Wenn du ?debug=true aufrufst, geben wir das rohe XML zurück.
    // So siehst du, ob Casasoft wirklich nur 2 liefert.
    if (debugMode) {
      res.setHeader('Content-Type', 'application/xml');
      return res.status(200).send(xmlData);
    }

    // 9. XML zu JSON parsen
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '', // Keine Prefixe für saubereres JSON
      textNodeName: 'value',
      parseAttributeValue: true,
      trimValues: true,
      isArray: (name, jpath, isLeafNode, isAttribute) => {
        // Erzwinge Arrays für Listen, auch wenn nur 1 Element da ist
        if (name === 'property') return true;
        if (name === 'attachment') return true;
        return false;
      }
    });
    
    const jsonData = parser.parse(xmlData);
    
    // Sicherheitshalber prüfen, ob wir Daten haben
    const properties = jsonData?.publisherProperties?.property || [];
    
    // Info-Log (erscheint in Vercel Logs)
    console.log(`Gefundene Properties: ${properties.length}`);

    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(jsonData);

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Fehler beim Abrufen der Daten', 
      details: error.message 
    });
  }
};