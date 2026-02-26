/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractCityFromAddress(address) {
  if (!address || !address.trim()) return null;
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  if (parts.length >= 4) return parts[parts.length - 3] || null;
  return parts[parts.length - 2] || null;
}

function placeTypeToLabel(primaryType, types) {
  const all = [primaryType, ...(types || [])].filter(Boolean).map((t) => String(t).toLowerCase());
  if (all.some((t) => t.includes("coffee") || t.includes("cafe"))) return "cafe";
  if (all.some((t) => t.includes("pizza"))) return "pizza";
  if (all.some((t) => t.includes("sushi") || t.includes("japanese"))) return "japonesa";
  if (all.some((t) => t.includes("mexican") || t.includes("taco"))) return "mexicana";
  if (all.some((t) => t.includes("burger") || t.includes("hamburger"))) return "hamburguesa";
  if (all.some((t) => t.includes("bakery"))) return "panaderia";
  if (all.some((t) => t.includes("bar"))) return "bar";
  if (all.some((t) => t.includes("restaurant"))) return "restaurant";
  return primaryType || types?.[0] || null;
}

async function searchPlace(textQuery, apiKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const fieldMask = [
    "places.displayName",
    "places.formattedAddress",
    "places.location",
    "places.primaryType",
    "places.types",
    "places.googleMapsUri",
  ].join(",");

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
    },
    signal: controller.signal,
    body: JSON.stringify({
      textQuery,
      languageCode: "es",
      pageSize: 5,
    }),
  });
  clearTimeout(timeout);

  if (!res.ok) {
    const text = await res.text();
    const isNewApiDisabled = res.status === 403 && /Places API \\(New\\)|disabled|has not been used/i.test(text);
    if (!isNewApiDisabled) {
      throw new Error(`Places search error ${res.status}: ${text.slice(0, 180)}`);
    }
    const legacyUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
      textQuery
    )}&key=${encodeURIComponent(apiKey)}&language=es`;
    const legacyController = new AbortController();
    const legacyTimeout = setTimeout(() => legacyController.abort(), 10000);
    const legacyRes = await fetch(legacyUrl, { signal: legacyController.signal });
    clearTimeout(legacyTimeout);
    if (!legacyRes.ok) {
      const legacyText = await legacyRes.text();
      throw new Error(`Places legacy error ${legacyRes.status}: ${legacyText.slice(0, 180)}`);
    }
    const legacyData = await legacyRes.json();
    const status = legacyData.status;
    if (status !== "OK" && status !== "ZERO_RESULTS") {
      throw new Error(`Places legacy status ${status}: ${(legacyData.error_message || "").slice(0, 180)}`);
    }
    const legacyResults = Array.isArray(legacyData.results) ? legacyData.results : [];
    return legacyResults.map((r) => ({
      displayName: { text: r.name || "" },
      formattedAddress: r.formatted_address || "",
      location: {
        latitude: r.geometry?.location?.lat,
        longitude: r.geometry?.location?.lng,
      },
      primaryType: Array.isArray(r.types) && r.types.length > 0 ? r.types[0] : undefined,
      types: r.types || [],
      googleMapsUri: r.place_id
        ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(r.place_id)}`
        : undefined,
    }));
  }
  const data = await res.json();
  return Array.isArray(data.places) ? data.places : [];
}

function chooseBestCandidate(row, candidates) {
  if (!candidates.length) return null;
  const rowName = norm(row.nombre);
  const rowCity = norm(row.ciudad || extractCityFromAddress(row.direccion) || "");

  let best = null;
  let bestScore = -Infinity;
  for (const c of candidates) {
    const cName = norm(c.displayName?.text || "");
    const cAddr = norm(c.formattedAddress || "");
    const cCity = norm(extractCityFromAddress(c.formattedAddress || "") || "");
    let score = 0;
    if (cName === rowName) score += 8;
    else if (cName.includes(rowName) || rowName.includes(cName)) score += 5;
    if (rowCity && cCity && rowCity === cCity) score += 4;
    else if (rowCity && cAddr.includes(rowCity)) score += 2;
    if (typeof c.location?.latitude === "number" && typeof c.location?.longitude === "number") score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return bestScore >= 4 ? best : null;
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const apply = process.argv.includes("--apply");

  if (!url || !serviceKey || !mapsKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: rows, error } = await supabase
    .from("lugares")
    .select("id,nombre,direccion,ciudad,pais,lat,lng,tipo_comida,google_maps_url,questions,review_text_published")
    .or("review_text_published.is.null,review_text_published.eq.")
    .limit(5000);
  if (error) throw error;

  const list = rows || [];
  console.log(`Sin reseña: ${list.length}`);

  let found = 0;
  let updated = 0;
  let failed = 0;
  let failLogs = 0;

  for (const row of list) {
    const query = `${row.nombre}${row.ciudad ? ` ${row.ciudad}` : ""}${row.pais ? ` ${row.pais}` : ""}`;
    try {
      const candidates = await searchPlace(query, mapsKey);
      const best = chooseBestCandidate(row, candidates);
      if (!best) continue;
      found += 1;

      const resolvedAddress = best.formattedAddress || row.direccion || null;
      const resolvedCity = extractCityFromAddress(resolvedAddress || "") || row.ciudad || null;
      const resolvedType = placeTypeToLabel(best.primaryType, best.types) || row.tipo_comida || null;
      const lat =
        typeof best.location?.latitude === "number" ? best.location.latitude : row.lat;
      const lng =
        typeof best.location?.longitude === "number" ? best.location.longitude : row.lng;

      const currentQuestions = Array.isArray(row.questions) ? row.questions : [];
      const hasTipoQuestion = currentQuestions.some(
        (q) => q && typeof q === "object" && norm(q.question) === "tipo de comida"
      );
      const nextQuestions = hasTipoQuestion
        ? currentQuestions
        : [...currentQuestions, { question: "Tipo de comida", selected_option: resolvedType }];

      const patch = {
        direccion: row.direccion || resolvedAddress,
        ciudad: row.ciudad || resolvedCity,
        lat,
        lng,
        tipo_comida: row.tipo_comida || resolvedType,
        google_maps_url: row.google_maps_url || best.googleMapsUri || null,
        questions: nextQuestions,
      };

      if (!apply) continue;

      const { error: upErr } = await supabase.from("lugares").update(patch).eq("id", row.id);
      if (upErr) {
        failed += 1;
        console.error(`Update fail ${row.id}: ${upErr.message}`);
      } else {
        updated += 1;
      }
    } catch (e) {
      failed += 1;
      if (failLogs < 20) {
        console.error(`Lookup fail ${row.id}: ${e.message}`);
        failLogs += 1;
      }
    }
    if ((found + failed) % 25 === 0) {
      console.log(`Progreso: ${found + failed}/${list.length} | matched=${found} | failed=${failed}`);
    }
    await new Promise((r) => setTimeout(r, 30));
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        totalNoReview: list.length,
        matchedByPlaces: found,
        updated,
        failed,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
