import { STATE_NAMES, DISTRICT_NAMES, BLOCK_NAMES } from '../constants';

export interface GeoLookupResult {
  stateCode: string | null;
  stateName: string | null;
  districtCode: string | null;
  districtName: string | null;
  blockCode: string | null;
  blockName: string | null;
}

// Complete Master Geo Dataset: 36 States/UTs & 72 Districts
export const MASTER_GEO_DATA: { stateCode: string; stateName: string; districtCode: string; districtName: string }[] = [
  // Andhra Pradesh (AP)
  { stateCode: 'AP', stateName: 'Andhra Pradesh', districtCode: 'GNT', districtName: 'Guntur' },
  { stateCode: 'AP', stateName: 'Andhra Pradesh', districtCode: 'VSK', districtName: 'Visakhapatnam' },
  // Arunachal Pradesh (AR)
  { stateCode: 'AR', stateName: 'Arunachal Pradesh', districtCode: 'TWG', districtName: 'Tawang' },
  { stateCode: 'AR', stateName: 'Arunachal Pradesh', districtCode: 'PPR', districtName: 'Papum Pare' },
  // Assam (AS)
  { stateCode: 'AS', stateName: 'Assam', districtCode: 'KMR', districtName: 'Kamrup' },
  { stateCode: 'AS', stateName: 'Assam', districtCode: 'NGN', districtName: 'Nagaon' },
  // Bihar (BR)
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'PTN', districtName: 'Patna' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'GYA', districtName: 'Gaya' },
  // Chhattisgarh (CG)
  { stateCode: 'CG', stateName: 'Chhattisgarh', districtCode: 'RPR', districtName: 'Raipur' },
  { stateCode: 'CG', stateName: 'Chhattisgarh', districtCode: 'BSP', districtName: 'Bilaspur' },
  // Goa (GA)
  { stateCode: 'GA', stateName: 'Goa', districtCode: 'NGO', districtName: 'North Goa' },
  { stateCode: 'GA', stateName: 'Goa', districtCode: 'SGO', districtName: 'South Goa' },
  // Gujarat (GJ)
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'AMD', districtName: 'Ahmedabad' },
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'SRT', districtName: 'Surat' },
  // Haryana (HR)
  { stateCode: 'HR', stateName: 'Haryana', districtCode: 'AMB', districtName: 'Ambala' },
  { stateCode: 'HR', stateName: 'Haryana', districtCode: 'PKL', districtName: 'Panchkula' },
  { stateCode: 'HR', stateName: 'Haryana', districtCode: 'KRN', districtName: 'Karnal' },
  // Himachal Pradesh (HP)
  { stateCode: 'HP', stateName: 'Himachal Pradesh', districtCode: 'SHL', districtName: 'Shimla' },
  { stateCode: 'HP', stateName: 'Himachal Pradesh', districtCode: 'KNG', districtName: 'Kangra' },
  // Jharkhand (JH)
  { stateCode: 'JH', stateName: 'Jharkhand', districtCode: 'RNC', districtName: 'Ranchi' },
  { stateCode: 'JH', stateName: 'Jharkhand', districtCode: 'DHD', districtName: 'Dhanbad' },
  // Karnataka (KA)
  { stateCode: 'KA', stateName: 'Karnataka', districtCode: 'BNG', districtName: 'Bangalore' },
  { stateCode: 'KA', stateName: 'Karnataka', districtCode: 'MYS', districtName: 'Mysore' },
  // Kerala (KL)
  { stateCode: 'KL', stateName: 'Kerala', districtCode: 'TVM', districtName: 'Thiruvananthapuram' },
  { stateCode: 'KL', stateName: 'Kerala', districtCode: 'EKM', districtName: 'Ernakulam' },
  // Madhya Pradesh (MP)
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'BPL', districtName: 'Bhopal' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'IND', districtName: 'Indore' },
  // Maharashtra (MH)
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'MUM', districtName: 'Mumbai' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'PUN', districtName: 'Pune' },
  // Manipur (MN)
  { stateCode: 'MN', stateName: 'Manipur', districtCode: 'IMW', districtName: 'Imphal West' },
  { stateCode: 'MN', stateName: 'Manipur', districtCode: 'IME', districtName: 'Imphal East' },
  // Meghalaya (ML)
  { stateCode: 'ML', stateName: 'Meghalaya', districtCode: 'EKH', districtName: 'East Khasi Hills' },
  { stateCode: 'ML', stateName: 'Meghalaya', districtCode: 'WJH', districtName: 'West Jaintia Hills' },
  // Mizoram (MZ)
  { stateCode: 'MZ', stateName: 'Mizoram', districtCode: 'AIZ', districtName: 'Aizawl' },
  { stateCode: 'MZ', stateName: 'Mizoram', districtCode: 'CMP', districtName: 'Champhai' },
  // Nagaland (NL)
  { stateCode: 'NL', stateName: 'Nagaland', districtCode: 'KOH', districtName: 'Kohima' },
  { stateCode: 'NL', stateName: 'Nagaland', districtCode: 'DIM', districtName: 'Dimapur' },
  // Odisha (OD)
  { stateCode: 'OD', stateName: 'Odisha', districtCode: 'BBS', districtName: 'Bhubaneswar' },
  { stateCode: 'OD', stateName: 'Odisha', districtCode: 'CTC', districtName: 'Cuttack' },
  // Punjab (PB)
  { stateCode: 'PB', stateName: 'Punjab', districtCode: 'LDH', districtName: 'Ludhiana' },
  { stateCode: 'PB', stateName: 'Punjab', districtCode: 'ASR', districtName: 'Amritsar' },
  { stateCode: 'PB', stateName: 'Punjab', districtCode: 'JAL', districtName: 'Jalandhar' },
  { stateCode: 'PB', stateName: 'Punjab', districtCode: 'BTH', districtName: 'Bathinda' },
  { stateCode: 'PB', stateName: 'Punjab', districtCode: 'PAT', districtName: 'Patiala' },
  { stateCode: 'PB', stateName: 'Punjab', districtCode: 'MOG', districtName: 'Moga' },
  // Rajasthan (RJ)
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'JAI', districtName: 'Jaipur' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'JDP', districtName: 'Jodhpur' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'UDA', districtName: 'Udaipur' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'AJM', districtName: 'Ajmer' },
  // Sikkim (SK)
  { stateCode: 'SK', stateName: 'Sikkim', districtCode: 'ESK', districtName: 'East Sikkim' },
  { stateCode: 'SK', stateName: 'Sikkim', districtCode: 'WSK', districtName: 'West Sikkim' },
  // Tamil Nadu (TN)
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'CHN', districtName: 'Chennai' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'CBE', districtName: 'Coimbatore' },
  // Telangana (TS)
  { stateCode: 'TS', stateName: 'Telangana', districtCode: 'HYD', districtName: 'Hyderabad' },
  { stateCode: 'TS', stateName: 'Telangana', districtCode: 'WGL', districtName: 'Warangal' },
  // Tripura (TR)
  { stateCode: 'TR', stateName: 'Tripura', districtCode: 'WTR', districtName: 'West Tripura' },
  { stateCode: 'TR', stateName: 'Tripura', districtCode: 'SPJ', districtName: 'Sepahijala' },
  // Uttarakhand (UK)
  { stateCode: 'UK', stateName: 'Uttarakhand', districtCode: 'DDN', districtName: 'Dehradun' },
  { stateCode: 'UK', stateName: 'Uttarakhand', districtCode: 'HRW', districtName: 'Haridwar' },
  // Uttar Pradesh (UP)
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'LKO', districtName: 'Lucknow' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'KNP', districtName: 'Kanpur' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'VAR', districtName: 'Varanasi' },
  // West Bengal (WB)
  { stateCode: 'WB', stateName: 'West Bengal', districtCode: 'KOL', districtName: 'Kolkata' },
  { stateCode: 'WB', stateName: 'West Bengal', districtCode: 'HWH', districtName: 'Howrah' },
  // UTs
  { stateCode: 'AN', stateName: 'Andaman and Nicobar Islands', districtCode: 'SAN', districtName: 'South Andaman' },
  { stateCode: 'AN', stateName: 'Andaman and Nicobar Islands', districtCode: 'NMA', districtName: 'North and Middle Andaman' },
  { stateCode: 'CH', stateName: 'Chandigarh', districtCode: 'CHU', districtName: 'Chandigarh Urban' },
  { stateCode: 'CH', stateName: 'Chandigarh', districtCode: 'CHR', districtName: 'Chandigarh Rural' },
  { stateCode: 'DN', stateName: 'Dadra and Nagar Haveli', districtCode: 'SLS', districtName: 'Silvassa' },
  { stateCode: 'DN', stateName: 'Dadra and Nagar Haveli', districtCode: 'DDR', districtName: 'Dadra' },
  { stateCode: 'DD', stateName: 'Daman and Diu', districtCode: 'DMA', districtName: 'Daman' },
  { stateCode: 'DD', stateName: 'Daman and Diu', districtCode: 'DIU', districtName: 'Diu' },
  { stateCode: 'DL', stateName: 'Delhi', districtCode: 'NDL', districtName: 'North Delhi' },
  { stateCode: 'DL', stateName: 'Delhi', districtCode: 'SDL', districtName: 'South Delhi' },
  { stateCode: 'JK', stateName: 'Jammu and Kashmir', districtCode: 'SRN', districtName: 'Srinagar' },
  { stateCode: 'JK', stateName: 'Jammu and Kashmir', districtCode: 'JMU', districtName: 'Jammu' },
  { stateCode: 'LA', stateName: 'Ladakh', districtCode: 'LEH', districtName: 'Leh' },
  { stateCode: 'LA', stateName: 'Ladakh', districtCode: 'KGL', districtName: 'Kargil' },
  { stateCode: 'PY', stateName: 'Puducherry', districtCode: 'PUD', districtName: 'Puducherry' },
  { stateCode: 'PY', stateName: 'Puducherry', districtCode: 'KAL', districtName: 'Karaikal' },
];

