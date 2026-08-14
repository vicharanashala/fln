// State/UT -> District master data (28 States + 8 UTs). This is the single source
// of truth for the geo hierarchy: seed.ts uses it to generate users/schools, and
// index.ts's /api/states, /districts, /blocks routes read from it directly so the
// coordinator-registration flow always matches what was actually seeded.
export interface DistrictInfo {
  code: string;
  name: string;
}

export interface StateInfo {
  code: string;
  name: string;
  districts: DistrictInfo[];
}

export const STATES_UTS: StateInfo[] = [
  // ── 28 STATES ──
  {
    code: 'AP', name: 'Andhra Pradesh',
    districts: [
      { code: 'GNT', name: 'Guntur' },
      { code: 'VSK', name: 'Visakhapatnam' },
    ],
  },
  {
    code: 'AR', name: 'Arunachal Pradesh',
    districts: [
      { code: 'TWG', name: 'Tawang' },
      { code: 'PPR', name: 'Papum Pare' },
    ],
  },
  {
    code: 'AS', name: 'Assam',
    districts: [
      { code: 'BJL', name: 'Bajali' },
      { code: 'BKS', name: 'Baksa' },
      { code: 'BRP', name: 'Barpeta' },
      { code: 'BSW_AS', name: 'Biswanath' },
      { code: 'BNG_AS', name: 'Bongaigaon' },
      { code: 'CCH', name: 'Cachar' },
      { code: 'CRD', name: 'Charaideo' },
      { code: 'CRG', name: 'Chirang' },
      { code: 'DRG_AS', name: 'Darrang' },
      { code: 'DMJ', name: 'Dhemaji' },
      { code: 'DHB', name: 'Dhubri' },
      { code: 'DBR', name: 'Dibrugarh' },
      { code: 'DMH_AS', name: 'Dima Hasao' },
      { code: 'GLP', name: 'Goalpara' },
      { code: 'GLT', name: 'Golaghat' },
      { code: 'HLK', name: 'Hailakandi' },
      { code: 'HOJ', name: 'Hojai' },
      { code: 'JRH', name: 'Jorhat' },
      { code: 'KRM', name: 'Kamrup Metropolitan' },
      { code: 'KRR_AS', name: 'Kamrup Rural' },
      { code: 'KBA', name: 'Karbi Anglong' },
      { code: 'KMG', name: 'Karimganj' },
      { code: 'KKR_AS', name: 'Kokrajhar' },
      { code: 'LKP_AS', name: 'Lakhimpur' },
      { code: 'MJL', name: 'Majuli' },
      { code: 'MRG', name: 'Morigaon' },
      { code: 'NGN', name: 'Nagaon' },
      { code: 'NLB', name: 'Nalbari' },
      { code: 'SVS', name: 'Sivasagar' },
      { code: 'SNT', name: 'Sonitpur' },
      { code: 'SSM', name: 'South Salmara-Mankachar' },
      { code: 'TMP', name: 'Tamulpur' },
      { code: 'TSK', name: 'Tinsukia' },
      { code: 'UDL', name: 'Udalguri' },
      { code: 'WKA', name: 'West Karbi Anglong' },
    ],
  },
  {
    code: 'BR', name: 'Bihar',
    districts: [
      { code: 'PTN', name: 'Patna' },
      { code: 'GYA', name: 'Gaya' },
    ],
  },
  {
    code: 'CG', name: 'Chhattisgarh',
    districts: [
      { code: 'BLD_CG', name: 'Balod' },
      { code: 'BDB', name: 'Baloda Bazar' },
      { code: 'BLR_CG', name: 'Balrampur' },
      { code: 'BST_CG', name: 'Bastar' },
      { code: 'BMT', name: 'Bemetara' },
      { code: 'BJP', name: 'Bijapur' },
      { code: 'BLP_CG', name: 'Bilaspur' },
      { code: 'DTW', name: 'Dantewada / South Bastar' },
      { code: 'DHM', name: 'Dhamtari' },
      { code: 'DRG', name: 'Durg' },
      { code: 'GRB', name: 'Gariaband' },
      { code: 'GPM', name: 'Gaurela-Pendra-Marwahi' },
      { code: 'JJC', name: 'Janjgir-Champa' },
      { code: 'JSP_CG', name: 'Jashpur' },
      { code: 'KBD', name: 'Kabirdham / Kawardha' },
      { code: 'KNK', name: 'Kanker / North Bastar' },
      { code: 'KCG', name: 'Khairagarh-Chhuikhadan-Gandai' },
      { code: 'KDG_CG', name: 'Kondagaon' },
      { code: 'KRB', name: 'Korba' },
      { code: 'KRY', name: 'Koriya' },
      { code: 'MSM', name: 'Mahasamund' },
      { code: 'MCB', name: 'Manendragarh-Chirmiri-Bharatpur' },
      { code: 'MMA', name: 'Mohla-Manpur-Ambagarh Chowki' },
      { code: 'MGL', name: 'Mungeli' },
      { code: 'NRP', name: 'Narayanpur' },
      { code: 'RGH', name: 'Raigarh' },
      { code: 'RPR', name: 'Raipur' },
      { code: 'RJN', name: 'Rajnandgaon' },
      { code: 'SKT', name: 'Sakti' },
      { code: 'SGB', name: 'Sarangarh-Bilaigarh' },
      { code: 'SKM', name: 'Sukma' },
      { code: 'SRJ', name: 'Surajpur' },
      { code: 'SRG', name: 'Surguja' },
    ],
  },
  {
    code: 'GA', name: 'Goa',
    districts: [
      { code: 'NGO', name: 'North Goa' },
      { code: 'SGO', name: 'South Goa' },
    ],
  },
  {
    code: 'GJ', name: 'Gujarat',
    districts: [
      { code: 'AMD', name: 'Ahmedabad' },
      { code: 'SRT', name: 'Surat' },
    ],
  },
  {
    code: 'HR', name: 'Haryana',
    districts: [
      { code: 'AMB', name: 'Ambala' },
      { code: 'PKL', name: 'Panchkula' },
      { code: 'KRN', name: 'Karnal' },
    ],
  },
  {
    code: 'HP', name: 'Himachal Pradesh',
    districts: [
      { code: 'SHL', name: 'Shimla' },
      { code: 'KNG', name: 'Kangra' },
    ],
  },
  {
    code: 'JH', name: 'Jharkhand',
    districts: [
      { code: 'BKO', name: 'Bokaro' },
      { code: 'CTR', name: 'Chatra' },
      { code: 'DGR', name: 'Deoghar' },
      { code: 'DHN', name: 'Dhanbad' },
      { code: 'DMK', name: 'Dumka' },
      { code: 'ESB', name: 'East Singhbhum' },
      { code: 'GRH', name: 'Garhwa' },
      { code: 'GRD', name: 'Giridih' },
      { code: 'GDD', name: 'Godda' },
      { code: 'GML', name: 'Gumla' },
      { code: 'HZB', name: 'Hazaribagh' },
      { code: 'JMT', name: 'Jamtara' },
      { code: 'KHT_JH', name: 'Khunti' },
      { code: 'KOD', name: 'Koderma' },
      { code: 'LTH', name: 'Latehar' },
      { code: 'LHD', name: 'Lohardaga' },
      { code: 'PKR', name: 'Pakur' },
      { code: 'PLM', name: 'Palamu' },
      { code: 'RMG', name: 'Ramgarh' },
      { code: 'RNC', name: 'Ranchi' },
      { code: 'SBG', name: 'Sahibganj' },
      { code: 'SKR_JH', name: 'Seraikela Kharsawan' },
      { code: 'SMD', name: 'Simdega' },
      { code: 'WSB', name: 'West Singhbhum' },
    ],
  },
  {
    code: 'KA', name: 'Karnataka',
    districts: [
      { code: 'BNG', name: 'Bangalore' },
      { code: 'MYS', name: 'Mysore' },
    ],
  },
  {
    code: 'KL', name: 'Kerala',
    districts: [
      { code: 'ALP', name: 'Alappuzha' },
      { code: 'EKM', name: 'Ernakulam' },
      { code: 'IDK', name: 'Idukki' },
      { code: 'KNR_KL', name: 'Kannur' },
      { code: 'KSG_KL', name: 'Kasaragod' },
      { code: 'KLM', name: 'Kollam' },
      { code: 'KTM', name: 'Kottayam' },
      { code: 'KKD', name: 'Kozhikode' },
      { code: 'MLP', name: 'Malappuram' },
      { code: 'PLK', name: 'Palakkad' },
      { code: 'PTA', name: 'Pathanamthitta' },
      { code: 'TVM_KL', name: 'Thiruvananthapuram' },
      { code: 'TSR', name: 'Thrissur' },
      { code: 'WYD', name: 'Wayanad' },
    ],
  },
  {
    code: 'MP', name: 'Madhya Pradesh',
    districts: [
      { code: 'BPL', name: 'Bhopal' },
      { code: 'IND', name: 'Indore' },
    ],
  },
  {
    code: 'MH', name: 'Maharashtra',
    districts: [
      { code: 'AHM_MH', name: 'Ahmednagar / Ahilyanagar' },
      { code: 'AKL', name: 'Akola' },
      { code: 'AMR_MH', name: 'Amravati' },
      { code: 'CSN', name: 'Chhatrapati Sambhaji Nagar' },
      { code: 'BED', name: 'Beed' },
      { code: 'BHD_MH', name: 'Bhandara' },
      { code: 'BLD', name: 'Buldhana' },
      { code: 'CHD', name: 'Chandrapur' },
      { code: 'DHL', name: 'Dhule' },
      { code: 'GDC', name: 'Gadchiroli' },
      { code: 'GND_MH', name: 'Gondia' },
      { code: 'HNG', name: 'Hingoli' },
      { code: 'JLG', name: 'Jalgaon' },
      { code: 'JLN_MH', name: 'Jalna' },
      { code: 'KLP_MH', name: 'Kolhapur' },
      { code: 'LTR', name: 'Latur' },
      { code: 'MMC', name: 'Mumbai City' },
      { code: 'MMS', name: 'Mumbai Suburban' },
      { code: 'NGP', name: 'Nagpur' },
      { code: 'NND', name: 'Nanded' },
      { code: 'NDB', name: 'Nandurbar' },
      { code: 'NSK', name: 'Nashik' },
      { code: 'DHR_MH', name: 'Dharashiv / Osmanabad' },
      { code: 'PLG', name: 'Palghar' },
      { code: 'PBN', name: 'Parbhani' },
      { code: 'PUN', name: 'Pune' },
      { code: 'RGD', name: 'Raigad' },
      { code: 'RTN', name: 'Ratnagiri' },
      { code: 'SGL', name: 'Sangli' },
      { code: 'STR', name: 'Satara' },
      { code: 'SND', name: 'Sindhudurg' },
      { code: 'SLP', name: 'Solapur' },
      { code: 'THN', name: 'Thane' },
      { code: 'WRD', name: 'Wardha' },
      { code: 'WSM', name: 'Washim' },
      { code: 'YTL', name: 'Yavatmal' },
    ],
  },
  {
    code: 'MN', name: 'Manipur',
    districts: [
      { code: 'IMW', name: 'Imphal West' },
      { code: 'IME', name: 'Imphal East' },
    ],
  },
  {
    code: 'ML', name: 'Meghalaya',
    districts: [
      { code: 'EKH', name: 'East Khasi Hills' },
      { code: 'WJH', name: 'West Jaintia Hills' },
    ],
  },
  {
    code: 'MZ', name: 'Mizoram',
    districts: [
      { code: 'AIZ', name: 'Aizawl' },
      { code: 'CMP', name: 'Champhai' },
    ],
  },
  {
    code: 'NL', name: 'Nagaland',
    districts: [
      { code: 'KOH', name: 'Kohima' },
      { code: 'DIM', name: 'Dimapur' },
    ],
  },
  {
    code: 'OD', name: 'Odisha',
    districts: [
      { code: 'ANG', name: 'Angul' },
      { code: 'BLG_OD', name: 'Balangir' },
      { code: 'BLS_OD', name: 'Balasore' },
      { code: 'BRG', name: 'Bargarh' },
      { code: 'BDK', name: 'Bhadrak' },
      { code: 'BDH', name: 'Boudh' },
      { code: 'CTC', name: 'Cuttack' },
      { code: 'DGH', name: 'Deoghar' },
      { code: 'DNK', name: 'Dhenkanal' },
      { code: 'GJP', name: 'Gajapati' },
      { code: 'GNJ', name: 'Ganjam' },
      { code: 'JSP', name: 'Jagatsinghpur' },
      { code: 'JJP', name: 'Jajpur' },
      { code: 'JSG', name: 'Jharsuguda' },
      { code: 'KLH', name: 'Kalahandi' },
      { code: 'KND', name: 'Kandhamal' },
      { code: 'KNP_OD', name: 'Kendrapara' },
      { code: 'KJR', name: 'Kendujhar / Keonjhar' },
      { code: 'KRD', name: 'Khordha' },
      { code: 'KPT_OD', name: 'Koraput' },
      { code: 'MLK_OD', name: 'Malkangiri' },
      { code: 'MBJ', name: 'Mayurbhanj' },
      { code: 'NBP', name: 'Nabarangpur' },
      { code: 'NYG', name: 'Nayagarh' },
      { code: 'NPD', name: 'Nuapada' },
      { code: 'PRI', name: 'Puri' },
      { code: 'RYG', name: 'Rayagada' },
      { code: 'SBP', name: 'Sambalpur' },
      { code: 'SBP_OD', name: 'Subarnapur / Sonepur' },
      { code: 'SNG_OD', name: 'Sundargarh' },
    ],
  },
  {
    code: 'PB', name: 'Punjab',
    districts: [
      { code: 'ASR', name: 'Amritsar' },
      { code: 'BNL', name: 'Barnala' },
      { code: 'BTH', name: 'Bathinda' },
      { code: 'FDK', name: 'Faridkot' },
      { code: 'FGS', name: 'Fatehgarh Sahib' },
      { code: 'FZK', name: 'Fazilka' },
      { code: 'FZP', name: 'Ferozepur' },
      { code: 'GSP', name: 'Gurdaspur' },
      { code: 'HSP', name: 'Hoshiarpur' },
      { code: 'JAL', name: 'Jalandhar' },
      { code: 'KPT', name: 'Kapurthala' },
      { code: 'LDH', name: 'Ludhiana' },
      { code: 'MLK', name: 'Malerkotla' },
      { code: 'MNS', name: 'Mansa' },
      { code: 'MOG', name: 'Moga' },
      { code: 'PTK', name: 'Pathankot' },
      { code: 'PAT', name: 'Patiala' },
      { code: 'RUP', name: 'Rupnagar' },
      { code: 'SAS', name: 'SAS Nagar (Mohali)' },
      { code: 'SBS', name: 'SBS Nagar (Nawanshahr)' },
      { code: 'MKS', name: 'Sri Muktsar Sahib' },
      { code: 'SNG', name: 'Sangrur' },
      { code: 'TTN', name: 'Tarn Taran' },
    ],
  },
  {
    code: 'RJ', name: 'Rajasthan',
    districts: [
      { code: 'JAI', name: 'Jaipur' },
      { code: 'JDP', name: 'Jodhpur' },
      { code: 'UDA', name: 'Udaipur' },
      { code: 'AJM', name: 'Ajmer' },
    ],
  },
  {
    code: 'SK', name: 'Sikkim',
    districts: [
      { code: 'ESK', name: 'East Sikkim' },
      { code: 'WSK', name: 'West Sikkim' },
    ],
  },
  {
    code: 'TN', name: 'Tamil Nadu',
    districts: [
      { code: 'ARI', name: 'Ariyalur' },
      { code: 'CGP', name: 'Chengalpattu' },
      { code: 'CHN', name: 'Chennai' },
      { code: 'CBE', name: 'Coimbatore' },
      { code: 'CUD', name: 'Cuddalore' },
      { code: 'DPI', name: 'Dharmapuri' },
      { code: 'DGL', name: 'Dindigul' },
      { code: 'ERD', name: 'Erode' },
      { code: 'KLK', name: 'Kallakurichi' },
      { code: 'KCP', name: 'Kancheepuram' },
      { code: 'KKM', name: 'Kanniyakumari' },
      { code: 'KRR', name: 'Karur' },
      { code: 'KGI', name: 'Krishnagiri' },
      { code: 'MDU', name: 'Madurai' },
      { code: 'MYD', name: 'Mayiladuthurai' },
      { code: 'NGP_TN', name: 'Nagapattinam' },
      { code: 'NMK', name: 'Namakkal' },
      { code: 'PBL', name: 'Perambalur' },
      { code: 'PDK', name: 'Pudukkottai' },
      { code: 'RMD', name: 'Ramanathapuram' },
      { code: 'RPT', name: 'Ranipet' },
      { code: 'SLM', name: 'Salem' },
      { code: 'SVG', name: 'Sivaganga' },
      { code: 'TKS', name: 'Tenkasi' },
      { code: 'TNJ', name: 'Thanjavur' },
      { code: 'NLG', name: 'The Nilgiris' },
      { code: 'THN_TN', name: 'Theni' },
      { code: 'TLR', name: 'Thiruvallur' },
      { code: 'TVR', name: 'Thiruvarur' },
      { code: 'TUT', name: 'Thoothukudi / Tuticorin' },
      { code: 'TRI', name: 'Tiruchirappalli' },
      { code: 'TNV', name: 'Tirunelveli' },
      { code: 'TPR_TN', name: 'Tirupathur' },
      { code: 'TPR', name: 'Tiruppur' },
      { code: 'TVM_TN', name: 'Tiruvannamalai' },
      { code: 'VEL', name: 'Vellore' },
      { code: 'VLP', name: 'Viluppuram' },
      { code: 'VRD', name: 'Virudhunagar' },
    ],
  },
  {
    code: 'TS', name: 'Telangana',
    districts: [
      { code: 'HYD', name: 'Hyderabad' },
      { code: 'WGL', name: 'Warangal' },
    ],
  },
  {
    code: 'TR', name: 'Tripura',
    districts: [
      { code: 'WTR', name: 'West Tripura' },
      { code: 'SPJ', name: 'Sepahijala' },
    ],
  },
  {
    code: 'UK', name: 'Uttarakhand',
    districts: [
      { code: 'DDN', name: 'Dehradun' },
      { code: 'HRW', name: 'Haridwar' },
    ],
  },
  {
    code: 'UP', name: 'Uttar Pradesh',
    districts: [
      { code: 'LKO', name: 'Lucknow' },
      { code: 'KNP', name: 'Kanpur' },
      { code: 'VAR', name: 'Varanasi' },
    ],
  },
  {
    code: 'WB', name: 'West Bengal',
    districts: [
      { code: 'KOL', name: 'Kolkata' },
      { code: 'HWH', name: 'Howrah' },
    ],
  },
  // ── 8 UNION TERRITORIES ──
  {
    code: 'AN', name: 'Andaman and Nicobar Islands',
    districts: [
      { code: 'SAN', name: 'South Andaman' },
      { code: 'NMA', name: 'North and Middle Andaman' },
    ],
  },
  {
    code: 'CH', name: 'Chandigarh',
    districts: [
      { code: 'CHU', name: 'Chandigarh Urban' },
      { code: 'CHR', name: 'Chandigarh Rural' },
    ],
  },
  {
    code: 'DN', name: 'Dadra and Nagar Haveli',
    districts: [
      { code: 'SLS', name: 'Silvassa' },
      { code: 'DDR', name: 'Dadra' },
    ],
  },
  {
    code: 'DD', name: 'Daman and Diu',
    districts: [
      { code: 'DMA', name: 'Daman' },
      { code: 'DIU', name: 'Diu' },
    ],
  },
  {
    code: 'DL', name: 'Delhi',
    districts: [
      { code: 'NDL', name: 'North Delhi' },
      { code: 'SDL', name: 'South Delhi' },
    ],
  },
  {
    code: 'JK', name: 'Jammu and Kashmir',
    districts: [
      { code: 'SRN', name: 'Srinagar' },
      { code: 'JMU', name: 'Jammu' },
    ],
  },
  {
    code: 'LA', name: 'Ladakh',
    districts: [
      { code: 'LEH', name: 'Leh' },
      { code: 'KGL', name: 'Kargil' },
    ],
  },
  {
    code: 'PY', name: 'Puducherry',
    districts: [
      { code: 'PUD', name: 'Puducherry' },
      { code: 'KAL', name: 'Karaikal' },
    ],
  },
];

