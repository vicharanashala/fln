/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Student, School, Ticket, Announcement, LogEntry } from './types';

export const FLN_STRANDS = [
  'Number Sense (One-to-One Correspondence)',
  'Number Operations',
  'Money',
  'Measurement',
  'Shapes',
  'Fractions',
  'Patterns',
  'Data Handling',
  'Calendar & Time'
];

export const STATES_DATA = [
  { id: 'pb', name: 'Punjab', districtsCount: 23, enrolled: 245000, certified: 159250 },
  { id: 'hr', name: 'Haryana', districtsCount: 22, enrolled: 198000, certified: 128700 },
  { id: 'rj', name: 'Rajasthan', districtsCount: 33, enrolled: 382000, certified: 191000 },
  { id: 'up', name: 'Uttar Pradesh', districtsCount: 75, enrolled: 520000, certified: 286000 },
  { id: 'hp', name: 'Himachal Pradesh', districtsCount: 12, enrolled: 84000, certified: 63840 },
  { id: 'ut', name: 'Uttarakhand', districtsCount: 13, enrolled: 95000, certified: 68400 }
];

export const DISTRICTS_DATA: Record<string, { id: string; name: string; blocksCount: number; avgScore: number; lagging: boolean }[]> = {
  pb: [
    { id: 'ldh', name: 'Ludhiana', blocksCount: 14, avgScore: 78, lagging: false },
    { id: 'jal', name: 'Jalandhar', blocksCount: 11, avgScore: 74, lagging: false },
    { id: 'asr', name: 'Amritsar', blocksCount: 9, avgScore: 68, lagging: false },
    { id: 'bth', name: 'Bathinda', blocksCount: 8, avgScore: 38, lagging: true },
    { id: 'pat', name: 'Patiala', blocksCount: 10, avgScore: 61, lagging: false },
    { id: 'mog', name: 'Moga', blocksCount: 6, avgScore: 52, lagging: false }
  ],
  hr: [
    { id: 'amb', name: 'Ambala', blocksCount: 8, avgScore: 71, lagging: false },
    { id: 'pkl', name: 'Panchkula', blocksCount: 5, avgScore: 79, lagging: false },
    { id: 'krn', name: 'Karnal', blocksCount: 7, avgScore: 63, lagging: false }
  ],
  rj: [
    { id: 'jpr', name: 'Jaipur', blocksCount: 15, avgScore: 72, lagging: false },
    { id: 'jod', name: 'Jodhpur', blocksCount: 12, avgScore: 54, lagging: false },
    { id: 'uda', name: 'Udaipur', blocksCount: 11, avgScore: 35, lagging: true },
    { id: 'ajm', name: 'Ajmer', blocksCount: 8, avgScore: 39, lagging: true }
  ],
  up: [
    { id: 'lko', name: 'Lucknow', blocksCount: 12, avgScore: 65, lagging: false },
    { id: 'knp', name: 'Kanpur', blocksCount: 10, avgScore: 44, lagging: true },
    { id: 'var', name: 'Varanasi', blocksCount: 9, avgScore: 58, lagging: false }
  ]
};

export const BLOCKS_DATA: Record<string, { id: string; name: string; districtId: string; avgScore: number }[]> = new Proxy({
  'ldh': [
    { id: 'LDH-01', name: 'Ludhiana Block 1', districtId: 'ldh', avgScore: 78 },
    { id: 'LDH-02', name: 'Ludhiana Block 2', districtId: 'ldh', avgScore: 65 }
  ],
  'bth': [
    { id: 'BTH-01', name: 'Bathinda Block 1', districtId: 'bth', avgScore: 38 }
  ],
  'asr': [
    { id: 'ASR-01', name: 'Ajnala Block', districtId: 'asr', avgScore: 68 },
    { id: 'ASR-02', name: 'Attari Block', districtId: 'asr', avgScore: 65 }
  ],
  'mog': [
    { id: 'MOG-02', name: 'Moga Block 2', districtId: 'mog', avgScore: 52 }
  ],
  'amb': [
    { id: 'AMB-01', name: 'Ambala Block 1', districtId: 'amb', avgScore: 71 },
    { id: 'AMB-02', name: 'Ambala Block 2', districtId: 'amb', avgScore: 68 }
  ],
  'pkl': [
    { id: 'PKL-01', name: 'Panchkula Block 1', districtId: 'pkl', avgScore: 79 }
  ],
  'jpr': [
    { id: 'JAI-01', name: 'Jaipur Block A', districtId: 'jpr', avgScore: 72 },
    { id: 'JAI-02', name: 'Jaipur Block B', districtId: 'jpr', avgScore: 65 }
  ],
  'uda': [
    { id: 'UDA-01', name: 'Udaipur Block 1', districtId: 'uda', avgScore: 35 }
  ],
  'lko': [
    { id: 'LKO-01', name: 'Lucknow Block 1', districtId: 'lko', avgScore: 65 },
    { id: 'LKO-02', name: 'Lucknow Block 2', districtId: 'lko', avgScore: 58 }
  ],
  'knp': [
    { id: 'KNP-01', name: 'Kanpur Block 1', districtId: 'knp', avgScore: 44 }
  ],
  'hwh': [
    { id: 'HWH-01', name: 'Howrah Block 1', districtId: 'hwh', avgScore: 75 },
    { id: 'HWH-02', name: 'Howrah Block 2', districtId: 'hwh', avgScore: 68 }
  ],
  'hwr': [
    { id: 'HWR-01', name: 'Howrah Block 1', districtId: 'hwr', avgScore: 75 },
    { id: 'HWR-02', name: 'Howrah Block 2', districtId: 'hwr', avgScore: 68 }
  ]
}, {
  get(target, prop: string) {
    if (typeof prop !== 'string') return (target as any)[prop];
    const key = prop.toLowerCase();
    if (target[key]) return target[key];
    
    // Auto-generate block list for any unlisted district code (e.g. hwh, kol, vsk, etc.)
    const dCode = key.toUpperCase();
    const dName = DISTRICT_NAMES[dCode] || dCode;
    return [
      { id: `${dCode}-01`, name: `${dName} Block 1`, districtId: key, avgScore: 68 },
      { id: `${dCode}-02`, name: `${dName} Block 2`, districtId: key, avgScore: 62 }
    ];
  }
});

// Code-to-name mappings for all 36 States/UTs, Districts, and Blocks
export const STATE_NAMES: Record<string, string> = {
  AP: 'Andhra Pradesh', AR: 'Arunachal Pradesh', AS: 'Assam', BR: 'Bihar',
  CG: 'Chhattisgarh', GA: 'Goa', GJ: 'Gujarat', HR: 'Haryana',
  HP: 'Himachal Pradesh', JH: 'Jharkhand', KA: 'Karnataka', KL: 'Kerala',
  MP: 'Madhya Pradesh', MH: 'Maharashtra', MN: 'Manipur', ML: 'Meghalaya',
  MZ: 'Mizoram', NL: 'Nagaland', OD: 'Odisha', PB: 'Punjab',
  RJ: 'Rajasthan', SK: 'Sikkim', TN: 'Tamil Nadu', TS: 'Telangana',
  TR: 'Tripura', UK: 'Uttarakhand', UP: 'Uttar Pradesh', WB: 'West Bengal',
  AN: 'Andaman and Nicobar Islands', CH: 'Chandigarh', DN: 'Dadra and Nagar Haveli',
  DD: 'Daman and Diu', DL: 'Delhi', JK: 'Jammu and Kashmir', LA: 'Ladakh', PY: 'Puducherry',
};

export const DISTRICT_NAMES: Record<string, string> = {
  GNT: 'Guntur', VSK: 'Visakhapatnam', TWG: 'Tawang', PPR: 'Papum Pare',
  KMR: 'Kamrup', NGN: 'Nagaon', GYA: 'Gaya',
  RPR: 'Raipur', BSP: 'Bilaspur', NGO: 'North Goa', SGO: 'South Goa',
  // Haryana (HR)
  AMB: 'Ambala', BHW: 'Bhiwani', CKD: 'Charkhi Dadri', FBD: 'Faridabad', FTB: 'Fatehabad',
  GGM: 'Gurugram', HSR: 'Hisar', JHJ: 'Jhajjar', JND: 'Jind', KTL: 'Kaithal',
  KRL: 'Karnal', KKR: 'Kurukshetra', MHG: 'Mahendragarh', NUH: 'Nuh', PLW: 'Palwal',
  PKL: 'Panchkula', PNP: 'Panipat', REW: 'Rewari', RTK: 'Rohtak', SRS: 'Sirsa',
  SNP: 'Sonipat', YNR: 'Yamunanagar',
  // Himachal Pradesh (HP)
  BLP: 'Bilaspur', CHM: 'Chamba', HMR: 'Hamirpur', KNG: 'Kangra', KNR: 'Kinnaur',
  KLU: 'Kullu', LHS: 'Lahaul and Spiti', MND: 'Mandi', SML: 'Shimla', SMR: 'Sirmaur',
  SLN: 'Solan', UNA: 'Una',
  // Uttarakhand (UK)
  ALM: 'Almora', BAG: 'Bageshwar', CPW: 'Champawat', DDN: 'Dehradun', HWR: 'Haridwar',
  NTL: 'Nainital', PAU: 'Pauri Garhwal', PTH: 'Pithoragarh', RPY: 'Rudraprayag', TEH: 'Tehri Garhwal',
  USN: 'Udham Singh Nagar', UTK: 'Uttarkashi',
  RNC: 'Ranchi', DHN: 'Dhanbad',
  BNG: 'Bangalore', MYS: 'Mysore', TVM: 'Thiruvananthapuram', EKM: 'Ernakulam',
  BPL: 'Bhopal', MUM: 'Mumbai', PUN: 'Pune',
  // Maharashtra (MH) - All 36 Official Districts
  AHM_MH: 'Ahmednagar / Ahilyanagar', AKL: 'Akola', AMR_MH: 'Amravati', CSN: 'Chhatrapati Sambhaji Nagar', BED: 'Beed',
  BHD_MH: 'Bhandara', BLD: 'Buldhana', CHD: 'Chandrapur', DHL: 'Dhule', GDC: 'Gadchiroli',
  GND_MH: 'Gondia', HNG: 'Hingoli', JLG: 'Jalgaon', JLN_MH: 'Jalna', KLP_MH: 'Kolhapur',
  LTR: 'Latur', MMC: 'Mumbai City', MMS: 'Mumbai Suburban', NGP: 'Nagpur', NND: 'Nanded',
  NDB: 'Nandurbar', NSK: 'Nashik', DHR_MH: 'Dharashiv / Osmanabad', PLG: 'Palghar', PBN: 'Parbhani',
  RGD: 'Raigad', RTN: 'Ratnagiri', SGL: 'Sangli', STR: 'Satara',
  SND: 'Sindhudurg', SLP: 'Solapur', THN: 'Thane', WRD: 'Wardha', WSM: 'Washim', YTL: 'Yavatmal',
  IMW: 'Imphal West', IME: 'Imphal East', EKH: 'East Khasi Hills', WJH: 'West Jaintia Hills',
  AIZ: 'Aizawl', CMP: 'Champhai', KOH: 'Kohima', DIM: 'Dimapur',
  BBS: 'Bhubaneswar', CTC: 'Cuttack',
  ASR: 'Amritsar', BNL: 'Barnala', BTH: 'Bathinda', FDK: 'Faridkot', FGS: 'Fatehgarh Sahib',
  FZK: 'Fazilka', FZP: 'Ferozepur', GSP: 'Gurdaspur', HSP: 'Hoshiarpur', JAL: 'Jalandhar',
  KPT: 'Kapurthala', LDH: 'Ludhiana', MLK: 'Malerkotla', MNS: 'Mansa', MOG: 'Moga',
  PTK: 'Pathankot', PAT: 'Patiala', RUP: 'Rupnagar', SAS: 'SAS Nagar (Mohali)',
  SBS: 'SBS Nagar (Nawanshahr)', MKS: 'Sri Muktsar Sahib', SNG: 'Sangrur', TTN: 'Tarn Taran',
  JAI: 'Jaipur', JDP: 'Jodhpur', ESK: 'East Sikkim', WSK: 'West Sikkim',
  // Tamil Nadu (TN) - All 38 Official Districts
  ARI: 'Ariyalur', CGP: 'Chengalpattu', CHN: 'Chennai', CBE: 'Coimbatore', CUD: 'Cuddalore',
  DPI: 'Dharmapuri', DGL: 'Dindigul', ERD: 'Erode', KLK: 'Kallakurichi', KCP: 'Kancheepuram',
  KKM: 'Kanniyakumari', KRR: 'Karur', KGI: 'Krishnagiri', MDU: 'Madurai', MYD: 'Mayiladuthurai',
  NGP_TN: 'Nagapattinam', NMK: 'Namakkal', PBL: 'Perambalur', PDK: 'Pudukkottai', RMD: 'Ramanathapuram',
  RPT: 'Ranipet', SLM: 'Salem', SVG: 'Sivaganga', TKS: 'Tenkasi', TNJ: 'Thanjavur',
  NLG: 'The Nilgiris', THN_TN: 'Theni', TLR: 'Thiruvallur', TVR: 'Thiruvarur', TUT: 'Thoothukudi / Tuticorin',
  TRI: 'Tiruchirappalli', TNV: 'Tirunelveli', TPR_TN: 'Tirupathur', TPR: 'Tiruppur', TVM_TN: 'Tiruvannamalai',
  VEL: 'Vellore', VLP: 'Viluppuram', VRD: 'Virudhunagar',
  HYD: 'Hyderabad', WGL: 'Warangal',
  // Uttar Pradesh (UP) - 75 Districts
  AGR: 'Agra', ALG: 'Aligarh', AMB_UP: 'Ambedkar Nagar', AMT: 'Amethi', AMR: 'Amroha',
  AUR: 'Auraiya', AYO: 'Ayodhya', AZM: 'Azamgarh', BGP: 'Baghpat', BHR: 'Bahraich',
  BAL: 'Ballia', BLR: 'Balrampur', BND: 'Banda', BBK: 'Barabanki', BLY: 'Bareilly',
  BST: 'Basti', BHD: 'Bhadohi', BJN: 'Bijnor', BDN: 'Budaun', BLS: 'Bulandshahr',
  CND: 'Chandauli', CKT: 'Chitrakoot', DEO: 'Deoria', ETH: 'Etah', ETW: 'Etawah',
  FRK: 'Farrukhabad', FTP: 'Fatehpur', FZB: 'Firozabad', GBN: 'Gautam Buddha Nagar', GZB: 'Ghaziabad',
  GZP: 'Ghazipur', GND: 'Gonda', GKP: 'Gorakhpur', HMP: 'Hamirpur', HPR: 'Hapur',
  HRD: 'Hardoi', HTR: 'Hathras', JLN: 'Jalaun', JNP: 'Jaunpur', JHS: 'Jhansi',
  KNJ: 'Kannauj', KPD: 'Kanpur Dehat', KPN: 'Kanpur Nagar', KSG: 'Kasganj', KSH: 'Kaushambi',
  KSHN: 'Kushinagar', LKP: 'Lakhimpur Kheri', LLT: 'Lalitpur', LKO: 'Lucknow', MHJ: 'Maharajganj',
  MHB: 'Mahoba', MNP: 'Mainpuri', MTH: 'Mathura', MAU: 'Mau', MRT: 'Meerut',
  MZP: 'Mirzapur', MBD: 'Moradabad', MZF: 'Muzaffarnagar', PLB: 'Pilibhit', PRT: 'Pratapgarh',
  PRY: 'Prayagraj', RBL: 'Raebareli', RMP: 'Rampur', SHR: 'Saharanpur', SMB: 'Sambhal',
  // Bihar (BR) - 38 Districts
  ARA: 'Araria', ARW: 'Arwal', AUR_BR: 'Aurangabad', BNK: 'Banka', BGS: 'Begusarai',
  BGP_BR: 'Bhagalpur', BHP: 'Bhojpur', BXR: 'Buxar', DBG: 'Darbhanga', ECM: 'East Champaran',
  GAY: 'Gaya', GPL: 'Gopalganj', JMU: 'Jamui', JHD: 'Jehanabad', KMR_BR: 'Kaimur',
  KTR: 'Katihar', KHG: 'Khagaria', KSG_BR: 'Kishanganj', LKS: 'Lakhisarai', MDP: 'Madhepura',
  MDB: 'Madhubani', MNG: 'Munger', MUZ: 'Muzaffarpur', NAL: 'Nalanda', NWD: 'Nawada',
  PAT_BR: 'Patna', PUR: 'Purnia', RHT: 'Rohtas', SHS: 'Saharsa', SMT: 'Samastipur',
  // Rajasthan (RJ) - 50 Districts
  AJM: 'Ajmer', ALW: 'Alwar', APG: 'Anupgarh', BLT: 'Balotra', BSW: 'Banswara',
  BRN: 'Baran', BMR: 'Barmer', BWR: 'Beawar', BHT: 'Bharatpur', BHL: 'Bhilwara',
  BKN: 'Bikaner', BND_RJ: 'Bundi', CTG: 'Chittorgarh', CHR: 'Churu', DSA: 'Dausa',
  DEG: 'Deeg', DHP: 'Dholpur', DKC: 'Didwana-Kuchaman', DNG: 'Dungarpur', GGN: 'Sri Ganganagar',
  GPC: 'Gangapur City', HNM: 'Hanumangarh', JPR: 'Jaipur', JSM: 'Jaisalmer', JLR: 'Jalore',
  JHL: 'Jhalawar', JJN: 'Jhunjhunu', JDH: 'Jodhpur', KRL_RJ: 'Karauli', KKR_RJ: 'Kekri',
  KHT: 'Khairthal-Tijara', KTA: 'Kota', KPB: 'Kotputli-Behror', NGR: 'Nagaur', NKT: 'Neem Ka Thana',
  // Madhya Pradesh (MP) - 55 Districts
  AGM: 'Agar Malwa', ALR: 'Alirajpur', ANP: 'Anuppur', ASH: 'Ashoknagar', BLG: 'Balaghat',
  BRW: 'Barwani', BTL: 'Betul', BHN: 'Bhind', BHP_MP: 'Bhopal', BUR: 'Burhanpur',
  CHT: 'Chhatarpur', CHW: 'Chhindwara', DMH: 'Damoh', DTA: 'Datia', DWS: 'Dewas',
  DHR: 'Dhar', DND: 'Dindori', GNA: 'Guna', GWL: 'Gwalior', HRD_MP: 'Harda',
  IND: 'Indore', JBL: 'Jabalpur', JHB: 'Jhabua', KTN: 'Katni', KHD: 'Khandwa',
  KHG_MP: 'Khargone', MHR: 'Maihar', MDL: 'Mandla', MND_MP: 'Mandsaur', MGJ: 'Mauganj',
  MRN: 'Morena', NMP: 'Narmadapuram', NSP: 'Narsinghpur', NMC: 'Neemuch', NWR: 'Niwari',
  PND: 'Pandhurna', PAN: 'Panna', RSN: 'Raisen', RJG: 'Rajgarh', RTL: 'Ratlam',
  REW_MP: 'Rewa', SGR: 'Sagar', STN: 'Satna', SHR_MP: 'Sehore', SNO: 'Seoni',
  SHD: 'Shahdol', SJP: 'Shajapur', SHP_MP: 'Sheopur', SVP: 'Shivpuri', SDH: 'Sidhi',
  // Gujarat (GJ) - 33 Districts
  AHM: 'Ahmedabad', AMR_GJ: 'Amreli', AND: 'Anand', ARV: 'Aravalli', BNK_GJ: 'Banaskantha',
  BRH: 'Bharuch', BHV: 'Bhavnagar', BTD: 'Botad', CHU_GJ: 'Chhota Udaipur', DHD: 'Dahod',
  DNG_GJ: 'Dang', DBD: 'Devbhumi Dwarka', GDN: 'Gandhinagar', GSM: 'Gir Somnath', JMN: 'Jamnagar',
  JND_GJ: 'Junagadh', KCH: 'Kachchh', KHD_GJ: 'Kheda', MSG: 'Mahisagar', MSN: 'Mehsana',
  MRB: 'Morbi', NRM: 'Narmada', NVS: 'Navsari', PNC: 'Panchmahal', PTN: 'Patan',
  // West Bengal (WB) - 23 Districts
  APD: 'Alipurduar', BNK_WB: 'Bankura', BRB: 'Birbhum', COB: 'Cooch Behar', DDN_WB: 'Dakshin Dinajpur',
  DAR: 'Darjeeling', HGL: 'Hooghly', HWH: 'Howrah', JPG: 'Jalpaiguri', JHG: 'Jhargram',
  KLP: 'Kalimpong', KOL: 'Kolkata', MLD: 'Malda', MSD: 'Murshidabad', NAD: 'Nadia',
  N24: 'North 24 Parganas', PBD_WB: 'Paschim Bardhaman', PMD: 'Paschim Medinipur', PRB: 'Purba Bardhaman', EGM: 'Purba Medinipur',
  PUR_WB: 'Purulia', S24: 'South 24 Parganas', UDN: 'Uttar Dinajpur',
  AN: 'Andaman and Nicobar Islands', CH: 'Chandigarh', DN: 'Dadra and Nagar Haveli',
  DD: 'Daman and Diu', DL: 'Delhi', JK: 'Jammu and Kashmir', LA: 'Ladakh', PY: 'Puducherry',
};