// Lookup dictionaries built automatically from MASTER_GEO_DATA
const STATE_LOOKUP: Record<string, { code: string; name: string }> = {};
const DISTRICT_LOOKUP: Record<string, { code: string; name: string; stateCode: string; stateName: string }> = {
  // Aliases
  hwr: { code: 'HWH', name: 'Howrah', stateCode: 'WB', stateName: 'West Bengal' },
  jpr: { code: 'JAI', name: 'Jaipur', stateCode: 'RJ', stateName: 'Rajasthan' },
  jod: { stateCode: 'RJ', stateName: 'Rajasthan', code: 'JDP', name: 'Jodhpur' },
};

// Populate state lookup from STATE_NAMES and MASTER_GEO_DATA
Object.entries(STATE_NAMES).forEach(([code, name]) => {
  const val = { code: code.toUpperCase(), name };
  STATE_LOOKUP[code.toLowerCase()] = val;
  STATE_LOOKUP[name.toLowerCase()] = val;
});

MASTER_GEO_DATA.forEach((item) => {
  const stateVal = { code: item.stateCode, name: item.stateName };
  STATE_LOOKUP[item.stateCode.toLowerCase()] = stateVal;
  STATE_LOOKUP[item.stateName.toLowerCase()] = stateVal;

  const distVal = {
    code: item.districtCode,
    name: item.districtName,
    stateCode: item.stateCode,
    stateName: item.stateName,
  };
  DISTRICT_LOOKUP[item.districtCode.toLowerCase()] = distVal;
  DISTRICT_LOOKUP[item.districtName.toLowerCase()] = distVal;
});