/**
 * Auto-resolves state & district names to official codes (e.g. Punjab -> PB, Howrah -> HWH)
 */
export function getGeoLookup(stateInput?: string, districtInput?: string) {
  let matchedState: StateInfo | undefined;
  let matchedDistrict: DistrictInfo | undefined;

  const sClean = stateInput?.trim().toLowerCase();
  const dClean = districtInput?.trim().toLowerCase();

  if (sClean) {
    matchedState = STATES_UTS.find(
      s => s.code.toLowerCase() === sClean || s.name.toLowerCase() === sClean
    );
  }

  if (dClean) {
    // If state is matched, prioritize districts within that state
    const targetStates = matchedState ? [matchedState] : STATES_UTS;
    for (const st of targetStates) {
      const found = st.districts.find(
        d =>
          d.code.toLowerCase() === dClean ||
          d.name.toLowerCase() === dClean ||
          (dClean === 'hwr' && d.code === 'HWH') // alias support
      );
      if (found) {
        matchedDistrict = found;
        if (!matchedState) matchedState = st;
        break;
      }
    }
  }

  return {
    stateCode: matchedState?.code || null,
    stateName: matchedState?.name || null,
    districtCode: matchedDistrict?.code || null,
    districtName: matchedDistrict?.name || null,
  };
}