export const BLOCK_NAMES: Record<string, string> = {
  'GNT_01': 'Guntur Block 1', 'GNT_02': 'Guntur Block 2',
  'VSK_01': 'Visakhapatnam Block 1', 'VSK_02': 'Visakhapatnam Block 2',
  'TWG_01': 'Tawang Block 1', 'TWG_02': 'Tawang Block 2',
  'PPR_01': 'Papum Pare Block 1', 'PPR_02': 'Papum Pare Block 2',
  'KMR_01': 'Kamrup Block 1', 'KMR_02': 'Kamrup Block 2',
  'NGN_01': 'Nagaon Block 1', 'NGN_02': 'Nagaon Block 2',
  'GYA_01': 'Gaya Block 1', 'GYA_02': 'Gaya Block 2',
  'RPR_01': 'Raipur Block 1', 'RPR_02': 'Raipur Block 2',
  'BSP_01': 'Bilaspur Block 1', 'BSP_02': 'Bilaspur Block 2',
  'NGO_01': 'North Goa Block 1', 'NGO_02': 'North Goa Block 2',
  'SGO_01': 'South Goa Block 1', 'SGO_02': 'South Goa Block 2',
  'RNC_01': 'Ranchi Block 1', 'RNC_02': 'Ranchi Block 2',
  'DHN_01': 'Dhanbad Block 1', 'DHN_02': 'Dhanbad Block 2',
  'BNG_01': 'Bangalore Block 1', 'BNG_02': 'Bangalore Block 2',
  'MYS_01': 'Mysore Block 1', 'MYS_02': 'Mysore Block 2',
  'TVM_01': 'Thiruvananthapuram Block 1', 'TVM_02': 'Thiruvananthapuram Block 2',
  'EKM_01': 'Ernakulam Block 1', 'EKM_02': 'Ernakulam Block 2',
  // --- MAHARASHTRA (MH) 350+ BLOCKS ACROSS 36 OFFICIAL DISTRICTS ---
  'AHM_MH_01': 'Akole Block', 'AHM_MH_02': 'Jamkhed Block', 'AHM_MH_03': 'Karjat Block', 'AHM_MH_04': 'Kopargaon Block', 'AHM_MH_05': 'Nagar Block', 'AHM_MH_06': 'Nevasa Block', 'AHM_MH_07': 'Parner Block', 'AHM_MH_08': 'Pathardi Block', 'AHM_MH_09': 'Rahata Block', 'AHM_MH_10': 'Rahuri Block', 'AHM_MH_11': 'Sangamner Block', 'AHM_MH_12': 'Shevgaon Block', 'AHM_MH_13': 'Shrigonda Block', 'AHM_MH_14': 'Shrirampur Block',

  'AKL_01': 'Akola Block', 'AKL_02': 'Akot Block', 'AKL_03': 'Balapur Block', 'AKL_04': 'Barshitakli Block', 'AKL_05': 'Murtizapur Block', 'AKL_06': 'Patur Block', 'AKL_07': 'Telhara Block',

  'AMR_MH_01': 'Achalpur Block', 'AMR_MH_02': 'Amravati Block', 'AMR_MH_03': 'Anjangaon Surji Block', 'AMR_MH_04': 'Bhatkuli Block', 'AMR_MH_05': 'Chandur Railway Block', 'AMR_MH_06': 'Chandurbazar Block', 'AMR_MH_07': 'Chikhaldara Block', 'AMR_MH_08': 'Daryapur Block', 'AMR_MH_09': 'Dhamangaon Railway Block', 'AMR_MH_10': 'Dharni Block', 'AMR_MH_11': 'Morshi Block', 'AMR_MH_12': 'Nandgaon Khandeshwar Block', 'AMR_MH_13': 'Teosa Block', 'AMR_MH_14': 'Warud Block',

  'CSN_01': 'Aurangabad Block', 'CSN_02': 'Gangapur Block', 'CSN_03': 'Kannad Block', 'CSN_04': 'Khuldabad Block', 'CSN_05': 'Paithan Block', 'CSN_06': 'Phulambri Block', 'CSN_07': 'Sillod Block', 'CSN_08': 'Soegaon Block', 'CSN_09': 'Vaijapur Block',

  'BED_01': 'Ambejogai Block', 'BED_02': 'Ashti Block', 'BED_03': 'Beed Block', 'BED_04': 'Georai Block', 'BED_05': 'Kaij Block', 'BED_06': 'Majalgaon Block', 'BED_07': 'Parli Block', 'BED_08': 'Patoda Block', 'BED_09': 'Shirur Kasar Block', 'BED_10': 'Wadwani Block', 'BED_11': 'Dharur Block',

  'BHD_MH_01': 'Bhandara Block', 'BHD_MH_02': 'Lakhandur Block', 'BHD_MH_03': 'Lakhani Block', 'BHD_MH_04': 'Mohadi Block', 'BHD_MH_05': 'Pauni Block', 'BHD_MH_06': 'Sakoli Block', 'BHD_MH_07': 'Tumsar Block',

  'BLD_01': 'Buldhana Block', 'BLD_02': 'Chikhli Block', 'BLD_03': 'Deolgaon Raja Block', 'BLD_04': 'Jalgaon Jamod Block', 'BLD_05': 'Khamgaon Block', 'BLD_06': 'Lonar Block', 'BLD_07': 'Malkapur Block', 'BLD_08': 'Mehkar Block', 'BLD_09': 'Motala Block', 'BLD_10': 'Nandura Block', 'BLD_11': 'Sangrampur Block', 'BLD_12': 'Shegaon Block', 'BLD_13': 'Sindkhed Raja Block',

  'CHD_01': 'Ballarpur Block', 'CHD_02': 'Bhadravati Block', 'CHD_03': 'Brahmapuri Block', 'CHD_04': 'Chandrapur Block', 'CHD_05': 'Chimur Block', 'CHD_06': 'Gondpipri Block', 'CHD_07': 'Jiwati Block', 'CHD_08': 'Korpana Block', 'CHD_09': 'Mul Block', 'CHD_10': 'Nagbhid Block', 'CHD_11': 'Pombhurna Block', 'CHD_12': 'Rajura Block', 'CHD_13': 'Sawali Block', 'CHD_14': 'Sindewahi Block', 'CHD_15': 'Warora Block',

  'DHL_01': 'Dhule Block', 'DHL_02': 'Sakri Block', 'DHL_03': 'Shirpur Block', 'DHL_04': 'Sindkheda Block',

  'GDC_01': 'Aheri Block', 'GDC_02': 'Armori Block', 'GDC_03': 'Bhamragad Block', 'GDC_04': 'Chamorshi Block', 'GDC_05': 'Desaiganj Wadsa Block', 'GDC_06': 'Dhanora Block', 'GDC_07': 'Etapalli Block', 'GDC_08': 'Gadchiroli Block', 'GDC_09': 'Korchi Block', 'GDC_10': 'Kurkheda Block', 'GDC_11': 'Mulchera Block', 'GDC_12': 'Sironcha Block',

  'GND_MH_01': 'Amgaon Block', 'GND_MH_02': 'Arjuni Morgaon Block', 'GND_MH_03': 'Deori Block', 'GND_MH_04': 'Gondia Block', 'GND_MH_05': 'Goregaon Block', 'GND_MH_06': 'Sadak Arjuni Block', 'GND_MH_07': 'Salekasa Block', 'GND_MH_08': 'Tirora Block',

  'HNG_01': 'Aundha Nagnath Block', 'HNG_02': 'Basmath Block', 'HNG_03': 'Hingoli Block', 'HNG_04': 'Kalamnuri Block', 'HNG_05': 'Sengaon Block',

  'JLG_01': 'Amalner Block', 'JLG_02': 'Bhadgaon Block', 'JLG_03': 'Bhusawal Block', 'JLG_04': 'Bodwad Block', 'JLG_05': 'Chalisgaon Block', 'JLG_06': 'Chopda Block', 'JLG_07': 'Dharangaon Block', 'JLG_08': 'Erandol Block', 'JLG_09': 'Jalgaon Block', 'JLG_10': 'Jamner Block', 'JLG_11': 'Muktainagar Block', 'JLG_12': 'Pachora Block', 'JLG_13': 'Parola Block', 'JLG_14': 'Raver Block', 'JLG_15': 'Yawal Block',

  'JLN_MH_01': 'Ambad Block', 'JLN_MH_02': 'Badnapur Block', 'JLN_MH_03': 'Bhokardan Block', 'JLN_MH_04': 'Ghansawangi Block', 'JLN_MH_05': 'Jafrabad Block', 'JLN_MH_06': 'Jalna Block', 'JLN_MH_07': 'Mantha Block', 'JLN_MH_08': 'Partur Block',

  'KLP_MH_01': 'Ajra Block', 'KLP_MH_02': 'Bavda / Gaganbawda Block', 'KLP_MH_03': 'Bhudargad Block', 'KLP_MH_04': 'Chandgad Block', 'KLP_MH_05': 'Gadhinglaj Block', 'KLP_MH_06': 'Hatkanangle Block', 'KLP_MH_07': 'Kagal Block', 'KLP_MH_08': 'Karveer Block', 'KLP_MH_09': 'Panhala Block', 'KLP_MH_10': 'Radhanagari Block', 'KLP_MH_11': 'Shahuwadi Block', 'KLP_MH_12': 'Shirol Block',

  'LTR_01': 'Ahmadpur Block', 'LTR_02': 'Ausa Block', 'LTR_03': 'Chakur Block', 'LTR_04': 'Deoni Block', 'LTR_05': 'Jalkot Block', 'LTR_06': 'Latur Block', 'LTR_07': 'Nilanga Block', 'LTR_08': 'Renapur Block', 'LTR_09': 'Shirur Anantpal Block', 'LTR_10': 'Udgir Block',

  'MMC_01': 'No Rural Blocks - Entirely Urban / Municipal Corporation',

  'MMS_01': 'Andheri / Western Suburban Block', 'MMS_02': 'Borivali / Northern Suburban Block', 'MMS_03': 'Kurla / Eastern Suburban Block',

  'NGP_01': 'Bhiwapur Block', 'NGP_02': 'Hingna Block', 'NGP_03': 'Kalameshwar Block', 'NGP_04': 'Kamptee Block', 'NGP_05': 'Katol Block', 'NGP_06': 'Kuhi Block', 'NGP_07': 'Mouda Block', 'NGP_08': 'Nagpur Rural Block', 'NGP_09': 'Narkhed Block', 'NGP_10': 'Parseoni Block', 'NGP_11': 'Ramtek Block', 'NGP_12': 'Savner Block', 'NGP_13': 'Umred Block',

  'NND_01': 'Ardhapur Block', 'NND_02': 'Bhokar Block', 'NND_03': 'Biloli Block', 'NND_04': 'Deglur Block', 'NND_05': 'Dharmabad Block', 'NND_06': 'Hadgaon Block', 'NND_07': 'Himayatnagar Block', 'NND_08': 'Kandhar Block', 'NND_09': 'Kinwat Block', 'NND_10': 'Loha Block', 'NND_11': 'Mahur Block', 'NND_12': 'Mudkhed Block', 'NND_13': 'Mukhed Block', 'NND_14': 'Naigaon / Khairgaon Block', 'NND_15': 'Nanded Block', 'NND_16': 'Umri Block',

  'NDB_01': 'Akkalkuwa Block', 'NDB_02': 'Akrani / Dhadgaon Block', 'NDB_03': 'Nandurbar Block', 'NDB_04': 'Navapur Block', 'NDB_05': 'Shahada Block', 'NDB_06': 'Taloda Block',

  'NSK_01': 'Baglan / Satana Block', 'NSK_02': 'Chandwad Block', 'NSK_03': 'Deola Block', 'NSK_04': 'Dindori Block', 'NSK_05': 'Igatpuri Block', 'NSK_06': 'Kalwan Block', 'NSK_07': 'Malegaon Block', 'NSK_08': 'Nandgaon Block', 'NSK_09': 'Nashik Block', 'NSK_10': 'Niphad Block', 'NSK_11': 'Peth Block', 'NSK_12': 'Sinnar Block', 'NSK_13': 'Surgana Block', 'NSK_14': 'Trimbakeshwar Block', 'NSK_15': 'Yeola Block',

  'DHR_MH_01': 'Bhoom Block', 'DHR_MH_02': 'Kalamb Block', 'DHR_MH_03': 'Lohara Block', 'DHR_MH_04': 'Osmanabad / Dharashiv Block', 'DHR_MH_05': 'Paranda Block', 'DHR_MH_06': 'Tuljapur Block', 'DHR_MH_07': 'Umarga Block', 'DHR_MH_08': 'Washi Block',

  'PLG_01': 'Dahanu Block', 'PLG_02': 'Jawhar Block', 'PLG_03': 'Mokhada Block', 'PLG_04': 'Palghar Block', 'PLG_05': 'Talasari Block', 'PLG_06': 'Vada Block', 'PLG_07': 'Vasai Block', 'PLG_08': 'Vikramgad Block',

  'PBN_01': 'Gangakhed Block', 'PBN_02': 'Jintur Block', 'PBN_03': 'Manwath Block', 'PBN_04': 'Palam Block', 'PBN_05': 'Parbhani Block', 'PBN_06': 'Pathri Block', 'PBN_07': 'Purna Block', 'PBN_08': 'Sailu Block', 'PBN_09': 'Sonpeth Block',

  'PUN_01': 'Ambegaon Block', 'PUN_02': 'Baramati Block', 'PUN_03': 'Bhor Block', 'PUN_04': 'Daund Block', 'PUN_05': 'Haveli Block', 'PUN_06': 'Indapur Block', 'PUN_07': 'Junnar Block', 'PUN_08': 'Khed Block', 'PUN_09': 'Maval Block', 'PUN_10': 'Mulshi Block', 'PUN_11': 'Purandar Block', 'PUN_12': 'Shirur Block', 'PUN_13': 'Velhe Block',

  'RGD_01': 'Alibag Block', 'RGD_02': 'Karjat Block', 'RGD_03': 'Khalapur Block', 'RGD_04': 'Mahad Block', 'RGD_05': 'Mangaon Block', 'RGD_06': 'Mhasla Block', 'RGD_07': 'Murud Block', 'RGD_08': 'Panvel Block', 'RGD_09': 'Pen Block', 'RGD_10': 'Poladpur Block', 'RGD_11': 'Roha Block', 'RGD_12': 'Shrivardhan Block', 'RGD_13': 'Sudhagad Pali Block', 'RGD_14': 'Tala Block', 'RGD_15': 'Uran Block',

  'RTN_01': 'Chiplun Block', 'RTN_02': 'Dapoli Block', 'RTN_03': 'Guhagar Block', 'RTN_04': 'Khed Block', 'RTN_05': 'Lanja Block', 'RTN_06': 'Mandangad Block', 'RTN_07': 'Rajapur Block', 'RTN_08': 'Ratnagiri Block', 'RTN_09': 'Sangameshwar Block',

  'SGL_01': 'Atpadi Block', 'SGL_02': 'Jat Block', 'SGL_03': 'Kadegaon Block', 'SGL_04': 'Kavathe Mahankal Block', 'SGL_05': 'Khanapur / Vita Block', 'SGL_06': 'Miraj Block', 'SGL_07': 'Palus Block', 'SGL_08': 'Shirala Block', 'SGL_09': 'Tasgaon Block', 'SGL_10': 'Walwa / Islampur Block',

  'STR_01': 'Jaoli Block', 'STR_02': 'Karad Block', 'STR_03': 'Khandala Block', 'STR_04': 'Khatav Block', 'STR_05': 'Koregaon Block', 'STR_06': 'Mahabaleshwar Block', 'STR_07': 'Man Block', 'STR_08': 'Patan Block', 'STR_09': 'Phaltan Block', 'STR_10': 'Satara Block', 'STR_11': 'Wai Block',

  'SND_01': 'Devgad Block', 'SND_02': 'Dodamarg Block', 'SND_03': 'Kankavli Block', 'SND_04': 'Kudal Block', 'SND_05': 'Malvan Block', 'SND_06': 'Sawantwadi Block', 'SND_07': 'Vaibhavwadi Block', 'SND_08': 'Vengurla Block',

  'SLP_01': 'Akkalkot Block', 'SLP_02': 'Barshi Block', 'SLP_03': 'Karmala Block', 'SLP_04': 'Madha Block', 'SLP_05': 'Malshiras Block', 'SLP_06': 'Mangalwedha Block', 'SLP_07': 'Mohol Block', 'SLP_08': 'Pandharpur Block', 'SLP_09': 'Sangole Block', 'SLP_10': 'Solapur North Block', 'SLP_11': 'Solapur South Block',

  'THN_01': 'Ambernath Block', 'THN_02': 'Bhiwandi Block', 'THN_03': 'Kalyan Block', 'THN_04': 'Murbad Block', 'THN_05': 'Shahapur Block', 'THN_06': 'Thane Rural Block', 'THN_07': 'Ulhasnagar Block',

  'WRD_01': 'Arvi Block', 'WRD_02': 'Ashti Block', 'WRD_03': 'Deoli Block', 'WRD_04': 'Hinganghat Block', 'WRD_05': 'Karanja Block', 'WRD_06': 'Samudrapur Block', 'WRD_07': 'Seloo Block', 'WRD_08': 'Wardha Block',

  'WSM_01': 'Karanja Block', 'WSM_02': 'Malegaon Block', 'WSM_03': 'Mangrulpir Block', 'WSM_04': 'Manora Block', 'WSM_05': 'Risod Block', 'WSM_06': 'Washim Block',

  'YTL_01': 'Arni Block', 'YTL_02': 'Babhulgaon Block', 'YTL_03': 'Darwha Block', 'YTL_04': 'Digras Block', 'YTL_05': 'Ghatanji Block', 'YTL_06': 'Kalamb Block', 'YTL_07': 'Kelapur / Pandharkawada Block', 'YTL_08': 'Mahagaon Block', 'YTL_09': 'Maregaon Block', 'YTL_10': 'Ner Block', 'YTL_11': 'Pusad Block', 'YTL_12': 'Ralegaon Block', 'YTL_13': 'Umarkhed Block', 'YTL_14': 'Wani Block', 'YTL_15': 'Yavatmal Block', 'YTL_16': 'Zari-Jamani Block',
  // --- TAMIL NADU (TN) 388 BLOCKS ACROSS 38 OFFICIAL DISTRICTS ---
  'ARI_01': 'Andimadam Block', 'ARI_02': 'Ariyalur Block', 'ARI_03': 'Jayankondam Block', 'ARI_04': 'Sendurai Block', 'ARI_05': 'T.Palur Block', 'ARI_06': 'Thirumanur Block',

  'CGP_01': 'Acharapakkam Block', 'CGP_02': 'Chithamur Block', 'CGP_03': 'Kattankolathur Block', 'CGP_04': 'Lathur Block', 'CGP_05': 'Maduranthakam Block', 'CGP_06': 'St. Thomas Mount Block', 'CGP_07': 'Thiruporur Block', 'CGP_08': 'Tirukalukundram Block',

  'CHN_01': 'No Rural Blocks - Entirely Greater Chennai Corporation',

  'CBE_01': 'Anamalai Block', 'CBE_02': 'Annur Block', 'CBE_03': 'Karamadai Block', 'CBE_04': 'Kinathukadavu Block', 'CBE_05': 'Madukkarai Block', 'CBE_06': 'Periyanayakkanpalayam Block', 'CBE_07': 'Pollachi North Block', 'CBE_08': 'Pollachi South Block', 'CBE_09': 'Sarcarsamakulam Block', 'CBE_10': 'Sultanpet Block', 'CBE_11': 'Sulur Block', 'CBE_12': 'Thondamuthur Block',

  'CUD_01': 'Annagramam Block', 'CUD_02': 'Cuddalore Block', 'CUD_03': 'Kammapuram Block', 'CUD_04': 'Kattumannarkoil Block', 'CUD_05': 'Keerapalayam Block', 'CUD_06': 'Kumaratchi Block', 'CUD_07': 'Kurinjipadi Block', 'CUD_08': 'Mangalur Block', 'CUD_09': 'Melbhuvanagiri Block', 'CUD_10': 'Nallur Block', 'CUD_11': 'Panruti Block', 'CUD_12': 'Parangipettai Block', 'CUD_13': 'Srimushnam Block', 'CUD_14': 'Virudhachalam Block',

  'DPI_01': 'Dharmapuri Block', 'DPI_02': 'Harur Block', 'DPI_03': 'Karimangalam Block', 'DPI_04': 'Kadathur Block', 'DPI_05': 'Morappur Block', 'DPI_06': 'Nallampalli Block', 'DPI_07': 'Palakkodu Block', 'DPI_08': 'Pappireddipatti Block', 'DPI_09': 'Pennagaram Block', 'DPI_10': 'Eriyur Block',

  'DGL_01': 'Athoor Block', 'DGL_02': 'Batlagundu Block', 'DGL_03': 'Dindigul Block', 'DGL_04': 'Gujiliamparai Block', 'DGL_05': 'Kodaikanal Block', 'DGL_06': 'Natham Block', 'DGL_07': 'Nilakottai Block', 'DGL_08': 'Oddanchatram Block', 'DGL_09': 'Palani Block', 'DGL_10': 'Reddiarchatram Block', 'DGL_11': 'Shanarpatti Block', 'DGL_12': 'Thoppampatti Block', 'DGL_13': 'Vadamadurai Block', 'DGL_14': 'Vedasandur Block',

  'ERD_01': 'Ammapet Block', 'ERD_02': 'Anthiyur Block', 'ERD_03': 'Bhavani Block', 'ERD_04': 'Bhavanisagar Block', 'ERD_05': 'Chennimalai Block', 'ERD_06': 'Erode Block', 'ERD_07': 'Gobichettipalayam Block', 'ERD_08': 'Kodumudi Block', 'ERD_09': 'Modakkurichi Block', 'ERD_10': 'Nambiyur Block', 'ERD_11': 'Perundurai Block', 'ERD_12': 'Sathyamangalam Block', 'ERD_13': 'Talavadi Block', 'ERD_14': 'T.N.Palayam Block',

  'KLK_01': 'Chinnasalem Block', 'KLK_02': 'Kalrayan Hills Block', 'KLK_03': 'Kallakurichi Block', 'KLK_04': 'Rishivandiyam Block', 'KLK_05': 'Sankarapuram Block', 'KLK_06': 'Thiagadurgam Block', 'KLK_07': 'Tirukkoyilur Block', 'KLK_08': 'Tirunavalur Block', 'KLK_09': 'Ulundurpet Block',

  'KCP_01': 'Kancheepuram Block', 'KCP_02': 'Kundrathur Block', 'KCP_03': 'Sriperumbudur Block', 'KCP_04': 'Uthiramerur Block', 'KCP_05': 'Walajabad Block',

  'KKM_01': 'Agastheeswaram Block', 'KKM_02': 'Killiyoor Block', 'KKM_03': 'Kurunthancode Block', 'KKM_04': 'Melpuram Block', 'KKM_05': 'Munchirai Block', 'KKM_06': 'Rajakkamangalam Block', 'KKM_07': 'Thiruvattar Block', 'KKM_08': 'Thovalai Block', 'KKM_09': 'Thuckalay Block',

  'KRR_01': 'Aravakurichi Block', 'KRR_02': 'K.Paramathi Block', 'KRR_03': 'Kadavur Block', 'KRR_04': 'Karur Block', 'KRR_05': 'Krishnarayapuram Block', 'KRR_06': 'Kulithalai Block', 'KRR_07': 'Thanthoni Block', 'KRR_08': 'Thogaimalai Block',

  'KGI_01': 'Bargur Block', 'KGI_02': 'Hosur Block', 'KGI_03': 'Kaveripattinam Block', 'KGI_04': 'Kelamangalam Block', 'KGI_05': 'Krishnagiri Block', 'KGI_06': 'Mathur Block', 'KGI_07': 'Shoolagiri Block', 'KGI_08': 'Thally Block', 'KGI_09': 'Uthangarai Block', 'KGI_10': 'Veppanapalli Block',

  'MDU_01': 'Alanganallur Block', 'MDU_02': 'Chellampatti Block', 'MDU_03': 'Kallikudi Block', 'MDU_04': 'Kottampatti Block', 'MDU_05': 'Madurai East Block', 'MDU_06': 'Madurai West Block', 'MDU_07': 'Melur Block', 'MDU_08': 'Sedapatti Block', 'MDU_09': 'T.Kallupatti Block', 'MDU_10': 'Thirumangalam Block', 'MDU_11': 'Thirupparankundram Block', 'MDU_12': 'Usilampatti Block', 'MDU_13': 'Vadipatti Block',

  'MYD_01': 'Kollidam Block', 'MYD_02': 'Kuthalam Block', 'MYD_03': 'Mayiladuthurai Block', 'MYD_04': 'Sirkali Block', 'MYD_05': 'Sembanarkoil Block',

  'NGP_TN_01': 'Keelaiyur Block', 'NGP_TN_02': 'Kilvelur Block', 'NGP_TN_03': 'Nagapattinam Block', 'NGP_TN_04': 'Thalainayar Block', 'NGP_TN_05': 'Thirumarugal Block', 'NGP_TN_06': 'Vedaranyam Block',

  'NMK_01': 'Elachipalayam Block', 'NMK_02': 'Erumapatty Block', 'NMK_03': 'Kabilarmalai Block', 'NMK_04': 'Kolli Hills Block', 'NMK_05': 'Mallasamudram Block', 'NMK_06': 'Mohanur Block', 'NMK_07': 'Namagiripet Block', 'NMK_08': 'Namakkal Block', 'NMK_09': 'Paramathi Block', 'NMK_10': 'Puduchatram Block', 'NMK_11': 'Rasipuram Block', 'NMK_12': 'Sendamangalam Block', 'NMK_13': 'Thiruchengode Block', 'NMK_14': 'Vennandur Block', 'NMK_15': 'Pallipalayam Block',

  'PBL_01': 'Alathur Block', 'PBL_02': 'Kurumbalur / Perambalur Block', 'PBL_03': 'Veppanthattai Block', 'PBL_04': 'Veppur Block',

  'PDK_01': 'Annavasal Block', 'PDK_02': 'Aranthangi Block', 'PDK_03': 'Arimalam Block', 'PDK_04': 'Avudayarkoil Block', 'PDK_05': 'Gandarvakottai Block', 'PDK_06': 'Karambakkudi Block', 'PDK_07': 'Kunnandarkoil Block', 'PDK_08': 'Manamelkudi Block', 'PDK_09': 'Mayilappur / Viralimalai Block', 'PDK_10': 'Pudukkottai Block', 'PDK_11': 'Thiruvarankulam Block', 'PDK_12': 'Thirumayam Block', 'PDK_13': 'Ponnamaravathi Block',

  'RMD_01': 'Bogalur Block', 'RMD_02': 'Kadaladi Block', 'RMD_03': 'Kamuthi Block', 'RMD_04': 'Mandapam Block', 'RMD_05': 'Mudukulathur Block', 'RMD_06': 'Nainarkoil Block', 'RMD_07': 'Paramakudi Block', 'RMD_08': 'R.S.Mangalam Block', 'RMD_09': 'Ramanathapuram Block', 'RMD_10': 'Thiruppullani Block', 'RMD_11': 'Thiruvadanai Block',

  'RPT_01': 'Arakkonam Block', 'RPT_02': 'Arcot Block', 'RPT_03': 'Kaveripakkam Block', 'RPT_04': 'Nemili Block', 'RPT_05': 'Sholinghur Block', 'RPT_06': 'Timiri Block', 'RPT_07': 'Walajah Block',

  'SLM_01': 'Attur Block', 'SLM_02': 'Ayothiyapattinam Block', 'SLM_03': 'Gangavalli Block', 'SLM_04': 'Idappadi Block', 'SLM_05': 'Kadayampatti Block', 'SLM_06': 'Kolathur Block', 'SLM_07': 'Konganapuram Block', 'SLM_08': 'Magudanchavadi Block', 'SLM_09': 'Mecheri Block', 'SLM_10': 'Nangavalli Block', 'SLM_11': 'Omalur Block', 'SLM_12': 'Panaimarathupatti Block', 'SLM_13': 'Peddanaickenpalayam Block', 'SLM_14': 'Salem Block', 'SLM_15': 'Sankari Block', 'SLM_16': 'Thalaivasal Block', 'SLM_17': 'Tharamangalam Block', 'SLM_18': 'Valapady Block', 'SLM_19': 'Veerapandi Block', 'SLM_20': 'Yercaud Block',

  'SVG_01': 'Devakottai Block', 'SVG_02': 'Ilanyangudi Block', 'SVG_03': 'Kalayarkoil Block', 'SVG_04': 'Kallal Block', 'SVG_05': 'Kannankudi Block', 'SVG_06': 'Manamadurai Block', 'SVG_07': 'S.Pudur Block', 'SVG_08': 'Sakkottai Block', 'SVG_09': 'Singampunari Block', 'SVG_10': 'Sivaganga Block', 'SVG_11': 'Thiruppuvanam Block', 'SVG_12': 'Tirupathur Block',

  'TKS_01': 'Alangulam Block', 'TKS_02': 'Kadayanallur Block', 'TKS_03': 'Keelapavoor Block', 'TKS_04': 'Kuruvikulam Block', 'TKS_05': 'Melaneelithanallur Block', 'TKS_06': 'Sankarankovil Block', 'TKS_07': 'Shenkottai Block', 'TKS_08': 'Tenkasi Block', 'TKS_09': 'Vasudevanallur Block', 'TKS_10': 'Vembakottai Block',

  'TNJ_01': 'Ammapettai Block', 'TNJ_02': 'Budalur Block', 'TNJ_03': 'Kumbakonam Block', 'TNJ_04': 'Madukkur Block', 'TNJ_05': 'Orathanadu Block', 'TNJ_06': 'Papanasam Block', 'TNJ_07': 'Pattukkottai Block', 'TNJ_08': 'Peravurani Block', 'TNJ_09': 'Sethubhavachatram Block', 'TNJ_10': 'Thanjavur Block', 'TNJ_11': 'Thirappanandal Block', 'TNJ_12': 'Thiruvaiyaru Block', 'TNJ_13': 'Thiruvonam Block', 'TNJ_14': 'Thiruvidaimarudur Block',

  'NLG_01': 'Coonoor Block', 'NLG_02': 'Gudalur Block', 'NLG_03': 'Kotagiri Block', 'NLG_04': 'Udhagamandalam Block',

  'THN_TN_01': 'Andipatti Block', 'THN_TN_02': 'Bodinayakkanur Block', 'THN_TN_03': 'Chinnamanur Block', 'THN_TN_04': 'Cumbum Block', 'THN_TN_05': 'Kadamalaikundu-Myladumparai Block', 'THN_TN_06': 'Periyakulam Block', 'THN_TN_07': 'Theni Block', 'THN_TN_08': 'Uthamapalayam Block',

  'TLR_01': 'Ellapuram Block', 'TLR_02': 'Gummidipoondi Block', 'TLR_03': 'Kadambathur Block', 'TLR_04': 'Minjur Block', 'TLR_05': 'Pallipattu Block', 'TLR_06': 'Poondi Block', 'TLR_07': 'Poonamallee Block', 'TLR_08': 'R.K.Pet Block', 'TLR_09': 'Sholavaram Block', 'TLR_10': 'Tiruttani Block', 'TLR_11': 'Thiruvallur Block', 'TLR_12': 'Thiruvalangadu Block', 'TLR_13': 'Villivakkam Block', 'TLR_14': 'Ekkadu Block',

  'TVR_01': 'Kodavasal Block', 'TVR_02': 'Koradacheri Block', 'TVR_03': 'Kottur Block', 'TVR_04': 'Mannargudi Block', 'TVR_05': 'Muthupettai Block', 'TVR_06': 'Nannilam Block', 'TVR_07': 'Needamangalam Block', 'TVR_08': 'Thirumakkottai Block', 'TVR_09': 'Thiruvarur Block', 'TVR_10': 'Valangaiman Block',

  'TUT_01': 'Alwarthirunagari Block', 'TUT_02': 'Karunkulam Block', 'TUT_03': 'Kayathar Block', 'TUT_04': 'Kovilpatti Block', 'TUT_05': 'Ottapidaram Block', 'TUT_06': 'Pudur Block', 'TUT_07': 'Sattankulam Block', 'TUT_08': 'Srivaikuntam Block', 'TUT_09': 'Thoothukudi Block', 'TUT_10': 'Tiruchendur Block', 'TUT_11': 'Udangudi Block', 'TUT_12': 'Vilathikulam Block',

  'TRI_01': 'Andanallur Block', 'TRI_02': 'Lalgudi Block', 'TRI_03': 'Manachanallur Block', 'TRI_04': 'Manapparai Block', 'TRI_05': 'Manikandam Block', 'TRI_06': 'Marungapuri Block', 'TRI_07': 'Musiri Block', 'TRI_08': 'Pullambadi Block', 'TRI_09': 'Tattayyangarpettai Block', 'TRI_10': 'Thiruverumbur Block', 'TRI_11': 'Thottiam Block', 'TRI_12': 'Thuraiyur Block', 'TRI_13': 'Uppiliyapuram Block', 'TRI_14': 'Vaiyampatti Block',

  'TNV_01': 'Ambasamudram Block', 'TNV_02': 'Cheranmahadevi Block', 'TNV_03': 'Kalakadu Block', 'TNV_04': 'Manur Block', 'TNV_05': 'Nanguneri Block', 'TNV_06': 'Palayamkottai Block', 'TNV_07': 'Pappakudi Block', 'TNV_08': 'Radhapuram Block', 'TNV_09': 'Valliyoor Block',

  'TPR_TN_01': 'Alangayam Block', 'TPR_TN_02': 'Jolarpet Block', 'TPR_TN_03': 'Kandhili Block', 'TPR_TN_04': 'Madhanur Block', 'TPR_TN_05': 'Natrampalli Block', 'TPR_TN_06': 'Tirupathur Block',

  'TPR_01': 'Avinashi Block', 'TPR_02': 'Dharapuram Block', 'TPR_03': 'Gudimangalam Block', 'TPR_04': 'Kangeyam Block', 'TPR_05': 'Kundadam Block', 'TPR_06': 'Madathukulam Block', 'TPR_07': 'Mulanur Block', 'TPR_08': 'Palladam Block', 'TPR_09': 'Pongalur Block', 'TPR_10': 'Tiruppur Block', 'TPR_11': 'Udumalaipettai Block', 'TPR_12': 'Uthukuli Block', 'TPR_13': 'Vellakoil Block',

  'TVM_TN_01': 'Anakkavoor Block', 'TVM_TN_02': 'Arani East Block', 'TVM_TN_03': 'Arani West Block', 'TVM_TN_04': 'Chetpet Block', 'TVM_TN_05': 'Cheyyar Block', 'TVM_TN_06': 'Jawadhu Hills Block', 'TVM_TN_07': 'Kalasapakkam Block', 'TVM_TN_08': 'Kilpennathur Block', 'TVM_TN_09': 'Peranamallur Block', 'TVM_TN_10': 'Polur Block', 'TVM_TN_11': 'Pudupalayam Block', 'TVM_TN_12': 'Thandarampattu Block', 'TVM_TN_13': 'Thellar Block', 'TVM_TN_14': 'Thiruvannamalai Block', 'TVM_TN_15': 'Turinjapuram Block', 'TVM_TN_16': 'Vandavasi Block', 'TVM_TN_17': 'Vembakkam Block', 'TVM_TN_18': 'West Arani Block',

  'VEL_01': 'Anaicut Block', 'VEL_02': 'Gudiyatham Block', 'VEL_03': 'Kaniyambadi Block', 'VEL_04': 'Katpadi Block', 'VEL_05': 'K.V.Kuppam Block', 'VEL_06': 'Pernambut Block', 'VEL_07': 'Vellore Block',

  'VLP_01': 'Gingee Block', 'VLP_02': 'Kanai Block', 'VLP_03': 'Kandamangalam Block', 'VLP_04': 'Koliyanur Block', 'VLP_05': 'Mailam Block', 'VLP_06': 'Marakkanam Block', 'VLP_07': 'Melmalayanur Block', 'VLP_08': 'Mugaiyur Block', 'VLP_09': 'Olakkur Block', 'VLP_10': 'Thiruvennainallur Block', 'VLP_11': 'Vanur Block', 'VLP_12': 'Vikaravandi Block', 'VLP_13': 'Vallam Block',

  'VRD_01': 'Aruppukkottai Block', 'VRD_02': 'Kariapatti Block', 'VRD_03': 'Narikudi Block', 'VRD_04': 'Rajapalayam Block', 'VRD_05': 'Sathur Block', 'VRD_06': 'Sivakasi Block', 'VRD_07': 'Srivilliputhur Block', 'VRD_08': 'Tiruchuli Block', 'VRD_09': 'Vembakottai Block', 'VRD_10': 'Virudhunagar Block', 'VRD_11': 'Watrap Block',
  'IMW_01': 'Imphal West Block 1', 'IMW_02': 'Imphal West Block 2',
  'IME_01': 'Imphal East Block 1', 'IME_02': 'Imphal East Block 2',
  'EKH_01': 'East Khasi Hills Block 1', 'EKH_02': 'East Khasi Hills Block 2',
  'WJH_01': 'West Jaintia Hills Block 1', 'WJH_02': 'West Jaintia Hills Block 2',
  'AIZ_01': 'Aizawl Block 1', 'AIZ_02': 'Aizawl Block 2',
  'CMP_01': 'Champhai Block 1', 'CMP_02': 'Champhai Block 2',
  'KOH_01': 'Kohima Block 1', 'KOH_02': 'Kohima Block 2',
  'DIM_01': 'Dimapur Block 1', 'DIM_02': 'Dimapur Block 2',
  'BBS_01': 'Bhubaneswar Block 1', 'BBS_02': 'Bhubaneswar Block 2',
  // --- PUNJAB (PB) ALL 23 OFFICIAL DISTRICTS & 152 BLOCKS ---
  'ASR_01': 'Ajnala Block', 'ASR_02': 'Attari Block', 'ASR_03': 'Chogawan Block',
  'ASR_04': 'Majitha Block', 'ASR_05': 'Jandiala Guru Block', 'ASR_06': 'Verka Block',
  'ASR_07': 'Rayya Block', 'ASR_08': 'Tarsika Block', 'ASR_09': 'Harsha Chhina Block',

  'BNL_01': 'Barnala Block', 'BNL_02': 'Sehna Block', 'BNL_03': 'Mehal Kalan Block',

  'BTH_01': 'Bathinda Block', 'BTH_02': 'Talwandi Sabo Block', 'BTH_03': 'Rampura Block',
  'BTH_04': 'Maur Block', 'BTH_05': 'Nathana Block', 'BTH_06': 'Phul Block',
  'BTH_07': 'Bhagta Bhaika Block', 'BTH_08': 'Sangat Block', 'BTH_09': 'Goniana Mandi Block',

  'FDK_01': 'Faridkot Block', 'FDK_02': 'Kot Kapura Block', 'FDK_03': 'Jaitu Block',

  'FGS_01': 'Sirhind Block', 'FGS_02': 'Amloh Block', 'FGS_03': 'Bassi Pathana Block',
  'FGS_04': 'Khamanon Block', 'FGS_05': 'Khera Block',

  'FZK_01': 'Fazilka Block', 'FZK_02': 'Abohar Block', 'FZK_03': 'Jalalabad Block',
  'FZK_04': 'Khuian Sarwar Block', 'FZK_05': 'Arniwala Sheikh Subhan Block',

  'FZP_01': 'Ferozepur Block', 'FZP_02': 'Ghall Khurd Block', 'FZP_03': 'Guru Harsahai Block',
  'FZP_04': 'Makhu Block', 'FZP_05': 'Mamdot Block', 'FZP_06': 'Zira Block',

  'GSP_01': 'Gurdaspur Block', 'GSP_02': 'Batala Block', 'GSP_03': 'Dera Baba Nanak Block',
  'GSP_04': 'Dhariwal Block', 'GSP_05': 'Dinanagar Block', 'GSP_06': 'Fatehgarh Churian Block',
  'GSP_07': 'Kalanaur Block', 'GSP_08': 'Sri Hargobindpur Block', 'GSP_09': 'Qadian Block',
  'GSP_10': 'Kahnuwan Block', 'GSP_11': 'Dorangla Block',

  'HSP_01': 'Hoshiarpur 1 Block', 'HSP_02': 'Hoshiarpur 2 Block', 'HSP_03': 'Dasuya Block',
  'HSP_04': 'Garhshankar Block', 'HSP_05': 'Mukerian Block', 'HSP_06': 'Tanda Block',
  'HSP_07': 'Mahalpur Block', 'HSP_08': 'Bhunga Block', 'HSP_09': 'Hajipur Block',
  'HSP_10': 'Talwara Block',

  'JAL_01': 'Jalandhar East Block', 'JAL_02': 'Jalandhar West Block', 'JAL_03': 'Nakodar Block',
  'JAL_04': 'Phillaur Block', 'JAL_05': 'Shahkot Block', 'JAL_06': 'Adampur Block',
  'JAL_07': 'Bhogpur Block', 'JAL_08': 'Mehatpur Block', 'JAL_09': 'Lohian Block',
  'JAL_10': 'Nurmahal Block', 'JAL_11': 'Rurka Kalan Block',

  'KPT_01': 'Kapurthala Block', 'KPT_02': 'Phagwara Block', 'KPT_03': 'Sultanpur Lodhi Block',
  'KPT_04': 'Dhilwan Block', 'KPT_05': 'Nadala Block',

  'LDH_01': 'Ludhiana 1 Block', 'LDH_02': 'Ludhiana 2 Block', 'LDH_03': 'Khanna Block',
  'LDH_04': 'Jagraon Block', 'LDH_05': 'Samrala Block', 'LDH_06': 'Doraha Block',
  'LDH_07': 'Raikot Block', 'LDH_08': 'Machhiwara Block', 'LDH_09': 'Sudhar Block',
  'LDH_10': 'Sidhwan Bet Block', 'LDH_11': 'Dehlon Block', 'LDH_12': 'Pakhowal Block',
  'LDH_13': 'Malaud Block',

  'MLK_01': 'Ahmedgarh Block', 'MLK_02': 'Amargarh Block', 'MLK_03': 'Malerkotla HQ Block',

  'MNS_01': 'Mansa Block', 'MNS_02': 'Budhlada Block', 'MNS_03': 'Sardulgarh Block',
  'MNS_04': 'Bhikhi Block', 'MNS_05': 'Jhunir Block',

  'MOG_01': 'Moga 1 Block', 'MOG_02': 'Moga 2 Block', 'MOG_03': 'Nihal Singh Wala Block',
  'MOG_04': 'Bagha Purana Block', 'MOG_05': 'Dharamkot Block',

  'PTK_01': 'Pathankot Block', 'PTK_02': 'Sujanpur Block', 'PTK_03': 'Dhar Kalan Block',
  'PTK_04': 'Narot Jaimal Singh Block', 'PTK_05': 'Bamial Block', 'PTK_06': 'Gharota Block',

  'PAT_01': 'Patiala Block', 'PAT_02': 'Rajpura Block', 'PAT_03': 'Nabha Block',
  'PAT_04': 'Samana Block', 'PAT_05': 'Ghanaur Block', 'PAT_06': 'Bhunerheri Block',
  'PAT_07': 'Patran Block', 'PAT_08': 'Sanaur Block', 'PAT_09': 'Shambu Kalan Block',

  'RUP_01': 'Rup Nagar Block', 'RUP_02': 'Anandpur Sahib Block', 'RUP_03': 'Chamkaur Sahib Block',
  'RUP_04': 'Morinda Block', 'RUP_05': 'Nurpur Bedi Block',

  'SAS_01': 'Mohali Block', 'SAS_02': 'Kharar Block', 'SAS_03': 'Dera Bassi Block',
  'SAS_04': 'Majri Block',

  'SBS_01': 'Nawan Shahr Block', 'SBS_02': 'Balachaur Block', 'SBS_03': 'Banga Block',
  'SBS_04': 'Aur Block', 'SBS_05': 'Saroya Block',

  'MKS_01': 'Sri Muktsar Sahib Block', 'MKS_02': 'Malout Block', 'MKS_03': 'Kot Bhai Block',
  'MKS_04': 'Lambi Block',

  'SNG_01': 'Sangrur Block', 'SNG_02': 'Sunam Block', 'SNG_03': 'Dhuri Block',
  'SNG_04': 'Lehragaga Block', 'SNG_05': 'Andana Block', 'SNG_06': 'Bhawanigarh Block',
  'SNG_07': 'Dirba Block', 'SNG_08': 'Sherpur Block',

  'TTN_01': 'Tarn Taran Block', 'TTN_02': 'Patti Block', 'TTN_03': 'Khadur Sahib Block',
  'TTN_04': 'Bhikhiwind Block', 'TTN_05': 'Valtoha Block', 'TTN_06': 'Naushehra Pannuan Block',
  'TTN_07': 'Gandiwind Block', 'TTN_08': 'Chohla Sahib Block',
  // --- HARYANA (HR) 143 BLOCKS ACROSS 22 DISTRICTS ---
  'AMB_01': 'Ambala I Block', 'AMB_02': 'Ambala II Block', 'AMB_03': 'Barara Block', 'AMB_04': 'Naraingarh Block', 'AMB_05': 'Saha Block', 'AMB_06': 'Shahzadpur Block',
  'BHW_01': 'Bawani Khera Block', 'BHW_02': 'Behal Block', 'BHW_03': 'Bhiwani Block', 'BHW_04': 'Kairu Block', 'BHW_05': 'Loharu Block', 'BHW_06': 'Siwani Block', 'BHW_07': 'Tosham Block',
  'CKD_01': 'Badhra Block', 'CKD_02': 'Bond Kalan Block', 'CKD_03': 'Charkhi Dadri Block', 'CKD_04': 'Jhojhu Kalan Block',
  'FBD_01': 'Faridabad Block', 'FBD_02': 'Ballabgarh Block', 'FBD_03': 'Tigaon Block',
  'FTB_01': 'Bhattu Kalan Block', 'FTB_02': 'Bhuna Block', 'FTB_03': 'Fatehabad Block', 'FTB_04': 'Jakhal Block', 'FTB_05': 'Nagpur Block', 'FTB_06': 'Ratia Block', 'FTB_07': 'Tohana Block',
  'GGM_01': 'Farrukhnagar Block', 'GGM_02': 'Gurugram Block', 'GGM_03': 'Pataudi Block', 'GGM_04': 'Sohna Block',
  'HSR_01': 'Agroha Block', 'HSR_02': 'Adampur Block', 'HSR_03': 'Barwala Block', 'HSR_04': 'Bass Block', 'HSR_05': 'Hansi I Block', 'HSR_06': 'Hansi II Block', 'HSR_07': 'Hisar I Block', 'HSR_08': 'Hisar II Block', 'HSR_09': 'Narnaund Block', 'HSR_10': 'Uklana Block',
  'JHJ_01': 'Bahadurgarh Block', 'JHJ_02': 'Beri Block', 'JHJ_03': 'Jhajjar Block', 'JHJ_04': 'Matanhail Block', 'JHJ_05': 'Salhawas Block', 'JHJ_06': 'Machhroli Block',
  'JND_01': 'Alewa Block', 'JND_02': 'Danoda Kalan Block', 'JND_03': 'Jind Block', 'JND_04': 'Julana Block', 'JND_05': 'Narwana Block', 'JND_06': 'Pillu Khera Block', 'JND_07': 'Safidon Block', 'JND_08': 'Uchana Block',
  'KTL_01': 'Dhand Block', 'KTL_02': 'Guhla Block', 'KTL_03': 'Kalayat Block', 'KTL_04': 'Kaithal Block', 'KTL_05': 'Pundri Block', 'KTL_06': 'Rajound Block', 'KTL_07': 'Siwan Block',
  'KRL_01': 'Assandh Block', 'KRL_02': 'Gharaunda Block', 'KRL_03': 'Indri Block', 'KRL_04': 'Karnal Block', 'KRL_05': 'Kunjpura Block', 'KRL_06': 'Munak Block', 'KRL_07': 'Nilokheri Block', 'KRL_08': 'Nissing Block',
  'KKR_01': 'Babain Block', 'KKR_02': 'Ismailabad Block', 'KKR_03': 'Ladwa Block', 'KKR_04': 'Pehowa Block', 'KKR_05': 'Pipli Block', 'KKR_06': 'Shahbad Block', 'KKR_07': 'Thanesar Block',
  'MHG_01': 'Ateli Block', 'MHG_02': 'Kanina Block', 'MHG_03': 'Mahendragarh Block', 'MHG_04': 'Nangol Choudhary Block', 'MHG_05': 'Narnaul Block', 'MHG_06': 'Nizampur Block', 'MHG_07': 'Satnali Block', 'MHG_08': 'Sihma Block',
  'NUH_01': 'Ferozepur Jhirka Block', 'NUH_02': 'Indri Block', 'NUH_03': 'Nagina Block', 'NUH_04': 'Nuh Block', 'NUH_05': 'Pinangwan Block', 'NUH_06': 'Punhana Block', 'NUH_07': 'Taoru Block',
  'PLW_01': 'Hassanpur Block', 'PLW_02': 'Hathir Block', 'PLW_03': 'Hodal Block', 'PLW_04': 'Palwal Block', 'PLW_05': 'Prithla Block',
  'PKL_01': 'Barwala Block', 'PKL_02': 'Morni Block', 'PKL_03': 'Pinjore Block', 'PKL_04': 'Raipur Rani Block',
  'PNP_01': 'Bapoli Block', 'PNP_02': 'Israna Block', 'PNP_03': 'Madlauda Block', 'PNP_04': 'Panipat Block', 'PNP_05': 'Samalkha Block', 'PNP_06': 'Sanauli Khurd Block',
  'REW_01': 'Bawal Block', 'REW_02': 'Dharuhera Block', 'REW_03': 'Jatusana Block', 'REW_04': 'Khol Block', 'REW_05': 'Nahar Block', 'REW_06': 'Rewari Block',
  'RTK_01': 'Kalanaur Block', 'RTK_02': 'Lakhan Majra Block', 'RTK_03': 'Maham Block', 'RTK_04': 'Rohtak Block', 'RTK_05': 'Sampla Block',
  'SRS_01': 'Baragudha Block', 'SRS_02': 'Dabwali Block', 'SRS_03': 'Ellenabad Block', 'SRS_04': 'Nathusari Chopta Block', 'SRS_05': 'Odhan Block', 'SRS_06': 'Rania Block', 'SRS_07': 'Sirsa Block',
  'SNP_01': 'Ganaur Block', 'SNP_02': 'Gohana Block', 'SNP_03': 'Kathura Block', 'SNP_04': 'Kharkhoda Block', 'SNP_05': 'Mundlana Block', 'SNP_06': 'Murthal Block', 'SNP_07': 'Rai Block', 'SNP_08': 'Sonipat Block',
  'YNR_01': 'Bilaspur Block', 'YNR_02': 'Chhachhrauli Block', 'YNR_03': 'Jagadhri Block', 'YNR_04': 'Saraswati Nagar Block', 'YNR_05': 'Pratap Nagar Block', 'YNR_06': 'Radaur Block', 'YNR_07': 'Sadhaura Block',

  // --- HIMACHAL PRADESH (HP) 92 BLOCKS ACROSS 12 DISTRICTS ---
  'BLP_01': 'Bilaspur Sadar Block', 'BLP_02': 'Ghumarwin Block', 'BLP_03': 'Jhandutta Block', 'BLP_04': 'Shri Naina Devi Ji Block',
  'CHM_01': 'Bhattiyat Block', 'CHM_02': 'Bharmour Block', 'CHM_03': 'Chamba Block', 'CHM_04': 'Mehla Block', 'CHM_05': 'Pangi Block', 'CHM_06': 'Salooni Block', 'CHM_07': 'Tissa Block',
  'HMR_01': 'Bamsan Block', 'HMR_02': 'Bijhari Block', 'HMR_03': 'Bhoranj Block', 'HMR_04': 'Hamirpur Block', 'HMR_05': 'Nadaun Block', 'HMR_06': 'Sujanpur Block',
  'KNG_01': 'Baijnath Block', 'KNG_02': 'Bhawarna Block', 'KNG_03': 'Dehra Block', 'KNG_04': 'Dharamsala Block', 'KNG_05': 'Fatehpur Block', 'KNG_06': 'Indora Block', 'KNG_07': 'Kangra Block', 'KNG_08': 'Lambagaon Block', 'KNG_09': 'Nagrota Bagwan Block', 'KNG_10': 'Nagrota Surian Block', 'KNG_11': 'Nurpur Block', 'KNG_12': 'Panchrukhi Block', 'KNG_13': 'Pragpur Block', 'KNG_14': 'Rait Block', 'KNG_15': 'Sulah Block',
  'KNR_01': 'Kalpa Block', 'KNR_02': 'Nichar Block', 'KNR_03': 'Pooh Block',
  'KLU_01': 'Anni Block', 'KLU_02': 'Banjar Block', 'KLU_03': 'Kullu Block', 'KLU_04': 'Nagar Block', 'KLU_05': 'Nirmand Block',
  'LHS_01': 'Lahaul Block', 'LHS_02': 'Spiti Block',
  'MND_01': 'Balh Block', 'MND_02': 'Chauntra Block', 'MND_03': 'Dharampur Block', 'MND_04': 'Drang Block', 'MND_05': 'Gohar Block', 'MND_06': 'Gopalpur Block', 'MND_07': 'Karsog Block', 'MND_08': 'Mandi Sadar Block', 'MND_09': 'Seraj Block', 'MND_10': 'Sundernagar Block', 'MND_11': 'Sadar Mandi Block',
  'SML_01': 'Basantpur Block', 'SML_02': 'Chaupal Block', 'SML_03': 'Chirgaon Block', 'SML_04': 'Jubbal Kotkhai Block', 'SML_05': 'Mashobra Block', 'SML_06': 'Nankhari Block', 'SML_07': 'Narkanda Block', 'SML_08': 'Rampur Block', 'SML_09': 'Rohru Block', 'SML_10': 'Theog Block', 'SML_11': 'Totu Block',
  'SMR_01': 'Nahan Block', 'SMR_02': 'Paonta Sahib Block', 'SMR_03': 'Pacchad Block', 'SMR_04': 'Rajgarh Block', 'SMR_05': 'Sangrah Block', 'SMR_06': 'Shillai Block', 'SMR_07': 'Tilordhar Block',
  'SLN_01': 'Dharampur Block', 'SLN_02': 'Kandaghat Block', 'SLN_03': 'Kunihar Block', 'SLN_04': 'Nalagarh Block', 'SLN_05': 'Solan Block',
  'UNA_01': 'Amb Block', 'UNA_02': 'Bangana Block', 'UNA_03': 'Gagret Block', 'UNA_04': 'Haroli Block', 'UNA_05': 'Una Block',

  // --- UTTARAKHAND (UK) 95 BLOCKS ACROSS 13 DISTRICTS ---
  'ALM_01': 'Bhikiyasain Block', 'ALM_02': 'Chaukhutiya Block', 'ALM_03': 'Dhaula Devi Block', 'ALM_04': 'Dwarahat Block', 'ALM_05': 'Hawalbagh Block', 'ALM_06': 'Lamgara Block', 'ALM_07': 'Sult Block', 'ALM_08': 'Syaldhey Block', 'ALM_09': 'Tarikhet Block', 'ALM_10': 'Takula Block', 'ALM_11': 'Bhaisiya Chhana Block',
  'BAG_01': 'Bageshwar Block', 'BAG_02': 'Garur Block', 'BAG_03': 'Kapkot Block',
  'CHM_UK_01': 'Dasholi Block', 'CHM_UK_02': 'Dewal Block', 'CHM_UK_03': 'Gairsain Block', 'CHM_UK_04': 'Ghat Block', 'CHM_UK_05': 'Joshimath Block', 'CHM_UK_06': 'Karanprayag Block', 'CHM_UK_07': 'Narayanbagar Block', 'CHM_UK_08': 'Pokhari Block', 'CHM_UK_09': 'Tharali Block',
  'CPW_01': 'Barakot Block', 'CPW_02': 'Champawat Block', 'CPW_03': 'Lohaghat Block', 'CPW_04': 'Pati Block',
  'DDN_01': 'Chakrata Block', 'DDN_02': 'Doiwala Block', 'DDN_03': 'Kalsi Block', 'DDN_04': 'Raipur Block', 'DDN_05': 'Sahaspur Block', 'DDN_06': 'Vikasnagar Block',
  'HWR_01': 'Bahadrabad Block', 'HWR_02': 'Bhagwanpur Block', 'HWR_03': 'Khanpur Block', 'HWR_04': 'Laksar Block', 'HWR_05': 'Narsan Block', 'HWR_06': 'Roorkee Block',
  'NTL_01': 'Bhimtal Block', 'NTL_02': 'Betalghat Block', 'NTL_03': 'Dhari Block', 'NTL_04': 'Haldwani Block', 'NTL_05': 'Kotabagh Block', 'NTL_06': 'Okhalkanda Block', 'NTL_07': 'Ramgarh Block', 'NTL_08': 'Ramnagar Block',
  'PAU_01': 'Bironkhal Block', 'PAU_02': 'Dugadda Block', 'PAU_03': 'Dwarikhal Block', 'PAU_04': 'Ekeshwar Block', 'PAU_05': 'Jaiharikhal Block', 'PAU_06': 'Kaljikhal Block', 'PAU_07': 'Khirsu Block', 'PAU_08': 'Kot Block', 'PAU_09': 'Nainidanda Block', 'PAU_10': 'Pabi Block', 'PAU_11': 'Pauri Block', 'PAU_12': 'Pokhra Block', 'PAU_13': 'Rikhnikhal Block', 'PAU_14': 'Thalisain Block', 'PAU_15': 'Zahirikhal Block',
  'PTH_01': 'Berinag Block', 'PTH_02': 'Dharchula Block', 'PTH_03': 'Didihat Block', 'PTH_04': 'Gangolihat Block', 'PTH_05': 'Kanalichhina Block', 'PTH_06': 'Munsiari Block', 'PTH_07': 'Moona Kot Block', 'PTH_08': 'Pithoragarh Block',
  'RPY_01': 'Agastmuni Block', 'RPY_02': 'Jakholi Block', 'RPY_03': 'Ukhimath Block',
  'TEH_01': 'Bhilangana Block', 'TEH_02': 'Chamba Block', 'TEH_03': 'Devprayag Block', 'TEH_04': 'Jakhnidhar Block', 'TEH_05': 'Jaunpur Block', 'TEH_06': 'Kirtinagar Block', 'TEH_07': 'Narendranagar Block', 'TEH_08': 'Pratapnagar Block', 'TEH_09': 'Thauldhar Block',
  'USN_01': 'Bajpur Block', 'USN_02': 'Gadarpur Block', 'USN_03': 'Jaspur Block', 'USN_04': 'Kashipur Block', 'USN_05': 'Khatima Block', 'USN_06': 'Rudrapur Block', 'USN_07': 'Sitarganj Block',
  // --- UTTAR PRADESH (UP) 826 BLOCKS ACROSS 75 DISTRICTS ---
  'AGR_01': 'Achhnera Block', 'AGR_02': 'Akola Block', 'AGR_03': 'Bah Block', 'AGR_04': 'Barauli Ahir Block', 'AGR_05': 'Bichpuri Block', 'AGR_06': 'Etmadpur Block', 'AGR_07': 'Fatehabad Block', 'AGR_08': 'Fatehpur Sikri Block', 'AGR_09': 'Jagner Block', 'AGR_10': 'Khandauli Block', 'AGR_11': 'Kheragarh Block', 'AGR_12': 'Pinahat Block', 'AGR_13': 'Saiyan Block', 'AGR_14': 'Shamsabad Block', 'AGR_15': 'Barauli Block',
  'ALG_01': 'Akrabad Block', 'ALG_02': 'Atrauli Block', 'ALG_03': 'Bijauli Block', 'ALG_04': 'Chandaus Block', 'ALG_05': 'Dhanipur Block', 'ALG_06': 'Gonda Block', 'ALG_07': 'Iglas Block', 'ALG_08': 'Jawan Sikandarpur Block', 'ALG_09': 'Khair Block', 'ALG_10': 'Lodha Block', 'ALG_11': 'Tappal Block', 'ALG_12': 'Gangiri Block',
  'AMB_UP_01': 'Akbarpur Block', 'AMB_UP_02': 'Baskhari Block', 'AMB_UP_03': 'Bhiyawan Block', 'AMB_UP_04': 'Jahangirganj Block', 'AMB_UP_05': 'Jalalpur Block', 'AMB_UP_06': 'Katehari Block', 'AMB_UP_07': 'Ramnagar Block', 'AMB_UP_08': 'Tanda Block', 'AMB_UP_09': 'Bhiti Block',
  'AMT_01': 'Amethi Block', 'AMT_02': 'Bhadar Block', 'AMT_03': 'Bhetua Block', 'AMT_04': 'Gauriganj Block', 'AMT_05': 'Jagdishpur Block', 'AMT_06': 'Jamo Block', 'AMT_07': 'Musafirkhana Block', 'AMT_08': 'Sangrampur Block', 'AMT_09': 'Shahgarh Block', 'AMT_10': 'Shukla Bazar Block', 'AMT_11': 'Singhpur Block', 'AMT_12': 'Tiloi Block', 'AMT_13': 'Bazar Shukul Block',
  'AMR_01': 'Amroha Block', 'AMR_02': 'Dhanaura Block', 'AMR_03': 'Gajraula Block', 'AMR_04': 'Hasanpur Block', 'AMR_05': 'Joya Block', 'AMR_06': 'Gangeshwari Block',
  'AUR_01': 'Achhalda Block', 'AUR_02': 'Ajitmal Block', 'AUR_03': 'Auraiya Block', 'AUR_04': 'Bhagyanagar Block', 'AUR_05': 'Bidhuna Block', 'AUR_06': 'Erwa Katra Block', 'AUR_07': 'Sahar Block',
  'AYO_01': 'Amaniganj Block', 'AYO_02': 'Bikapur Block', 'AYO_03': 'Harringtonganj Block', 'AYO_04': 'Hariyangant Block', 'AYO_05': 'Maya Bazar Block', 'AYO_06': 'Milkipur Block', 'AYO_07': 'Masodha Block', 'AYO_08': 'Pura Bazar Block', 'AYO_09': 'Rudauli Block', 'AYO_10': 'Sohawal Block', 'AYO_11': 'Tarun Block',
  'AZM_01': 'Ahiraula Block', 'AZM_02': 'Atraulia Block', 'AZM_03': 'Azmatgarh Block', 'AZM_04': 'Bilariyaganj Block', 'AZM_05': 'Haraiya Block', 'AZM_06': 'Jahanaganj Block', 'AZM_07': 'Koilsa Block', 'AZM_08': 'Lalganj Block', 'AZM_09': 'Mahrajganj Block', 'AZM_10': 'Martinganj Block', 'AZM_11': 'Mehnagar Block', 'AZM_12': 'Mirzapur Block', 'AZM_13': 'Mohammadpur Block', 'AZM_14': 'Palhana Block', 'AZM_15': 'Phoolpur Block', 'AZM_16': 'Pawai Block', 'AZM_17': 'Rani Ki Sarai Block', 'AZM_18': 'Sathiyaon Block', 'AZM_19': 'Tahbarpur Block', 'AZM_20': 'Tarwa Block', 'AZM_21': 'Thekma Block', 'AZM_22': 'Phulpur Pawai Block',
  'BGP_01': 'Baghpat Block', 'BGP_02': 'Baraut Block', 'BGP_03': 'Binauli Block', 'BGP_04': 'Chhaprauli Block', 'BGP_05': 'Khekra Block', 'BGP_06': 'Pilana Block',
  'BHR_01': 'Balha Block', 'BHR_02': 'Chittaura Block', 'BHR_03': 'Fakharpur Block', 'BHR_04': 'Huzoorpur Block', 'BHR_05': 'Jarwal Block', 'BHR_06': 'Kaisarganj Block', 'BHR_07': 'Mahasi Block', 'BHR_08': 'Mihinpurwa Block', 'BHR_09': 'Nawabganj Block', 'BHR_10': 'Payagpur Block', 'BHR_11': 'Phakharpur Block', 'BHR_12': 'Risia Block', 'BHR_13': 'Shivpur Block', 'BHR_14': 'Tejwapur Block', 'BHR_15': 'Visheshwarganj Block',
  'BAL_01': 'Bairia Block', 'BAL_02': 'Bansdih Block', 'BAL_03': 'Belhari Block', 'BAL_04': 'Beruarbari Block', 'BAL_05': 'Chilkahar Block', 'BAL_06': 'Dubhad Block', 'BAL_07': 'Garwar Block', 'BAL_08': 'Hanumanganj Block', 'BAL_09': 'Maniyar Block', 'BAL_10': 'Murli Chhapra Block', 'BAL_11': 'Nagra Block', 'BAL_12': 'Navanagar Block', 'BAL_13': 'Pandah Block', 'BAL_14': 'Rasra Block', 'BAL_15': 'Ratsar Kalan Block', 'BAL_16': 'Reoti Block', 'BAL_17': 'Siar Block',
  'BLR_01': 'Balrampur Block', 'BLR_02': 'Gaindas Bujurg Block', 'BLR_03': 'Gainsari Block', 'BLR_04': 'Harraiya Satgharwa Block', 'BLR_05': 'Pachpedwa Block', 'BLR_06': 'Rehra Bazar Block', 'BLR_07': 'Shivpura Block', 'BLR_08': 'Tulsipur Block', 'BLR_09': 'Utraula Block',
  'BND_01': 'Badokhar Khurd Block', 'BND_02': 'Baberu Block', 'BND_03': 'Bisanda Block', 'BND_04': 'Jaspura Block', 'BND_05': 'Kamasin Block', 'BND_06': 'Mahuva Block', 'BND_07': 'Naraini Block', 'BND_08': 'Tindwari Block',
  'BBK_01': 'Banki Block', 'BBK_02': 'Bani Kodar Block', 'BBK_03': 'Daryabad Block', 'BBK_04': 'Dewal Block', 'BBK_05': 'Fatehpur Block', 'BBK_06': 'Haidergarh Block', 'BBK_07': 'Harakh Block', 'BBK_08': 'Masauli Block', 'BBK_09': 'Nindura Block', 'BBK_10': 'Ramnagar Block', 'BBK_11': 'Siddhaur Block', 'BBK_12': 'Sirsi Gauspur Block', 'BBK_13': 'Suratganj Block', 'BBK_14': 'Trivediganj Block', 'BBK_15': 'Pure Dalai Block',
  'BLY_01': 'Baheri Block', 'BLY_02': 'Bhadpura Block', 'BLY_03': 'Bhojipura Block', 'BLY_04': 'Bithri Chainpur Block', 'BLY_05': 'Damkhoda Block', 'BLY_06': 'Faridpur Block', 'BLY_07': 'Fatehganj Paschim Block', 'BLY_08': 'Fatehganj Purvi Block', 'BLY_09': 'Kiyara Block', 'BLY_10': 'Majhgawan Block', 'BLY_11': 'Mirganj Block', 'BLY_12': 'Nawabganj Block', 'BLY_13': 'Ramnagar Block', 'BLY_14': 'Rithora Block', 'BLY_15': 'Shergarh Block',
  'BST_01': 'Bahadurpur Block', 'BST_02': 'Bankati Block', 'BST_03': 'Basti Sadar Block', 'BST_04': 'Bhanwapur Block', 'BST_05': 'Duboulia Block', 'BST_06': 'Gaur Block', 'BST_07': 'Harraiya Block', 'BST_08': 'Kaptanganj Block', 'BST_09': 'Kudraha Block', 'BST_10': 'Paras Rampur Block', 'BST_11': 'Ramnagar Block', 'BST_12': 'Rudauli Block', 'BST_13': 'Saltaua Gopalpur Block', 'BST_14': 'Saunghat Block', 'BST_15': 'Vikram Jot Block',
  'BHD_01': 'Aurai Block', 'BHD_02': 'Bhadohi Block', 'BHD_03': 'Deegh Block', 'BHD_04': 'Gyanpur Block', 'BHD_05': 'Suriyawan Block', 'BHD_06': 'Abholi Block',
  'BJN_01': 'Afzalgarh Block', 'BJN_02': 'Alhepur Block', 'BJN_03': 'Haldaur Block', 'BJN_04': 'Jalilpur Block', 'BJN_05': 'Kiratpur Block', 'BJN_06': 'Kotwali Block', 'BJN_07': 'Mohammadpur Deomal Block', 'BJN_08': 'Najibabad Block', 'BJN_09': 'Nehtaur Block', 'BJN_10': 'Noorpur Block', 'BJN_11': 'Sohara Block',
  'BDN_01': 'Ambiapur Block', 'BDN_02': 'Asafpur Block', 'BDN_03': 'Bilsi Block', 'BDN_04': 'Bisauli Block', 'BDN_05': 'Dahgawan Block', 'BDN_06': 'Dataganj Block', 'BDN_07': 'Islamnagar Block', 'BDN_08': 'Jagat Block', 'BDN_09': 'Miajampur Block', 'BDN_10': 'Qadar Chowk Block', 'BDN_11': 'Salarpur Block', 'BDN_12': 'Sahaswan Block', 'BDN_13': 'Samrer Block', 'BDN_14': 'Ujhani Block', 'BDN_15': 'Wazirganj Block',
  'BLS_01': 'Agota Block', 'BLS_02': 'Anupshahr Block', 'BLS_03': 'Arnia Block', 'BLS_04': 'BB Nagar Block', 'BLS_05': 'Bulandshahr Block', 'BLS_06': 'Danpur Block', 'BLS_07': 'Dibai Block', 'BLS_08': 'Gulaothi Block', 'BLS_09': 'Jahangirabad Block', 'BLS_10': 'Khurja Block', 'BLS_11': 'Lakhaothi Block', 'BLS_12': 'Pahasu Block', 'BLS_13': 'Shikarpur Block', 'BLS_14': 'Siana Block', 'BLS_15': 'Syana Block', 'BLS_16': 'Unchagaon Block',
  'CND_01': 'Barhani Block', 'CND_02': 'Chakiya Block', 'CND_03': 'Chandauli Block', 'CND_04': 'Dhanapur Block', 'CND_05': 'Niamatabad Block', 'CND_06': 'Naugarh Block', 'CND_07': 'Sakaldiha Block', 'CND_08': 'Shahabganj Block', 'CND_09': 'Chahaniya Block',
  'CKT_01': 'Karwi Block', 'CKT_02': 'Manikpur Block', 'CKT_03': 'Mau Block', 'CKT_04': 'Pahari Block', 'CKT_05': 'Ramnagar Block',
  'DEO_01': 'Baitalpur Block', 'DEO_02': 'Bankata Block', 'DEO_03': 'Barhaj Block', 'DEO_04': 'Bhaluani Block', 'DEO_05': 'Bhatni Block', 'DEO_06': 'Bhatpar Rani Block', 'DEO_07': 'Deoria Block', 'DEO_08': 'Desahi Deoria Block', 'DEO_09': 'Gauri Bazar Block', 'DEO_10': 'Lar Block', 'DEO_11': 'Pathardeva Block', 'DEO_12': 'Rampur Karkhana Block', 'DEO_13': 'Rudrapur Block', 'DEO_14': 'Salempur Block', 'DEO_15': 'Tarkulwa Block', 'DEO_16': 'Bhagalpur Block',
  'ETH_01': 'Aliganj Block', 'ETH_02': 'Awagarh Block', 'ETH_03': 'Jalesar Block', 'ETH_04': 'Jaithara Block', 'ETH_05': 'Marhara Block', 'ETH_06': 'Nidhauli Kalan Block', 'ETH_07': 'Sakit Block', 'ETH_08': 'Sheetalpur Block',
  'ETW_01': 'Barhpura Block', 'ETW_02': 'Basrehar Block', 'ETW_03': 'Bharthana Block', 'ETW_04': 'Chakarnagar Block', 'ETW_05': 'Jaswantnagar Block', 'ETW_06': 'Maheva Block', 'ETW_07': 'Saifai Block', 'ETW_08': 'Takha Block',
  'FRK_01': 'Barhpur Block', 'FRK_02': 'Kamalganj Block', 'FRK_03': 'Kaimganj Block', 'FRK_04': 'Mohammadabad Block', 'FRK_05': 'Nawabganj Block', 'FRK_06': 'Rajepur Block', 'FRK_07': 'Shamsabad Block',
  'FTP_01': 'Airayan Block', 'FTP_02': 'Amauli Block', 'FTP_03': 'Asothar Block', 'FTP_04': 'Bahua Block', 'FTP_05': 'Bhitaura Block', 'FTP_06': 'Deomai Block', 'FTP_07': 'Dhata Block', 'FTP_08': 'Haswa Block', 'FTP_09': 'Hathgam Block', 'FTP_10': 'Khajuha Block', 'FTP_11': 'Malwan Block', 'FTP_12': 'Teliyani Block', 'FTP_13': 'Vijayipur Block',
  'FZB_01': 'Akaur Block', 'FZB_02': 'Firozabad Block', 'FZB_03': 'Jasrana Block', 'FZB_04': 'Khaeragarh Block', 'FZB_05': 'Madanpur Block', 'FZB_06': 'Narkhi Block', 'FZB_07': 'Shikohabad Block', 'FZB_08': 'Tundla Block', 'FZB_09': 'Eka Block',
  'GBN_01': 'Bisrakh Block', 'GBN_02': 'Dadri Block', 'GBN_03': 'Dankaur Block', 'GBN_04': 'Jewar Block',
  'GZB_01': 'Bhojpur Block', 'GZB_02': 'Loni Block', 'GZB_03': 'Muradnagar Block', 'GZB_04': 'Razapur Block',
  'GZP_01': 'Barachati Block', 'GZP_02': 'Bhadura Block', 'GZP_03': 'Bhawarkol Block', 'GZP_04': 'Birno Block', 'GZP_05': 'Deokali Block', 'GZP_06': 'Ghazipur Block', 'GZP_07': 'Jakhania Block', 'GZP_08': 'Karanda Block', 'GZP_09': 'Kasiabad Block', 'GZP_10': 'Manihari Block', 'GZP_11': 'Mardah Block', 'GZP_12': 'Mohammadabad Block', 'GZP_13': 'Reotipur Block', 'GZP_14': 'Sadat Block', 'GZP_15': 'Saidpur Block', 'GZP_16': 'Zamania Block',
  'GND_01': 'Belsar Block', 'GND_02': 'Chhapia Block', 'GND_03': 'Colonelganj Block', 'GND_04': 'Haldharmau Block', 'GND_05': 'Itiathok Block', 'GND_06': 'Jhanjhari Block', 'GND_07': 'Katra Bazar Block', 'GND_08': 'Mankapur Block', 'GND_09': 'Mujehana Block', 'GND_10': 'Nawabganj Block', 'GND_11': 'Pandey Baba Block', 'GND_12': 'Paraspur Block', 'GND_13': 'Rupaidih Block', 'GND_14': 'Tarabganj Block', 'GND_15': 'Vazirganj Block', 'GND_16': 'Babhanjot Block',
  'GKP_01': 'Bansgaon Block', 'GKP_02': 'Barhalganj Block', 'GKP_03': 'Belghat Block', 'GKP_04': 'Bhathat Block', 'GKP_05': 'Brahmpur Block', 'GKP_06': 'Campierganj Block', 'GKP_07': 'Chargawan Block', 'GKP_08': 'Gagaha Block', 'GKP_09': 'Gola Block', 'GKP_10': 'Jungle Kaudia Block', 'GKP_11': 'Khaurabar Block', 'GKP_12': 'Khajni Block', 'GKP_13': 'Pipraich Block', 'GKP_14': 'Piprauli Block', 'GKP_15': 'Sahjanwa Block', 'GKP_16': 'Sardarnagar Block', 'GKP_17': 'Pali Block', 'GKP_18': 'Khorabar Block', 'GKP_19': 'Urwa Block', 'GKP_20': 'Uruwa Block',
  'HMP_01': 'Gohand Block', 'HMP_02': 'Kurara Block', 'HMP_03': 'Maudaha Block', 'HMP_04': 'Muskara Block', 'HMP_05': 'Rath Block', 'HMP_06': 'Sarila Block', 'HMP_07': 'Sumerpur Block',
  'HPR_01': 'Garhmukteshwar Block', 'HPR_02': 'Hapur Block', 'HPR_03': 'Simbhawali Block', 'HPR_04': 'Dhaulana Block',
  'HRD_01': 'Ahirori Block', 'HRD_02': 'Bawan Block', 'HRD_03': 'Behendar Block', 'HRD_04': 'Bharawan Block', 'HRD_05': 'Bharkhani Block', 'HRD_06': 'Bilgram Block', 'HRD_07': 'Harpalpur Block', 'HRD_08': 'Hariyawan Block', 'HRD_09': 'Kachhauna Block', 'HRD_10': 'Kothawan Block', 'HRD_11': 'Madhoganj Block', 'HRD_12': 'Mallawan Block', 'HRD_13': 'Pihani Block', 'HRD_14': 'Sandila Block', 'HRD_15': 'Sandi Block', 'HRD_16': 'Shahabad Block', 'HRD_17': 'Sursa Block', 'HRD_18': 'Tandiyawan Block', 'HRD_19': 'Todarpur Block',
  'HTR_01': 'Hasayan Block', 'HTR_02': 'Hathras Block', 'HTR_03': 'Mursan Block', 'HTR_04': 'Sadabad Block', 'HTR_05': 'Sahpau Block', 'HTR_06': 'Sasni Block', 'HTR_07': 'Sikandra Rao Block',
  'JLN_01': 'Dakore Block', 'JLN_02': 'Jalaun Block', 'JLN_03': 'Kadaura Block', 'JLN_04': 'Konch Block', 'JLN_05': 'Madhogarh Block', 'JLN_06': 'Maheva Block', 'JLN_07': 'Nadigaon Block', 'JLN_08': 'Rendhar Block', 'JLN_09': 'Rampura Block',
  'JNP_01': 'Badlapur Block', 'JNP_02': 'Baksha Block', 'JNP_03': 'Barsathi Block', 'JNP_04': 'Dharmapur Block', 'JNP_05': 'Dobhi Block', 'JNP_06': 'Jalalpur Block', 'JNP_07': 'Kerakat Block', 'JNP_08': 'Karanjakala Block', 'JNP_09': 'Khutahan Block', 'JNP_10': 'Machhlishahr Block', 'JNP_11': 'Maharajganj Block', 'JNP_12': 'Mariyahu Block', 'JNP_13': 'Muftiganj Block', 'JNP_14': 'Mungra Badshahpur Block', 'JNP_15': 'Ramnagar Block', 'JNP_16': 'Rampur Block', 'JNP_17': 'Suitha Kala Block', 'JNP_18': 'Sikrara Block', 'JNP_19': 'Sirkhoni Block', 'JNP_20': 'Sujanganj Block', 'JNP_21': 'Suitha Khurd Block',
  'JHS_01': 'Babina Block', 'JHS_02': 'Badaagaon Block', 'JHS_03': 'Bangra Block', 'JHS_04': 'Bamour Block', 'JHS_05': 'Chirgaon Block', 'JHS_06': 'Gursarai Block', 'JHS_07': 'Mauranipur Block', 'JHS_08': 'Month Block',
  'KNJ_01': 'Chhibramau Block', 'KNJ_02': 'Guhasganj Block', 'KNJ_03': 'Haseran Block', 'KNJ_04': 'Jalalabad Block', 'KNJ_05': 'Kannauj Block', 'KNJ_06': 'Saurikh Block', 'KNJ_07': 'Talgram Block', 'KNJ_08': 'Umarda Block',
  'KPD_01': 'Akbarpur Block', 'KPD_02': 'Amrodha Block', 'KPD_03': 'Derapur Block', 'KPD_04': 'Jhinjhak Block', 'KPD_05': 'Maitha Block', 'KPD_06': 'Malasa Block', 'KPD_07': 'Rajpur Block', 'KPD_08': 'Rasulabad Block', 'KPD_09': 'Sandallpur Block', 'KPD_10': 'Sarbankhera Block',
  'KPN_01': 'Bilhaur Block', 'KPN_02': 'Bhitargaon Block', 'KPN_03': 'Chaubepur Block', 'KPN_04': 'Ghatampur Block', 'KPN_05': 'Kalyanpur Block', 'KPN_06': 'Kakwan Block', 'KPN_07': 'Patara Block', 'KPN_08': 'Sarsaul Block', 'KPN_09': 'Shivrajpur Block', 'KPN_10': 'Vidunu Block',
  'KSG_01': 'Amapur Block', 'KSG_02': 'Ganjdundwara Block', 'KSG_03': 'Kasganj Block', 'KSG_04': 'Patiyali Block', 'KSG_05': 'Sahawar Block', 'KSG_06': 'Sidhpura Block', 'KSG_07': 'Soron Block',
  'KSH_01': 'Chail Block', 'KSH_02': 'Kanaili Block', 'KSH_03': 'Kara Block', 'KSH_04': 'Kaushambi Block', 'KSH_05': 'Manjhanpur Block', 'KSH_06': 'Mooratganj Block', 'KSH_07': 'Nevada Block', 'KSH_08': 'Sarsawan Block',
  'KSHN_01': 'Dudhai Block', 'KSHN_02': 'Fazilnagar Block', 'KSHN_03': 'Hata Block', 'KSHN_04': 'Kaptanganj Block', 'KSHN_05': 'Kasia Block', 'KSHN_06': 'Khadha Block', 'KSHN_07': 'Motichak Block', 'KSHN_08': 'Nebua Naurangiya Block', 'KSHN_09': 'Padrauna Block', 'KSHN_10': 'Ramkola Block', 'KSHN_11': 'Seorahi Block', 'KSHN_12': 'Sukrauli Block', 'KSHN_13': 'Tamkuhi Raj Block', 'KSHN_14': 'Vishunpura Block',
  'LKP_01': 'Bankeyganj Block', 'LKP_02': 'Behjam Block', 'LKP_03': 'Bijauliya Block', 'LKP_04': 'Dhaurahra Block', 'LKP_05': 'Isanagar Block', 'LKP_06': 'Kumbhigola Block', 'LKP_07': 'Lakhimpur Block', 'LKP_08': 'Mitauli Block', 'LKP_09': 'Mohammadi Block', 'LKP_10': 'Nakaha Block', 'LKP_11': 'Nighasan Block', 'LKP_12': 'Palia Block', 'LKP_13': 'Phoolbehar Block', 'LKP_14': 'Ramia Behar Block', 'LKP_15': 'Pasgawan Block',
  'LLT_01': 'Bar Block', 'LLT_02': 'Birdha Block', 'LLT_03': 'Jakhaura Block', 'LLT_04': 'Madawara Block', 'LLT_05': 'Mahroni Block', 'LLT_06': 'Talbehat Block',
  'LKO_01': 'Bakshi Ka Talab Block', 'LKO_02': 'Chinhat Block', 'LKO_03': 'Gosainganj Block', 'LKO_04': 'Kakori Block', 'LKO_05': 'Mal Block', 'LKO_06': 'Malihabad Block', 'LKO_07': 'Mohanlalganj Block', 'LKO_08': 'Sarojini Nagar Block',
  'MHJ_01': 'Brijmanganj Block', 'MHJ_02': 'Dhani Block', 'MHJ_03': 'Ghughli Block', 'MHJ_04': 'Laxmipur Block', 'MHJ_05': 'Maharajganj Block', 'MHJ_06': 'Mithaura Block', 'MHJ_07': 'Nautanwa Block', 'MHJ_08': 'Nichlaul Block', 'MHJ_09': 'Paniyara Block', 'MHJ_10': 'Pharenda Block', 'MHJ_11': 'Ratanpur Block', 'MHJ_12': 'Siswa Block',
  'MHB_01': 'Charkhari Block', 'MHB_02': 'Jaitpur Block', 'MHB_03': 'Kabrai Block', 'MHB_04': 'Panwari Block',
  'MNP_01': 'Barnahal Block', 'MNP_02': 'Bewar Block', 'MNP_03': 'Ghiror Block', 'MNP_04': 'Karhal Block', 'MNP_05': 'Kishni Block', 'MNP_06': 'Kuraoli Block', 'MNP_07': 'Mainpuri Block', 'MNP_08': 'Sultanganj Block', 'MNP_09': 'Alau Block',
  'MTH_01': 'Baldeo Block', 'MTH_02': 'Chaumuha Block', 'MTH_03': 'Chhata Block', 'MTH_04': 'Farah Block', 'MTH_05': 'Goverdhan Block', 'MTH_06': 'Mathura Block', 'MTH_07': 'Nandgaon Block', 'MTH_08': 'Naujhil Block', 'MTH_09': 'Raya Block', 'MTH_10': 'Mant Block',
  'MAU_01': 'Badraon Block', 'MAU_02': 'Dohrighat Block', 'MAU_03': 'Fatehpur Madaun Block', 'MAU_04': 'Ghosi Block', 'MAU_05': 'Kopaganj Block', 'MAU_06': 'Mohammadabad Gohna Block', 'MAU_07': 'Pardaha Block', 'MAU_08': 'Ratanpura Block', 'MAU_09': 'Ranipur Block',
  'MRT_01': 'Daurala Block', 'MRT_02': 'Hastinapur Block', 'MRT_03': 'Janikhurd Block', 'MRT_04': 'Kharkhoda Block', 'MRT_05': 'Machhra Block', 'MRT_06': 'Mawana Kalan Block', 'MRT_07': 'Meerut Block', 'MRT_08': 'Parikshitgarh Block', 'MRT_09': 'Rajpura Block', 'MRT_10': 'Rohta Block', 'MRT_11': 'Sarurpur Khurd Block', 'MRT_12': 'Sardhana Block',
  'MZP_01': 'Chhanvey Block', 'MZP_02': 'City Mirzapur Block', 'MZP_03': 'Halio Block', 'MZP_04': 'Jamalpur Block', 'MZP_05': 'Kon Block', 'MZP_06': 'Lalganj Block', 'MZP_07': 'Majhawa Block', 'MZP_08': 'Narayanpur Block', 'MZP_09': 'Pahari Block', 'MZP_10': 'Patehra Kalan Block', 'MZP_11': 'Rajgarh Block', 'MZP_12': 'Sikhar Block',
  'MBD_01': 'Bahjoi Block', 'MBD_02': 'Bhagatpur Tanda Block', 'MBD_03': 'Bilari Block', 'MBD_04': 'Chhajlat Block', 'MBD_05': 'Dingarpur Block', 'MBD_06': 'Kundarki Block', 'MBD_07': 'Moradabad Block', 'MBD_08': 'Munda Pandey Block', 'MBD_09': 'Thakurdwara Block',
  'MZF_01': 'Baghra Block', 'MZF_02': 'Budhana Block', 'MZF_03': 'Charthawal Block', 'MZF_04': 'Jansath Block', 'MZF_05': 'Kakrauli Block', 'MZF_06': 'Khadkhedi Block', 'MZF_07': 'Miranpur Block', 'MZF_08': 'Morna Block', 'MZF_09': 'Muzaffarnagar Block', 'MZF_10': 'Purkazi Block', 'MZF_11': 'Shahpur Block',
  'PLB_01': 'Amariya Block', 'PLB_02': 'Barkhera Block', 'PLB_03': 'Bilsanda Block', 'PLB_04': 'Bisalpur Block', 'PLB_05': 'Lalaurikhera Block', 'PLB_06': 'Marauri Block', 'PLB_07': 'Puranpur Block',
  'PRT_01': 'Aspur Deosara Block', 'PRT_02': 'Baba Belkharnath Dham Block', 'PRT_03': 'Babaganj Block', 'PRT_04': 'Bihar Block', 'PRT_05': 'Gaura Block', 'PRT_06': 'Kunda Block', 'PRT_07': 'Laxmanpur Block', 'PRT_08': 'Mandhata Block', 'PRT_09': 'Mangraura Block', 'PRT_10': 'Patti Block', 'PRT_11': 'Rampur Sangramgarh Block', 'PRT_12': 'Sadak Arka Block', 'PRT_13': 'Sandwa Chandrika Block', 'PRT_14': 'Sangipur Block', 'PRT_15': 'Shivgarh Block', 'PRT_16': 'Sadar Pratapgarh Block', 'PRT_17': 'Kalakankar Block',
  'PRY_01': 'Baharia Block', 'PRY_02': 'Chaka Block', 'PRY_03': 'Dhanupur Block', 'PRY_04': 'Handia Block', 'PRY_05': 'Holagarh Block', 'PRY_06': 'Jasra Block', 'PRY_07': 'Karchhana Block', 'PRY_08': 'Kaundhiyara Block', 'PRY_09': 'Kaurihar Block', 'PRY_10': 'Manda Block', 'PRY_11': 'Mauaima Block', 'PRY_12': 'Meja Block', 'PRY_13': 'Pratappur Block', 'PRY_14': 'Saidabad Block', 'PRY_15': 'Shankargarh Block', 'PRY_16': 'Soraon Block', 'PRY_17': 'Sringverpur Dham Block', 'PRY_18': 'Uruwa Block', 'PRY_19': 'Bahadurpur Block', 'PRY_20': 'Koraon Block',
  'RBL_01': 'Bachhrawan Block', 'RBL_02': 'Deen Shah Gaura Block', 'RBL_03': 'Dalmau Block', 'RBL_04': 'Harchandpur Block', 'RBL_05': 'Jagatpur Block', 'RBL_06': 'Khiro Block', 'RBL_07': 'Lalganj Block', 'RBL_08': 'Mahrajganj Block', 'RBL_09': 'Rahi Block', 'RBL_10': 'Rohaniya Block', 'RBL_11': 'Sareni Block', 'RBL_12': 'Sataon Block', 'RBL_13': 'Salon Block', 'RBL_14': 'Shivgarh Block', 'RBL_15': 'Unchahar Block', 'RBL_16': 'Amawan Block', 'RBL_17': 'Dih Block',
  'RMP_01': 'Chamraua Block', 'RMP_02': 'Milak Block', 'RMP_03': 'Saidnagar Block', 'RMP_04': 'Shahabad Block', 'RMP_05': 'Suar Block', 'RMP_06': 'Bilaspur Block',
  'SHR_01': 'Ballialheri Block', 'SHR_02': 'Deoband Block', 'SHR_03': 'Gangoh Block', 'SHR_04': 'Muzzafarabad Block', 'SHR_05': 'Nagall Block', 'SHR_06': 'Nanauta Block', 'SHR_07': 'Puwaraka Block', 'SHR_08': 'Rampur Maniharan Block', 'SHR_09': 'Sadauli Qadeem Block', 'SHR_10': 'Sarsawa Block', 'SHR_11': 'Nakur Block',
  'SMB_01': 'Asmoli Block', 'SMB_02': 'Bahjoi Block', 'SMB_03': 'Baniya Khera Block', 'SMB_04': 'Gunnaur Block', 'SMB_05': 'Janawai Block', 'SMB_06': 'Panwasa Block', 'SMB_07': 'Rajpura Block', 'SMB_08': 'Sambhal Block',
  'SKN_01': 'Bakira Block', 'SKN_02': 'Belhar Kala Block', 'SKN_03': 'Hainsar Bazar Block', 'SKN_04': 'Khalilabad Block', 'SKN_05': 'Nath Nagar Block', 'SKN_06': 'Paoli Block', 'SKN_07': 'Sameriyawan Block', 'SKN_08': 'Sanjhaarpur Block', 'SKN_09': 'Mendhwal Block',
  'SPN_01': 'Banda Block', 'SPN_02': 'Banthara Block', 'SPN_03': 'Bhwal Khera Block', 'SPN_04': 'Jalalabad Block', 'SPN_05': 'Kalan Block', 'SPN_06': 'Kant Block', 'SPN_07': 'Khutar Block', 'SPN_08': 'Katra Block', 'SPN_09': 'Madnapur Block', 'SPN_10': 'Mirzapur Block', 'SPN_11': 'Nigohi Block', 'SPN_12': 'Powayan Block', 'SPN_13': 'Puwayan Block', 'SPN_14': 'Sindhauli Block', 'SPN_15': 'Tilhar Block',
  'SML_UP_01': 'Kandhla Block', 'SML_UP_02': 'Kairana Block', 'SML_UP_03': 'Shamli Block', 'SML_UP_04': 'Thana Bhawan Block', 'SML_UP_05': 'Un Block',
  'SRV_01': 'Ekona Block', 'SRV_02': 'Gilaula Block', 'SRV_03': 'Hariharpur Rani Block', 'SRV_04': 'Jamunaha Block', 'SRV_05': 'Sirsiya Block',
  'SDN_01': 'Bansi Block', 'SDN_02': 'Barhni Block', 'SDN_03': 'Birdpur Block', 'SDN_04': 'Bhanwapur Block', 'SDN_05': 'Domariyaganj Block', 'SDN_06': 'Itwa Block', 'SDN_07': 'Jogia Block', 'SDN_08': 'Khesraha Block', 'SDN_09': 'Khuniyaon Block', 'SDN_10': 'Lotan Block', 'SDN_11': 'Mithwal Block', 'SDN_12': 'Naugarh Block', 'SDN_13': 'Shohratgarh Block', 'SDN_14': 'Uska Bazar Block',
  'STP_01': 'Ailiya Block', 'STP_02': 'Biswan Block', 'STP_03': 'Behta Block', 'STP_04': 'Gondlamau Block', 'STP_05': 'Hargaon Block', 'STP_06': 'Khairabad Block', 'STP_07': 'Kasmanda Block', 'STP_08': 'Laharpur Block', 'STP_09': 'Machhrehta Block', 'STP_10': 'Mahmudabad Block', 'STP_11': 'Maholi Block', 'STP_12': 'Mishrikh Block', 'STP_13': 'Pahala Block', 'STP_14': 'Parsendi Block', 'STP_15': 'Pisawan Block', 'STP_16': 'Rampur Mathura Block', 'STP_17': 'Reusa Block', 'STP_18': 'Sakran Block', 'STP_19': 'Sidhauli Block',
  'SNB_01': 'Babhani Block', 'SNB_02': 'Chatra Block', 'SNB_03': 'Chopan Block', 'SNB_04': 'Dudhi Block', 'SNB_05': 'Ghorawal Block', 'SNB_06': 'Myorpur Block', 'SNB_07': 'Nagwa Block', 'SNB_08': 'Robertsganj Block',
  'SLT_01': 'Akhand Nagar Block', 'SLT_02': 'Baldirai Block', 'SLT_03': 'Bhadaiya Block', 'SLT_04': 'Dhanpatganj Block', 'SLT_05': 'Dubeypur Block', 'SLT_06': 'Jaisinghpur Block', 'SLT_07': 'Kadipur Block', 'SLT_08': 'Kurebhar Block', 'SLT_09': 'Kurwar Block', 'SLT_10': 'Lambhua Block', 'SLT_11': 'Motigarpur Block', 'SLT_12': 'Pratappur Kamaicha Block', 'SLT_13': 'Purey Bazar Block', 'SLT_14': 'Kudwar Block',
  'UNA_UP_01': 'Aganj Block', 'UNA_UP_02': 'Asoha Block', 'UNA_UP_03': 'Auras Block', 'UNA_UP_04': 'Bichhiya Block', 'UNA_UP_05': 'Bigapur Block', 'UNA_UP_06': 'Fatehpur Chaurasi Block', 'UNA_UP_07': 'Ganj Muradabad Block', 'UNA_UP_08': 'Hasanganj Block', 'UNA_UP_09': 'Hilauli Block', 'UNA_UP_10': 'Miyanganj Block', 'UNA_UP_11': 'Nawabganj Block', 'UNA_UP_12': 'Purwa Block', 'UNA_UP_13': 'Safipur Block', 'UNA_UP_14': 'Sikandarpur Karan Block', 'UNA_UP_15': 'Sikandarpur Sirausi Block', 'UNA_UP_16': 'Sumerpur Block',
  // --- BIHAR (BR) 534 BLOCKS ACROSS 38 DISTRICTS ---
  'ARA_01': 'Araria Block', 'ARA_02': 'Bhargama Block', 'ARA_03': 'Forbesganj Block', 'ARA_04': 'Jokihat Block', 'ARA_05': 'Kursakanta Block', 'ARA_06': 'Narpatganj Block', 'ARA_07': 'Palasi Block', 'ARA_08': 'Raniganj Block', 'ARA_09': 'Sikti Block',
  'ARW_01': 'Arwal Block', 'ARW_02': 'Kaler Block', 'ARW_03': 'Karpi Block', 'ARW_04': 'Kurtha Block', 'ARW_05': 'Sonbhadra Banshi Suryapur Block',
  'AUR_BR_01': 'Aurangabad Block', 'AUR_BR_02': 'Barun Block', 'AUR_BR_03': 'Daudnagar Block', 'AUR_BR_04': 'Deo Block', 'AUR_BR_05': 'Goh Block', 'AUR_BR_06': 'Haspura Block', 'AUR_BR_07': 'Kutumba Block', 'AUR_BR_08': 'Madanpur Block', 'AUR_BR_09': 'Nabinagar Block', 'AUR_BR_10': 'Obra Block', 'AUR_BR_11': 'Rafiganj Block',
  'BNK_01': 'Amarpur Block', 'BNK_02': 'Banka Block', 'BNK_03': 'Barahat Block', 'BNK_04': 'Belhar Block', 'BNK_05': 'Bounsi Block', 'BNK_06': 'Chandan Block', 'BNK_07': 'Dhuraiya Block', 'BNK_08': 'Fullidumar Block', 'BNK_09': 'Katoria Block', 'BNK_10': 'Rajaun Block', 'BNK_11': 'Shambhuganj Block',
  'BGS_01': 'Bachhwara Block', 'BGS_02': 'Bakhri Block', 'BGS_03': 'Ballia Block', 'BGS_04': 'Barauni Block', 'BGS_05': 'Begusarai Block', 'BGS_06': 'Bhagwanpur Block', 'BGS_07': 'Birpur Block', 'BGS_08': 'Cheria Bariarpur Block', 'BGS_09': 'Chhorahi Block', 'BGS_10': 'Dandari Block', 'BGS_11': 'Garhpura Block', 'BGS_12': 'Khodabandpur Block', 'BGS_13': 'Mansurchak Block', 'BGS_14': 'Matihani Block', 'BGS_15': 'Naokothi Block', 'BGS_16': 'Sahebpur Kamal Block', 'BGS_17': 'Shamho Akha Kurha Block', 'BGS_18': 'Teghra Block',
  'BGP_BR_01': 'Goradih Block', 'BGP_BR_02': 'Jagdishpur Block', 'BGP_BR_03': 'Nathnagar Block', 'BGP_BR_04': 'Sabour Block', 'BGP_BR_05': 'Shahkund Block', 'BGP_BR_06': 'Sultanganj Block', 'BGP_BR_07': 'Kahalgaon Block', 'BGP_BR_08': 'Pirpainti Block', 'BGP_BR_09': 'Sanokhar Block', 'BGP_BR_10': 'Bihpur Block', 'BGP_BR_11': 'Gopalpur Block', 'BGP_BR_12': 'Ismailpur Block', 'BGP_BR_13': 'Kharik Block', 'BGP_BR_14': 'Narayanpur Block', 'BGP_BR_15': 'Naugachhia Block', 'BGP_BR_16': 'Rangra Chowk Block',
  'BHP_01': 'Agiaon Block', 'BHP_02': 'Ara Block', 'BHP_03': 'Barhara Block', 'BHP_04': 'Bihiya Block', 'BHP_05': 'Charpokhari Block', 'BHP_06': 'Garhani Block', 'BHP_07': 'Jagdishpur Block', 'BHP_08': 'Koilwar Block', 'BHP_09': 'Piro Block', 'BHP_10': 'Sahar Block', 'BHP_11': 'Sandesh Block', 'BHP_12': 'Shahpur Block', 'BHP_13': 'Tarari Block', 'BHP_14': 'Udwantnagar Block',
  'BXR_01': 'Brahampur Block', 'BXR_02': 'Buxar Block', 'BXR_03': 'Chakki Block', 'BXR_04': 'Chaugain Block', 'BXR_05': 'Chausa Block', 'BXR_06': 'Dumraon Block', 'BXR_07': 'Itarhi Block', 'BXR_08': 'Kesath Block', 'BXR_09': 'Nawanagar Block', 'BXR_10': 'Rajpur Block', 'BXR_11': 'Simri Block',
  'DBG_01': 'Ali Nagar Block', 'DBG_02': 'Bahadurpur Block', 'DBG_03': 'Baheri Block', 'DBG_04': 'Benipur Block', 'DBG_05': 'Biraul Block', 'DBG_06': 'Darbhanga Sadar Block', 'DBG_07': 'Ghanshyampur Block', 'DBG_08': 'Hanumannagar Block', 'DBG_09': 'Hayaghat Block', 'DBG_10': 'Jale Block', 'DBG_11': 'Keoti Block', 'DBG_12': 'Kiratpur Block', 'DBG_13': 'Kusheshwar Asthan Block', 'DBG_14': 'Kusheshwar Asthan East Block', 'DBG_15': 'Manigachhi Block', 'DBG_16': 'Singhwara Block', 'DBG_17': 'Tardih Block', 'DBG_18': 'Gaura Bauram Block',
  'ECM_01': 'Adapur Block', 'ECM_02': 'Areraj Block', 'ECM_03': 'Banjariya Block', 'ECM_04': 'Bankatwa Block', 'ECM_05': 'Chakia Block', 'ECM_06': 'Chhauradano Block', 'ECM_07': 'Chiraiya Block', 'ECM_08': 'Dhaka Block', 'ECM_09': 'Ghorasahan Block', 'ECM_10': 'Harsidhi Block', 'ECM_11': 'Kalyanpur Block', 'ECM_12': 'Kesariya Block', 'ECM_13': 'Kotwa Block', 'ECM_14': 'Madhuban Block', 'ECM_15': 'Mehsi Block', 'ECM_16': 'Motihari Block', 'ECM_17': 'Paharpur Block', 'ECM_18': 'Pakridayal Block', 'ECM_19': 'Patahi Block', 'ECM_20': 'Phenhara Block', 'ECM_21': 'Piprakothi Block', 'ECM_22': 'Ramgarhwa Block', 'ECM_23': 'Raxaul Block', 'ECM_24': 'Sangrampur Block', 'ECM_25': 'Sugauli Block', 'ECM_26': 'Tetariya Block', 'ECM_27': 'Turkaulia Block',
  'GAY_01': 'Amas Block', 'GAY_02': 'Atri Block', 'GAY_03': 'Banke Bazar Block', 'GAY_04': 'Barachatti Block', 'GAY_05': 'Belaganj Block', 'GAY_06': 'Bodh Gaya Block', 'GAY_07': 'Dobhi Block', 'GAY_08': 'Dumaria Block', 'GAY_09': 'Fatehpur Block', 'GAY_10': 'Gaya Sadar Block', 'GAY_11': 'Guraru Block', 'GAY_12': 'Gurua Block', 'GAY_13': 'Imamganj Block', 'GAY_14': 'Khizirsarai Block', 'GAY_15': 'Konch Block', 'GAY_16': 'Manpur Block', 'GAY_17': 'Mohanpur Block', 'GAY_18': 'Muhra Block', 'GAY_19': 'Neem Chak Bathani Block', 'GAY_20': 'Paraiya Block', 'GAY_21': 'Sherghati Block', 'GAY_22': 'Tan Kuppa Block', 'GAY_23': 'Tikari Block', 'GAY_24': 'Wazirganj Block',
  'GPL_01': 'Baikunthpur Block', 'GPL_02': 'Barauli Block', 'GPL_03': 'Bhorey Block', 'GPL_04': 'Bijaipur Block', 'GPL_05': 'Gopalganj Block', 'GPL_06': 'Hathua Block', 'GPL_07': 'Katiya Block', 'GPL_08': 'Kuchaikote Block', 'GPL_09': 'Manjha Block', 'GPL_10': 'Pach Deori Block', 'GPL_11': 'Phulwariya Block', 'GPL_12': 'Sidhwalia Block', 'GPL_13': 'Thawe Block', 'GPL_14': 'Uchkagaon Block',
  'JMU_01': 'Barhat Block', 'JMU_02': 'Chakai Block', 'JMU_03': 'Gidhaur Block', 'JMU_04': 'Islamnagar Aliganj Block', 'JMU_05': 'Jamui Block', 'JMU_06': 'Jhajha Block', 'JMU_07': 'Khaira Block', 'JMU_08': 'Laxmipur Block', 'JMU_09': 'Sikandra Block', 'JMU_10': 'Sono Block',
  'JHD_01': 'Ghosi Block', 'JHD_02': 'Hulasganj Block', 'JHD_03': 'Jehanabad Block', 'JHD_04': 'Kako Block', 'JHD_05': 'Makhdumpur Block', 'JHD_06': 'Modanganj Block', 'JHD_07': 'Ratni Faridpur Block',
  'KMR_BR_01': 'Adhaura Block', 'KMR_BR_02': 'Bhagwanpur Block', 'KMR_BR_03': 'Bhabhua Block', 'KMR_BR_04': 'Chainpur Block', 'KMR_BR_05': 'Chand Block', 'KMR_BR_06': 'Durgawati Block', 'KMR_BR_07': 'Kudra Block', 'KMR_BR_08': 'Mohania Block', 'KMR_BR_09': 'Nuon Block', 'KMR_BR_10': 'Ramgarh Block', 'KMR_BR_11': 'Rampur Block',
  'KTR_01': 'Amdabad Block', 'KTR_02': 'Azamnagar Block', 'KTR_03': 'Balrampur Block', 'KTR_04': 'Barari Block', 'KTR_05': 'Barsoi Block', 'KTR_06': 'Dandkhora Block', 'KTR_07': 'Falka Block', 'KTR_08': 'Hasanganj Block', 'KTR_09': 'Kadwa Block', 'KTR_10': 'Katihar Block', 'KTR_11': 'Korha Block', 'KTR_12': 'Kursela Block', 'KTR_13': 'Manihari Block', 'KTR_14': 'Mansahi Block', 'KTR_15': 'Pranpur Block', 'KTR_16': 'Sameli Block',
  'KHG_01': 'Alauli Block', 'KHG_02': 'Beldaur Block', 'KHG_03': 'Chautham Block', 'KHG_04': 'Gogri Block', 'KHG_05': 'Khagaria Block', 'KHG_06': 'Mansi Block', 'KHG_07': 'Parbatta Block',
  'KSG_BR_01': 'Bahadurganj Block', 'KSG_BR_02': 'Dighalbank Block', 'KSG_BR_03': 'Kishanganj Block', 'KSG_BR_04': 'Kochadhaman Block', 'KSG_BR_05': 'Pothia Block', 'KSG_BR_06': 'Terhagachh Block', 'KSG_BR_07': 'Thakurganj Block',
  'LKS_01': 'Barahiya Block', 'LKS_02': 'Chanan Block', 'LKS_03': 'Halsi Block', 'LKS_04': 'Lakhisarai Block', 'LKS_05': 'Pipariya Block', 'LKS_06': 'Ramgarh Chowk Block', 'LKS_07': 'Surajgarha Block',
  'MDP_01': 'Alamnagar Block', 'MDP_02': 'Bihariganj Block', 'MDP_03': 'Chausa Block', 'MDP_04': 'Gheshar Block', 'MDP_05': 'Gwalpara Block', 'MDP_06': 'Gamharia Block', 'MDP_07': 'Kumarkhand Block', 'MDP_08': 'Madhepura Block', 'MDP_09': 'Murliganj Block', 'MDP_10': 'Puraini Block', 'MDP_11': 'Shankarpur Block', 'MDP_12': 'Singheshwar Block', 'MDP_13': 'Kishunganj Block',
  'MDB_01': 'Andhratharhi Block', 'MDB_02': 'Babubarhi Block', 'MDB_03': 'Basopatti Block', 'MDB_04': 'Benipatti Block', 'MDB_05': 'Bisfi Block', 'MDB_06': 'Ghoghardiha Block', 'MDB_07': 'Harlakhi Block', 'MDB_08': 'Jhanjharpur Block', 'MDB_09': 'Kaluahi Block', 'MDB_10': 'Khajauli Block', 'MDB_11': 'Ladania Block', 'MDB_12': 'Lakhnaur Block', 'MDB_13': 'Laukaha Block', 'MDB_14': 'Laukahi Block', 'MDB_15': 'Madhepur Block', 'MDB_16': 'Madhubani Block', 'MDB_17': 'Pandaul Block', 'MDB_18': 'Phulparas Block', 'MDB_19': 'Rajnagar Block', 'MDB_20': 'Madhwapur Block',
  'MNG_01': 'Asarganj Block', 'MNG_02': 'Bariarpur Block', 'MNG_03': 'Dharhara Block', 'MNG_04': 'Haveli Kharagpur Block', 'MNG_05': 'Jamalpur Block', 'MNG_06': 'Munger Sadar Block', 'MNG_07': 'Sangrampur Block', 'MNG_08': 'Tarapur Block', 'MNG_09': 'Tetiha Bambar Block',
  'MUZ_01': 'Aurai Block', 'MUZ_02': 'Bandra Block', 'MUZ_03': 'Motipur Block', 'MUZ_04': 'Bochahan Block', 'MUZ_05': 'Gaighat Block', 'MUZ_06': 'Kanti Block', 'MUZ_07': 'Katra Block', 'MUZ_08': 'Kurhani Block', 'MUZ_09': 'Marwan Block', 'MUZ_10': 'Minapur Block', 'MUZ_11': 'Moraul Block', 'MUZ_12': 'Mushahari Block', 'MUZ_13': 'Paroo Block', 'MUZ_14': 'Sahebganj Block', 'MUZ_15': 'Sakra Block', 'MUZ_16': 'Saraiya Block',
  'NAL_01': 'Asthawan Block', 'NAL_02': 'Ben Block', 'NAL_03': 'Biharsharif Block', 'NAL_04': 'Bind Block', 'NAL_05': 'Chandi Block', 'NAL_06': 'Ekangarsarai Block', 'NAL_07': 'Giriyak Block', 'NAL_08': 'Harnaut Block', 'NAL_09': 'Hilsa Block', 'NAL_10': 'Islampur Block', 'NAL_11': 'Karai Parsurai Block', 'NAL_12': 'Katrisarai Block', 'NAL_13': 'Nagarnausa Block', 'NAL_14': 'Noorsarai Block', 'NAL_15': 'Parwalpur Block', 'NAL_16': 'Rahui Block', 'NAL_17': 'Rajgir Block', 'NAL_18': 'Sarmera Block', 'NAL_19': 'Silao Block', 'NAL_20': 'Tharthari Block',
  'NWD_01': 'Akbarpur Block', 'NWD_02': 'Gobindpur Block', 'NWD_03': 'Hisua Block', 'NWD_04': 'Kashichak Block', 'NWD_05': 'Kowakol Block', 'NWD_06': 'Meskaur Block', 'NWD_07': 'Nardiganj Block', 'NWD_08': 'Narhat Block', 'NWD_09': 'Nawada Block', 'NWD_10': 'Pakribarawan Block', 'NWD_11': 'Rajauli Block', 'NWD_12': 'Roh Block', 'NWD_13': 'Sirdala Block', 'NWD_14': 'Warisaliganj Block',
  'PAT_BR_01': 'Athmalgola Block', 'PAT_BR_02': 'Bakhtiarpur Block', 'PAT_BR_03': 'Barh Block', 'PAT_BR_04': 'Belchi Block', 'PAT_BR_05': 'Bihta Block', 'PAT_BR_06': 'Bikram Block', 'PAT_BR_07': 'Daniyawan Block', 'PAT_BR_08': 'Khusrupur Block', 'PAT_BR_09': 'Dhanarua Block', 'PAT_BR_10': 'Dulhin Bazar Block', 'PAT_BR_11': 'Fatuha Block', 'PAT_BR_12': 'Ghoswari Block', 'PAT_BR_13': 'Maner Block', 'PAT_BR_14': 'Masaurhi Block', 'PAT_BR_15': 'Mokama Block', 'PAT_BR_16': 'Naubatpur Block', 'PAT_BR_17': 'Paliganj Block', 'PAT_BR_18': 'Pandarak Block', 'PAT_BR_19': 'Patna Sadar Block', 'PAT_BR_20': 'Phulwari Sharif Block', 'PAT_BR_21': 'Punpun Block', 'PAT_BR_22': 'Sampatchak Block', 'PAT_BR_23': 'Danapur Block',
  'PUR_01': 'Amour Block', 'PUR_02': 'Baisa Block', 'PUR_03': 'Baisi Block', 'PUR_04': 'Banmankhi Block', 'PUR_05': 'Barhara Kothi Block', 'PUR_06': 'Bhawanipur Block', 'PUR_07': 'Dagarua Block', 'PUR_08': 'Dhamdaha Block', 'PUR_09': 'Jalalgarh Block', 'PUR_10': 'Kasba Block', 'PUR_11': 'Krityanand Nagar Block', 'PUR_12': 'Purnia East Block', 'PUR_13': 'Rupouli Block', 'PUR_14': 'Srinagar Block',
  'RHT_01': 'Akorhi Gola Block', 'RHT_02': 'Bikramganj Block', 'RHT_03': 'Chenari Block', 'RHT_04': 'Dawath Block', 'RHT_05': 'Dehri Block', 'RHT_06': 'Dinara Block', 'RHT_07': 'Karakat Block', 'RHT_08': 'Kargahar Block', 'RHT_09': 'Kochas Block', 'RHT_10': 'Nasriganj Block', 'RHT_11': 'Nauhatta Block', 'RHT_12': 'Nokha Block', 'RHT_13': 'Rajpur Block', 'RHT_14': 'Rohtas Block', 'RHT_15': 'Sanjhauli Block', 'RHT_16': 'Sasaram Block', 'RHT_17': 'Sheosagar Block', 'RHT_18': 'Suryapura Block', 'RHT_19': 'Tilouthu Block',
  'SHS_01': 'Banma Itahri Block', 'SHS_02': 'Kahara Block', 'SHS_03': 'Mahishi Block', 'SHS_04': 'Nauhatta Block', 'SHS_05': 'Patarghat Block', 'SHS_06': 'Paterhi Belsar Block', 'SHS_07': 'Salkhua Block', 'SHS_08': 'Sattar Kattaiya Block', 'SHS_09': 'Saur Bazar Block', 'SHS_10': 'Simri Bakhtiarpur Block', 'SHS_11': 'Sonbarsa Block',
  'SMT_01': 'Bibhutipur Block', 'SMT_02': 'Bithan Block', 'SMT_03': 'Dalsinghsarai Block', 'SMT_04': 'Hasanpur Block', 'SMT_05': 'Kalyanpur Block', 'SMT_06': 'Khanpur Block', 'SMT_07': 'Mohanpur Block', 'SMT_08': 'Mohiuddin Nagar Block', 'SMT_09': 'Morwa Block', 'SMT_10': 'Patori Block', 'SMT_11': 'Pusa Block', 'SMT_12': 'Rosera Block', 'SMT_13': 'Samastipur Block', 'SMT_14': 'Sarairanjan Block', 'SMT_15': 'Shivaji Nagar Block', 'SMT_16': 'Singhia Block', 'SMT_17': 'Tajpur Block', 'SMT_18': 'Ujiarpur Block', 'SMT_19': 'Vidyapati Nagar Block', 'SMT_20': 'Warishnagar Block',
  'SRN_BR_01': 'Amnour Block', 'SRN_BR_02': 'Baniapur Block', 'SRN_BR_03': 'Chapra Sadar Block', 'SRN_BR_04': 'Dariyapur Block', 'SRN_BR_05': 'Dighwara Block', 'SRN_BR_06': 'Ekma Block', 'SRN_BR_07': 'Garkha Block', 'SRN_BR_08': 'Ishuapur Block', 'SRN_BR_09': 'Jalalpur Block', 'SRN_BR_10': 'Lahladpur Block', 'SRN_BR_11': 'Maker Block', 'SRN_BR_12': 'Manjhi Block', 'SRN_BR_13': 'Marhaura Block', 'SRN_BR_14': 'Mashrakh Block', 'SRN_BR_15': 'Nagra Block', 'SRN_BR_16': 'Panapur Block', 'SRN_BR_17': 'Parsa Block', 'SRN_BR_18': 'Rivilganj Block', 'SRN_BR_19': 'Sonepur Block', 'SRN_BR_20': 'Taraiya Block',
  'SKP_01': 'Ariari Block', 'SKP_02': 'Barbigha Block', 'SKP_03': 'Chewara Block', 'SKP_04': 'Ghat Kusumbha Block', 'SKP_05': 'Sheikhpura Block', 'SKP_06': 'Shekhopur Sarai Block',
  'SHH_01': 'Dumri Katsari Block', 'SHH_02': 'Piprarhi Block', 'SHH_03': 'Purnahiya Block', 'SHH_04': 'Sheohar Block', 'SHH_05': 'Tariyani Chowk Block',
  'STM_01': 'Bairgania Block', 'STM_02': 'Bajpatti Block', 'STM_03': 'Bathanaha Block', 'STM_04': 'Belsand Block', 'STM_05': 'Bokra Block', 'STM_06': 'Charaut Block', 'STM_07': 'Dumra Block', 'STM_08': 'Nanpur Block', 'STM_09': 'Parihar Block', 'STM_10': 'Parsauni Block', 'STM_11': 'Pupri Block', 'STM_12': 'Riga Block', 'STM_13': 'Runnisaidpur Block', 'STM_14': 'Sursand Block', 'STM_15': 'Sonbarsa Block', 'STM_16': 'Suppi Block', 'STM_17': 'Majorganj Block',
  'SWN_01': 'Andar Block', 'SWN_02': 'Barharia Block', 'SWN_03': 'Basantpur Block', 'SWN_04': 'Bhagwanpur Hat Block', 'SWN_05': 'Darauli Block', 'SWN_06': 'Daraundha Block', 'SWN_07': 'Goreyakothi Block', 'SWN_08': 'Guthani Block', 'SWN_09': 'Hasanpura Block', 'SWN_10': 'Hussainganj Block', 'SWN_11': 'Jiradei Block', 'SWN_12': 'Lakri Nabiganj Block', 'SWN_13': 'Maharajganj Block', 'SWN_14': 'Mairwa Block', 'SWN_15': 'Nautan Block', 'SWN_16': 'Pachrukhi Block', 'SWN_17': 'Raghunathpur Block', 'SWN_18': 'Siswan Block', 'SWN_19': 'Siwan Block',
  'SPL_01': 'Basantpur Block', 'SPL_02': 'Chhatapur Block', 'SPL_03': 'Kishanpur Block', 'SPL_04': 'Marauna Block', 'SPL_05': 'Nirmali Block', 'SPL_06': 'Pipra Block', 'SPL_07': 'Pratapganj Block', 'SPL_08': 'Raghopur Block', 'SPL_09': 'Saraigarh Bhaptiyahi Block', 'SPL_10': 'Supaul Block', 'SPL_11': 'Triveniganj Block',
  'VSH_01': 'Bhagwanpur Block', 'VSH_02': 'Bidupur Block', 'VSH_03': 'Chehra Kalan Block', 'VSH_04': 'Desri Block', 'VSH_05': 'Goraul Block', 'VSH_06': 'Hajipur Block', 'VSH_07': 'Jandaha Block', 'VSH_08': 'Lalganj Block', 'VSH_09': 'Mahnar Block', 'VSH_10': 'Mahua Block', 'VSH_11': 'Patedhi Belsar Block', 'VSH_12': 'Patepur Block', 'VSH_13': 'Raghopur Block', 'VSH_14': 'Rajaapakar Block', 'VSH_15': 'Sahdei Buzurg Block', 'VSH_16': 'Vaishali Block',
  // --- RAJASTHAN (RJ) BLOCKS ACROSS 50 DISTRICTS ---
  'AJM_01': 'Ajmer Rural Block', 'AJM_02': 'Arain Block', 'AJM_03': 'Jawaja Block', 'AJM_04': 'Kekri Block', 'AJM_05': 'Masuda Block', 'AJM_06': 'Peesangan Block', 'AJM_07': 'Srinagar Block', 'AJM_08': 'Silora Block', 'AJM_09': 'Bhinai Block',
  'ALW_01': 'Bansur Block', 'ALW_02': 'Behror Block', 'ALW_03': 'Kathumar Block', 'ALW_04': 'Kishangarh Bas Block', 'ALW_05': 'Kotkasim Block', 'ALW_06': 'Laxmangarh Block', 'ALW_07': 'Mandawar Block', 'ALW_08': 'Neemrana Block', 'ALW_09': 'Rajgarh Block', 'ALW_10': 'Ramgarh Block', 'ALW_11': 'Reni Block', 'ALW_12': 'Thanagazi Block', 'ALW_13': 'Tijara Block', 'ALW_14': 'Umren Block',
  'APG_01': 'Anupgarh Block', 'APG_02': 'Gharsana Block', 'APG_03': 'Rawla Block', 'APG_04': 'Ramsinghpur Block', 'APG_05': 'Suratgarh Rural Block', 'APG_06': 'Vijaynagar Block',
  'BLT_01': 'Balotra Block', 'BLT_02': 'Baytu Block', 'BLT_03': 'Gida Block', 'BLT_04': 'Kalyanpur Block', 'BLT_05': 'Patodi Block', 'BLT_06': 'Samdari Block', 'BLT_07': 'Sindhari Block', 'BLT_08': 'Siwana Block',
  'BSW_01': 'Anandpuri Block', 'BSW_02': 'Arthuna Block', 'BSW_03': 'Bagidora Block', 'BSW_04': 'Banswara Block', 'BSW_05': 'Chhoti Sarwan Block', 'BSW_06': 'Gangarampur Block', 'BSW_07': 'Ghatol Block', 'BSW_08': 'Kushalgarh Block', 'BSW_09': 'Sajjangarh Block', 'BSW_10': 'Sajjangarh Rural Block', 'BSW_11': 'Talwara Block',
  'BRN_01': 'Antah Block', 'BRN_02': 'Atru Block', 'BRN_03': 'Baran Block', 'BRN_04': 'Chhabra Block', 'BRN_05': 'Chhipabarod Block', 'BRN_06': 'Kishanganj Block', 'BRN_07': 'Shahbad Block',
  'BMR_01': 'Barmer Block', 'BMR_02': 'Barmer Rural Block', 'BMR_03': 'Chauhtan Block', 'BMR_04': 'Dhanau Block', 'BMR_05': 'Dhorimanna Block', 'BMR_06': 'Gudamalani Block', 'BMR_07': 'Ramsar Block', 'BMR_08': 'Sedwa Block', 'BMR_09': 'Shiv Block',
  'BWR_01': 'Beawar Block', 'BWR_02': 'Jawaja Block', 'BWR_03': 'Raipur Block', 'BWR_04': 'Jaitaran Block', 'BWR_05': 'Badnor Block', 'BWR_06': 'Masuda Rural Block', 'BWR_07': 'Tatgarh Block',
  'BHT_01': 'Bayana Block', 'BHT_02': 'Deeg Rural Block', 'BHT_03': 'Kaman Rural Block', 'BHT_04': 'Kumher Block', 'BHT_05': 'Nadbai Block', 'BHT_06': 'Nagar Rural Block', 'BHT_07': 'Pahari Block', 'BHT_08': 'Rupbas Block', 'BHT_09': 'Sewar Block', 'BHT_10': 'Uchchain Block', 'BHT_11': 'Weir Block',
  'BHL_01': 'Asind Block', 'BHL_02': 'Banera Block', 'BHL_03': 'Bijolia Block', 'BHL_04': 'Hurda Block', 'BHL_05': 'Jahazpur Block', 'BHL_06': 'Kotri Block', 'BHL_07': 'Mandal Block', 'BHL_08': 'Mandalgarh Block', 'BHL_09': 'Raipur Block', 'BHL_10': 'Sahada Block', 'BHL_11': 'Suwana Block',
  'BKN_01': 'Bajju Block', 'BKN_02': 'Bikaner Block', 'BKN_03': 'Dungargarh Block', 'BKN_04': 'Khajuwala Block', 'BKN_05': 'Kolayat Block', 'BKN_06': 'Lunkaransar Block', 'BKN_07': 'Nokha Block', 'BKN_08': 'Poogal Block',
  'BND_RJ_01': 'Bundi Block', 'BND_RJ_02': 'Hindoli Block', 'BND_RJ_03': 'K.Patan Block', 'BND_RJ_04': 'Nainwa Block', 'BND_RJ_05': 'Talera Block',
  'CTG_01': 'Bari Sadri Block', 'CTG_02': 'Begun Block', 'CTG_03': 'Bhadesar Block', 'CTG_04': 'Bhopalsagar Block', 'CTG_05': 'Chittorgarh Block', 'CTG_06': 'Dungla Block', 'CTG_07': 'Gangrar Block', 'CTG_08': 'Kapasan Block', 'CTG_09': 'Nimbahera Block', 'CTG_10': 'Rashmi Block', 'CTG_11': 'Rawatbhata Block',
  'CHR_01': 'Bidasar Block', 'CHR_02': 'Churu Block', 'CHR_03': 'Rajgarh Block', 'CHR_04': 'Ratangarh Block', 'CHR_05': 'Sardarshahar Block', 'CHR_06': 'Sujangarh Block', 'CHR_07': 'Taranagar Block',
  'DSA_01': 'Bandikui Block', 'DSA_02': 'Dausa Block', 'DSA_03': 'Lalsot Block', 'DSA_04': 'Lawan Block', 'DSA_05': 'Mahwa Block', 'DSA_06': 'Ramgarh Pachwara Block', 'DSA_07': 'Sikrai Block', 'DSA_08': 'Baijupada Block',
  'DEG_01': 'Deeg Block', 'DEG_02': 'Kaman Block', 'DEG_03': 'Kumher Rural Block', 'DEG_04': 'Nagar Block', 'DEG_05': 'Pahari Block', 'DEG_06': 'Jurhara Block',
  'DHP_01': 'Bari Block', 'DHP_02': 'Baseri Block', 'DHP_03': 'Dholpur Block', 'DHP_04': 'Rajakhera Block', 'DHP_05': 'Saipau Block', 'DHP_06': 'Sarmathura Block',
  'DKC_01': 'Didwana Block', 'DKC_02': 'Kuchaman City Block', 'DKC_03': 'Ladnun Block', 'DKC_04': 'Makrana Block', 'DKC_05': 'Maulasar Block', 'DKC_06': 'Nawa Block', 'DKC_07': 'Parbatsar Block',
  'DNG_01': 'Aspur Block', 'DNG_02': 'Bichhiwara Block', 'DNG_03': 'Chikhli Block', 'DNG_04': 'Dovda Block', 'DNG_05': 'Dungarpur Block', 'DNG_06': 'Galiakot Block', 'DNG_07': 'Gamhari Block', 'DNG_08': 'Jholiyawad Block', 'DNG_09': 'Sabla Block', 'DNG_10': 'Sagwara Block', 'DNG_11': 'Simalwara Block',
  'GGN_01': 'Ganganagar Block', 'GGN_02': 'Karanpur Block', 'GGN_03': 'Padampur Block', 'GGN_04': 'Raisinghnagar Block', 'GGN_05': 'Sadulshahar Block', 'GGN_06': 'Suratgarh Block',
  'GPC_01': 'Bamanwas Block', 'GPC_02': 'Bonli Rural Block', 'GPC_03': 'Gangapur Block', 'GPC_04': 'Todabhim Block', 'GPC_05': 'Wazirpur Block',
  'HNM_01': 'Bhadra Block', 'HNM_02': 'Hanumangarh Block', 'HNM_03': 'Nohar Block', 'HNM_04': 'Pilibanga Block', 'HNM_05': 'Rawatsar Block', 'HNM_06': 'Sangaria Block', 'HNM_07': 'Tibbi Block',
  'JPR_01': 'Amber Block', 'JPR_02': 'Bass Block', 'JPR_03': 'Chaksu Block', 'JPR_04': 'Govindgarh Block', 'JPR_05': 'Jalsu Block', 'JPR_06': 'Jamwa Ramgarh Block', 'JPR_07': 'Jhotwara Block', 'JPR_08': 'Kotputli Rural Block', 'JPR_09': 'Paota Block', 'JPR_10': 'Phagi Block', 'JPR_11': 'Sambhar Block', 'JPR_12': 'Sanganer Block', 'JPR_13': 'Shahpura Block', 'JPR_14': 'Tunga Block', 'JPR_15': 'Viratnagar Block',
  'JSM_01': 'Bhaniyana Block', 'JSM_02': 'Fatehgarh Block', 'JSM_03': 'Jaisalmer Block', 'JSM_04': 'Mohangarh Block', 'JSM_05': 'Nachna Block', 'JSM_06': 'Pokaran Block', 'JSM_07': 'Sam Block', 'JSM_08': 'Sankra Block',
  'JLR_01': 'Ahore Block', 'JLR_02': 'Bhinmal Block', 'JLR_03': 'Chitalwana Block', 'JLR_04': 'Jaswantpura Block', 'JLR_05': 'Jalore Block', 'JLR_06': 'Raniwara Block', 'JLR_07': 'Sanchore Rural Block', 'JLR_08': 'Sayla Block',
  'JHL_01': 'Bakani Block', 'JHL_02': 'Dag Block', 'JHL_03': 'Jhalrapatan Block', 'JHL_04': 'Khanpur Block', 'JHL_05': 'Manohar Thana Block', 'JHL_06': 'Pirawa Block', 'JHL_07': 'Sunel Block',
  'JJN_01': 'Alsisar Block', 'JJN_02': 'Buhana Block', 'JJN_03': 'Chirawa Block', 'JJN_04': 'Jhunjhunu Block', 'JJN_05': 'Khetri Block', 'JJN_06': 'Nawalgarh Block', 'JJN_07': 'Surajgarh Block', 'JJN_08': 'Udaipurwati Block',
  'JDH_01': 'Baori Block', 'JDH_02': 'Bap Block', 'JDH_03': 'Balesar Block', 'JDH_04': 'Bhopalgarh Block', 'JDH_05': 'Bilara Block', 'JDH_06': 'Chamu Block', 'JDH_07': 'Dechu Block', 'JDH_08': 'Luni Block', 'JDH_09': 'Mandor Block', 'JDH_10': 'Osian Block', 'JDH_11': 'Phalodi Rural Block', 'JDH_12': 'Piparcity Block', 'JDH_13': 'Sekhala Block', 'JDH_14': 'Shergarh Block', 'JDH_15': 'Tiwari Block',
  'KRL_RJ_01': 'Hindaun Block', 'KRL_RJ_02': 'Karauli Block', 'KRL_RJ_03': 'Karanpur Block', 'KRL_RJ_04': 'Mandrail Block', 'KRL_RJ_05': 'Masalpur Block', 'KRL_RJ_06': 'Nadoti Block', 'KRL_RJ_07': 'Sapotra Block', 'KRL_RJ_08': 'Todabhim Rural Block',
  'KKR_RJ_01': 'Bhinai Block', 'KKR_RJ_02': 'Kekri Block', 'KKR_RJ_03': 'Sarwar Block', 'KKR_RJ_04': 'Sawar Block', 'KKR_RJ_05': 'Todaraisingh Block',
  'KHT_01': 'Kishangarh Bas Block', 'KHT_02': 'Kotkasim Block', 'KHT_03': 'Mundawar Block', 'KHT_04': 'Neemrana Block', 'KHT_05': 'Tijara Block',
  'KTA_01': 'Chechat Block', 'KTA_02': 'Itawa Block', 'KTA_03': 'Khairabad Block', 'KTA_04': 'Ladpura Block', 'KTA_05': 'Sangod Block', 'KTA_06': 'Sultanpur Block',
  'KPB_01': 'Bansur Block', 'KPB_02': 'Behror Block', 'KPB_03': 'Kotputli Block', 'KPB_04': 'Mandhan Block', 'KPB_05': 'Narayanpur Block', 'KPB_06': 'Paota Block', 'KPB_07': 'Viratnagar Block',
  'NGR_01': 'Degana Block', 'NGR_02': 'Jayal Block', 'NGR_03': 'Khinvsar Block', 'NGR_04': 'Merta Block', 'NGR_05': 'Mundwa Block', 'NGR_06': 'Nagaur Block', 'NGR_07': 'Riyan Badi Block',
  'NKT_01': 'Khetri Rural Block', 'NKT_02': 'Neem Ka Thana Block', 'NKT_03': 'Patan Block', 'NKT_04': 'Srimadhopur Block', 'NKT_05': 'Udaipurwati Rural Block',
  'PLI_01': 'Bali Block', 'PLI_02': 'Desuri Block', 'PLI_03': 'Marwar Junction Block', 'PLI_04': 'Pali Block', 'PLI_05': 'Rani Block', 'PLI_06': 'Rohat Block', 'PLI_07': 'Sojat Block', 'PLI_08': 'Sumerpur Block',
  'PHL_01': 'Bap Block', 'PHL_02': 'Bapini Block', 'PHL_03': 'Dechu Rural Block', 'PHL_04': 'Ghantiyali Block', 'PHL_05': 'Lohawat Block', 'PHL_06': 'Phalodi Block',
  'PRT_RJ_01': 'Arnod Block', 'PRT_RJ_02': 'Chhoti Sadri Block', 'PRT_RJ_03': 'Dhariawad Block', 'PRT_RJ_04': 'Peepalkhoont Block', 'PRT_RJ_05': 'Pratapgarh Block', 'PRT_RJ_06': 'Suhagpura Block',
  'RJS_01': 'Amet Block', 'RJS_02': 'Bhim Block', 'RJS_03': 'Deogarh Block', 'RJS_04': 'Khamnor Block', 'RJS_05': 'Kumbhalgarh Block', 'RJS_06': 'Railmagra Block', 'RJS_07': 'Rajsamand Block',
  'SLB_01': 'Jhadol Rural Block', 'SLB_02': 'Kherwara Rural Block', 'SLB_03': 'Lasadiya Block', 'SLB_04': 'Salumbar Block', 'SLB_05': 'Sarada Block', 'SLB_06': 'Semari Block',
  'SNC_01': 'Bagoda Block', 'SNC_02': 'Chitalwana Block', 'SNC_03': 'Raniwara Rural Block', 'SNC_04': 'Sanchore Block',
  'SWM_01': 'Bamanwas Rural Block', 'SWM_02': 'Bonli Block', 'SWM_03': 'Chauth Ka Barwara Block', 'SWM_04': 'Khandar Block', 'SWM_05': 'Malarna Doongar Block', 'SWM_06': 'Sawai Madhopur Block',
  'SHP_01': 'Banera Rural Block', 'SHP_02': 'Hurda Rural Block', 'SHP_03': 'Jahazpur Rural Block', 'SHP_04': 'Kotri Rural Block', 'SHP_05': 'Shahpura Block',
  'SKR_01': 'Danta Ramgarh Block', 'SKR_02': 'Dhond Block', 'SKR_03': 'Fatehpur Block', 'SKR_04': 'Khandela Block', 'SKR_05': 'Laxmangarh Block', 'SKR_06': 'Nechwa Block', 'SKR_07': 'Paprana Block', 'SKR_08': 'Piparali Block', 'SKR_09': 'Sikar Block',
  'SRH_01': 'Abu Road Block', 'SRH_02': 'Pindwara Block', 'SRH_03': 'Reodar Block', 'SRH_04': 'Sheoganj Block', 'SRH_05': 'Sirohi Block',
  'TNK_01': 'Deoli Block', 'TNK_02': 'Malpura Block', 'TNK_03': 'Niwai Block', 'TNK_04': 'Peeplu Block', 'TNK_05': 'Todaraisingh Rural Block', 'TNK_06': 'Tonk Block', 'TNK_07': 'Uniara Block',
  // --- MADHYA PRADESH (MP) BLOCKS ACROSS 55 DISTRICTS ---
  'AGM_01': 'Agar Block', 'AGM_02': 'Barod Block', 'AGM_03': 'Nalkheda Block', 'AGM_04': 'Susner Block',
  'ALR_01': 'Alirajpur Block', 'ALR_02': 'Chandra Shekhar Azad Nagar Block', 'ALR_03': 'Jobat Block', 'ALR_04': 'Katthiwada Block', 'ALR_05': 'Sondwa Block', 'ALR_06': 'Udaygarh Block',
  'ANP_01': 'Anuppur Block', 'ANP_02': 'Jaithari Block', 'ANP_03': 'Kotma Block', 'ANP_04': 'Pushprajgarh Block',
  'ASH_01': 'Ashoknagar Block', 'ASH_02': 'Chanderi Block', 'ASH_03': 'Isagarh Block', 'ASH_04': 'Mungaoli Block',
  'BLG_01': 'Baihar Block', 'BLG_02': 'Balaghat Block', 'BLG_03': 'Birsa Block', 'BLG_04': 'Katangi Block', 'BLG_05': 'Khairlanji Block', 'BLG_06': 'Kirnapur Block', 'BLG_07': 'Lalbarra Block', 'BLG_08': 'Lanji Block', 'BLG_09': 'Paraswada Block', 'BLG_10': 'Tirodi Block', 'BLG_11': 'Waraseoni Block',
  'BRW_01': 'Barwani Block', 'BRW_02': 'Niwali Block', 'BRW_03': 'Pansemal Block', 'BRW_04': 'Pati Block', 'BRW_05': 'Rajpur Block', 'BRW_06': 'Sendhwa Block', 'BRW_07': 'Thikri Block',
  'BTL_01': 'Amla Block', 'BTL_02': 'Athner Block', 'BTL_03': 'Betul Block', 'BTL_04': 'Bhainsdehi Block', 'BTL_05': 'Bhimpur Block', 'BTL_06': 'Chicholi Block', 'BTL_07': 'Ghoradongri Block', 'BTL_08': 'Multai Block', 'BTL_09': 'Prabhat Pattan Block', 'BTL_10': 'Shahpur Block',
  'BHN_01': 'Ater Block', 'BHN_02': 'Bhind Block', 'BHN_03': 'Gohad Block', 'BHN_04': 'Lahar Block', 'BHN_05': 'Mehgaon Block', 'BHN_06': 'Mihona Block', 'BHN_07': 'Raun Block',
  'BHP_MP_01': 'Berasia Block', 'BHP_MP_02': 'Phanda Block',
  'BUR_01': 'Burhanpur Block', 'BUR_02': 'Khanknar Block',
  'CHT_01': 'Bada Malhera Block', 'CHT_02': 'Bakswaha Block', 'CHT_03': 'Bijawar Block', 'CHT_04': 'Chhatarpur Block', 'CHT_05': 'Gaurihar Block', 'CHT_06': 'Laundi Block', 'CHT_07': 'Nowgong Block', 'CHT_08': 'Rajnagar Block',
  'CHW_01': 'Amarwara Block', 'CHW_02': 'Bichhua Block', 'CHW_03': 'Chaurai Block', 'CHW_04': 'Chhindwara Block', 'CHW_05': 'Harrai Block', 'CHW_06': 'Junnardeo Block', 'CHW_07': 'Mohkhed Block', 'CHW_08': 'Parasia Block', 'CHW_09': 'Tamia Block',
  'DMH_01': 'Batiyagarh Block', 'DMH_02': 'Damoh Block', 'DMH_03': 'Hatta Block', 'DMH_04': 'Jabera Block', 'DMH_05': 'Pathariya Block', 'DMH_06': 'Patera Block', 'DMH_07': 'Tendukheda Block',
  'DTA_01': 'Bhander Block', 'DTA_02': 'Datia Block', 'DTA_03': 'Seondha Block',
  'DWS_01': 'Bagli Block', 'DWS_02': 'Dewas Block', 'DWS_03': 'Kannod Block', 'DWS_04': 'Khategaon Block', 'DWS_05': 'Sonkatch Block', 'DWS_06': 'Tonk Khurd Block',
  'DHR_01': 'Badnawar Block', 'DHR_02': 'Bagh Block', 'DHR_03': 'Dhar Block', 'DHR_04': 'Dharampuri Block', 'DHR_05': 'Gandhwani Block', 'DHR_06': 'Kukshi Block', 'DHR_07': 'Manawar Block', 'DHR_08': 'Nalchha Block', 'DHR_09': 'Nisarpur Block', 'DHR_10': 'Sardarpur Block', 'DHR_11': 'Tirla Block', 'DHR_12': 'Umarban Block', 'DHR_13': 'Dahi Block',
  'DND_01': 'Amarpur Block', 'DND_02': 'Bajag Block', 'DND_03': 'Dindori Block', 'DND_04': 'Karanjiya Block', 'DND_05': 'Mehandwani Block', 'DND_06': 'Samnapur Block', 'DND_07': 'Shahpura Block',
  'GNA_01': 'Aron Block', 'GNA_02': 'Bamori Block', 'GNA_03': 'Chachoda Block', 'GNA_04': 'Guna Block', 'GNA_05': 'Raghogarh Block',
  'GWL_01': 'Bhitarwar Block', 'GWL_02': 'Dabra Block', 'GWL_03': 'Barai Block', 'GWL_04': 'Morar Block',
  'HRD_MP_01': 'Harda Block', 'HRD_MP_02': 'Khirkiya Block', 'HRD_MP_03': 'Timarni Block',
  'IND_01': 'Depalpur Block', 'IND_02': 'Indore Block', 'IND_03': 'Dr. Ambedkar Nagar Block', 'IND_04': 'Sanwer Block',
  'JBL_01': 'Jabalpur Block', 'JBL_02': 'Kundam Block', 'JBL_03': 'Majholi Block', 'JBL_04': 'Panagar Block', 'JBL_05': 'Patan Block', 'JBL_06': 'Shahpura Block', 'JBL_07': 'Sihora Block',
  'JHB_01': 'Jhabua Block', 'JHB_02': 'Meghnagar Block', 'JHB_03': 'Petlawad Block', 'JHB_04': 'Rama Block', 'JHB_05': 'Ranapur Block', 'JHB_06': 'Thandla Block',
  'KTN_01': 'Badwara Block', 'KTN_02': 'Bahoriband Block', 'KTN_03': 'Dheemerkheda Block', 'KTN_04': 'Katni Block', 'KTN_05': 'Rithi Block', 'KTN_06': 'Vijayraghavgarh Block',
  'KHD_01': 'Baladi Block', 'KHD_02': 'Chhaigaon Makhan Block', 'KHD_03': 'Harsud Block', 'KHD_04': 'Khandwa Block', 'KHD_05': 'Khalwa Block', 'KHD_06': 'Pandhana Block', 'KHD_07': 'Punasa Block',
  'KHG_MP_01': 'Barwaha Block', 'KHG_MP_02': 'Bhagwanpura Block', 'KHG_MP_03': 'Bhikangaon Block', 'KHG_MP_04': 'Gogawan Block', 'KHG_MP_05': 'Kasrawad Block', 'KHG_MP_06': 'Khargone Block', 'KHG_MP_07': 'Maheshwar Block', 'KHG_MP_08': 'Segaon Block', 'KHG_MP_09': 'Jhiranya Block',
  'MHR_01': 'Maihar Block', 'MHR_02': 'Amarpatan Block', 'MHR_03': 'Ramnagar Block',
  'MDL_01': 'Bichhiya Block', 'MDL_02': 'Bijadandi Block', 'MDL_03': 'Ghughri Block', 'MDL_04': 'Mandla Block', 'MDL_05': 'Mawai Block', 'MDL_06': 'Mohgaon Block', 'MDL_07': 'Nainpur Block', 'MDL_08': 'Niwas Block', 'MDL_09': 'Narayanganj Block',
  'MND_MP_01': 'Bhanpura Block', 'MND_MP_02': 'Garoth Block', 'MND_MP_03': 'Malhargarh Block', 'MND_MP_04': 'Mandsaur Block', 'MND_MP_05': 'Sitamau Block',
  'MGJ_01': 'Hanumana Block', 'MGJ_02': 'Mauganj Block', 'MGJ_03': 'Naigarhi Block',
  'MRN_01': 'Ambah Block', 'MRN_02': 'Joura Block', 'MRN_03': 'Kailaras Block', 'MRN_04': 'Morena Block', 'MRN_05': 'Paharhgarh Block', 'MRN_06': 'Porsa Block', 'MRN_07': 'Sabalgarh Block',
  'NMP_01': 'Makhan Nagar Block', 'NMP_02': 'Bankhedi Block', 'NMP_03': 'Narmadapuram Block', 'NMP_04': 'Kesla Block', 'NMP_05': 'Pipariya Block', 'NMP_06': 'Hoshangabad Rural Block', 'NMP_07': 'Seoni Malwa Block', 'NMP_08': 'Sohagpur Block',
  'NSP_01': 'Babai Chichali Block', 'NSP_02': 'Chawarpatha Block', 'NSP_03': 'Gotegaon Block', 'NSP_04': 'Kareli Block', 'NSP_05': 'Narsinghpur Block', 'NSP_06': 'Saikheda Block',
  'NMC_01': 'Jawad Block', 'NMC_02': 'Manasa Block', 'NMC_03': 'Neemuch Block',
  'NWR_01': 'Niwari Block', 'NWR_02': 'Orchha Block', 'NWR_03': 'Prithvipur Block',
  'PND_01': 'Pandhurna Block', 'PND_02': 'Sausar Block',
  'PAN_01': 'Ajaygarh Block', 'PAN_02': 'Gunnor Block', 'PAN_03': 'Panna Block', 'PAN_04': 'Pawai Block', 'PAN_05': 'Shahnagar Block',
  'RSN_01': 'Badi Block', 'RSN_02': 'Begamganj Block', 'RSN_03': 'Gairatganj Block', 'RSN_04': 'Obedullaganj Block', 'RSN_05': 'Sanchi Block', 'RSN_06': 'Silwani Block', 'RSN_07': 'Udaipura Block',
  'RJG_01': 'Biaora Block', 'RJG_02': 'Khilchipur Block', 'RJG_03': 'Narsinghgarh Block', 'RJG_04': 'Rajgarh Block', 'RJG_05': 'Sarangpur Block', 'RJG_06': 'Zirapur Block',
  'RTL_01': 'Alot Block', 'RTL_02': 'Bajna Block', 'RTL_03': 'Jaora Block', 'RTL_04': 'Piploda Block', 'RTL_05': 'Ratlam Block', 'RTL_06': 'Sailana Block',
  'REW_MP_01': 'Gangev Block', 'REW_MP_02': 'Govindgarh Block', 'REW_MP_03': 'Jawa Block', 'REW_MP_04': 'Raipur Karchuliyan Block', 'REW_MP_05': 'Rewa Block', 'REW_MP_06': 'Semariya Block', 'REW_MP_07': 'Sirmaur Block', 'REW_MP_08': 'Teonthar Block',
  'SGR_01': 'Banda Block', 'SGR_02': 'Bina Block', 'SGR_03': 'Deori Block', 'SGR_04': 'Jaisinagar Block', 'SGR_05': 'Kesli Block', 'SGR_06': 'Khurai Block', 'SGR_07': 'Malthone Block', 'SGR_08': 'Rahatgarh Block', 'SGR_09': 'Rehli Block', 'SGR_10': 'Sagar Block', 'SGR_11': 'Shahgarh Block',
  'STN_01': 'Kotor Block', 'STN_02': 'Majhgawan Block', 'STN_03': 'Nagod Block', 'STN_04': 'Rampur Baghelan Block', 'STN_05': 'Sohawal Block', 'STN_06': 'Uchehara Block', 'STN_07': 'Unchehara Block',
  'SHR_MP_01': 'Ashta Block', 'SHR_MP_02': 'Budhni Block', 'SHR_MP_03': 'Ichhawar Block', 'SHR_MP_04': 'Bherunda Block', 'SHR_MP_05': 'Sehore Block',
  'SNO_01': 'Barghat Block', 'SNO_02': 'Chhapara Block', 'SNO_03': 'Dhanora Block', 'SNO_04': 'Ghansore Block', 'SNO_05': 'Keolari Block', 'SNO_06': 'Kurai Block', 'SNO_07': 'Lakhnadon Block', 'SNO_08': 'Seoni Block',
  'SHD_01': 'Beohari Block', 'SHD_02': 'Burhar Block', 'SHD_03': 'Gohparu Block', 'SHD_04': 'Jaisinghnagar Block', 'SHD_05': 'Sohagpur Block',
  'SJP_01': 'Kalapipal Block', 'SJP_02': 'Moman Badodiya Block', 'SJP_03': 'Shajapur Block', 'SJP_04': 'Shujalpur Block',
  'SHP_MP_01': 'Karahal Block', 'SHP_MP_02': 'Sheopur Block', 'SHP_MP_03': 'Vijaypur Block',
  'SVP_01': 'Badarwas Block', 'SVP_02': 'Karera Block', 'SVP_03': 'Khaniadhana Block', 'SVP_04': 'Kolaras Block', 'SVP_05': 'Narwar Block', 'SVP_06': 'Pichhore Block', 'SVP_07': 'Pohari Block', 'SVP_08': 'Shivpuri Block',
  'SDH_01': 'Kusmi Block', 'SDH_02': 'Majhauli Block', 'SDH_03': 'Rampur Naikin Block', 'SDH_04': 'Sihawal Block', 'SDH_05': 'Sidhi Block',
  'SNG_MP_01': 'Baidhan Block', 'SNG_MP_02': 'Chitrangi Block', 'SNG_MP_03': 'Deosar Block',
  'TKM_01': 'Baldeogarh Block', 'TKM_02': 'Jatara Block', 'TKM_03': 'Palera Block', 'TKM_04': 'Tikamgarh Block',
  'UJN_01': 'Badnagar Block', 'UJN_02': 'Ghatiya Block', 'UJN_03': 'Khachrod Block', 'UJN_04': 'Mahidpur Block', 'UJN_05': 'Tarana Block', 'UJN_06': 'Ujjain Block',
  'UMR_01': 'Karkeli Block', 'UMR_02': 'Manpur Block', 'UMR_03': 'Pali Block',
  // --- GUJARAT (GJ) BLOCKS ACROSS 33 DISTRICTS ---
  'AHM_01': 'Bavla Block', 'AHM_02': 'Daskroi Block', 'AHM_03': 'Detroj-Rampura Block', 'AHM_04': 'Dhandhuka Block', 'AHM_05': 'Dholera Block', 'AHM_06': 'Dholka Block', 'AHM_07': 'Mandal Block', 'AHM_08': 'Sanand Block', 'AHM_09': 'Viramgam Block',
  'AMR_GJ_01': 'Amreli Block', 'AMR_GJ_02': 'Babra Block', 'AMR_GJ_03': 'Bagasara Block', 'AMR_GJ_04': 'Dhari Block', 'AMR_GJ_05': 'Jafrabad Block', 'AMR_GJ_06': 'Khambha Block', 'AMR_GJ_07': 'Kunkavav Vadia Block', 'AMR_GJ_08': 'Lathi Block', 'AMR_GJ_09': 'Lilia Block', 'AMR_GJ_10': 'Rajula Block', 'AMR_GJ_11': 'Savarkundla Block',
  'AND_01': 'Anand Block', 'AND_02': 'Anklav Block', 'AND_03': 'Borsad Block', 'AND_04': 'Khambhat Block', 'AND_05': 'Petlad Block', 'AND_06': 'Sojitra Block', 'AND_07': 'Tarapur Block', 'AND_08': 'Umreth Block',
  'ARV_01': 'Bayad Block', 'ARV_02': 'Bhiloda Block', 'ARV_03': 'Dhansura Block', 'ARV_04': 'Malpur Block', 'ARV_05': 'Meghraj Block', 'ARV_06': 'Modasa Block',
  'BNK_GJ_01': 'Amirgadh Block', 'BNK_GJ_02': 'Bhabhar Block', 'BNK_GJ_03': 'Danta Block', 'BNK_GJ_04': 'Dantiwada Block', 'BNK_GJ_05': 'Deesa Block', 'BNK_GJ_06': 'Deodar Block', 'BNK_GJ_07': 'Dhanera Block', 'BNK_GJ_08': 'Kankrej Block', 'BNK_GJ_09': 'Lakhani Block', 'BNK_GJ_10': 'Palanpur Block', 'BNK_GJ_11': 'Suigam Block', 'BNK_GJ_12': 'Tharad Block', 'BNK_GJ_13': 'Vadgam Block', 'BNK_GJ_14': 'Vav Block',
  'BRH_01': 'Amod Block', 'BRH_02': 'Ankleshwar Block', 'BRH_03': 'Bharuch Block', 'BRH_04': 'Hansot Block', 'BRH_05': 'Jambusar Block', 'BRH_06': 'Jhagadia Block', 'BRH_07': 'Netrang Block', 'BRH_08': 'Vagra Block', 'BRH_09': 'Valia Block',
  'BHV_01': 'Bhavnagar Rural Block', 'BHV_02': 'Gariadhar Block', 'BHV_03': 'Ghogha Block', 'BHV_04': 'Jesar Block', 'BHV_05': 'Mahuvva Block', 'BHV_06': 'Palitana Block', 'BHV_07': 'Sihor Block', 'BHV_08': 'Talaja Block', 'BHV_09': 'Umrala Block', 'BHV_10': 'Vallabhipur Block',
  'BTD_01': 'Barwala Block', 'BTD_02': 'Botad Block', 'BTD_03': 'Gadhada Block', 'BTD_04': 'Ranpur Block',
  'CHU_GJ_01': 'Bodeli Block', 'CHU_GJ_02': 'Chhota Udaipur Block', 'CHU_GJ_03': 'Jetpur Pavi Block', 'CHU_GJ_04': 'Kavant Block', 'CHU_GJ_05': 'Nasvadi Block', 'CHU_GJ_06': 'Sankheda Block',
  'DHD_01': 'Dahod Block', 'DHD_02': 'Devgadh Baria Block', 'DHD_03': 'Dhanpur Block', 'DHD_04': 'Fatepura Block', 'DHD_05': 'Garbada Block', 'DHD_06': 'Jhalod Block', 'DHD_07': 'Limkheda Block', 'DHD_08': 'Sanjeli Block', 'DHD_09': 'Singvad Block',
  'DNG_GJ_01': 'Ahwa Block', 'DNG_GJ_02': 'Subir Block', 'DNG_GJ_03': 'Waghai Block',
  'DBD_01': 'Bhanvad Block', 'DBD_02': 'Kalyanpur Block', 'DBD_03': 'Khambhalia Block', 'DBD_04': 'Okhamandal Block',
  'GDN_01': 'Dehgam Block', 'GDN_02': 'Gandhinagar Block', 'GDN_03': 'Kalol Block', 'GDN_04': 'Mansa Block',
  'GSM_01': 'Gir Gadhada Block', 'GSM_02': 'Kodinar Block', 'GSM_03': 'Patan-Veraval Block', 'GSM_04': 'Sutrapada Block', 'GSM_05': 'Talala Block', 'GSM_06': 'Una Block',
  'JMN_01': 'Dhrol Block', 'JMN_02': 'Jamjodhpur Block', 'JMN_03': 'Jamnagar Rural Block', 'JMN_04': 'Jodiya Block', 'JMN_05': 'Kalavad Block', 'JMN_06': 'Lalpur Block',
  'JND_GJ_01': 'Bhesan Block', 'JND_GJ_02': 'Junagadh Rural Block', 'JND_GJ_03': 'Keshod Block', 'JND_GJ_04': 'Malia Hatina Block', 'JND_GJ_05': 'Manavadar Block', 'JND_GJ_06': 'Mangrol Block', 'JND_GJ_07': 'Mendarda Block', 'JND_GJ_08': 'Vanthali Block', 'JND_GJ_09': 'Visavadar Block',
  'KCH_01': 'Abdasa Block', 'KCH_02': 'Anjar Block', 'KCH_03': 'Bhachau Block', 'KCH_04': 'Bhuj Block', 'KCH_05': 'Gandhidham Block', 'KCH_06': 'Lakhpat Block', 'KCH_07': 'Mandvi Block', 'KCH_08': 'Mundra Block', 'KCH_09': 'Nakhatrana Block', 'KCH_10': 'Rapar Block',
  'KHD_GJ_01': 'Galteshwar Block', 'KHD_GJ_02': 'Kapadvanj Block', 'KHD_GJ_03': 'Kathlal Block', 'KHD_GJ_04': 'Kheda Block', 'KHD_GJ_05': 'Mahudha Block', 'KHD_GJ_06': 'Matar Block', 'KHD_GJ_07': 'Mehmedabad Block', 'KHD_GJ_08': 'Nadiad Block', 'KHD_GJ_09': 'Thasra Block', 'KHD_GJ_10': 'Vaso Block',
  'MSG_01': 'Balasinor Block', 'MSG_02': 'Kadana Block', 'MSG_03': 'Khanpur Block', 'MSG_04': 'Lunawada Block', 'MSG_05': 'Santrampur Block', 'MSG_06': 'Virpur Block',
  'MSN_01': 'Becharaji Block', 'MSN_02': 'Jotana Block', 'MSN_03': 'Kadi Block', 'MSN_04': 'Kheralu Block', 'MSN_05': 'Mehsana Block', 'MSN_06': 'Satlasana Block', 'MSN_07': 'Unjha Block', 'MSN_08': 'Vadnagar Block', 'MSN_09': 'Vijapur Block', 'MSN_10': 'Visnagar Block',
  'MRB_01': 'Halvad Block', 'MRB_02': 'Maliya Block', 'MRB_03': 'Morbi Block', 'MRB_04': 'Tankara Block', 'MRB_05': 'Wankaner Block',
  'NRM_01': 'Dediapada Block', 'NRM_02': 'Garudeshwar Block', 'NRM_03': 'Nandod Block', 'NRM_04': 'Sagbara Block', 'NRM_05': 'Tilakwada Block',
  'NVS_01': 'Chikhli Block', 'NVS_02': 'Gandevi Block', 'NVS_03': 'Jalalpore Block', 'NVS_04': 'Khergam Block', 'NVS_05': 'Navsari Block', 'NVS_06': 'Vansda Block',
  'PNC_01': 'Ghoghamba Block', 'PNC_02': 'Godhra Block', 'PNC_03': 'Halol Block', 'PNC_04': 'Jambughoda Block', 'PNC_05': 'Kalol Block', 'PNC_06': 'Morwa Hadaf Block', 'PNC_07': 'Shehera Block',
  'PTN_01': 'Chanasma Block', 'PTN_02': 'Harij Block', 'PTN_03': 'Patan Block', 'PTN_04': 'Radhanpur Block', 'PTN_05': 'Sami Block', 'PTN_06': 'Sankheshwar Block', 'PTN_07': 'Santalpur Block', 'PTN_08': 'Saraswati Block', 'PTN_09': 'Sidhpur Block',
  'PBD_01': 'Kutiyana Block', 'PBD_02': 'Porbandar Block', 'PBD_03': 'Ranavav Block',
  'RJK_01': 'Dhoraji Block', 'RJK_02': 'Gondal Block', 'RJK_03': 'Jamkandorna Block', 'RJK_04': 'Jasdan Block', 'RJK_05': 'Jetpur Block', 'RJK_06': 'Kotda Sangani Block', 'RJK_07': 'Lodhika Block', 'RJK_08': 'Paddhari Block', 'RJK_09': 'Rajkot Rural Block', 'RJK_10': 'Upleta Block', 'RJK_11': 'Vinchhiya Block',
  'SBK_01': 'Himatnagar Block', 'SBK_02': 'Idar Block', 'SBK_03': 'Khedbrahma Block', 'SBK_04': 'Poshina Block', 'SBK_05': 'Prantij Block', 'SBK_06': 'Talod Block', 'SBK_07': 'Vadali Block', 'SBK_08': 'Vijaynagar Block',
  'SRT_01': 'Bardoli Block', 'SRT_02': 'Choryasi Block', 'SRT_03': 'Kamrej Block', 'SRT_04': 'Mahuva Block', 'SRT_05': 'Mandvi Block', 'SRT_06': 'Mangrol Block', 'SRT_07': 'Olpad Block', 'SRT_08': 'Palsana Block', 'SRT_09': 'Umarpada Block',
  'SRN_GJ_01': 'Chotila Block', 'SRN_GJ_02': 'Chuda Block', 'SRN_GJ_03': 'Dasada Block', 'SRN_GJ_04': 'Dhrangadhra Block', 'SRN_GJ_05': 'Halvad Block', 'SRN_GJ_06': 'Lakhtar Block', 'SRN_GJ_07': 'Limbdi Block', 'SRN_GJ_08': 'Muli Block', 'SRN_GJ_09': 'Sayla Block', 'SRN_GJ_10': 'Thangadh Block', 'SRN_GJ_11': 'Wadhwan Block',
  'TAP_01': 'Kukarmunda Block', 'TAP_02': 'Nizar Block', 'TAP_03': 'Songadh Block', 'TAP_04': 'Uchchhal Block', 'TAP_05': 'Valod Block', 'TAP_06': 'Vyara Block', 'TAP_07': 'Dolvan Block',
  'VDR_01': 'Dabhoi Block', 'VDR_02': 'Desar Block', 'VDR_03': 'Karjan Block', 'VDR_04': 'Padra Block', 'VDR_05': 'Savli Block', 'VDR_06': 'Sinor Block', 'VDR_07': 'Vadodara Rural Block', 'VDR_08': 'Vaghodia Block',
  // --- WEST BENGAL (WB) BLOCKS ACROSS 23 DISTRICTS ---
  'APD_01': 'Alipurduar I Block', 'APD_02': 'Alipurduar II Block', 'APD_03': 'Falakata Block', 'APD_04': 'Kalchini Block', 'APD_05': 'Kumargram Block', 'APD_06': 'Madarihat-Birpara Block',
  'BNK_WB_01': 'Bankura I Block', 'BNK_WB_02': 'Bankura II Block', 'BNK_WB_03': 'Barjora Block', 'BNK_WB_04': 'Chhatna Block', 'BNK_WB_05': 'Gangajalghati Block', 'BNK_WB_06': 'Mejia Block', 'BNK_WB_07': 'Onda Block', 'BNK_WB_08': 'Saltora Block', 'BNK_WB_09': 'Indpur Block', 'BNK_WB_10': 'Khatra Block', 'BNK_WB_11': 'Hirbandh Block', 'BNK_WB_12': 'Ranibandh Block', 'BNK_WB_13': 'Raipur Block', 'BNK_WB_14': 'Sarenga Block', 'BNK_WB_15': 'Simlapal Block', 'BNK_WB_16': 'Taldangra Block', 'BNK_WB_17': 'Bishnupur Block', 'BNK_WB_18': 'Joypur Block', 'BNK_WB_19': 'Kotulpur Block', 'BNK_WB_20': 'Sonamukhi Block', 'BNK_WB_21': 'Patrasayer Block', 'BNK_WB_22': 'Indas Block',
  'BRB_01': 'Suri I Block', 'BRB_02': 'Suri II Block', 'BRB_03': 'Sainthia Block', 'BRB_04': 'Dubrajpur Block', 'BRB_05': 'Khoyrasol Block', 'BRB_06': 'Rajnagar Block', 'BRB_07': 'Mohammad Bazar Block', 'BRB_08': 'Bolpur-Sriniketan Block', 'BRB_09': 'Ilambazar Block', 'BRB_10': 'Labpur Block', 'BRB_11': 'Nanoor Block', 'BRB_12': 'Rampurhat I Block', 'BRB_13': 'Rampurhat II Block', 'BRB_14': 'Mayureswar I Block', 'BRB_15': 'Mayureswar II Block', 'BRB_16': 'Nalhati I Block', 'BRB_17': 'Nalhati II Block', 'BRB_18': 'Murarai I Block', 'BRB_19': 'Murarai II Block',
  'COB_01': 'Cooch Behar I Block', 'COB_02': 'Cooch Behar II Block', 'COB_03': 'Dinhata I Block', 'COB_04': 'Dinhata II Block', 'COB_05': 'Dinhata III Block', 'COB_06': 'Haldibari Block', 'COB_07': 'Mathabhanga I Block', 'COB_08': 'Mathabhanga II Block', 'COB_09': 'Mekhliganj Block', 'COB_10': 'Sitalkuchi Block', 'COB_11': 'Sitai Block', 'COB_12': 'Tufanganj I Block', 'COB_13': 'Tufanganj II Block',
  'DDN_WB_01': 'Balurghat Block', 'DDN_WB_02': 'Hili Block', 'DDN_WB_03': 'Kumarganj Block', 'DDN_WB_04': 'Tapan Block', 'DDN_WB_05': 'Gangarampur Block', 'DDN_WB_06': 'Bansihari Block', 'DDN_WB_07': 'Harirampur Block', 'DDN_WB_08': 'Kushmandi Block',
  'DAR_01': 'Darjeeling-Pulbazar Block', 'DAR_02': 'Rangli Rangliot Block', 'DAR_03': 'Jorebunglow Sukhiapokhri Block', 'DAR_04': 'Kurseong Block', 'DAR_05': 'Mirik Block', 'DAR_06': 'Matigara Block', 'DAR_07': 'Naxalbari Block', 'DAR_08': 'Phansidewa Block', 'DAR_09': 'Kharibari Block',
  'HGL_01': 'Balagarh Block', 'HGL_02': 'Chinsurah-Mogra Block', 'HGL_03': 'Dhaniakhali Block', 'HGL_04': 'Pandua Block', 'HGL_05': 'Polba-Dadpur Block', 'HGL_06': 'Chanditala I Block', 'HGL_07': 'Chanditala II Block', 'HGL_08': 'Jangipara Block', 'HGL_09': 'Singur Block', 'HGL_10': 'Sreerampur-Uttarpara Block', 'HGL_11': 'Haripal Block', 'HGL_12': 'Pursurah Block', 'HGL_13': 'Tarakeswar Block', 'HGL_14': 'Arambagh Block', 'HGL_15': 'Khanakul I Block', 'HGL_16': 'Khanakul II Block', 'HGL_17': 'Goghat I Block', 'HGL_18': 'Goghat II Block',
  'HWH_01': 'Bally-Jagachha Block', 'HWH_02': 'Domjur Block', 'HWH_03': 'Panchla Block', 'HWH_04': 'Sankrail Block', 'HWH_05': 'Jagatballavpur Block', 'HWH_06': 'Amta I Block', 'HWH_07': 'Amta II Block', 'HWH_08': 'Udaynarayanpur Block', 'HWH_09': 'Bagnan I Block', 'HWH_10': 'Bagnan II Block', 'HWH_11': 'Shyampur I Block', 'HWH_12': 'Shyampur II Block', 'HWH_13': 'Uluberia I Block', 'HWH_14': 'Uluberia II Block',
  'JPG_01': 'Jalpaiguri Block', 'JPG_02': 'Maynaguri Block', 'JPG_03': 'Dhupguri Block', 'JPG_04': 'Rajganj Block', 'JPG_05': 'Mal Block', 'JPG_06': 'Matiali Block', 'JPG_07': 'Nagrakata Block', 'JPG_08': 'Banarhat Block', 'JPG_09': 'Kranti Block',
  'JHG_01': 'Jhargram Block', 'JHG_02': 'Binpur I Block', 'JHG_03': 'Binpur II Block', 'JHG_04': 'Jamboni Block', 'JHG_05': 'Nayagram Block', 'JHG_06': 'Gopiballavpur I Block', 'JHG_07': 'Gopiballavpur II Block', 'JHG_08': 'Sankrail Block',
  'KLP_01': 'Kalimpong I Block', 'KLP_02': 'Kalimpong II Block', 'KLP_03': 'Gorubathan Block', 'KLP_04': 'Lava Block',
  'KOL_01': 'Kolkata Municipal Corporation',
  'MLD_01': 'English Bazar Block', 'MLD_02': 'Gazole Block', 'MLD_03': 'Habibpur Block', 'MLD_04': 'Kaliachak I Block', 'MLD_05': 'Kaliachak II Block', 'MLD_06': 'Kaliachak III Block', 'MLD_07': 'Harischandrapur I Block', 'MLD_08': 'Harischandrapur II Block', 'MLD_09': 'Chanchal I Block', 'MLD_10': 'Chanchal II Block', 'MLD_11': 'Ratua I Block', 'MLD_12': 'Ratua II Block', 'MLD_13': 'Manikchak Block', 'MLD_14': 'Old Malda Block', 'MLD_15': 'Bamangola Block',
  'MSD_01': 'Berhampore Block', 'MSD_02': 'Beldanga I Block', 'MSD_03': 'Beldanga II Block', 'MSD_04': 'Hariharpara Block', 'MSD_05': 'Naoda Block', 'MSD_06': 'Domkal Block', 'MSD_07': 'Jalangi Block', 'MSD_08': 'Raninagar I Block', 'MSD_09': 'Raninagar II Block', 'MSD_10': 'Murshidabad-Jiaganj Block', 'MSD_11': 'Bhagawangola I Block', 'MSD_12': 'Bhagawangola II Block', 'MSD_13': 'Lalgola Block', 'MSD_14': 'Nabagram Block', 'MSD_15': 'Kandi Block', 'MSD_16': 'Khargram Block', 'MSD_17': 'Burwan Block', 'MSD_18': 'Bharatpur I Block', 'MSD_19': 'Bharatpur II Block', 'MSD_20': 'Farakka Block', 'MSD_21': 'Samserganj Block', 'MSD_22': 'Suti I Block', 'MSD_23': 'Suti II Block', 'MSD_24': 'Raghunathganj I Block', 'MSD_25': 'Raghunathganj II Block', 'MSD_26': 'Sagardighi Block',
  'NAD_01': 'Krishnanagar I Block', 'NAD_02': 'Krishnanagar II Block', 'NAD_03': 'Nabadwip Block', 'NAD_04': 'Chapra Block', 'NAD_05': 'Nakashipara Block', 'NAD_06': 'Kaliganj Block', 'NAD_07': 'Tehatta I Block', 'NAD_08': 'Tehatta II Block', 'NAD_09': 'Karimpur I Block', 'NAD_10': 'Karimpur II Block', 'NAD_11': 'Ranaghat I Block', 'NAD_12': 'Ranaghat II Block', 'NAD_13': 'Santipur Block', 'NAD_14': 'Hanskhali Block', 'NAD_15': 'Chakdaha Block', 'NAD_16': 'Haringhata Block', 'NAD_17': 'Krishnaganj Block',
  'N24_01': 'Barasat I Block', 'N24_02': 'Barasat II Block', 'N24_03': 'Amdanga Block', 'N24_04': 'Deganga Block', 'N24_05': 'Habra I Block', 'N24_06': 'Habra II Block', 'N24_07': 'Rajarhat Block', 'N24_08': 'Barrackpore I Block', 'N24_09': 'Barrackpore II Block', 'N24_10': 'Basirhat I Block', 'N24_11': 'Basirhat II Block', 'N24_12': 'Baduria Block', 'N24_13': 'Haroa Block', 'N24_14': 'Hasnabad Block', 'N24_15': 'Hingalganj Block', 'N24_16': 'Minakhan Block', 'N24_17': 'Sandeshkhali I Block', 'N24_18': 'Sandeshkhali II Block', 'N24_19': 'Swarupnagar Block', 'N24_20': 'Bangaon Block', 'N24_21': 'Bagdah Block', 'N24_22': 'Gaighata Block',
  'PBD_WB_01': 'Faridpur-Durgapur Block', 'PBD_WB_02': 'Kanksa Block', 'PBD_WB_03': 'Pandabeswar Block', 'PBD_WB_04': 'Andal Block', 'PBD_WB_05': 'Raniganj Block', 'PBD_WB_06': 'Jamuria Block', 'PBD_WB_07': 'Barabani Block', 'PBD_WB_08': 'Salanpur Block',
  'PMD_01': 'Medinipur Sadar Block', 'PMD_02': 'Garhbeta I Block', 'PMD_03': 'Garhbeta II Block', 'PMD_04': 'Garhbeta III Block', 'PMD_05': 'Keshpur Block', 'PMD_06': 'Salboni Block', 'PMD_07': 'Dantan I Block', 'PMD_08': 'Dantan II Block', 'PMD_09': 'Debra Block', 'PMD_10': 'Keshiary Block', 'PMD_11': 'Kharagpur I Block', 'PMD_12': 'Kharagpur II Block', 'PMD_13': 'Mohanpur Block', 'PMD_14': 'Narayangarh Block', 'PMD_15': 'Pingla Block', 'PMD_16': 'Sabang Block', 'PMD_17': 'Daspur I Block', 'PMD_18': 'Daspur II Block', 'PMD_19': 'Ghatal Block', 'PMD_20': 'Chandrakona I Block', 'PMD_21': 'Chandrakona II Block',
  'PRB_01': 'Burdwan I Block', 'PRB_02': 'Burdwan II Block', 'PRB_03': 'Bhatar Block', 'PRB_04': 'Galsi I Block', 'PRB_05': 'Galsi II Block', 'PRB_06': 'Khandaghosh Block', 'PRB_07': 'Jamalpur Block', 'PRB_08': 'Memari I Block', 'PRB_09': 'Memari II Block', 'PRB_10': 'Raina I Block', 'PRB_11': 'Raina II Block', 'PRB_12': 'Kalna I Block', 'PRB_13': 'Kalna II Block', 'PRB_14': 'Manteswar Block', 'PRB_15': 'Purbasthali I Block', 'PRB_16': 'Purbasthali II Block', 'PRB_17': 'Katwa I Block', 'PRB_18': 'Katwa II Block', 'PRB_19': 'Ketugram I Block', 'PRB_20': 'Ketugram II Block', 'PRB_21': 'Mongalkote Block', 'PRB_22': 'Ausgram I Block', 'PRB_23': 'Ausgram II Block',
  'EGM_01': 'Tamluk Block', 'EGM_02': 'Sahid Matangini Block', 'EGM_03': 'Panskura Block', 'EGM_04': 'Kolaghat Block', 'EGM_05': 'Moyna Block', 'EGM_06': 'Nandakumar Block', 'EGM_07': 'Chandipur Block', 'EGM_08': 'Mahisadal Block', 'EGM_09': 'Nandigram I Block', 'EGM_10': 'Nandigram II Block', 'EGM_11': 'Sutahata Block', 'EGM_12': 'Haldia Block', 'EGM_13': 'Contai I Block', 'EGM_14': 'Contai III Block', 'EGM_15': 'Deshapran Block', 'EGM_16': 'Khejuri I Block', 'EGM_17': 'Khejuri II Block', 'EGM_18': 'Bhagabanpur I Block', 'EGM_19': 'Bhagabanpur II Block', 'EGM_20': 'Egra I Block', 'EGM_21': 'Egra II Block', 'EGM_22': 'Patashpur I Block', 'EGM_23': 'Patashpur II Block', 'EGM_24': 'Ramnagar I Block', 'EGM_25': 'Ramnagar II Block',
  'PUR_WB_01': 'Arsha Block', 'PUR_WB_02': 'Balarampur Block', 'PUR_WB_03': 'Barabazar Block', 'PUR_WB_04': 'Baghmundi Block', 'PUR_WB_05': 'Bandwan Block', 'PUR_WB_06': 'Hura Block', 'PUR_WB_07': 'Jhalda I Block', 'PUR_WB_08': 'Jhalda II Block', 'PUR_WB_09': 'Joypur Block', 'PUR_WB_10': 'Kashipur Block', 'PUR_WB_11': 'Manbazar I Block', 'PUR_WB_12': 'Manbazar II Block', 'PUR_WB_13': 'Neturia Block', 'PUR_WB_14': 'Para Block', 'PUR_WB_15': 'Puncha Block', 'PUR_WB_16': 'Purulia I Block', 'PUR_WB_17': 'Purulia II Block', 'PUR_WB_18': 'Raghunathpur I Block', 'PUR_WB_19': 'Raghunathpur II Block', 'PUR_WB_20': 'Santuri Block',
  'S24_01': 'Alipore Sadar Block', 'S24_02': 'Budge Budge I Block', 'S24_03': 'Budge Budge II Block', 'S24_04': 'Bishnupur I Block', 'S24_05': 'Bishnupur II Block', 'S24_06': 'Sonarpur Block', 'S24_07': 'Bhangar I Block', 'S24_08': 'Bhangar II Block', 'S24_09': 'Baruipur Block', 'S24_10': 'Jaynagar I Block', 'S24_11': 'Jaynagar II Block', 'S24_12': 'Kultali Block', 'S24_13': 'Canning I Block', 'S24_14': 'Canning II Block', 'S24_15': 'Basanti Block', 'S24_16': 'Gosaba Block', 'S24_17': 'Diamond Harbour I Block', 'S24_18': 'Diamond Harbour II Block', 'S24_19': 'Falta Block', 'S24_20': 'Magrahat I Block', 'S24_21': 'Magrahat II Block', 'S24_22': 'Kulpi Block', 'S24_23': 'Mandirbazar Block', 'S24_24': 'Mathurapur I Block', 'S24_25': 'Mathurapur II Block', 'S24_26': 'Kakdwip Block', 'S24_27': 'Namkhana Block', 'S24_28': 'Patharpratima Block', 'S24_29': 'Sagar Block',
  'UDN_01': 'Raiganj Block', 'UDN_02': 'Hemtabad Block', 'UDN_03': 'Kaliaganj Block', 'UDN_04': 'Itahar Block', 'UDN_05': 'Islampur Block', 'UDN_06': 'Chopra Block', 'UDN_07': 'Goalpokhar I Block', 'UDN_08': 'Goalpokhar II Block', 'UDN_09': 'Karandighi Block',
  'SAN_01': 'South Andaman Block 1', 'SAN_02': 'South Andaman Block 2',
  'NMA_01': 'North and Middle Andaman Block 1', 'NMA_02': 'North and Middle Andaman Block 2',
  'CHU_01': 'Chandigarh Urban Block 1', 'CHU_02': 'Chandigarh Urban Block 2',
  'CHR_UT_01': 'Chandigarh Rural Block 1', 'CHR_UT_02': 'Chandigarh Rural Block 2',
  'SLS_01': 'Silvassa Block 1', 'SLS_02': 'Silvassa Block 2',
  'DDR_01': 'Dadra Block 1', 'DDR_02': 'Dadra Block 2',
  'DMA_01': 'Daman Block 1', 'DMA_02': 'Daman Block 2',
  'DIU_01': 'Diu Block 1', 'DIU_02': 'Diu Block 2',
  'NDL_01': 'North Delhi Block 1', 'NDL_02': 'North Delhi Block 2',
  'SDL_01': 'South Delhi Block 1', 'SDL_02': 'South Delhi Block 2',
  'SRN_01': 'Srinagar Block 1', 'SRN_02': 'Srinagar Block 2',
  'JMU_JK_01': 'Jammu Block 1', 'JMU_JK_02': 'Jammu Block 2',
  'LEH_01': 'Leh Block 1', 'LEH_02': 'Leh Block 2',
  'KGL_01': 'Kargil Block 1', 'KGL_02': 'Kargil Block 2',
  'PUD_01': 'Puducherry Block 1', 'PUD_02': 'Puducherry Block 2',
  'KAL_01': 'Karaikal Block 1', 'KAL_02': 'Karaikal Block 2',
};

