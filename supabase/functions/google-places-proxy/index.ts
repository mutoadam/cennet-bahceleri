import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  // Robust path detection
  const path = url.pathname.split("/").filter(Boolean).pop();

  const googleApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!googleApiKey) {
    return new Response("Configuration Error: Missing Google API Key", { status: 500, headers: corsHeaders });
  }

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  async function validateAdmin() {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return { error: "Missing Authorization header", status: 401 };

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: isAdmin, error: rpcError } = await userClient.rpc("is_admin");
    if (rpcError || !isAdmin) return { error: "Forbidden - Admin access required", status: 403 };

    return { success: true };
  }

  // 1. SEARCH
  if (path === "search") {
    const auth = await validateAdmin();
    if (auth.error) return new Response(auth.error, { status: auth.status, headers: corsHeaders });

    const query = url.searchParams.get("q");
    if (!query) return new Response("Missing query", { status: 400, headers: corsHeaders });

    try {
      const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": googleApiKey,
          "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.photos",
        },
        body: JSON.stringify({ textQuery: query, languageCode: "tr" }),
      });

      const data = await response.json();
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
  }

  // 2. PREVIEW (Admin Only)
  if (path === "photo-preview") {
    const auth = await validateAdmin();
    if (auth.error) return new Response(auth.error, { status: auth.status, headers: corsHeaders });

    const name = url.searchParams.get("name");
    if (!name || !name.startsWith("places/")) return new Response("Invalid name", { status: 400 });

    const googleUrl = `https://places.googleapis.com/v1/${name}/media?key=${googleApiKey}&maxHeightPx=400&maxWidthPx=400`;

    try {
      const res = await fetch(googleUrl);
      if (!res.ok) return new Response("Google Fetch Failed", { status: res.status, headers: corsHeaders });

      return new Response(res.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": res.headers.get("Content-Type") || "image/jpeg",
          "Cache-Control": "public, max-age=3600"
        }
      });
    } catch (err) {
      return new Response("Streaming Error", { status: 500, headers: corsHeaders });
    }
  }

  // 3. PUBLIC STABLE PHOTO ENDPOINT
  if (path === "photo") {
    const tombImageId = url.searchParams.get("tomb_image_id");
    if (!tombImageId) return new Response("Missing tomb_image_id", { status: 400, headers: corsHeaders });

    try {
      // 1. Get metadata
      const { data: record, error: dbError } = await adminClient
        .from("tomb_images")
        .select("google_photo_name, google_place_id, google_photo_index, tomb_id")
        .eq("id", tombImageId)
        .eq("source_type", "GOOGLE_PLACES")
        .single();

      if (dbError || !record) {
        return new Response("Photo metadata not found", { status: 404, headers: corsHeaders });
      }

      // 2. Check active tomb
      const { data: tomb, error: tombError } = await adminClient
        .from("tomb_locations")
        .select("is_active")
        .eq("id", record.tomb_id)
        .single();

      if (tombError || !tomb || !tomb.is_active) {
        return new Response("Tomb inactive or not found", { status: 404, headers: corsHeaders });
      }

      let currentName = record.google_photo_name;
      let photoRes = await fetch(`https://places.googleapis.com/v1/${currentName}/media?key=${googleApiKey}&maxHeightPx=1600&maxWidthPx=1600`);

      // 3. Stale Refresh logic
      if (!photoRes.ok && photoRes.status === 404) {
        const detailsRes = await fetch(`https://places.googleapis.com/v1/places/${record.google_place_id}?fields=photos&key=${googleApiKey}&languageCode=tr`);
        if (detailsRes.ok) {
          const details = await detailsRes.json();
          const photos = details.photos || [];
          const idx = record.google_photo_index ?? -1;
          const match = idx >= 0 ? photos[idx] : null;

          if (match && match.name) {
            currentName = match.name;
            // Update DB
            adminClient.from("tomb_images").update({ google_photo_name: currentName }).eq("id", tombImageId).then();
            // Retry
            photoRes = await fetch(`https://places.googleapis.com/v1/${currentName}/media?key=${googleApiKey}&maxHeightPx=1600&maxWidthPx=1600`);
          }
        }
      }

      if (!photoRes.ok) {
        return new Response("Photo unavailable", { status: photoRes.status, headers: corsHeaders });
      }

      return new Response(photoRes.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": photoRes.headers.get("Content-Type") || "image/jpeg",
          "Cache-Control": "public, max-age=86400"
        }
      });

    } catch (err) {
      console.error("Proxy Error:", err);
      return new Response("Internal Error", { status: 500, headers: corsHeaders });
    }
  }

  return new Response("Not Found", { status: 404, headers: corsHeaders });
});
