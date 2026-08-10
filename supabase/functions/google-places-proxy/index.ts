import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Cennet Bahçeleri - Google Places Proxy (B16.2A)
 * API Key güvenliği ve maliyet kontrolü için tasarlanmıştır.
 */
serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { latitude, longitude, radius = 3000, type = 'mosque' } = body

    // 1. Girdi Doğrulaması (Validation)
    if (latitude === undefined || longitude === undefined) {
      return new Response(JSON.stringify({ error: 'Koordinat bilgisi eksik (latitude/longitude)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return new Response(JSON.stringify({ error: 'Geçersiz koordinat aralığı' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (radius <= 0 || radius > 50000) {
      return new Response(JSON.stringify({ error: 'Geçersiz yarıçap (maksimum 50km)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Sadece cami ve ibadethane aramasına izin ver
    if (type !== 'mosque' && type !== 'place_of_worship') {
      return new Response(JSON.stringify({ error: 'Desteklenmeyen mekan türü' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Secret Kontrolü
    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY')
    if (!apiKey) {
      console.error('SERVER_ERROR: GOOGLE_PLACES_API_KEY secret not found in Supabase.')
      return new Response(JSON.stringify({ error: 'Sunucu yapılandırma hatası: API anahtarı bulunamadı' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Google Places API (New) Nearby Search İsteği
    console.log(`Searching for ${type} at ${latitude},${longitude} with radius ${radius}m`)

    const googleResponse = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        // MALİYET OPTİMİZASYONU: Sadece gerekli alanları iste
        'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.formattedAddress',
      },
      body: JSON.stringify({
        includedTypes: [type],
        locationRestriction: {
          circle: {
            center: { latitude, longitude },
            radius: radius,
          },
        },
        maxResultCount: 20, // Kota kontrolü için sınırlı tutulmuştur
      }),
    })

    if (!googleResponse.ok) {
      const errorData = await googleResponse.json()
      console.error('Google API Error:', errorData)
      return new Response(JSON.stringify({ error: 'Google API hatası', details: errorData }), {
        status: googleResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const data = await googleResponse.json()

    // 4. Response Normalizasyonu
    const normalizedPlaces = (data.places || []).map((place: any) => ({
      googlePlaceId: place.id,
      name: place.displayName?.text || 'İsimsiz Cami',
      latitude: place.location?.latitude,
      longitude: place.location?.longitude,
      formattedAddress: place.formattedAddress,
    }))

    return new Response(JSON.stringify({ places: normalizedPlaces }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Edge Function Unexpected Error:', error)
    return new Response(JSON.stringify({ error: 'İşlem sırasında beklenmedik bir hata oluştu', message: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