// Auto-generate 93 detailed FLN levels
export const FLN_LEVELS: any[] = (() => {
  const levels: any[] = [];
  const strandRotation = [
    'Number Sense (One-to-One Correspondence)',
    'Number Operations',
    'Shapes',
    'Measurement',
    'Patterns',
    'Money',
    'Calendar & Time',
    'Fractions',
    'Data Handling'
  ];

  const outcomesByStrand: Record<string, string[]> = {
    'Number Sense (One-to-One Correspondence)': [
      'Counting objects up to 10 with 1-to-1 matching',
      'Comparing sizes of groups (more, less, equal)',
      'Identifying position on a number line 1-10',
      'Reading and writing numerals up to 20',
      'Understanding place value up to 50 (tens and ones)',
      'Understanding place value up to 100',
      'Comparing 2-digit numbers using <, >, =',
      'Understanding numbers up to 1000'
    ],
    'Number Operations': [
      'Single-digit addition using visual aids',
      'Single-digit subtraction using visual objects',
      'Addition and subtraction of numbers up to 20 without carrying',
      'Double-digit addition without carrying',
      'Double-digit subtraction without borrowing',
      'Addition with carrying (2-digit)',
      'Subtraction with borrowing (2-digit)',
      'Basic multiplication tables of 2, 5, 10',
      'Introductory division as equal sharing',
      '3-digit addition and subtraction operations'
    ],
    'Shapes': [
      'Identifying basic shapes: Circle, Triangle, Square',
      'Recognizing shapes in real-world objects',
      'Differentiating 2D vs 3D shapes (Sphere, Cube)',
      'Understanding properties of shapes (corners, sides)',
      'Symmetry and spatial arrangements'
    ],
    'Measurement': [
      'Comparing length and height of objects (tall, short)',
      'Measuring length using non-standard units (handspan)',
      'Comparing weight of objects (heavy, light)',
      'Measuring volume using capacity containers',
      'Standard measurement units (cm, m, grams, ml)'
    ],
    'Patterns': [
      'Identifying simple repeating shape patterns (AB, AABB)',
      'Completing numeric skip counting patterns by 2s and 5s',
      'Creating custom sequential patterns',
      'Advanced numeric patterns (backwards, skip 10s)'
    ],
    'Money': [
      'Identifying 1, 2, 5, 10 rupee coins',
      'Understanding currency notes: 10, 20, 50, 100 rupees',
      'Adding simple monetary transactions (total price)',
      'Making change for a transaction (rupee notes)'
    ],
    'Calendar & Time': [
      'Identifying morning, afternoon, night routines',
      'Sequencing days of the week',
      'Telling time in full hours on analog clock',
      'Reading months of the year',
      'Telling time in half-hours and quarter-hours'
    ],
    'Fractions': [
      'Concept of whole vs. half (1/2)',
      'Concept of quarter (1/4)',
      'Comparing 1/2, 1/4 and whole visually',
      'Concept of three-quarters (3/4) and simple fractions'
    ],
    'Data Handling': [
      'Sorting objects into visual groups',
      'Creating simple tally charts',
      'Reading and interpreting bar pictographs',
      'Basic multi-variable tables'
    ]
  };

  for (let i = 1; i <= 93; i++) {
    const classLevel = i <= 42 ? 1 : i <= 61 ? 2 : i <= 75 ? 3 : 4;
    const strand = strandRotation[(i - 1) % strandRotation.length];
    const outcomes = outcomesByStrand[strand] || ['Demonstrates competency in foundational math concepts'];
    const outcome = outcomes[(i - 1) % outcomes.length];

    levels.push({
      levelNumber: i,
      strand,
      topic: `${strand.split(' ')[0]} - Phase ${Math.ceil(i / 10)}`,
      learningOutcome: outcome,
      classLevel,
      subLevels: {
        mastery: `Evaluates capability in ${outcome.toLowerCase()} under standard conditions.`,
        easier: `Simplified questions focusing on visual recognition and matching of ${outcome.toLowerCase()}.`,
        remedial: `Remedial intervention addressing fundamental prerequisite concepts for ${outcome.toLowerCase()}.`
      }
    });
  }

  return levels;
})();