// Also include DISTRICT_NAMES from constants
Object.entries(DISTRICT_NAMES).forEach(([code, name]) => {
  const codeKey = code.toLowerCase();
  const nameKey = name.toLowerCase();
  if (!DISTRICT_LOOKUP[codeKey]) {
    const parent = MASTER_GEO_DATA.find((m) => m.districtCode === code || m.districtName.toLowerCase() === nameKey);
    const distVal = {
      code: code.toUpperCase(),
      name,
      stateCode: parent?.stateCode || '',
      stateName: parent?.stateName || '',
    };
    DISTRICT_LOOKUP[codeKey] = distVal;
    if (!DISTRICT_LOOKUP[nameKey]) DISTRICT_LOOKUP[nameKey] = distVal;
  }
});

/**
 * Fetch state code and canonical name from state input (name or code).
 * If user enters a district name (e.g. "Ludhiana" or "Howrah"), it automatically detects parent state (PB or WB)!
 */
export function fetchStateCode(input?: string): { code: string | null; name: string | null; detectedFromDistrict?: string } {
  if (!input || !input.trim()) return { code: null, name: null };
  const clean = input.trim().toLowerCase();

  // 1. Direct state match
  const match = STATE_LOOKUP[clean];
  if (match) return match;

  // 2. District parent match (e.g., user typed "Ludhiana" or "Howrah" into State field)
  const distMatch = DISTRICT_LOOKUP[clean];
  if (distMatch && distMatch.stateCode) {
    return {
      code: distMatch.stateCode,
      name: distMatch.stateName,
      detectedFromDistrict: `${distMatch.name} (${distMatch.code})`,
    };
  }

  return { code: null, name: null };
}

