import { normalizeDomain } from "./normalize";
import {
  incrementPlacesUsage,
  placesTextSearchCallsRemainingThisMonth,
  placeDetailsCallsRemainingThisMonth,
} from "./usage";

export interface PlaceCandidate {
  name: string;
  url: string;
  domain: string;
  location: string | null;
}

const PLACES_KEY = () => process.env.GOOGLE_PLACES_API_KEY;

export function placesConfigured(): boolean {
  return !!PLACES_KEY();
}

// Places API (New) -- not the legacy `maps.googleapis.com/maps/api/place/*`
// endpoints. Legacy can no longer even be enabled on a new Google Cloud
// project (Google restricted that in 2025) and is a frozen product headed
// for eventual shutdown, so building fresh against it now would mean
// building on borrowed time. The New API also bills by field mask rather
// than a flat per-endpoint rate -- requesting displayName puts Text Search
// on the Pro SKU ($32/1,000 after 5,000 free/month); requesting websiteUri
// puts Place Details on the Enterprise SKU ($20/1,000 after 1,000
// free/month) -- both fields are the whole point of this search channel, so
// there's no cheaper field combination that still does the job. The hard
// monthly caps in usage.ts (deliberately below those free allowances) are
// what actually prevents this from ever costing money, not this file.
const TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const PLACE_DETAILS_URL = "https://places.googleapis.com/v1/places";

interface TextSearchResponsePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
}
interface TextSearchResponse {
  places?: TextSearchResponsePlace[];
  nextPageToken?: string;
  error?: { message?: string; status?: string };
}
interface PlaceDetailsResponse {
  websiteUri?: string;
  error?: { message?: string; status?: string };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface PlacesSearchResult {
  candidates: PlaceCandidate[];
  // True if this run stopped early because a monthly free-tier safety cap
  // was hit -- surfaced to the UI so "fewer results than expected" has an
  // honest reason attached rather than looking like a silent bug.
  cappedTextSearch: boolean;
  cappedDetails: boolean;
}

// Real map search: Text Search (New) biased to a lat/lng + radius (not a
// free-text place name the API has to re-geocode itself). Text Search
// doesn't return a business's website, so each candidate needs a follow-up
// Place Details call -- that's both the real cost driver and the reason
// this function tracks two separate quotas, not one.
export async function searchPlaces(params: {
  query: string;
  lat: number;
  lng: number;
  radiusMeters?: number;
  maxPages?: number;
}): Promise<PlacesSearchResult> {
  const key = PLACES_KEY();
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY not set");

  const radius = Math.min(params.radiusMeters ?? 20000, 50000);
  const maxPages = params.maxPages ?? 2;
  const candidates: PlaceCandidate[] = [];
  const seenPlaceIds = new Set<string>();
  let cappedTextSearch = false;
  let cappedDetails = false;

  let pageToken: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const remaining = await placesTextSearchCallsRemainingThisMonth();
    if (remaining <= 0) {
      cappedTextSearch = true;
      break;
    }

    // Google requires a short delay before a next_page_token becomes valid.
    if (pageToken) await sleep(2000);

    const body: Record<string, unknown> = pageToken
      ? { pageToken }
      : {
          textQuery: params.query,
          regionCode: "GB",
          locationBias: { circle: { center: { latitude: params.lat, longitude: params.lng }, radius } },
        };

    const res = await fetch(TEXT_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,nextPageToken",
      },
      body: JSON.stringify(body),
    });
    await incrementPlacesUsage("textSearchCalls");
    if (!res.ok) break;
    const data = (await res.json()) as TextSearchResponse;
    if (data.error) throw new Error(`Places Text Search error: ${data.error.status ?? "unknown"}${data.error.message ? ` -- ${data.error.message}` : ""}`);

    for (const place of data.places ?? []) {
      if (seenPlaceIds.has(place.id)) continue;
      seenPlaceIds.add(place.id);

      const detailsRemaining = await placeDetailsCallsRemainingThisMonth();
      if (detailsRemaining <= 0) {
        cappedDetails = true;
        break;
      }

      const detailsRes = await fetch(`${PLACE_DETAILS_URL}/${place.id}`, {
        headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "websiteUri" },
      });
      await incrementPlacesUsage("placeDetailsCalls");
      if (!detailsRes.ok) continue;
      const details = (await detailsRes.json()) as PlaceDetailsResponse;
      const website = details.websiteUri;
      if (!website) continue;

      const domain = normalizeDomain(website);
      if (!domain) continue;

      candidates.push({
        name: place.displayName?.text ?? "Unnamed business",
        url: website,
        domain,
        location: place.formattedAddress ?? null,
      });

      await sleep(100);
    }

    if (cappedDetails || !data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }

  return { candidates, cappedTextSearch, cappedDetails };
}