export const INITIAL_SCHOOLS: any[] = [
  {
    id: 'gps-mt-001',
    name: 'Primary School, Mattewal-3',
    district: 'Ludhiana',
    block: 'Ludhiana Block-1',
    state: 'Punjab',
    type: 'standard',
    avgScore: 78,
    enrolledStudents: 142,
    certifiedStudents: 110,
    defaultingTeachersCount: 0
  },
  {
    id: 'gps-sh-002',
    name: 'Primary School, Sirhind-1',
    district: 'Bathinda',
    block: 'Bathinda Block-2',
    state: 'Punjab',
    type: 'standard',
    avgScore: 35,
    enrolledStudents: 18,
    certifiedStudents: 4,
    defaultingTeachersCount: 1
  },
  {
    id: 'gps-jp-003',
    name: 'Primary School, Jaipur Rural-5',
    district: 'Jaipur',
    block: 'Jaipur Block-A',
    state: 'Rajasthan',
    type: 'standard',
    avgScore: 71,
    enrolledStudents: 220,
    certifiedStudents: 140,
    defaultingTeachersCount: 0
  },
  {
    id: 'gps-ud-004',
    name: 'Primary School, Udaipur Tribal-2',
    district: 'Udaipur',
    block: 'Udaipur Block-B',
    state: 'Rajasthan',
    type: 'standard',
    avgScore: 32,
    enrolledStudents: 14,
    certifiedStudents: 2,
    defaultingTeachersCount: 2 // Defaulter lock
  }
];

