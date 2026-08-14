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
  KMR: 'Kamrup', NGN: 'Nagaon', PTN: 'Patna', GYA: 'Gaya',
  RPR: 'Raipur', BSP: 'Bilaspur', NGO: 'North Goa', SGO: 'South Goa',
  AMD: 'Ahmedabad', SRT: 'Surat',
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
  RNC: 'Ranchi', DHD: 'Dhanbad',
  BNG: 'Bangalore', MYS: 'Mysore', TVM: 'Thiruvananthapuram', EKM: 'Ernakulam',
  BPL: 'Bhopal', IND: 'Indore', MUM: 'Mumbai', PUN: 'Pune',
  IMW: 'Imphal West', IME: 'Imphal East', EKH: 'East Khasi Hills', WJH: 'West Jaintia Hills',
  AIZ: 'Aizawl', CMP: 'Champhai', KOH: 'Kohima', DIM: 'Dimapur',
  BBS: 'Bhubaneswar', CTC: 'Cuttack',
  ASR: 'Amritsar', BNL: 'Barnala', BTH: 'Bathinda', FDK: 'Faridkot', FGS: 'Fatehgarh Sahib',
  FZK: 'Fazilka', FZP: 'Ferozepur', GSP: 'Gurdaspur', HSP: 'Hoshiarpur', JAL: 'Jalandhar',
  KPT: 'Kapurthala', LDH: 'Ludhiana', MLK: 'Malerkotla', MNS: 'Mansa', MOG: 'Moga',
  PTK: 'Pathankot', PAT: 'Patiala', RUP: 'Rupnagar', SAS: 'SAS Nagar (Mohali)',
  SBS: 'SBS Nagar (Nawanshahr)', MKS: 'Sri Muktsar Sahib', SNG: 'Sangrur', TTN: 'Tarn Taran',
  JAI: 'Jaipur', JDP: 'Jodhpur', ESK: 'East Sikkim', WSK: 'West Sikkim',
  CHN: 'Chennai', CBE: 'Coimbatore', HYD: 'Hyderabad', WGL: 'Warangal',
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
  SRN_BR: 'Saran', SKP: 'Sheikhpura', SHH: 'Sheohar', STM: 'Sitamarhi', SWN: 'Siwan',
  SPL: 'Supaul', VSH: 'Vaishali', WCM: 'West Champaran',
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
  'PTN_01': 'Patna Block 1', 'PTN_02': 'Patna Block 2',
  'GYA_01': 'Gaya Block 1', 'GYA_02': 'Gaya Block 2',
  'RPR_01': 'Raipur Block 1', 'RPR_02': 'Raipur Block 2',
  'BSP_01': 'Bilaspur Block 1', 'BSP_02': 'Bilaspur Block 2',
  'NGO_01': 'North Goa Block 1', 'NGO_02': 'North Goa Block 2',
  'SGO_01': 'South Goa Block 1', 'SGO_02': 'South Goa Block 2',
  'AMD_01': 'Ahmedabad Block 1', 'AMD_02': 'Ahmedabad Block 2',
  'SRT_01': 'Surat Block 1', 'SRT_02': 'Surat Block 2',
  'RNC_01': 'Ranchi Block 1', 'RNC_02': 'Ranchi Block 2',
  'DHD_01': 'Dhanbad Block 1', 'DHD_02': 'Dhanbad Block 2',
  'BNG_01': 'Bangalore Block 1', 'BNG_02': 'Bangalore Block 2',
  'MYS_01': 'Mysore Block 1', 'MYS_02': 'Mysore Block 2',
  'TVM_01': 'Thiruvananthapuram Block 1', 'TVM_02': 'Thiruvananthapuram Block 2',
  'EKM_01': 'Ernakulam Block 1', 'EKM_02': 'Ernakulam Block 2',
  'BPL_01': 'Bhopal Block 1', 'BPL_02': 'Bhopal Block 2',
  'IND_01': 'Indore Block 1', 'IND_02': 'Indore Block 2',
  'MUM_01': 'Mumbai Block 1', 'MUM_02': 'Mumbai Block 2',
  'PUN_01': 'Pune Block 1', 'PUN_02': 'Pune Block 2',
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
  'WCM_01': 'Bagaha I Block', 'WCM_02': 'Bagaha II Block', 'WCM_03': 'Bairia Block', 'WCM_04': 'Bettiah Block', 'WCM_05': 'Bhitaha Block', 'WCM_06': 'Chanpatia Block', 'WCM_07': 'Gaunaha Block', 'WCM_08': 'Jogapatti Block', 'WCM_09': 'Lauriya Block', 'WCM_10': 'Madhubani Block', 'WCM_11': 'Mainatand Block', 'WCM_12': 'Majhaulia Block', 'WCM_13': 'Narkatiaganj Block', 'WCM_14': 'Nautan Block', 'WCM_15': 'Piprasi Block', 'WCM_16': 'Ramnagar Block', 'WCM_17': 'Sikta Block', 'WCM_18': 'Thakaraha Block',
  'KOL_01': 'Kolkata Block 1', 'KOL_02': 'Kolkata Block 2',
  'HWH_01': 'Howrah Block 1', 'HWH_02': 'Howrah Block 2',
  'SAN_01': 'South Andaman Block 1', 'SAN_02': 'South Andaman Block 2',
  'NMA_01': 'North and Middle Andaman Block 1', 'NMA_02': 'North and Middle Andaman Block 2',
  'CHU_01': 'Chandigarh Urban Block 1', 'CHU_02': 'Chandigarh Urban Block 2',
  'CHR_01': 'Chandigarh Rural Block 1', 'CHR_02': 'Chandigarh Rural Block 2',
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

