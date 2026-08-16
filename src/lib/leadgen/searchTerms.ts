// What to search for, and where. Both lists are deliberately broader than
// the old backend's: it had 7 fixed phrases and 14 hardcoded counties (140
// towns total, string-only -- no coordinates, so its Places fallback had to
// re-geocode "county name" as free text and got poor, inconsistent results).
//
// SEARCH_TERMS spans the property types IDEAL_CUSTOMER_PROFILE.md calls
// Tier 1/Tier 2 fits, not just "holiday cottage" reworded seven ways -- this
// is the "search different things" half of the brief.
export const SEARCH_TERMS = [
  "holiday cottages",
  "holiday lets",
  "self catering cottage",
  "country cottage holidays",
  "coastal holiday cottage",
  "seaside holiday apartment",
  "holiday lodge rental",
  "glamping",
  "luxury holiday rental",
  "pet friendly holiday cottage",
  "group holiday accommodation",
  "farmhouse holiday let",
  "boutique holiday rental",
  "romantic holiday cottage",
] as const;

export type SearchTerm = (typeof SEARCH_TERMS)[number];

export interface RegionPoint {
  name: string;
  lat: number;
  lng: number;
}

export interface Region {
  name: string;
  points: RegionPoint[];
}

// A maintained list of real coordinates for well-known UK holiday-let
// hotspots, grouped by region -- not an algorithmically generated grid
// (that's overkill for this volume) but a genuine geographic upgrade over
// the old tool's plain county/town name strings: each point here is a real
// lat/lng Places can search a radius around directly, no re-geocoding step,
// no dependency on the search API guessing what "Cornwall" means. Add more
// points here as areas prove worth covering -- this list is meant to grow.
export const UK_REGIONS: Region[] = [
  {
    name: "Cornwall",
    points: [
      { name: "Newquay", lat: 50.4155, lng: -5.0837 },
      { name: "St Ives", lat: 50.2110, lng: -5.4802 },
      { name: "Falmouth", lat: 50.1526, lng: -5.0658 },
      { name: "Padstow", lat: 50.5375, lng: -4.9375 },
      { name: "Fowey", lat: 50.3355, lng: -4.6382 },
      { name: "Looe", lat: 50.3512, lng: -4.4531 },
      { name: "Penzance", lat: 50.1186, lng: -5.5370 },
      { name: "Bude", lat: 50.8296, lng: -4.5426 },
      { name: "Port Isaac", lat: 50.5928, lng: -4.8329 },
      { name: "Mevagissey", lat: 50.2705, lng: -4.7887 },
    ],
  },
  {
    name: "Devon",
    points: [
      { name: "Dartmouth", lat: 50.3510, lng: -3.5788 },
      { name: "Salcombe", lat: 50.2379, lng: -3.7716 },
      { name: "Ilfracombe", lat: 51.2095, lng: -4.1121 },
      { name: "Brixham", lat: 50.3959, lng: -3.5122 },
      { name: "Woolacombe", lat: 51.1735, lng: -4.1996 },
      { name: "Croyde", lat: 51.1289, lng: -4.2337 },
      { name: "Sidmouth", lat: 50.6877, lng: -3.2377 },
      { name: "Exmouth", lat: 50.6190, lng: -3.4136 },
      { name: "Totnes", lat: 50.4318, lng: -3.6852 },
      { name: "Appledore", lat: 51.0559, lng: -4.1935 },
    ],
  },
  {
    name: "Lake District",
    points: [
      { name: "Windermere", lat: 54.3781, lng: -2.9051 },
      { name: "Ambleside", lat: 54.4307, lng: -2.9633 },
      { name: "Keswick", lat: 54.6013, lng: -3.1349 },
      { name: "Grasmere", lat: 54.4590, lng: -3.0234 },
      { name: "Coniston", lat: 54.3708, lng: -3.0770 },
      { name: "Hawkshead", lat: 54.3778, lng: -2.9987 },
      { name: "Bowness-on-Windermere", lat: 54.3636, lng: -2.9198 },
      { name: "Ullswater", lat: 54.5807, lng: -2.8756 },
      { name: "Penrith", lat: 54.6656, lng: -2.7530 },
      { name: "Langdale", lat: 54.4453, lng: -3.1027 },
    ],
  },
  {
    name: "Peak District",
    points: [
      { name: "Bakewell", lat: 53.2137, lng: -1.6764 },
      { name: "Buxton", lat: 53.2591, lng: -1.9109 },
      { name: "Matlock", lat: 53.1400, lng: -1.5570 },
      { name: "Hathersage", lat: 53.3229, lng: -1.6494 },
      { name: "Castleton", lat: 53.3436, lng: -1.7768 },
      { name: "Hope Valley", lat: 53.3418, lng: -1.7284 },
      { name: "Edale", lat: 53.3667, lng: -1.8167 },
      { name: "Tideswell", lat: 53.2809, lng: -1.7688 },
      { name: "Eyam", lat: 53.2812, lng: -1.6720 },
      { name: "Baslow", lat: 53.2312, lng: -1.6182 },
    ],
  },
  {
    name: "Norfolk",
    points: [
      { name: "Wells-next-the-Sea", lat: 52.9598, lng: 0.8517 },
      { name: "Burnham Market", lat: 52.9548, lng: 0.7255 },
      { name: "Holt", lat: 52.9060, lng: 1.0872 },
      { name: "Cromer", lat: 52.9331, lng: 1.3011 },
      { name: "Sheringham", lat: 52.9427, lng: 1.2110 },
      { name: "Blakeney", lat: 52.9611, lng: 0.9980 },
      { name: "Brancaster", lat: 52.9698, lng: 0.6516 },
      { name: "Hunstanton", lat: 52.9410, lng: 0.4930 },
      { name: "Holkham", lat: 52.9631, lng: 0.8390 },
      { name: "Fakenham", lat: 52.8285, lng: 0.8484 },
    ],
  },
  {
    name: "Suffolk",
    points: [
      { name: "Aldeburgh", lat: 52.1553, lng: 1.6015 },
      { name: "Southwold", lat: 52.3273, lng: 1.6789 },
      { name: "Orford", lat: 52.0919, lng: 1.5343 },
      { name: "Dunwich", lat: 52.2778, lng: 1.6247 },
      { name: "Woodbridge", lat: 52.0929, lng: 1.3184 },
      { name: "Snape", lat: 52.1808, lng: 1.5010 },
      { name: "Walberswick", lat: 52.3122, lng: 1.6644 },
      { name: "Framlingham", lat: 52.2258, lng: 1.3428 },
      { name: "Saxmundham", lat: 52.2158, lng: 1.4919 },
      { name: "Thorpeness", lat: 52.1866, lng: 1.6191 },
    ],
  },
  {
    name: "Yorkshire",
    points: [
      { name: "Whitby", lat: 54.4863, lng: -0.6133 },
      { name: "Scarborough", lat: 54.2795, lng: -0.4040 },
      { name: "Filey", lat: 54.2117, lng: -0.2779 },
      { name: "Robin Hood's Bay", lat: 54.4325, lng: -0.5333 },
      { name: "Staithes", lat: 54.5591, lng: -0.7818 },
      { name: "Helmsley", lat: 54.2461, lng: -1.0645 },
      { name: "Pickering", lat: 54.2358, lng: -0.7734 },
      { name: "Harrogate", lat: 53.9919, lng: -1.5378 },
      { name: "Skipton", lat: 53.9615, lng: -2.0173 },
      { name: "Hawes", lat: 54.3010, lng: -2.1875 },
    ],
  },
  {
    name: "Cotswolds",
    points: [
      { name: "Bourton-on-the-Water", lat: 51.8767, lng: -1.7554 },
      { name: "Stow-on-the-Wold", lat: 51.9308, lng: -1.7229 },
      { name: "Chipping Campden", lat: 52.0525, lng: -1.7807 },
      { name: "Broadway", lat: 52.0367, lng: -1.8557 },
      { name: "Burford", lat: 51.8095, lng: -1.6360 },
      { name: "Moreton-in-Marsh", lat: 51.9885, lng: -1.6935 },
      { name: "Tetbury", lat: 51.6296, lng: -2.1573 },
      { name: "Cirencester", lat: 51.7189, lng: -1.9668 },
      { name: "Northleach", lat: 51.8181, lng: -1.8402 },
      { name: "Bibury", lat: 51.7614, lng: -1.8117 },
    ],
  },
  {
    name: "Pembrokeshire",
    points: [
      { name: "Tenby", lat: 51.6722, lng: -4.7031 },
      { name: "St Davids", lat: 51.8817, lng: -5.2690 },
      { name: "Newport (Pembs)", lat: 52.0243, lng: -4.8365 },
      { name: "Fishguard", lat: 52.0069, lng: -4.9836 },
      { name: "Manorbier", lat: 51.6472, lng: -4.8047 },
      { name: "Solva", lat: 51.8757, lng: -5.1919 },
      { name: "Saundersfoot", lat: 51.7139, lng: -4.6989 },
      { name: "Narberth", lat: 51.7970, lng: -4.7418 },
      { name: "Broad Haven", lat: 51.7742, lng: -5.0847 },
      { name: "Little Haven", lat: 51.7692, lng: -5.0997 },
    ],
  },
  {
    name: "Isle of Wight",
    points: [
      { name: "Yarmouth", lat: 50.7057, lng: -1.5001 },
      { name: "Ventnor", lat: 50.5947, lng: -1.2094 },
      { name: "Bembridge", lat: 50.6870, lng: -1.0906 },
      { name: "Ryde", lat: 50.7285, lng: -1.1592 },
      { name: "Cowes", lat: 50.7601, lng: -1.2982 },
      { name: "Sandown", lat: 50.6552, lng: -1.1543 },
      { name: "Shanklin", lat: 50.6317, lng: -1.1770 },
      { name: "Freshwater", lat: 50.6802, lng: -1.5237 },
      { name: "Niton", lat: 50.5866, lng: -1.2929 },
      { name: "Totland", lat: 50.6803, lng: -1.5457 },
    ],
  },
  {
    name: "Dorset",
    points: [
      { name: "Lyme Regis", lat: 50.7255, lng: -2.9367 },
      { name: "Swanage", lat: 50.6088, lng: -1.9591 },
      { name: "Wareham", lat: 50.6870, lng: -2.1090 },
      { name: "Bridport", lat: 50.7346, lng: -2.7593 },
      { name: "Weymouth", lat: 50.6141, lng: -2.4577 },
      { name: "Sherborne", lat: 50.9483, lng: -2.5169 },
      { name: "Blandford Forum", lat: 50.8595, lng: -2.1656 },
      { name: "Beaminster", lat: 50.8071, lng: -2.7460 },
      { name: "Corfe Castle", lat: 50.6395, lng: -2.0568 },
      { name: "Studland", lat: 50.6486, lng: -1.9575 },
    ],
  },
  {
    name: "Sussex",
    points: [
      { name: "Brighton", lat: 50.8225, lng: -0.1372 },
      { name: "Eastbourne", lat: 50.7687, lng: 0.2900 },
      { name: "Hastings", lat: 50.8543, lng: 0.5730 },
      { name: "Rye", lat: 50.9500, lng: 0.7333 },
      { name: "Arundel", lat: 50.8546, lng: -0.5559 },
      { name: "Midhurst", lat: 50.9838, lng: -0.7373 },
      { name: "Chichester", lat: 50.8365, lng: -0.7792 },
      { name: "Bexhill-on-Sea", lat: 50.8390, lng: 0.4700 },
      { name: "Seaford", lat: 50.7706, lng: 0.1017 },
      { name: "Alfriston", lat: 50.8064, lng: 0.1652 },
    ],
  },
  {
    name: "Scotland",
    points: [
      { name: "Fort William", lat: 56.8198, lng: -5.1052 },
      { name: "Inverness", lat: 57.4778, lng: -4.2247 },
      { name: "Oban", lat: 56.4152, lng: -5.4719 },
      { name: "Pitlochry", lat: 56.7000, lng: -3.7333 },
      { name: "St Andrews", lat: 56.3398, lng: -2.7967 },
      { name: "Aviemore", lat: 57.1936, lng: -3.8281 },
      { name: "Kyle of Lochalsh", lat: 57.2803, lng: -5.7147 },
      { name: "Ullapool", lat: 57.8951, lng: -5.1594 },
      { name: "Glencoe", lat: 56.6836, lng: -5.1030 },
      { name: "Dumfries", lat: 55.0700, lng: -3.6050 },
    ],
  },
  {
    name: "Wales",
    points: [
      { name: "Brecon", lat: 51.9483, lng: -3.3888 },
      { name: "Abergavenny", lat: 51.8236, lng: -3.0169 },
      { name: "Hay-on-Wye", lat: 52.0742, lng: -3.1289 },
      { name: "Llandudno", lat: 53.3241, lng: -3.8271 },
      { name: "Conwy", lat: 53.2799, lng: -3.8290 },
      { name: "Barmouth", lat: 52.7192, lng: -4.0517 },
      { name: "Aberdaron", lat: 52.7973, lng: -4.7091 },
      { name: "Portmeirion", lat: 52.9110, lng: -4.0967 },
      { name: "Betws-y-Coed", lat: 53.0954, lng: -3.8004 },
      { name: "Harlech", lat: 52.8600, lng: -4.1080 },
    ],
  },
];

// 14 platforms/agencies excluded from the query itself so results skew
// toward independent sites from the start, same idea as the old tool but
// checked against the current live set of major UK short-term-let
// platforms.
export const PLATFORM_EXCLUSIONS = [
  "airbnb.com",
  "airbnb.co.uk",
  "booking.com",
  "vrbo.com",
  "homeaway.co.uk",
  "sykescottages.co.uk",
  "hoseasons.co.uk",
  "cottages.com",
  "holidaycottages.co.uk",
  "lastminute-cottages.co.uk",
  "canbeholidays.co.uk",
  "cottages4you.co.uk",
  "tripadvisor.com",
  "tripadvisor.co.uk",
];