export const INITIAL_CLASSES: any[] = [
  {
    id: 'cls-3b',
    name: 'Class 3B',
    grade: 3,
    averageScore: 72,
    studentCount: 6,
    generationLocked: false,
    conceptSuggestions: ['Multiplication Tables of 5 and 10', 'Measuring using ruler scale (cm)'],
  },
  {
    id: 'cls-2a',
    name: 'Class 2A',
    grade: 2,
    averageScore: 61,
    studentCount: 4,
    generationLocked: false,
    conceptSuggestions: ['Place Value (tens and ones)', 'Simple Subtraction within 20'],
  },
  {
    id: 'cls-4a',
    name: 'Class 4A',
    grade: 4,
    averageScore: 82,
    studentCount: 5,
    generationLocked: true, // Lock example
    lockedBy: 'School Principal (Priya Patel)',
    lockedAt: '2026-07-04 10:30 AM',
    conceptSuggestions: ['Fractions visual comparisons', 'Reading analog clocks'],
  }
];

export const INITIAL_STUDENTS: any[] = [
  // Class 3B (Teacher Aarav Gupta's class)
  {
    id: 'stu-001',
    name: 'Aarav Kumar',
    age: 8,
    gender: 'Boy',
    classNum: 3,
    level: 7, // Level 7
    status: 'On Track',
    score: 75,
    aadharMasked: 'XXXX-XXXX-4921',
    teacherId: 'gps-mt-001.t01@fln.org',
    schoolId: 'gps-mt-001',
    lastAssessed: '2026-07-04',
    history: [
      {
        id: 'h-01a',
        assessmentCycle: 'Baseline',
        date: '2026-07-04',
        score: 75,
        levelAssigned: 7,
        questions: [
          { qId: 'q-num-01', text: 'Write digit shown in base block', expectedAnswer: '4', studentAnswer: '4', isCorrect: true },
          { qId: 'q-num-02', text: 'Identify position on a number line 1-10', expectedAnswer: 'ones', studentAnswer: 'ones', isCorrect: true },
          { qId: 'q-op-01', text: 'Double digit addition without carrying', expectedAnswer: '19', studentAnswer: '19', isCorrect: true },
          { qId: 'q-op-02', text: 'Double digit subtraction without borrowing', expectedAnswer: '7', studentAnswer: '10', isCorrect: false },
          { qId: 'q-shape-01', text: 'Identify properties of a square', expectedAnswer: 'square', studentAnswer: 'square', isCorrect: true },
          { qId: 'q-pat-01', text: 'Complete counting skip pattern: 2, 4, 6, 8, __', expectedAnswer: '10', studentAnswer: '9', isCorrect: false }
        ],
        narrativeReport: 'Aarav shows great focus on basic numbers, but requires reinforcement in simple subtraction calculations and pattern deduction. Recommending skip counting activities.'
      }
    ]
  },
  {
    id: 'stu-002',
    name: 'Aisha Patel',
    age: 9,
    gender: 'Girl',
    classNum: 3,
    level: 15,
    status: 'Advanced',
    score: 88,
    aadharMasked: 'XXXX-XXXX-9831',
    teacherId: 'gps-mt-001.t01@fln.org',
    schoolId: 'gps-mt-001',
    lastAssessed: '2026-07-03',
    history: [
      {
        id: 'h-02a',
        assessmentCycle: 'Baseline',
        date: '2026-07-03',
        score: 88,
        levelAssigned: 15,
        questions: [
          { qId: 'q-num-01', text: 'Write digit shown in base block', expectedAnswer: '4', studentAnswer: '4', isCorrect: true },
          { qId: 'q-num-02', text: 'Identify position on a number line 1-10', expectedAnswer: 'ones', studentAnswer: 'ones', isCorrect: true },
          { qId: 'q-op-01', text: 'Double digit addition without carrying', expectedAnswer: '19', studentAnswer: '19', isCorrect: true },
          { qId: 'q-op-02', text: 'Double digit subtraction without borrowing', expectedAnswer: '7', studentAnswer: '7', isCorrect: true },
          { qId: 'q-shape-01', text: 'Identify properties of a square', expectedAnswer: 'square', studentAnswer: 'circle', isCorrect: false },
          { qId: 'q-pat-01', text: 'Complete counting skip pattern: 2, 4, 6, 8, __', expectedAnswer: '10', studentAnswer: '10', isCorrect: true }
        ],
        narrativeReport: 'Outstanding operational accuracy! Aisha demonstrates near-mastery of Grade 3 objectives, having successfully completed double-digit carries. She only missed a geometric query.'
      }
    ]
  },
  {
    id: 'stu-003',
    name: 'Simran Preet',
    age: 8,
    gender: 'Girl',
    classNum: 3,
    level: 4,
    status: 'At Risk',
    score: 52,
    aadharMasked: 'XXXX-XXXX-1120',
    teacherId: 'gps-mt-001.t01@fln.org',
    schoolId: 'gps-mt-001',
    lastAssessed: '2026-07-01',
    history: [
      {
        id: 'h-03a',
        assessmentCycle: 'Baseline',
        date: '2026-07-01',
        score: 52,
        levelAssigned: 4,
        questions: [
          { qId: 'q-num-01', text: 'Write digit shown in base block', expectedAnswer: '4', studentAnswer: '2', isCorrect: false },
          { qId: 'q-num-02', text: 'Identify position on a number line 1-10', expectedAnswer: 'ones', studentAnswer: 'tens', isCorrect: false },
          { qId: 'q-op-01', text: 'Double digit addition without carrying', expectedAnswer: '19', studentAnswer: '15', isCorrect: false },
          { qId: 'q-op-02', text: 'Double digit subtraction without borrowing', expectedAnswer: '7', studentAnswer: '7', isCorrect: true },
          { qId: 'q-shape-01', text: 'Identify properties of a square', expectedAnswer: 'square', studentAnswer: 'square', isCorrect: true },
          { qId: 'q-pat-01', text: 'Complete counting skip pattern: 2, 4, 6, 8, __', expectedAnswer: '10', studentAnswer: '10', isCorrect: true }
        ],
        narrativeReport: 'Simran struggles significantly with basic place value designations (confused ones & tens) and counting matches. Needs foundational level practice sheets.'
      }
    ]
  },
  {
    id: 'stu-004',
    name: 'Rohit Singh',
    age: 9,
    gender: 'Boy',
    classNum: 3,
    level: 2,
    status: 'Intervention',
    score: 38,
    aadharMasked: 'XXXX-XXXX-2831',
    teacherId: 'gps-mt-001.t01@fln.org',
    schoolId: 'gps-mt-001',
    lastAssessed: '2026-07-04',
    history: [
      {
        id: 'h-04a',
        assessmentCycle: 'Baseline',
        date: '2026-07-04',
        score: 38,
        levelAssigned: 2,
        questions: [
          { qId: 'q-num-01', text: 'Write digit shown in base block', expectedAnswer: '4', studentAnswer: '5', isCorrect: false },
          { qId: 'q-num-02', text: 'Identify position on a number line 1-10', expectedAnswer: 'ones', studentAnswer: 'tens', isCorrect: false },
          { qId: 'q-op-01', text: 'Double digit addition without carrying', expectedAnswer: '19', studentAnswer: '11', isCorrect: false },
          { qId: 'q-op-02', text: 'Double digit subtraction without borrowing', expectedAnswer: '7', studentAnswer: '2', isCorrect: false },
          { qId: 'q-shape-01', text: 'Identify properties of a square', expectedAnswer: 'square', studentAnswer: 'square', isCorrect: true },
          { qId: 'q-pat-01', text: 'Complete counting skip pattern: 2, 4, 6, 8, __', expectedAnswer: '10', studentAnswer: '10', isCorrect: true }
        ],
        narrativeReport: 'Critical foundational gaps in operation arithmetic. Rohit requires extensive block-based active material practice before skip-counting tests.'
      }
    ]
  },
  {
    id: 'stu-005',
    name: 'Kabir Mehta',
    age: 8,
    gender: 'Boy',
    classNum: 3,
    level: 1,
    status: 'New',
    score: 0,
    aadharMasked: 'XXXX-XXXX-5821',
    teacherId: 'gps-mt-001.t01@fln.org',
    schoolId: 'gps-mt-001',
    lastAssessed: 'N/A'
  },
  {
    id: 'stu-006',
    name: 'Meera Nair',
    age: 8,
    gender: 'Girl',
    classNum: 3,
    level: 1,
    status: 'New',
    score: 0,
    aadharMasked: 'XXXX-XXXX-1932',
    teacherId: 'gps-mt-001.t01@fln.org',
    schoolId: 'gps-mt-001',
    lastAssessed: 'N/A'
  },
  // Class 2A
  {
    id: 'stu-007',
    name: 'Yash Vardhan',
    age: 7,
    gender: 'Boy',
    classNum: 2,
    level: 4,
    status: 'On Track',
    score: 65,
    aadharMasked: 'XXXX-XXXX-7721',
    teacherId: 'gps-mt-001.t01@fln.org',
    schoolId: 'gps-mt-001',
    lastAssessed: '2026-06-30',
    history: [
      {
        id: 'h-07a',
        assessmentCycle: 'Baseline',
        date: '2026-06-30',
        score: 65,
        levelAssigned: 4,
        questions: [
          { qId: 'q-num-01', text: 'Write digit shown in base block', expectedAnswer: '4', studentAnswer: '4', isCorrect: true },
          { qId: 'q-num-02', text: 'Identify position on a number line 1-10', expectedAnswer: 'ones', studentAnswer: 'ones', isCorrect: true },
          { qId: 'q-op-01', text: 'Double digit addition without carrying', expectedAnswer: '19', studentAnswer: '12', isCorrect: false },
          { qId: 'q-op-02', text: 'Double digit subtraction without borrowing', expectedAnswer: '7', studentAnswer: '7', isCorrect: true },
          { qId: 'q-shape-01', text: 'Identify properties of a square', expectedAnswer: 'square', studentAnswer: 'circle', isCorrect: false }
        ],
        narrativeReport: 'Yash has general understanding but requires visual guides for spatial shapes and geometric properties.'
      }
    ]
  },
  {
    id: 'stu-008',
    name: 'Diya Sharma',
    age: 7,
    gender: 'Girl',
    classNum: 2,
    level: 8,
    status: 'Advanced',
    score: 84,
    aadharMasked: 'XXXX-XXXX-3382',
    teacherId: 'gps-mt-001.t01@fln.org',
    schoolId: 'gps-mt-001',
    lastAssessed: '2026-07-02',
    history: [
      {
        id: 'h-08a',
        assessmentCycle: 'Baseline',
        date: '2026-07-02',
        score: 84,
        levelAssigned: 8,
        questions: [
          { qId: 'q-num-01', text: 'Write digit shown in base block', expectedAnswer: '4', studentAnswer: '4', isCorrect: true },
          { qId: 'q-num-02', text: 'Identify position on a number line 1-10', expectedAnswer: 'ones', studentAnswer: 'ones', isCorrect: true },
          { qId: 'q-op-01', text: 'Double digit addition without carrying', expectedAnswer: '19', studentAnswer: '19', isCorrect: true },
          { qId: 'q-op-02', text: 'Double digit subtraction without borrowing', expectedAnswer: '7', studentAnswer: '7', isCorrect: true },
          { qId: 'q-shape-01', text: 'Identify properties of a square', expectedAnswer: 'square', studentAnswer: 'circle', isCorrect: false }
        ],
        narrativeReport: 'Excellent capability in calculations! Diya is eager and performs operations quickly and cleanly.'
      }
    ]
  }
];

