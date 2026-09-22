const ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter'
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8'
};

exports.handler = async function(event) {
  // Handle CORS preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ ok: true, message: "Preflight OK" })
    };
  }

  // Reject methods other than POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        ok: false,
        error: "service_unavailable",
        message: "Method not allowed. Only POST is allowed."
      })
    };
  }

  let bodyData;
  try {
    bodyData = JSON.parse(event.body || '{}');
  } catch (err) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        ok: false,
        error: "query_error",
        message: "Geçersiz JSON isteği gönderildi."
      })
    };
  }

  const query = bodyData.query;
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        ok: false,
        error: "query_error",
        message: "Overpass QL sorgusu boş olamaz."
      })
    };
  }

  if (query.length > 15000) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        ok: false,
        error: "query_error",
        message: "Overpass QL sorgusu izin verilen maksimum boyutu aşıyor."
      })
    };
  }

  // Sanity check: Ensure query contains expected OSM/mosque terms
  const lowerQuery = query.toLowerCase();
  const hasExpectedTerm = [
    'place_of_worship',
    'mosque',
    'building',
    'amenity',
    'iso3166-2',
    'boundary'
  ].some(term => lowerQuery.includes(term));

  if (!hasExpectedTerm) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        ok: false,
        error: "query_error",
        message: "Sorgu geçerli bir Overpass cami/ibadethane filtresi içermiyor."
      })
    };
  }

  console.log(`[Overpass Proxy] Processing query (length: ${query.length})...`);

  // Sequential fallback loop across Overpass endpoints
  for (const endpoint of ENDPOINTS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s per endpoint

    try {
      console.log(`[Overpass Proxy] Trying endpoint: ${endpoint}`);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Accept': 'application/json',
          'User-Agent': 'CennetBahceleri/1.0 (Admin Panel Overpass Proxy)'
        },
        body: 'data=' + encodeURIComponent(query),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Handle syntax or query error (HTTP 400 / 422)
      if (response.status === 400 || response.status === 422) {
        const errorText = await response.text().catch(() => '');
        console.warn(`[Overpass Proxy] Query syntax error from ${endpoint} (HTTP ${response.status}): ${errorText.substring(0, 200)}`);
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            ok: false,
            error: "query_error",
            message: `Overpass sorgu hatası (HTTP ${response.status}): ${errorText.substring(0, 300) || "Geçersiz sorgu yapısı."}`
          })
        };
      }

      // Handle server error, rate limit (429), or 406
      if (!response.ok) {
        console.warn(`[Overpass Proxy] Endpoint ${endpoint} returned HTTP ${response.status}, trying next endpoint...`);
        continue;
      }

      // Try to parse JSON
      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        console.warn(`[Overpass Proxy] Endpoint ${endpoint} returned non-JSON response, trying next endpoint...`);
        continue;
      }

      if (data && Array.isArray(data.elements)) {
        console.log(`[Overpass Proxy] Success via ${endpoint}. Raw elements count: ${data.elements.length}`);
        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            ok: true,
            endpoint: endpoint,
            data: data
          })
        };
      } else {
        console.warn(`[Overpass Proxy] Endpoint ${endpoint} returned JSON without 'elements' array, trying next...`);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        console.warn(`[Overpass Proxy] Endpoint ${endpoint} timed out after 10s, trying next endpoint...`);
      } else {
        console.warn(`[Overpass Proxy] Endpoint ${endpoint} fetch error: ${err.message}, trying next endpoint...`);
      }
    }
  }

  // All endpoints failed
  console.error("[Overpass Proxy] All Overpass API endpoints failed or timed out.");
  return {
    statusCode: 503,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      ok: false,
      error: "service_unavailable",
      message: "Tüm Overpass API sunucuları yanıt vermedi veya zaman aşımına uğradı. Lütfen biraz sonra tekrar deneyin."
    })
  };
};
