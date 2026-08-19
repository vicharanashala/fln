import {
  fetchStateCode,
  fetchDistrictCode,
  fetchBlockCode,
  fetchGeoDetails,
  getDistrictSuggestions,
  getBlockSuggestions,
  levenshteinDistance,
  DISTRICTS_BY_STATE,
  BLOCKS_BY_DISTRICT,
} from '../geoLookup';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('=== Running Geographic Lookup Suite ===');

// 1. Map Indexing
assert(DISTRICTS_BY_STATE.size === 36, 'All 36 States/UTs must be in DISTRICTS_BY_STATE index');
assert((DISTRICTS_BY_STATE.get('PB')?.length ?? 0) === 23, 'Punjab must have 23 districts');
assert(BLOCKS_BY_DISTRICT.size > 600, 'BLOCKS_BY_DISTRICT must contain over 600 indexed districts');

// 2. Historical & Phonetic Aliases
const ludiana = fetchDistrictCode('ludiana');
assert(ludiana.code === 'LDH' && ludiana.name === 'Ludhiana', 'ludiana alias resolution failed');

const gurgaon = fetchDistrictCode('gurgaon');
assert(gurgaon.code === 'GGM' && gurgaon.name === 'Gurugram', 'gurgaon alias resolution failed');

const vizag = fetchDistrictCode('vizag');
assert(vizag.code === 'VSP' && vizag.name === 'Visakhapatnam', 'vizag alias resolution failed');

const orissa = fetchStateCode('orissa');
assert(orissa.code === 'OD' && orissa.name === 'Odisha', 'orissa state alias resolution failed');

const calcutta = fetchDistrictCode('calcutta');
assert(calcutta.code === 'KOL' && calcutta.name === 'Kolkata', 'calcutta alias resolution failed');

// 3. Levenshtein Fuzzy Match Fallback
const fuzzyLudhiana = getDistrictSuggestions('ludiana', 'PB');
assert(fuzzyLudhiana.length > 0 && fuzzyLudhiana[0].code === 'LDH', 'Fuzzy match for ludiana in PB failed');

const fuzzyAhmedabad = getDistrictSuggestions('ahmadabad', 'GJ');
assert(fuzzyAhmedabad.length > 0 && fuzzyAhmedabad[0].code === 'AHM', 'Fuzzy match for ahmadabad in GJ failed');

// 4. Auto-Suggest Accuracy
const hooghly = getDistrictSuggestions('ho', 'WB');
assert(hooghly.some(d => d.code === 'HGL') && hooghly.some(d => d.code === 'HWH'), 'District suggestions for "ho" in WB failed');

const hwhBlocks = getBlockSuggestions('1', 'HWH', 'WB');
assert(hwhBlocks.length > 0 && hwhBlocks[0].code === 'HWH-01', 'Block suggestions for HWH failed');

// 5. Full Geo Details Resolver
const fullDetails = fetchGeoDetails('Punjab', 'ludiana', '01');
assert(fullDetails.stateCode === 'PB', 'GeoDetails stateCode resolution failed');
assert(fullDetails.districtCode === 'LDH', 'GeoDetails districtCode resolution failed');
assert(fullDetails.blockCode === 'LDH-01', 'GeoDetails blockCode resolution failed');

console.log('✅ All Geographic Lookup unit test assertions passed successfully!');