export const INITIAL_ANNOUNCEMENTS: any[] = [
  {
    id: 'ann-001',
    title: 'Baseline Assessment Cycle Set to Start on July 10, 2026',
    body: 'Attention all School Principals and Teachers: The fixed Baseline Assessment Cycle for academic year 2026-27 will officially open on July 10, 2026. Make sure all class student rosters are fully updated and verified prior to generation.',
    urgency: 'high',
    postedAt: '2026-07-04 09:00 AM',
    emailEscalation: true
  },
  {
    id: 'ann-002',
    title: 'Revised Standard SVG Asset Library Released',
    body: 'The central curriculum team has completed the annual visual style refresh. The category-based SVG asset library now includes 150+ child-friendly, high-contrast monochrome line arts. If a generation task requests a missing illustration, same-category substitution will handle it automatically.',
    urgency: 'medium',
    postedAt: '2026-07-02 02:00 PM',
    emailEscalation: false
  },
  {
    id: 'ann-003',
    title: 'FLN Numeracy Benchmark Standards Updated',
    body: 'Revised NCERT-aligned sub-level descriptions have been populated for FLN levels 1 to 93. No action required; the auto-level evaluation pipeline incorporates these immediately.',
    urgency: 'low',
    postedAt: '2026-06-28 11:30 AM',
    emailEscalation: false
  }
];