/**
 * Fetch district code, canonical name, and parent state details from district input (name or code).
 * Example: "Ludhiana" -> { code: "LDH", name: "Ludhiana", stateCode: "PB", stateName: "Punjab" }
 */
export function fetchDistrictCode(input?: string): { code: string | null; name: string | null; stateCode: string | null; stateName: string | null } {
  if (!input || !input.trim()) return { code: null, name: null, stateCode: null, stateName: null };
  const clean = input.trim().toLowerCase();

  const match = DISTRICT_LOOKUP[clean];
  if (match) {
    return {
      code: match.code,
      name: match.name,
      stateCode: match.stateCode || null,
      stateName: match.stateName || null,
    };
  }

  return { code: null, name: null, stateCode: null, stateName: null };
}

/**
 * Fetch block code & block name from block input (e.g., "01", "1", "LDH-01", "HWH-01", "Ludhiana Block 1").
 * Uses parent district and/or parent state to resolve numeric inputs (e.g. WB + 01 -> HWH-01 / Howrah Block 1).
 */
export function fetchBlockCode(input?: string, parentDistrict?: string, parentState?: string): {
  code: string | null;
  name: string | null;
  districtCode: string | null;
  districtName: string | null;
  stateCode: string | null;
  stateName: string | null;
} {
  if (!input || !input.trim()) {
    return { code: null, name: null, districtCode: null, districtName: null, stateCode: null, stateName: null };
  }

  const rawInput = input.trim();
  const cleanInput = rawInput.toLowerCase();
  
  // 1. Resolve parent district if provided
  let distInfo = parentDistrict ? fetchDistrictCode(parentDistrict) : null;
  let stateInfo = parentState ? fetchStateCode(parentState) : null;

  // If district was not provided or not resolved, infer primary district for state if state is provided
  if ((!distInfo || !distInfo.code) && (stateInfo?.code || parentState)) {
    const sCode = stateInfo?.code || fetchStateCode(parentState).code;
    if (sCode) {
      const firstDistrictMatch = MASTER_GEO_DATA.find((m) => m.stateCode === sCode);
      if (firstDistrictMatch) {
        distInfo = {
          code: firstDistrictMatch.districtCode,
          name: firstDistrictMatch.districtName,
          stateCode: firstDistrictMatch.stateCode,
          stateName: firstDistrictMatch.stateName,
        };
      }
    }
  }

  const targetDistCode = distInfo?.code || 'LDH';
  const targetDistName = distInfo?.name || 'Ludhiana';
  const targetStateCode = distInfo?.stateCode || stateInfo?.code || 'PB';
  const targetStateName = distInfo?.stateName || stateInfo?.name || 'Punjab';

  // 2. Check if user typed numeric block code e.g. "01", "1", "02", "2"
  if (/^\d{1,2}$/.test(rawInput)) {
    const num = parseInt(rawInput, 10);
    const numStr = num.toString().padStart(2, '0');
    const constructedCode = `${targetDistCode}-${numStr}`;
    const keyUnderscore = `${targetDistCode}_${numStr}`;
    const blockName = BLOCK_NAMES[keyUnderscore] || `${targetDistName} Block ${num}`;

    return {
      code: constructedCode,
      name: blockName,
      districtCode: targetDistCode,
      districtName: targetDistName,
      stateCode: targetStateCode,
      stateName: targetStateName,
    };
  }

  // 3. Key lookups (handle hyphen e.g. LDH-01 -> LDH_01 or HWH-01 -> HWH_01)
  const keyWithUnderscore = cleanInput.replace(/-/g, '_').toUpperCase();

  // 4. Direct match in BLOCK_NAMES (e.g. BLOCK_NAMES['HWH_01'] -> "Howrah Block 1")
  let matchedName: string | null = BLOCK_NAMES[keyWithUnderscore] || null;

  // Reverse lookup: check if user typed a block name (e.g. "Howrah Block 1")
  let reverseMatchedCode: string | null = null;
  if (!matchedName) {
    const entry = Object.entries(BLOCK_NAMES).find(
      ([k, v]) => v.toLowerCase() === cleanInput || k.toLowerCase() === cleanInput
    );
    if (entry) {
      reverseMatchedCode = entry[0].replace(/_/g, '-');
      matchedName = entry[1];
    }
  }

  // Pattern check for valid block format (e.g., LDH-01, HWH-01, ASR-02)
  const matchesBlockPattern = /^[A-Za-z]{2,4}[_-]?\d{1,3}$/i.test(rawInput);

  if (!matchedName && !reverseMatchedCode && !matchesBlockPattern) {
    return {
      code: null,
      name: null,
      districtCode: distInfo?.code || null,
      districtName: distInfo?.name || null,
      stateCode: distInfo?.stateCode || stateInfo?.code || null,
      stateName: distInfo?.stateName || stateInfo?.name || null,
    };
  }

  const finalCode = reverseMatchedCode || rawInput.toUpperCase().replace(/_/g, '-');

  // Extract District Code prefix (e.g. "HWH" from "HWH-01")
  const distCodePrefix = finalCode.split('-')[0] || targetDistCode;
  const resolvedDist = fetchDistrictCode(distCodePrefix);

  if (!matchedName && (resolvedDist.name || distInfo?.name)) {
    const numMatch = finalCode.match(/\d+/);
    const blockNum = numMatch ? parseInt(numMatch[0], 10) : '';
    const dName = resolvedDist.name || targetDistName;
    matchedName = blockNum ? `${dName} Block ${blockNum}` : `${dName} Block`;
  }

  return {
    code: finalCode,
    name: matchedName,
    districtCode: resolvedDist.code || distInfo?.code || targetDistCode,
    districtName: resolvedDist.name || distInfo?.name || targetDistName,
    stateCode: resolvedDist.stateCode || distInfo?.stateCode || targetStateCode,
    stateName: resolvedDist.stateName || distInfo?.stateName || targetStateName,
  };
}

