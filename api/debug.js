const CryptoJS = require('crypto-js');
const { XMLParser } = require('fast-xml-parser');

module.exports = async (req, res) => {
  // CORS Headers für Framer
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Hole Keys aus Environment Variables
    const privateKey = process.env.CASAGATEWAY_PRIVATE_KEY;
    const apiKey = process.env.CASAGATEWAY_API_KEY;

    if (!privateKey || !apiKey) {
      return res.status(500).json({ 
        error: 'API keys not configured',
        message: 'Please set CASAGATEWAY_PRIVATE_KEY and CASAGATEWAY_API_KEY in Vercel Environment Variables'
      });
    }

    // Optionale Parameter aus Query
    const format = req.query.format || 'swissrets:2.7';
    const company = req.query.company || '';
    const responseFormat = req.query.responseFormat || 'json'; // 'json' oder 'xml'
    
    // Zusätzliche Filter (falls CASAGATEWAY diese unterstützt)
    const limit = req.query.limit || '';
    const offset = req.query.offset || '';
    const availability = req.query.availability || ''; // z.B. 'active'
    const type = req.query.type || ''; // z.B. 'buy', 'rent'

    // Timestamp generieren
    const timestamp = Date.now();

    // Query Parameter sortieren und zu String
    const params = [];
    if (availability) params.push({ key: 'availability', value: availability });
    if (company) params.push({ key: 'company', value: company });
    params.push({ key: 'format', value: format });
    if (limit) params.push({ key: 'limit', value: limit });
    if (offset) params.push({ key: 'offset', value: offset });
    if (type) params.push({ key: 'type', value: type });
    
    // Alphabetisch sortieren (wichtig für HMAC!)
    params.sort((a, b) => a.key.localeCompare(b.key));
    
    const optionsStr = params.reduce((acc, param) => {
      return `${acc}${param.key}${param.value}`;
    }, '');

    // HMAC berechnen wie im Postman Script
    const hmacString = `${optionsStr}${privateKey}${timestamp}`;
    const hmac = CryptoJS.SHA256(hmacString).toString(CryptoJS.enc.Hex);

    // URL zusammenbauen
    const queryParams = new URLSearchParams({
      apikey: apiKey,
      format: format,
      timestamp: timestamp.toString(),
      hmac: hmac
    });

    // Optionale Parameter hinzufügen
    if (company) queryParams.append('company', company);
    if (limit) queryParams.append('limit', limit);
    if (offset) queryParams.append('offset', offset);
    if (availability) queryParams.append('availability', availability);
    if (type) queryParams.append('type', type);

    const apiUrl = `https://casagateway.ch/rest/publisher-properties?${queryParams.toString()}`;

    console.log('Fetching from CASAGATEWAY...'); // Für Debugging in Vercel Logs

    // API Call zu CASAGATEWAY
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`CASAGATEWAY returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.text();

    // Wenn JSON gewünscht ist, konvertiere XML zu JSON
    if (responseFormat === 'json') {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        textNodeName: '#text',
        parseAttributeValue: true,
        trimValues: true
      });
      
      const jsonData = parser.parse(data);
      
      res.setHeader('Content-Type', 'application/json');
      res.status(200).json(jsonData);
    } else {
      // Original XML zurückgeben
      const contentType = response.headers.get('content-type') || 'application/xml';
      res.setHeader('Content-Type', contentType);
      res.status(200).send(data);
    }

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch properties',
      message: error.message 
    });
  }
};