export const INITIAL_TICKETS: any[] = [
  {
    id: 'tkt-101',
    title: 'Inconsistency in Level 12 Shapes categorization',
    description: 'The learning outcomes in Level 12 description seem to suggest 3D shapes, but some worksheets include basic 2D triangles. Please review if it maps to Level 11 shape prerequisites instead.',
    type: 'curriculum',
    status: 'open',
    submittedBy: 'Aarav Gupta (Teacher)',
    role: 'teacher',
    submittedAt: '2026-07-04 04:30 PM'
  },
  {
    id: 'tkt-102',
    title: 'Delayed attempt false alarm warning',
    description: 'Due to severe power outages on July 3,Mattewal-3 submitted scans 10 minutes past the submission window. We received a delayed attempt alert. Can this be whitelisted?',
    type: 'process',
    status: 'in-progress',
    submittedBy: 'Priya Patel (Principal)',
    role: 'school',
    submittedAt: '2026-07-03 06:15 PM'
  },
  {
    id: 'tkt-103',
    title: 'Missing regional coin SVG for Money strand',
    description: 'We require standard regional currency line illustrations for Punjab local worksheets. Category-based fallback is currently using general rupee coin vectors.',
    type: 'content',
    status: 'resolved',
    submittedBy: 'Rajesh Sharma (State Admin)',
    role: 'admin',
    submittedAt: '2026-06-25 10:00 AM'
  }
];