/**
 * Smart Geo Details Resolver with cross-inference between state, district, & block inputs.
 */
export function fetchGeoDetails(stateInput?: string, districtInput?: string, blockInput?: string): GeoLookupResult {
  let stateRes = fetchStateCode(stateInput);
  let districtRes = fetchDistrictCode(districtInput);
  let blockRes = fetchBlockCode(
    blockInput,
    districtRes.code || districtInput || undefined,
    stateRes.code || stateInput || undefined
  );

  // Cross-inference from block input (e.g. typing "01" or "HWH-01" auto-detects Howrah district & West Bengal state!)
  if (blockRes.code) {
    if (!districtRes.code && blockRes.districtCode) {
      districtRes = {
        code: blockRes.districtCode,
        name: blockRes.districtName,
        stateCode: blockRes.stateCode,
        stateName: blockRes.stateName,
      };
    }
    if (!stateRes.code && blockRes.stateCode) {
      stateRes = {
        code: blockRes.stateCode,
        name: blockRes.stateName,
      };
    }
  }

  // Cross-inference from district input if state is empty
  if (!stateRes.code && districtInput) {
    const stateCheck = fetchStateCode(districtInput);
    if (stateCheck.code) {
      stateRes = stateCheck;
    }
  }

  // Cross-inference from state input if district is empty but stateInput was typed as district
  if (!districtRes.code && stateInput) {
    const distCheck = fetchDistrictCode(stateInput);
    if (distCheck.code) {
      districtRes = distCheck;
    }
  }

  return {
    stateCode: stateRes.code || districtRes.stateCode || blockRes.stateCode,
    stateName: stateRes.name || districtRes.stateName || blockRes.stateName,
    districtCode: districtRes.code || blockRes.districtCode,
    districtName: districtRes.name || blockRes.districtName,
    blockCode: blockRes.code,
    blockName: blockRes.name,
  };
}