export const INITIAL_NOTIFICATIONS: any[] = [
  {
    id: 'notif-001',
    title: 'Urgent Announcement',
    message: 'Baseline Assessment Cycle officially starts July 10, 2026.',
    type: 'announcement',
    date: '2026-07-04',
    read: false
  },
  {
    id: 'notif-002',
    title: 'Delayed Attempt Warning',
    message: 'Mattewal-3 Class 3B logged 1 delayed attempt. You have 2 attempts remaining.',
    type: 'delayed',
    date: '2026-07-03',
    read: false
  },
  {
    id: 'notif-003',
    title: 'Evaluation Complete',
    message: 'Student Aarav Kumar evaluated successfully. Placed at Level 7.',
    type: 'evaluation',
    date: '2026-07-04',
    read: true
  }
];

export const MOCK_QUESTIONS_BANK = [
  {
    id: 'q-num-01',
    text: 'How many triangles are there in the box? Count them and write the number.',
    expectedAnswer: '4',
    strand: 'Number Sense (One-to-One Correspondence)',
    level: 4,
    illustration: 'triangle_group_4.svg',
    difficulty: 'easy'
  },
  {
    id: 'q-num-02',
    text: 'Write the place value of the underlined digit: 4_3_ (tens or ones?)',
    expectedAnswer: 'tens',
    strand: 'Number Sense (One-to-One Correspondence)',
    level: 7,
    illustration: 'tens_ones_blocks.svg',
    difficulty: 'medium'
  },
  {
    id: 'q-op-01',
    text: 'Solve: 14 + 5 = ?',
    expectedAnswer: '19',
    strand: 'Number Operations',
    level: 15,
    illustration: 'apple_addition_group.svg',
    difficulty: 'easy'
  },
  {
    id: 'q-op-02',
    text: 'If there are 3 birds on one branch and 5 birds on another branch, how many birds are there in total?',
    expectedAnswer: '8',
    strand: 'Number Operations',
    level: 7,
    illustration: 'birds_branch.svg',
    difficulty: 'medium'
  },
  {
    id: 'q-shape-01',
    text: 'Which shape has 4 equal sides and 4 corners?',
    expectedAnswer: 'square',
    strand: 'Shapes',
    level: 3,
    illustration: 'shapes_geometric.svg',
    difficulty: 'easy'
  },
  {
    id: 'q-pat-01',
    text: 'Complete the pattern: 2, 4, 6, 8, __',
    expectedAnswer: '10',
    strand: 'Patterns',
    level: 10,
    illustration: 'numbers_pattern.svg',
    difficulty: 'medium'
  }
];

export const INITIAL_LOGS: any[] = [
  {
    id: 'log-001',
    time: '2026-07-06 09:30 AM',
    type: 'Core Security',
    details: 'Global parameter synchronization finalized for National Database.',
    level: 'superadmin'
  },
  {
    id: 'log-002',
    time: '2026-07-05 04:00 PM',
    type: 'Access Review',
    details: 'Security credentials audit completed for 28 state admins.',
    level: 'superadmin'
  },
  {
    id: 'log-003',
    time: '2026-07-05 11:15 AM',
    type: 'State Allocation',
    details: 'Resource allocation limits whitelisted for Ludhiana and Amritsar blocks.',
    level: 'admin',
    scope: 'Punjab'
  },
  {
    id: 'log-004',
    time: '2026-07-04 02:00 PM',
    type: 'Baseline Schedule',
    details: 'Punjab state FLN testing schedule approved.',
    level: 'admin',
    scope: 'Punjab'
  },
  {
    id: 'log-005',
    time: '2026-07-05 03:20 PM',
    type: 'District Sync',
    details: 'Ingestion status reports aggregated for Amritsar district.',
    level: 'district_admin',
    scope: 'Amritsar'
  },
  {
    id: 'log-006',
    time: '2026-07-04 05:00 PM',
    type: 'District Rank Update',
    details: 'District-wide class 3 and 4 score matrices updated.',
    level: 'district_admin',
    scope: 'Ludhiana'
  },
  {
    id: 'log-007',
    time: '2026-07-05 01:10 PM',
    type: 'Block Inspection',
    details: 'Manual inspection scheduled for 4 schools with low scores.',
    level: 'block_admin',
    scope: 'Sirhind'
  },
  {
    id: 'log-008',
    time: '2026-07-04 10:45 AM',
    type: 'Volunteer Registration',
    details: 'Approved registration for 3 new student mentors in Mattewal block.',
    level: 'block_admin',
    scope: 'Mattewal'
  },
  {
    id: 'log-009',
    time: '2026-07-05 09:15 AM',
    type: 'School Roll Call',
    details: 'All class registers synchronized for GPS Mattewal-3.',
    level: 'school',
    scope: 'gps-mt-001'
  },
  {
    id: 'log-010',
    time: '2026-07-04 11:30 AM',
    type: 'Lock Applied',
    details: 'Class 4A testing results frozen by School Principal.',
    level: 'school',
    scope: 'gps-mt-001'
  },
  {
    id: 'log-011',
    time: '2026-07-05 10:15 AM',
    type: 'ICR Ingest',
    details: 'Evaluated Class 3B answer sheets and pushed to student history logs.',
    level: 'teacher',
    scope: 'gps-mt-001'
  },
  {
    id: 'log-012',
    time: '2026-07-04 03:40 PM',
    type: 'Exam Created',
    details: 'New practice assessment sheets published for 2D Shapes recognition.',
    level: 'teacher',
    scope: 'gps-mt-001'
  },
  {
    id: 'log-013',
    time: '2026-07-05 08:30 AM',
    type: 'Worksheets Printed',
    details: 'Offline diagnostic materials printed for Sirhind school.',
    level: 'volunteer',
    scope: 'gps-sh-002'
  },
  {
    id: 'log-014',
    time: '2026-07-04 11:30 AM',
    type: 'Student Enrolled',
    details: 'Collected and enrolled details for Aarav Gupta with masked Aadhar.',
    level: 'volunteer',
    scope: 'gps-mt-001'
  }
];

