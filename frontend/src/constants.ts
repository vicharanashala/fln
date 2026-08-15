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
  // Andhra Pradesh (AP) - All 26 Reorganized Districts
  ASR_AP: 'Alluri Sitharama Raju', AKP: 'Anakapalli', ATP: 'Ananthapuramu', ANN: 'Annamayya',
  BPT: 'Bapatla', CTR_AP: 'Chittoor', KNS: 'Dr. B.R. Ambedkar Konaseema', EGD: 'East Godavari',
  ELR: 'Eluru', GNT: 'Guntur', KKD_AP: 'Kakinada', KRI: 'Krishna',
  KRN: 'Kurnool', NDL: 'Nandyal', NTR: 'NTR / Vijayawada', PLN: 'Palnadu',
  PVM: 'Parvathipuram Manyam', PRK: 'Prakasam', NLR: 'Sri Potti Sriramulu Nellore', SSS: 'Sri Sathya Sai',
  SKL: 'Srikakulam', TPT: 'Tirupati', VSP: 'Visakhapatnam', VZM: 'Vizianagaram',
  WGD: 'West Godavari', YSR: 'YSR Kadapa',
  // Telangana (TS) - All 33 Official Districts
  ADB: 'Adilabad', BDK_TS: 'Bhadradri Kothagudem', HNK: 'Hanamkonda', HYD: 'Hyderabad',
  JGT: 'Jagtial', JNG: 'Jangaon', JSB: 'Jayashankar Bhupalpally', JGL: 'Jogulamba Gadwal',
  KMR_TS: 'Kamareddy', KRM_TS: 'Karimnagar', KHM: 'Khammam', KBA_TS: 'Kumuram Bheem Asifabad',
  MHBD: 'Mahabubabad', MBN: 'Mahabubnagar', MCL: 'Mancherial', MDK: 'Medak',
  MDM: 'Medchal-Malkajgiri', MLG: 'Mulugu', NGK: 'Nagarkurnool', NLG_TS: 'Nalgonda',
  NPT: 'Narayanpet', NRM_TS: 'Nirmal', NZB: 'Nizamabad', PDL: 'Peddapalli',
  RSC: 'Rajanna Sircilla', RRD: 'Ranga Reddy', SGR_TS: 'Sangareddy', SDP: 'Siddipet',
  SRY: 'Suryapet', VKB: 'Vikarabad', WNP: 'Wanaparthy', WRG: 'Warangal',
  YDB: 'Yadadri Bhuvanagiri',
  // Assam (AS) - All 35 Official Districts
  BJL: 'Bajali', BKS: 'Baksa', BRP: 'Barpeta', BSW_AS: 'Biswanath', BNG_AS: 'Bongaigaon',
  CCH: 'Cachar', CRD: 'Charaideo', CRG: 'Chirang', DRG_AS: 'Darrang', DMJ: 'Dhemaji',
  DHB: 'Dhubri', DBR: 'Dibrugarh', DMH_AS: 'Dima Hasao', GLP: 'Goalpara', GLT: 'Golaghat',
  HLK: 'Hailakandi', HOJ: 'Hojai', JRH: 'Jorhat', KRM: 'Kamrup Metropolitan', KRR_AS: 'Kamrup Rural',
  KBA: 'Karbi Anglong', KMG: 'Karimganj', KKR_AS: 'Kokrajhar', LKP_AS: 'Lakhimpur', MJL: 'Majuli',
  MRG: 'Morigaon', NGN: 'Nagaon', NLB: 'Nalbari', SVS: 'Sivasagar', SNT: 'Sonitpur',
  SSM: 'South Salmara-Mankachar', TMP: 'Tamulpur', TSK: 'Tinsukia', UDL: 'Udalguri', WKA: 'West Karbi Anglong',
  // Chhattisgarh (CG) - All 33 Official Districts
  BLD_CG: 'Balod', BDB: 'Baloda Bazar', BLR_CG: 'Balrampur', BST_CG: 'Bastar', BMT: 'Bemetara',
  BJP: 'Bijapur', BLP_CG: 'Bilaspur', DTW: 'Dantewada / South Bastar', DHM: 'Dhamtari', DRG: 'Durg',
  GRB: 'Gariaband', GPM: 'Gaurela-Pendra-Marwahi', JJC: 'Janjgir-Champa', JSP_CG: 'Jashpur', KBD: 'Kabirdham / Kawardha',
  KNK: 'Kanker / North Bastar', KCG: 'Khairagarh-Chhuikhadan-Gandai', KDG_CG: 'Kondagaon', KRB: 'Korba', KRY: 'Koriya',
  MSM: 'Mahasamund', MCB: 'Manendragarh-Chirmiri-Bharatpur', MMA: 'Mohla-Manpur-Ambagarh Chowki', MGL: 'Mungeli', NRP: 'Narayanpur',
  RGH: 'Raigarh', RPR: 'Raipur', RJN: 'Rajnandgaon', SKT: 'Sakti', SGB: 'Sarangarh-Bilaigarh',
  SKM: 'Sukma', SRJ: 'Surajpur', SRG: 'Surguja',
  GYA: 'Gaya', NGO: 'North Goa', SGO: 'South Goa',
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
  // Maharashtra (MH) - All 36 Official Districts
  AHM_MH: 'Ahmednagar / Ahilyanagar', AKL: 'Akola', AMR_MH: 'Amravati', CSN: 'Chhatrapati Sambhaji Nagar', BED: 'Beed',
  BHD_MH: 'Bhandara', BLD: 'Buldhana', CHD: 'Chandrapur', DHL: 'Dhule', GDC: 'Gadchiroli',
  GND_MH: 'Gondia', HNG: 'Hingoli', JLG: 'Jalgaon', JLN_MH: 'Jalna', KLP_MH: 'Kolhapur',
  LTR: 'Latur', MMC: 'Mumbai City', MMS: 'Mumbai Suburban', NGP: 'Nagpur', NND: 'Nanded',
  NDB: 'Nandurbar', NSK: 'Nashik', DHR_MH: 'Dharashiv / Osmanabad', PLG: 'Palghar', PBN: 'Parbhani',
  RGD: 'Raigad', RTN: 'Ratnagiri', SGL: 'Sangli', STR: 'Satara',
  SND: 'Sindhudurg', SLP: 'Solapur', THN: 'Thane', WRD: 'Wardha', WSM: 'Washim', YTL: 'Yavatmal',
  // Manipur (MN) - All 16 Districts
  BSP: 'Bishnupur', CDL: 'Chandel', CCP: 'Churachandpur', IE: 'Imphal East', IW: 'Imphal West', JRB: 'Jiribam', KCG_MN: 'Kakching', KMJ: 'Kamjong', KPI: 'Kangpokpi', NNY: 'Noney', PZL: 'Pherzawl', SPT: 'Senapati', TML: 'Tamenglong', TNP: 'Tengnoupal', THB: 'Thoubal', UKR: 'Ukhrul',
  // Meghalaya (ML) - All 12 Districts
  EWK: 'Eastern West Khasi Hills', EGH: 'East Garo Hills', EJH: 'East Jaintia Hills', EKH: 'East Khasi Hills', NGH: 'North Garo Hills', RBH: 'Ri-Bhoi', SGH: 'South Garo Hills', SWG: 'South West Garo Hills', SWK: 'South West Khasi Hills', WGH: 'West Garo Hills', WJH: 'West Jaintia Hills', WKH: 'West Khasi Hills',
  // Mizoram (MZ) - All 11 Districts
  AZL: 'Aizawl', CMP: 'Champhai', HNT: 'Hnahthial', KWZ: 'Khawzawl', KLB_MZ: 'Kolasib', LTL: 'Lawngtlai', LGL: 'Lunglei', MMT: 'Mamit', STL: 'Saitual', SRC: 'Serchhip', SIH: 'Siaha',
  // Nagaland (NL) - All 16 Districts
  CKM_NL: 'Chümoukedima', DMP: 'Dimapur', KPH: 'Kiphire', KHM_NL: 'Kohima', LLG: 'Longleng', MKC: 'Mokokchung', MON: 'Mon', NLD: 'Niuland', NKL: 'Noklak', PRN: 'Peren', PHK: 'Phek', SMT_NL: 'Shamator', TSM: 'Tseminyu', TSG: 'Tuensang', WKH_NL: 'Wokha', ZHB: 'Zunheboto',
  // Tripura (TR) - All 8 Districts
  DHL_TR: 'Dhalai', GMT: 'Gomati', KHW: 'Khowai', NTR_TR: 'North Tripura', SPH: 'Sepahijala', STR_TR: 'South Tripura', UNK: 'Unakoti', WTR: 'West Tripura',
  // Sikkim (SK) - All 6 Districts
  GTK: 'Gangtok', GYL: 'Gyalshing', MGN: 'Mangan', NMC_SK: 'Namchi', PKY: 'Pakyong', SRG_SK: 'Soreng',
  // Arunachal Pradesh (AR) - All 27 Districts
  AJW: 'Anjaw', CHG: 'Changlang', DBV: 'Dibang Valley', EKM_AR: 'East Kameng', ESG: 'East Siang', KML: 'Kamle', KRD_AR: 'Kra Daadi', KRK: 'Kurung Kumey', LPD: 'Leparada', LHT: 'Lohit', LDG: 'Longding', LDV: 'Lower Dibang Valley', LWS: 'Lower Siang', LSS: 'Lower Subansiri', NMS: 'Namsai', PKK: 'Pakke Kessang', PPP: 'Papum Pare', SYM: 'Shi Yomi', SNG_AR: 'Siang', TWG: 'Tawang', TRP: 'Tirap', UPS: 'Upper Siang', USS: 'Upper Subansiri', WKM: 'West Kameng', WSG: 'West Siang', ICC: 'Itanagar Capital Complex',
  // Jharkhand (JH) - All 24 Official Districts
  BKO: 'Bokaro', CTR: 'Chatra', DGR: 'Deoghar', DHN: 'Dhanbad', DMK: 'Dumka',
  ESB: 'East Singhbhum', GRH: 'Garhwa', GRD: 'Giridih', GDD: 'Godda', GML: 'Gumla',
  HZB: 'Hazaribagh', JMT: 'Jamtara', KHT_JH: 'Khunti', KOD: 'Koderma', LTH: 'Latehar',
  LHD: 'Lohardaga', PKR: 'Pakur', PLM: 'Palamu', RMG: 'Ramgarh', RNC: 'Ranchi',
  SBG: 'Sahibganj', SKR_JH: 'Seraikela Kharsawan', SMD: 'Simdega', WSB: 'West Singhbhum',
  // Karnataka (KA) - All 31 Official Districts
  BGK: 'Bagalkote', BLR_KA: 'Ballari', BLG_KA: 'Belagavi', BGR: 'Bengaluru Rural', BGU: 'Bengaluru Urban',
  BDR: 'Bidar', CRN: 'Chamarajanagara', CKB: 'Chikkaballapura', CKM: 'Chikkamagaluru', CTA: 'Chitradurga',
  DKN: 'Dakshina Kannada', DVG: 'Davanagere', DHW: 'Dharwad', GDG: 'Gadag', HSN: 'Hassan',
  HVR: 'Haveri', KLB: 'Kalaburagi', KDG: 'Kodagu', KLR: 'Kolar', KPL: 'Koppal',
  MDY: 'Mandya', MYS: 'Mysuru', RCR: 'Raichur', RMN: 'Ramanagara', SHM: 'Shivamogga',
  TMK: 'Tumakuru', UDP_KA: 'Udupi', UKN: 'Uttara Kannada', VJN: 'Vijayanagara', VJP: 'Vijayapura', YDG: 'Yadgir',
  // Kerala (KL) - All 14 Official Districts
  ALP: 'Alappuzha', EKM: 'Ernakulam', IDK: 'Idukki', KNR_KL: 'Kannur', KSG_KL: 'Kasaragod',
  KLM: 'Kollam', KTM: 'Kottayam', KKD: 'Kozhikode', MLP: 'Malappuram', PLK: 'Palakkad',
  PTA: 'Pathanamthitta', TVM_KL: 'Thiruvananthapuram', TSR: 'Thrissur', WYD: 'Wayanad',
  // Odisha (OD) - All 30 Official Districts
  ANG: 'Angul', BLG_OD: 'Balangir', BLS_OD: 'Balasore', BRG: 'Bargarh', BDK: 'Bhadrak',
  BDH: 'Boudh', CTC: 'Cuttack', DGH: 'Deoghar', DNK: 'Dhenkanal', GJP: 'Gajapati',
  GNJ: 'Ganjam', JSP: 'Jagatsinghpur', JJP: 'Jajpur', JSG: 'Jharsuguda', KLH: 'Kalahandi',
  KND: 'Kandhamal', KNP_OD: 'Kendrapara', KJR: 'Kendujhar / Keonjhar', KRD: 'Khordha', KPT_OD: 'Koraput',
  MLK_OD: 'Malkangiri', MBJ: 'Mayurbhanj', NBP: 'Nabarangpur', NYG: 'Nayagarh', NPD: 'Nuapada',
  PRI: 'Puri', RYG: 'Rayagada', SBP: 'Sambalpur', SBP_OD: 'Subarnapur / Sonepur', SNG_OD: 'Sundargarh',
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
  // Bihar (BR) - 38 Official Districts
  ARA: 'Araria', ARW: 'Arwal', AUR_BR: 'Aurangabad', BNK: 'Banka', BGS: 'Begusarai',
  BGP_BR: 'Bhagalpur', BHP: 'Bhojpur', BXR: 'Buxar', DBG: 'Darbhanga', ECM: 'East Champaran',
  GAY: 'Gaya', GPL: 'Gopalganj', JMU: 'Jamui', JHD: 'Jehanabad', KMR_BR: 'Kaimur',
  KTR: 'Katihar', KHG: 'Khagaria', KSG_BR: 'Kishanganj', LKS: 'Lakhisarai', MDP: 'Madhepura',
  MDB: 'Madhubani', MNG: 'Munger', MUZ: 'Muzaffarpur', NAL: 'Nalanda', NWD: 'Nawada',
  PAT_BR: 'Patna', PUR: 'Purnia', RHT: 'Rohtas', SHS: 'Saharsa', SMT: 'Samastipur',
  SRN: 'Saran', SKP: 'Sheikhpura', SHH: 'Sheohar', STM: 'Sitamarhi', SWN: 'Siwan',
  SPL: 'Supaul', VSH: 'Vaishali', WCM: 'West Champaran',
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
  // Goa (GA) - 2 Districts
  NG: 'North Goa', SG: 'South Goa',
  // Jammu & Kashmir (JK) - 20 Districts
  ANT: 'Anantnag', BND_JK: 'Bandipora', BRM: 'Baramulla', BDG: 'Budgam', DOD: 'Doda', GBL: 'Ganderbal', JMU_JK: 'Jammu', KTH: 'Kathua', KST: 'Kishtwar', KLG: 'Kulgam', KPW: 'Kupwara', PCH: 'Poonch', PLW_JK: 'Pulwama', RJR: 'Rajouri', RBN: 'Ramban', RSI: 'Reasi', SMB_JK: 'Samba', SHP_JK: 'Shopian', SRN_JK: 'Srinagar', UDH: 'Udhampur',
  // Ladakh (LA) - 2 Districts
  LEH: 'Leh', KGL: 'Kargil',
  // Puducherry (PY) - 4 Districts
  PDY: 'Puducherry', KRK_PY: 'Karaikal', MAH: 'Mahe', YAN: 'Yanam',
  // Andaman & Nicobar Islands (AN) - 3 Districts
  NIC: 'Nicobars', NMA: 'North and Middle Andaman', SAN: 'South Andaman',
  // Dadra & Nagar Haveli and Daman & Diu (DNHDD) - 3 Districts
  DNH: 'Dadra and Nagar Haveli', DMN: 'Daman', DIU: 'Diu',
  // Lakshadweep (LD) - 1 District
  LKD: 'Lakshadweep',
  // Chandigarh (CH) - 1 District
  CHD_UT: 'Chandigarh',
  // Delhi (DL) - 11 Revenue Districts
  CDL_DL: 'Central Delhi', EDL: 'East Delhi', NDL_DL: 'New Delhi', NDL_NORTH: 'North Delhi', NED: 'North East Delhi', NWD_DL: 'North West Delhi', SHD_DL: 'Shahdara', SDL: 'South Delhi', SED: 'South East Delhi', SWD: 'South West Delhi', WDL: 'West Delhi',
};

export const BLOCK_NAMES: Record<string, string> = {
  // --- ANDHRA PRADESH (AP) 679 MANDALS ACROSS 26 REORGANIZED DISTRICTS ---
  'ASR_AP_01': 'Addateegala Block', 'ASR_AP_02': 'Ananthagiri Block', 'ASR_AP_03': 'Araku Valley Block', 'ASR_AP_04': 'Chintapalle Block', 'ASR_AP_05': 'Chintoor Block', 'ASR_AP_06': 'Devipatnam Block', 'ASR_AP_07': 'Dumbriguda Block', 'ASR_AP_08': 'G.Madugula Block', 'ASR_AP_09': 'G.K.Veedhi Block', 'ASR_AP_10': 'Gangavaram Block', 'ASR_AP_11': 'Hukumpeta Block', 'ASR_AP_12': 'Koyyuru Block', 'ASR_AP_13': 'Kunavaram Block', 'ASR_AP_14': 'Maredumilli Block', 'ASR_AP_15': 'Munchingi Puttu Block', 'ASR_AP_16': 'Paderu Block', 'ASR_AP_17': 'Pedabayalu Block', 'ASR_AP_18': 'Rajavommangi Block', 'ASR_AP_19': 'Rampachodavaram Block', 'ASR_AP_20': 'Vararamachandrapuram Block', 'ASR_AP_21': 'Y.Ramavaram Block', 'ASR_AP_22': 'Nellipaka Block',

  'AKP_01': 'Anakapalli Block', 'AKP_02': 'Atchutapuram Block', 'AKP_03': 'Butchayyapeta Block', 'AKP_04': 'Cheedikada Block', 'AKP_05': 'Chodavaram Block', 'AKP_06': 'Devarapalle Block', 'AKP_07': 'Elamanchili Block', 'AKP_08': 'Golugonda Block', 'AKP_09': 'K.Kotapadu Block', 'AKP_10': 'Kasimkota Block', 'AKP_11': 'Kotauratla Block', 'AKP_12': 'Madugula Block', 'AKP_13': 'Makavarapalem Block', 'AKP_14': 'Munagapaka Block', 'AKP_15': 'Nakkapalle Block', 'AKP_16': 'Narsipatnam Block', 'AKP_17': 'Nathavaram Block', 'AKP_18': 'Parawada Block', 'AKP_19': 'Payakaraopeta Block', 'AKP_20': 'Rambilli Block', 'AKP_21': 'Ravikamatham Block', 'AKP_22': 'Rolugunta Block', 'AKP_23': 'S.Rayavaram Block', 'AKP_24': 'Sabbavaram Block',

  'ATP_01': 'Anantapur Block', 'ATP_02': 'Atmakur Block', 'ATP_03': 'Beluguppa Block', 'ATP_04': 'Bikkanuru / Bommanahal Block', 'ATP_05': 'Brahmasamudram Block', 'ATP_06': 'Bukkaraya Samudram Block', 'ATP_07': 'D.Hirehal Block', 'ATP_08': 'Garladinne Block', 'ATP_09': 'Gooty Block', 'ATP_10': 'Gummagatta Block', 'ATP_11': 'Guntakal Block', 'ATP_12': 'Kalyandurg Block', 'ATP_13': 'Kambadur Block', 'ATP_14': 'Kanekal Block', 'ATP_15': 'Kudair Block', 'ATP_16': 'Kundurpi Block', 'ATP_17': 'Narpala Block', 'ATP_18': 'Pamidi Block', 'ATP_19': 'Peddapappur Block', 'ATP_20': 'Peddavadugur Block', 'ATP_21': 'Putlur Block', 'ATP_22': 'Raptadu Block', 'ATP_23': 'Rayadurg Block', 'ATP_24': 'Settur Block', 'ATP_25': 'Singanamala Block', 'ATP_26': 'Tadpatri Block', 'ATP_27': 'Uravakonda Block', 'ATP_28': 'Vajrakarur Block', 'ATP_29': 'Vidapanakal Block', 'ATP_30': 'Yadiki Block', 'ATP_31': 'Yellanur Block',

  'ANN_01': 'B.Kothakota Block', 'ANN_02': 'Chinnamandem Block', 'ANN_03': 'Galiveedu Block', 'ANN_04': 'Gurramkonda Block', 'ANN_05': 'Kalakada Block', 'ANN_06': 'Kalikiri Block', 'ANN_07': 'Kambhamvaripalle Block', 'ANN_08': 'Kurabalakota Block', 'ANN_09': 'Lakkireddipalle Block', 'ANN_10': 'Madanapalle Block', 'ANN_11': 'Mulakalacheruvu Block', 'ANN_12': 'Nandalur Block', 'ANN_13': 'Nimmanapalle Block', 'ANN_14': 'Peddamandyam Block', 'ANN_15': 'Peddathippasamudram Block', 'ANN_16': 'Pileru Block', 'ANN_17': 'Pullampeta Block', 'ANN_18': 'Railway Kodur Block', 'ANN_19': 'Rajampet Block', 'ANN_20': 'Ramapuram Block', 'ANN_21': 'Ramasamudram Block', 'ANN_22': 'Rayachoti Block', 'ANN_23': 'Sambepalle Block', 'ANN_24': 'T.Sundupalle Block', 'ANN_25': 'Thamballapalle Block', 'ANN_26': 'Valmikipuram Block', 'ANN_27': 'Veeraballi Block', 'ANN_28': 'Penagalur Block', 'ANN_29': 'Obulavaripalle Block', 'ANN_30': 'Chitvel Block',

  'BPT_01': 'Addanki Block', 'BPT_02': 'Amruthalur Block', 'BPT_03': 'Ballikurava Block', 'BPT_04': 'Bapatla Block', 'BPT_05': 'Bhattiprolu Block', 'BPT_06': 'Cherukupalle Block', 'BPT_07': 'Chinaganjam Block', 'BPT_08': 'Inkollu Block', 'BPT_09': 'Janakavaram Panguluru Block', 'BPT_10': 'Karamchedu Block', 'BPT_11': 'Karisapadu Block', 'BPT_12': 'Kollur Block', 'BPT_13': 'Korisapadu Block', 'BPT_14': 'Martur Block', 'BPT_15': 'Nagaram Block', 'BPT_16': 'Nizampatnam Block', 'BPT_17': 'Parchur Block', 'BPT_18': 'Pittalavanipalem Block', 'BPT_19': 'Repalle Block', 'BPT_20': 'Santhamaguluru Block', 'BPT_21': 'Tsundur Block', 'BPT_22': 'Vemuru Block', 'BPT_23': 'Vetapalem Block', 'BPT_24': 'Yeddanapudi Block',

  'CTR_AP_01': 'Bangarupalem Block', 'CTR_AP_02': 'Chittoor Block', 'CTR_AP_03': 'Chowdepalle Block', 'CTR_AP_04': 'Gangadhara Nellore Block', 'CTR_AP_05': 'Gudipala Block', 'CTR_AP_06': 'Gudupalle Block', 'CTR_AP_07': 'Irala Block', 'CTR_AP_08': 'Karvetinagar Block', 'CTR_AP_09': 'Kuppam Block', 'CTR_AP_10': 'Nagari Block', 'CTR_AP_11': 'Nindra Block', 'CTR_AP_12': 'Palamaner Block', 'CTR_AP_13': 'Palasamudram Block', 'CTR_AP_14': 'Peddapanjani Block', 'CTR_AP_15': 'Penumuru Block', 'CTR_AP_16': 'Pulicherla Block', 'CTR_AP_17': 'Punganur Block', 'CTR_AP_18': 'Ramakuppam Block', 'CTR_AP_19': 'Rompicherla Block', 'CTR_AP_20': 'Santhipuram Block', 'CTR_AP_21': 'Sodam Block', 'CTR_AP_22': 'Somala Block', 'CTR_AP_23': 'Srirangarajapatnam Block', 'CTR_AP_24': 'Thavanampalle Block', 'CTR_AP_25': 'Vedurukuppam Block', 'CTR_AP_26': 'Venkatagirikota Block', 'CTR_AP_27': 'Vijayapuram Block', 'CTR_AP_28': 'Yadamarri Block', 'CTR_AP_29': 'Sadum Block',

  'KNS_01': 'Ainavilli Block', 'KNS_02': 'Alamuru Block', 'KNS_03': 'Allavaram Block', 'KNS_04': 'Amalapuram Block', 'KNS_05': 'Ambajipeta Block', 'KNS_06': 'Atreyapuram Block', 'KNS_07': 'I. Polavaram Block', 'KNS_08': 'Kadavilli / Kothapeta Block', 'KNS_09': 'Katrenikona Block', 'KNS_10': 'Malikipuram Block', 'KNS_11': 'Mamidikuduru Block', 'KNS_12': 'Mandapeta Block', 'KNS_13': 'Mummidivaram Block', 'KNS_14': 'P.Gannavaram Block', 'KNS_15': 'Ramachandrapuram Block', 'KNS_16': 'Ravulapalem Block', 'KNS_17': 'Rayavaram Block', 'KNS_18': 'Razole Block', 'KNS_19': 'Sakhinetipalle Block', 'KNS_20': 'Uppalaguptam Block', 'KNS_21': 'Kapileswarapuram Block', 'KNS_22': 'K.Gangavaram Block',

  'EGD_01': 'Anaparthi Block', 'EGD_02': 'Biccavolu Block', 'EGD_03': 'Chagallu Block', 'EGD_04': 'Devarapalle Block', 'EGD_05': 'Gokavaram Block', 'EGD_06': 'Gopalapuram Block', 'EGD_07': 'Kadiam Block', 'EGD_08': 'Korukonda Block', 'EGD_09': 'Kovvur Block', 'EGD_10': 'Nallajerla Block', 'EGD_11': 'Nidadavole Block', 'EGD_12': 'Peravali Block', 'EGD_13': 'Rajahmundry Rural Block', 'EGD_14': 'Rajahmundry Urban Block', 'EGD_15': 'Rajanagaram Block', 'EGD_16': 'Rangampeta Block', 'EGD_17': 'Seethanagaram Block', 'EGD_18': 'Tallapudi Block', 'EGD_19': 'Undrajavaram Block',

  'ELR_01': 'Agiripalli Block', 'ELR_02': 'Bhimadole Block', 'ELR_03': 'Buttayagudem Block', 'ELR_04': 'Chatrai Block', 'ELR_05': 'Chintalapudi Block', 'ELR_06': 'Denduluru Block', 'ELR_07': 'Dwaraka Tirumala Block', 'ELR_08': 'Eluru Block', 'ELR_09': 'Jangareddigudem Block', 'ELR_10': 'Jeelugumilli Block', 'ELR_11': 'Kaikaluru Block', 'ELR_12': 'Kalidindi Block', 'ELR_13': 'Kamavarapukota Block', 'ELR_14': 'Koyyalagudem Block', 'ELR_15': 'Kukunoor Block', 'ELR_16': 'Lingapalem Block', 'ELR_17': 'Mandavalli Block', 'ELR_18': 'Mudinepalle Block', 'ELR_19': 'Musunuru Block', 'ELR_20': 'Nidamarru Block', 'ELR_21': 'Nuzvid Block', 'ELR_22': 'Pedapadu Block', 'ELR_23': 'Pedavegi Block', 'ELR_24': 'Polavaram Block', 'ELR_25': 'T.Narasapuram Block', 'ELR_26': 'Unguturu Block', 'ELR_27': 'Velairpadu Block',

  'GNT_01': 'Chebrolu Block', 'GNT_02': 'Duggirala Block', 'GNT_03': 'Guntur East Block', 'GNT_04': 'Guntur West Block', 'GNT_05': 'Kakumanu Block', 'GNT_06': 'Kollipara Block', 'GNT_07': 'Mangalagiri Block', 'GNT_08': 'Medikonduru Block', 'GNT_09': 'Pedakakani Block', 'GNT_10': 'Pedanandipadu Block', 'GNT_11': 'Phirangipuram Block', 'GNT_12': 'Ponnur Block', 'GNT_13': 'Prathipadu Block', 'GNT_14': 'Tadikonda Block', 'GNT_15': 'Tenali Block', 'GNT_16': 'Thullur Block', 'GNT_17': 'Vatticherukuru Block',

  'KKD_AP_01': 'Gandepalle Block', 'KKD_AP_02': 'Gollaprolu Block', 'KKD_AP_03': 'Jaggampeta Block', 'KKD_AP_04': 'Kajuluru Block', 'KKD_AP_05': 'Kakinada Rural Block', 'KKD_AP_06': 'Kakinada Urban Block', 'KKD_AP_07': 'Karapa Block', 'KKD_AP_08': 'Kirlampudi Block', 'KKD_AP_09': 'Kotananduru Block', 'KKD_AP_10': 'Pedapudi Block', 'KKD_AP_11': 'Peddapuram Block', 'KKD_AP_12': 'Pithapuram Block', 'KKD_AP_13': 'Prathipadu Block', 'KKD_AP_14': 'Rowthulapudi Block', 'KKD_AP_15': 'Samalkota Block', 'KKD_AP_16': 'Sankhavaram Block', 'KKD_AP_17': 'Thondangi Block', 'KKD_AP_18': 'Tuni Block', 'KKD_AP_19': 'U.Kothapalle Block', 'KKD_AP_20': 'Yeleswaram Block', 'KKD_AP_21': 'Tallarevu Block',

  'KRI_01': 'Avanigadda Block', 'KRI_02': 'Bantumilli Block', 'KRI_03': 'Bapulapadu Block', 'KRI_04': 'Challapalli Block', 'KRI_05': 'Gannavaram Block', 'KRI_06': 'Ghantasala Block', 'KRI_07': 'Gudivada Block', 'KRI_08': 'Gudlavalleru Block', 'KRI_09': 'Guduru Block', 'KRI_10': 'Koduru Block', 'KRI_11': 'Kruthivennu Block', 'KRI_12': 'Machilipatnam North Block', 'KRI_13': 'Machilipatnam South Block', 'KRI_14': 'Mopidevi Block', 'KRI_15': 'Movva Block', 'KRI_16': 'Nagayalanka Block', 'KRI_17': 'Nandivada Block', 'KRI_18': 'Pamarru Block', 'KRI_19': 'Pamidimukkala Block', 'KRI_20': 'Pedana Block', 'KRI_21': 'Pedaparupudi Block', 'KRI_22': 'Unguturu Block', 'KRI_23': 'Uyyuru Block', 'KRI_24': 'Vuyyuru Block', 'KRI_25': 'Penamaluru Block',

  'KRN_01': 'Adoni Block', 'KRN_02': 'Alur Block', 'KRN_03': 'Aspari Block', 'KRN_04': 'C.Belagal Block', 'KRN_05': 'Devanakonda Block', 'KRN_06': 'Gonegandla Block', 'KRN_07': 'Gudur Block', 'KRN_08': 'Holagunda Block', 'KRN_09': 'Halaharvi Block', 'KRN_10': 'Kallur Block', 'KRN_11': 'Kodumur Block', 'KRN_12': 'Kowthalam Block', 'KRN_13': 'Krishnagiri Block', 'KRN_14': 'Kurnool Rural Block', 'KRN_15': 'Kurnool Urban Block', 'KRN_16': 'Maddikera East Block', 'KRN_17': 'Mantralayam Block', 'KRN_18': 'Nandavaram Block', 'KRN_19': 'Orvakal Block', 'KRN_20': 'Pattikonda Block', 'KRN_21': 'Pedda Kadubur Block', 'KRN_22': 'Tuggali Block', 'KRN_23': 'Veldurthi Block', 'KRN_24': 'Yemmiganur Block', 'KRN_25': 'Kosigi Block', 'KRN_26': 'Chippagiri Block',

  'NDL_01': 'Allagadda Block', 'NDL_02': 'Atmakur Block', 'NDL_03': 'Banaganapalle Block', 'NDL_04': 'Bandi Atmakur Block', 'NDL_05': 'Bethamcherla Block', 'NDL_06': 'Chagalamarri Block', 'NDL_07': 'Dhone Block', 'NDL_08': 'Dornipadu Block', 'NDL_09': 'Gadivemula Block', 'NDL_10': 'Gospadu Block', 'NDL_11': 'Jupadu Bunglow Block', 'NDL_12': 'Koilkuntla Block', 'NDL_13': 'Kolimigundla Block', 'NDL_14': 'Kothapalle Block', 'NDL_15': 'Mahanandi Block', 'NDL_16': 'Midthur Block', 'NDL_17': 'Nandikotkur Block', 'NDL_18': 'Nandyal Rural Block', 'NDL_19': 'Nandyal Urban Block', 'NDL_20': 'Owk Block', 'NDL_21': 'Pagidyala Block', 'NDL_22': 'Pamulapadu Block', 'NDL_23': 'Panyam Block', 'NDL_24': 'Rudravaram Block', 'NDL_25': 'Sanjamala Block', 'NDL_26': 'Sirvella Block', 'NDL_27': 'Srisailam Block', 'NDL_28': 'Uyyalawada Block', 'NDL_29': 'Velgodu Block',

  'NTR_01': 'A.Konduru Block', 'NTR_02': 'Chandarlapadu Block', 'NTR_03': 'G.Konduru Block', 'NTR_04': 'Gampalagudem Block', 'NTR_05': 'Ibrahimpatnam Block', 'NTR_06': 'Jaggayyapeta Block', 'NTR_07': 'Kanchikacherla Block', 'NTR_08': 'Mylavaram Block', 'NTR_09': 'Nandigama Block', 'NTR_10': 'Penuganchiprolu Block', 'NTR_11': 'Reddigudem Block', 'NTR_12': 'Tiruvuru Block', 'NTR_13': 'Vatsavai Block', 'NTR_14': 'Veerullapadu Block', 'NTR_15': 'Vijayawada Central Block', 'NTR_16': 'Vijayawada East Block', 'NTR_17': 'Vijayawada North Block', 'NTR_18': 'Vijayawada Rural Block', 'NTR_19': 'Vijayawada West Block', 'NTR_20': 'Vissannapeta Block',

  'PLN_01': 'Amaravathi Block', 'PLN_02': 'Atchampet Block', 'PLN_03': 'Bellamkonda Block', 'PLN_04': 'Bollapalle Block', 'PLN_05': 'Chilakaluripet Block', 'PLN_06': 'Dachepalle Block', 'PLN_07': 'Durgi Block', 'PLN_08': 'Edlapadu Block', 'PLN_09': 'Gurazala Block', 'PLN_10': 'Ipur Block', 'PLN_11': 'Karempudi Block', 'PLN_12': 'Krosuru Block', 'PLN_13': 'Machavaram Block', 'PLN_14': 'Macherla Block', 'PLN_15': 'Muppalla Block', 'PLN_16': 'Nadendla Block', 'PLN_17': 'Narasaraopet Block', 'PLN_18': 'Nekarikallu Block', 'PLN_19': 'Pedakurapadu Block', 'PLN_20': 'Piduguralla Block', 'PLN_21': 'Rajupalem Block', 'PLN_22': 'Rentachintala Block', 'PLN_23': 'Rompicherla Block', 'PLN_24': 'Sattenapalle Block', 'PLN_25': 'Savalyapuram Block', 'PLN_26': 'Veldurthi Block', 'PLN_27': 'Vinukonda Block',

  'PVM_01': 'Balijipeta Block', 'PVM_02': 'Bhamini Block', 'PVM_03': 'Garugubilli Block', 'PVM_04': 'Gummalakshmipuram Block', 'PVM_05': 'Jiyyammavalasa Block', 'PVM_06': 'Komarada Block', 'PVM_07': 'Kurupam Block', 'PVM_08': 'Makkuva Block', 'PVM_09': 'Pachipenta Block', 'PVM_10': 'Palakonda Block', 'PVM_11': 'Parvathipuram Block', 'PVM_12': 'Salur Block', 'PVM_13': 'Seethampeta Block', 'PVM_14': 'Seethanagaram Block', 'PVM_15': 'Veeraghattam Block',

  'PRK_01': 'Ardhaveedu Block', 'PRK_02': 'Bestavaripeta Block', 'PRK_03': 'Chandra Sekhara Puram Block', 'PRK_04': 'Chimakurthi Block', 'PRK_05': 'Cumbum Block', 'PRK_06': 'Darsi Block', 'PRK_07': 'Donakonda Block', 'PRK_08': 'Dornala Block', 'PRK_09': 'Giddalur Block', 'PRK_10': 'Hanumanthuni Padu Block', 'PRK_11': 'Kani Giri Block', 'PRK_12': 'Komarolu Block', 'PRK_13': 'Konakanamitla Block', 'PRK_14': 'Kondapi Block', 'PRK_15': 'Kotha Patnam Block', 'PRK_16': 'Kurichedu Block', 'PRK_17': 'Maddipadu Block', 'PRK_18': 'Markapur Block', 'PRK_19': 'Marripudi Block', 'PRK_20': 'Mundlamuru Block', 'PRK_21': 'Naguluppala Padu Block', 'PRK_22': 'Ongole Rural Block', 'PRK_23': 'Ongole Urban Block', 'PRK_24': 'Pedda Araveedu Block', 'PRK_25': 'Peda Cherlo Palle Block', 'PRK_26': 'Podili Block', 'PRK_27': 'Ponnaluru Block', 'PRK_28': 'Pulla Cheruvu Block', 'PRK_29': 'Racherla Block', 'PRK_30': 'Santhanuthala Padu Block', 'PRK_31': 'Singarayakonda Block', 'PRK_32': 'Tarlupadu Block', 'PRK_33': 'Thallur Block', 'PRK_34': 'Tripuranthakam Block', 'PRK_35': 'Veligandla Block', 'PRK_36': 'Yerragondapalem Block', 'PRK_37': 'Zarugumilli Block',

  'NLR_01': 'Allur Block', 'NLR_02': 'Ananthasagaram Block', 'NLR_03': 'Anumasamudrampeta Block', 'NLR_04': 'Atmakur Block', 'NLR_05': 'Bogole Block', 'NLR_06': 'Buchireddipalem Block', 'NLR_07': 'Chejerla Block', 'NLR_08': 'Dagadarthi Block', 'NLR_09': 'Duttalur Block', 'NLR_10': 'Gudur Block', 'NLR_11': 'Indukurpet Block', 'NLR_12': 'Jaladanki Block', 'NLR_13': 'Kaluvoya Block', 'NLR_14': 'Kavali Block', 'NLR_15': 'Kodavalur Block', 'NLR_16': 'Kondapuram Block', 'NLR_17': 'Kota Block', 'NLR_18': 'Kovur Block', 'NLR_19': 'Manubolu Block', 'NLR_20': 'Marripadu Block', 'NLR_21': 'Muthukur Block', 'NLR_22': 'Nellore Rural Block', 'NLR_23': 'Nellore Urban Block', 'NLR_24': 'Podalakur Block', 'NLR_25': 'Rapur Block', 'NLR_26': 'Sangam Block', 'NLR_27': 'Seetharamapuram Block', 'NLR_28': 'Sydapuram Block', 'NLR_29': 'Thotapalligudur Block', 'NLR_30': 'Udayagiri Block', 'NLR_31': 'Vakadu Block', 'NLR_32': 'Varikuntapadu Block', 'NLR_33': 'Venkatachalam Block', 'NLR_34': 'Vidavalur Block', 'NLR_35': 'Vinjamur Block',

  'SSS_01': 'Agali Block', 'SSS_02': 'Amadagur Block', 'SSS_03': 'Amarapuram Block', 'SSS_04': 'Bathalapalle Block', 'SSS_05': 'Bukkapatnam Block', 'SSS_06': 'Chennekothapalle Block', 'SSS_07': 'Chilamathur Block', 'SSS_08': 'Dharmavaram Block', 'SSS_09': 'Gandlapenta Block', 'SSS_10': 'Gorantla Block', 'SSS_11': 'Gudibanda Block', 'SSS_12': 'Hindupur Block', 'SSS_13': 'Kadiri Block', 'SSS_14': 'Kanaganapalle Block', 'SSS_15': 'Kothacheruvu Block', 'SSS_16': 'Lepakshi Block', 'SSS_17': 'Madakasira Block', 'SSS_18': 'Mudigubba Block', 'SSS_19': 'Nallacheruvu Block', 'SSS_20': 'Nallamada Block', 'SSS_21': 'Nambulapulakunta Block', 'SSS_22': 'Obuladevaracheruvu Block', 'SSS_23': 'Parigi Block', 'SSS_24': 'Penukonda Block', 'SSS_25': 'Puttaparthi Block', 'SSS_26': 'Ramagiri Block', 'SSS_27': 'Rolla Block', 'SSS_28': 'Roddam Block', 'SSS_29': 'Talupula Block', 'SSS_30': 'Tanakal Block', 'SSS_31': 'Somandepalle Block', 'SSS_32': 'Tadimarri Block',

  'SKL_01': 'Amadalavalasa Block', 'SKL_02': 'Burja Block', 'SKL_03': 'Etcherla Block', 'SKL_04': 'Gara Block', 'SKL_05': 'Ganguvarisigadam Block', 'SKL_06': 'Hiramandalam Block', 'SKL_07': 'Ichchapuram Block', 'SKL_08': 'Jalumuru Block', 'SKL_09': 'Kanchili Block', 'SKL_10': 'Kaviti Block', 'SKL_11': 'Kotabommali Block', 'SKL_12': 'Kothuru Block', 'SKL_13': 'Laveru Block', 'SKL_14': 'L.N. Peta Block', 'SKL_15': 'Mandaas Block', 'SKL_16': 'Meliaputti Block', 'SKL_17': 'Nandigam Block', 'SKL_18': 'Narasannapeta Block', 'SKL_19': 'Palasa Block', 'SKL_20': 'Polaki Block', 'SKL_21': 'Ponduru Block', 'SKL_22': 'Ranastalam Block', 'SKL_23': 'Santhabommali Block', 'SKL_24': 'Saravakota Block', 'SKL_25': 'Sarubujjili Block', 'SKL_26': 'Sompeta Block', 'SKL_27': 'Srikakulam Block', 'SKL_28': 'Tekkali Block', 'SKL_29': 'Vajrapukothuru Block', 'SKL_30': 'Vangara Block',

  'TPT_01': 'Balayapalle Block', 'TPT_02': 'Chandragiri Block', 'TPT_03': 'Chinnagottigallu Block', 'TPT_04': 'Chillakur Block', 'TPT_05': 'Chittamur Block', 'TPT_06': 'Dakkili Block', 'TPT_07': 'Doravarisatram Block', 'TPT_08': 'Gudur Rural Block', 'TPT_09': 'K.V.B.Puram Block', 'TPT_10': 'Nagari Rural / Yerpedu Block', 'TPT_11': 'Naidupeta Block', 'TPT_12': 'Narayanavanam Block', 'TPT_13': 'Ozili Block', 'TPT_14': 'Pakala Block', 'TPT_15': 'Pellakur Block', 'TPT_16': 'Pichatur Block', 'TPT_17': 'Putalapattu Block', 'TPT_18': 'Renigunta Block', 'TPT_19': 'Satyavedu Block', 'TPT_20': 'Srikalahasti Block', 'TPT_21': 'Sullurpeta Block', 'TPT_22': 'Tada Block', 'TPT_23': 'Tirupati Rural Block', 'TPT_24': 'Tirupati Urban Block', 'TPT_25': 'Tottambedu Block', 'TPT_26': 'Vadamalapeta Block', 'TPT_27': 'Varadaiahpalem Block', 'TPT_28': 'Venkatagiri Block', 'TPT_29': 'Yerpedu Block', 'TPT_30': 'Yerravaripalem Block',

  'VSP_01': 'Bheemunipatnam Block', 'VSP_02': 'Gajuwaka Block', 'VSP_03': 'Maharanipeta Block', 'VSP_04': 'Mulagada Block', 'VSP_05': 'Padmanabham Block', 'VSP_06': 'Pendurthi Block', 'VSP_07': 'Seethammadhara Block', 'VSP_08': 'Anandapuram Block', 'VSP_09': 'Gopalapatnam Block', 'VSP_10': 'Pedagantyada Block', 'VSP_11': 'Chinnagadili Block',

  'VZM_01': 'Badangi Block', 'VZM_02': 'Bhogapuram Block', 'VZM_03': 'Bobbili Block', 'VZM_04': 'Bondapalle Block', 'VZM_05': 'Cheepurupalle Block', 'VZM_06': 'Dattirajeru Block', 'VZM_07': 'Denkada Block', 'VZM_08': 'Gajapathinagaram Block', 'VZM_09': 'Gantyada Block', 'VZM_10': 'Garividi Block', 'VZM_11': 'Gurla Block', 'VZM_12': 'Jami Block', 'VZM_13': 'Kothavalasa Block', 'VZM_14': 'Lakkavarapukota Block', 'VZM_15': 'Mentada Block', 'VZM_16': 'Merakamudidam Block', 'VZM_17': 'Nellimarla Block', 'VZM_18': 'Pusapatirega Block', 'VZM_19': 'Rajam Block', 'VZM_20': 'Ramabhadrapuram Block', 'VZM_21': 'Santhakavati Block', 'VZM_22': 'Srungavarapukota Block', 'VZM_23': 'Therlam Block', 'VZM_24': 'Vepada Block', 'VZM_25': 'Vizianagaram Rural Block', 'VZM_26': 'Vizianagaram Urban Block', 'VZM_27': 'Regidi Amadalavalasa Block',

  'WGD_01': 'Achanta Block', 'WGD_02': 'Akividu Block', 'WGD_03': 'Attili Block', 'WGD_04': 'Bhimavaram Block', 'WGD_05': 'Iragavaram Block', 'WGD_06': 'Kalla Block', 'WGD_07': 'Mogalthur Block', 'WGD_08': 'Narasapuram Block', 'WGD_09': 'Palacoderu Block', 'WGD_10': 'Palakollu Block', 'WGD_11': 'Penugonda Block', 'WGD_12': 'Penumantra Block', 'WGD_13': 'Pentapadu Block', 'WGD_14': 'Poduru Block', 'WGD_15': 'Tadepalligudem Block', 'WGD_16': 'Tanuku Block', 'WGD_17': 'Undi Block', 'WGD_18': 'Veeravasaram Block', 'WGD_19': 'Yelamanchili Block',

  'YSR_01': 'Atlur Block', 'YSR_02': 'B.Matam Block', 'YSR_03': 'Badvel Block', 'YSR_04': 'Chakarayapet Block', 'YSR_05': 'Chapad Block', 'YSR_06': 'Chennur Block', 'YSR_07': 'Chinthakommadinne Block', 'YSR_08': 'Duvvur Block', 'YSR_09': 'Gopavaram Block', 'YSR_10': 'Jammalamadugu Block', 'YSR_11': 'Kadapa Block', 'YSR_12': 'Kalasapadu Block', 'YSR_13': 'Kamalapuram Block', 'YSR_14': 'Khajipet Block', 'YSR_15': 'Kondapuram Block', 'YSR_16': 'Lingala Block', 'YSR_17': 'Muddanur Block', 'YSR_18': 'Mylavaram Block', 'YSR_19': 'Peddamudium Block', 'YSR_20': 'Pendlimarri Block', 'YSR_21': 'Porumamilla Block', 'YSR_22': 'Proddatur Block', 'YSR_23': 'Pulivendula Block', 'YSR_24': 'Rajupalem Block', 'YSR_25': 'S.Mydukur Block', 'YSR_26': 'Sambreepalle / Sambepalli Block', 'YSR_27': 'Simhadripuram Block', 'YSR_28': 'Sri Avadhutha Kasinayana Block', 'YSR_29': 'Thondur Block', 'YSR_30': 'Vallur Block', 'YSR_31': 'Veerapunayani Palle Block', 'YSR_32': 'Vempalle Block', 'YSR_33': 'Vemula Block', 'YSR_34': 'Yerraguntla Block',

  // --- TELANGANA (TS) 621 MANDALS ACROSS 33 DISTRICTS ---
  'ADB_01': 'Adilabad Rural Block', 'ADB_02': 'Adilabad Urban Block', 'ADB_03': 'Bazarhathnoor Block', 'ADB_04': 'Bela Block', 'ADB_05': 'Bheempoor Block', 'ADB_06': 'Boath Block', 'ADB_07': 'Gadiguda Block', 'ADB_08': 'Gudihatnoor Block', 'ADB_09': 'Ichoda Block', 'ADB_10': 'Inderavelly Block', 'ADB_11': 'Jainad Block', 'ADB_12': 'Mavala Block', 'ADB_13': 'Narnoor Block', 'ADB_14': 'Neradigonda Block', 'ADB_15': 'Sirikonda Block', 'ADB_16': 'Talamadugu Block', 'ADB_17': 'Tamsi Block', 'ADB_18': 'Utnoor Block',

  'BDK_TS_01': 'Allapalli Block', 'BDK_TS_02': 'Annapureddypally Block', 'BDK_TS_03': 'Aswapuram Block', 'BDK_TS_04': 'Aswaraopeta Block', 'BDK_TS_05': 'Bhadrachalam Block', 'BDK_TS_06': 'Burgampahad Block', 'BDK_TS_07': 'Chandrugonda Block', 'BDK_TS_08': 'Cherla Block', 'BDK_TS_09': 'Chunchupally Block', 'BDK_TS_10': 'Dammapeta Block', 'BDK_TS_11': 'Dummugudem Block', 'BDK_TS_12': 'Gundala Block', 'BDK_TS_13': 'Julurpad Block', 'BDK_TS_14': 'Karakagudem Block', 'BDK_TS_15': 'Kothagudem Block', 'BDK_TS_16': 'Laxmidevipally Block', 'BDK_TS_17': 'Manuguru Block', 'BDK_TS_18': 'Mulakalapally Block', 'BDK_TS_19': 'Palwancha Block', 'BDK_TS_20': 'Pinapaka Block', 'BDK_TS_21': 'Sujathanagar Block', 'BDK_TS_22': 'Tekulapally Block', 'BDK_TS_23': 'Yellandu Block',

  'HNK_01': 'Bheemadevarpalle Block', 'HNK_02': 'Dharmasagar Block', 'HNK_03': 'Elkathurthi Block', 'HNK_04': 'Hanamkonda Block', 'HNK_05': 'Hasanparthy Block', 'HNK_06': 'Inavole Block', 'HNK_07': 'Kamalapur Block', 'HNK_08': 'Kazipet Block', 'HNK_09': 'Narsimhulapet / Nadikuda Block', 'HNK_10': 'Parkal Block', 'HNK_11': 'Shayampet Block', 'HNK_12': 'Velair Block', 'HNK_13': 'Damera Block', 'HNK_14': 'Atmakur Block',

  'HYD_01': 'Amberpet Block', 'HYD_02': 'Asifnagar Block', 'HYD_03': 'Bahadurpura Block', 'HYD_04': 'Bandlaguda Block', 'HYD_05': 'Charminar Block', 'HYD_06': 'Golconda Block', 'HYD_07': 'Himayathnagar Block', 'HYD_08': 'Khairatabad Block', 'HYD_09': 'Marredpally Block', 'HYD_10': 'Musheerabad Block', 'HYD_11': 'Nampally Block', 'HYD_12': 'Saidabad Block', 'HYD_13': 'Secunderabad Block', 'HYD_14': 'Shaikpet Block', 'HYD_15': 'Tirumalagiri Block', 'HYD_16': 'Ameerpet Block',

  'JGT_01': 'Beerpur Block', 'JGT_02': 'Buggaram Block', 'JGT_03': 'Dharmapuri Block', 'JGT_04': 'Gollapalle Block', 'JGT_05': 'Ibrahimpatnam Block', 'JGT_06': 'Jagtial Block', 'JGT_07': 'Jagtial Rural Block', 'JGT_08': 'Kathlapur Block', 'JGT_09': 'Kodimial Block', 'JGT_10': 'Korutla Block', 'JGT_11': 'Mallapur Block', 'JGT_12': 'Mallial Block', 'JGT_13': 'Medipalli Block', 'JGT_14': 'Metpalli Block', 'JGT_15': 'Pegadapalli Block', 'JGT_16': 'Raikal Block', 'JGT_17': 'Sarangapur Block', 'JGT_18': 'Velgatoor Block',

  'JNG_01': 'Bachannapeta Block', 'JNG_02': 'Devaruppula Block', 'JNG_03': 'Ghanpur Station Block', 'JNG_04': 'Jangaon Block', 'JNG_05': 'Lingalaghanpur Block', 'JNG_06': 'Narmetta Block', 'JNG_07': 'Palakurthi Block', 'JNG_08': 'Raghunathpalle Block', 'JNG_09': 'Tarigoppula Block', 'JNG_10': 'Zaffergadh Block', 'JNG_11': 'Chilpur Block',

  'JSB_01': 'Bhupalpally Block', 'JSB_02': 'Chityal Block', 'JSB_03': 'Ghanpur Block', 'JSB_04': 'Kataram Block', 'JSB_05': 'Mahadevpur Block', 'JSB_06': 'Maha Mutharam Block', 'JSB_07': 'Malhar Rao Block', 'JSB_08': 'Mogullapally Block', 'JSB_09': 'Palimela Block', 'JSB_10': 'Regonda Block', 'JSB_11': 'Tekumatla Block',

  'JGL_01': 'Alampur Block', 'JGL_02': 'Dharur Block', 'JGL_03': 'Gadwal Block', 'JGL_04': 'Gattu Block', 'JGL_05': 'Itikyal Block', 'JGL_06': 'Kaloor-Timmandoddi Block', 'JGL_07': 'Maldakal Block', 'JGL_08': 'Manopad Block', 'JGL_09': 'Rajoli Block', 'JGL_10': 'Undavelli Block', 'JGL_11': 'Waddepalle Block', 'JGL_12': 'Kothakota Block',

  'KMR_TS_01': 'Banswada Block', 'KMR_TS_02': 'Bhiknoor Block', 'KMR_TS_03': 'Birkoor Block', 'KMR_TS_04': 'Bibipet Block', 'KMR_TS_05': 'Domakonda Block', 'KMR_TS_06': 'Gandhari Block', 'KMR_TS_07': 'Jukkal Block', 'KMR_TS_08': 'Kamareddy Block', 'KMR_TS_09': 'Lingampet Block', 'KMR_TS_10': 'Machareddy Block', 'KMR_TS_11': 'Madnoor Block', 'KMR_TS_12': 'Nagireddypet Block', 'KMR_TS_13': 'Nasrullabad Block', 'KMR_TS_14': 'Nizamsagar Block', 'KMR_TS_15': 'Pitlam Block', 'KMR_TS_16': 'Rajampet Block', 'KMR_TS_17': 'Ramareddy Block', 'KMR_TS_18': 'Sadashivanagar Block', 'KMR_TS_19': 'Tadwai Block', 'KMR_TS_20': 'Yellareddy Block', 'KMR_TS_21': 'Dongli Block', 'KMR_TS_22': 'Pedda Kodapgal Block',

  'KRM_TS_01': 'Chigurumamidi Block', 'KRM_TS_02': 'Choppadandi Block', 'KRM_TS_03': 'Ellanthakunta Block', 'KRM_TS_04': 'Ganneruvaram Block', 'KRM_TS_05': 'Huzurabad Block', 'KRM_TS_06': 'Jammikunta Block', 'KRM_TS_07': 'Karimnagar Rural Block', 'KRM_TS_08': 'Karimnagar Urban Block', 'KRM_TS_09': 'Kothapalli Block', 'KRM_TS_10': 'Manakondur Block', 'KRM_TS_11': 'Ramadugu Block', 'KRM_TS_12': 'Saidapur Block', 'KRM_TS_13': 'Shankarapatnam Block', 'KRM_TS_14': 'Thimmapur Block', 'KRM_TS_15': 'Veenavanka Block', 'KRM_TS_16': 'V-Saidapur Block',

  'KHM_01': 'Bonakal Block', 'KHM_02': 'Chinthakani Block', 'KHM_03': 'Enkoor Block', 'KHM_04': 'Kalluru Block', 'KHM_05': 'Kamepally Block', 'KHM_06': 'Khammam Rural Block', 'KHM_07': 'Khammam Urban Block', 'KHM_08': 'Konijerla Block', 'KHM_09': 'Kusumanchi Block', 'KHM_10': 'Madhira Block', 'KHM_11': 'Mudigonda Block', 'KHM_12': 'Nelakondapally Block', 'KHM_13': 'Penuballi Block', 'KHM_14': 'Raghunadhapalem Block', 'KHM_15': 'Sathupally Block', 'KHM_16': 'Singareni Block', 'KHM_17': 'Thallada Block', 'KHM_18': 'Tirumalayapalem Block', 'KHM_19': 'Vemsoor Block', 'KHM_20': 'Wyra Block', 'KHM_21': 'Yerrupalem Block',

  'KBA_TS_01': 'Asifabad Block', 'KBA_TS_02': 'Bejjur Block', 'KBA_TS_03': 'Chintalamanepally Block', 'KBA_TS_04': 'Dahegaon Block', 'KBA_TS_05': 'Jainoor Block', 'KBA_TS_06': 'Kagaznagar Block', 'KBA_TS_07': 'Kerameri Block', 'KBA_TS_08': 'Kouthala Block', 'KBA_TS_09': 'Lingapur Block', 'KBA_TS_10': 'Penchikalpet Block', 'KBA_TS_11': 'Rebbena Block', 'KBA_TS_12': 'Sirpur T Block', 'KBA_TS_13': 'Sirpur U Block', 'KBA_TS_14': 'Tiryani Block', 'KBA_TS_15': 'Wankdi Block',

  'MHBD_01': 'Bayyaram Block', 'MHBD_02': 'Danthalapalle Block', 'MHBD_03': 'Dornakal Block', 'MHBD_04': 'Garla Block', 'MHBD_05': 'Gudur Block', 'MHBD_06': 'Gangaram Block', 'MHBD_07': 'Kesamudram Block', 'MHBD_08': 'Kothaguda Block', 'MHBD_09': 'Kuravi Block', 'MHBD_10': 'Mahabubabad Block', 'MHBD_11': 'Maripeda Block', 'MHBD_12': 'Narsimhulapet Block', 'MHBD_13': 'Nellikudur Block', 'MHBD_14': 'Peddavangara Block', 'MHBD_15': 'Thorrugur Block', 'MHBD_16': 'Inugurthy Block',

  'MBN_01': 'Addakal Block', 'MBN_02': 'Balanagar Block', 'MBN_03': 'Bhoothpur Block', 'MBN_04': 'Chinna Chintakunta Block', 'MBN_05': 'Devarkadra Block', 'MBN_06': 'Gandeed Block', 'MBN_07': 'Hanwada Block', 'MBN_08': 'Jadcherla Block', 'MBN_09': 'Koilkonda Block', 'MBN_10': 'Mahabubnagar Rural Block', 'MBN_11': 'Mahabubnagar Urban Block', 'MBN_12': 'Midjil Block', 'MBN_13': 'Moosapet Block', 'MBN_14': 'Nawabpet Block', 'MBN_15': 'Rajapur Block', 'MBN_16': 'Kowkuntla Block',

  'MCL_01': 'Bheemaram Block', 'MCL_02': 'Bellarampalle / Bellampally Block', 'MCL_03': 'Chennur Block', 'MCL_04': 'Dandepally Block', 'MCL_05': 'Jannaram Block', 'MCL_06': 'Jaipur Block', 'MCL_07': 'Kannepally Block', 'MCL_08': 'Kotapally Block', 'MCL_09': 'Luxettipet Block', 'MCL_10': 'Mancherial Block', 'MCL_11': 'Mandamarri Block', 'MCL_12': 'Naspur Block', 'MCL_13': 'Nennal Block', 'MCL_14': 'Kasipet Block', 'MCL_15': 'Tandur Block', 'MCL_16': 'Vemanpally Block', 'MCL_17': 'Bheemini Block', 'MCL_18': 'Hajipur Block',

  'MDK_01': 'Alladurg Block', 'MDK_02': 'Chegunta Block', 'MDK_03': 'Chilpched Block', 'MDK_04': 'Havelighanpur Block', 'MDK_05': 'Kulcharam Block', 'MDK_06': 'Kowdipalle Block', 'MDK_07': 'Manoharabad Block', 'MDK_08': 'Masaipet Block', 'MDK_09': 'Medak Block', 'MDK_10': 'Narsapur Block', 'MDK_11': 'Nizampet Block', 'MDK_12': 'Papannapet Block', 'MDK_13': 'Ramayampet Block', 'MDK_14': 'Regode Block', 'MDK_15': 'Shankarampet A Block', 'MDK_16': 'Shankarampet R Block', 'MDK_17': 'Shivampet Block', 'MDK_18': 'Tekmal Block', 'MDK_19': 'Tupran Block', 'MDK_20': 'Yeldurthy Block', 'MDK_21': 'Narsingi Block',

  'MDM_01': 'Alwal Block', 'MDM_02': 'Bachupally Block', 'MDM_03': 'Balanagar Block', 'MDM_04': 'Dundigal Gandimaisamma Block', 'MDM_05': 'Ghatkesar Block', 'MDM_06': 'Kapra Block', 'MDM_07': 'Keesara Block', 'MDM_08': 'Kukatpally Block', 'MDM_09': 'Malkajgiri Block', 'MDM_10': 'Medchal Block', 'MDM_11': 'Medipally Block', 'MDM_12': 'Muduchintalpally Block', 'MDM_13': 'Quthbullapur Block', 'MDM_14': 'Shamirpet Block', 'MDM_15': 'Uppal Block',

  'MLG_01': 'Mulugu Block', 'MLG_02': 'Venkatapur Block', 'MLG_03': 'Govindaraopet Block', 'MLG_04': 'Pasra Block', 'MLG_05': 'Tadvai / Sammakka Saralamma Block', 'MLG_06': 'Eturnagaram Block', 'MLG_07': 'Mangapet Block', 'MLG_08': 'Kannaigudem Block', 'MLG_09': 'Wazeed Block',

  'NGK_01': 'Achampet Block', 'NGK_02': 'Amrabad Block', 'NGK_03': 'Balmoor Block', 'NGK_04': 'Bijinapalle Block', 'NGK_05': 'Charakonda Block', 'NGK_06': 'Kalwakurthy Block', 'NGK_07': 'Kollapur Block', 'NGK_08': 'Kodair Block', 'NGK_09': 'Lingal Block', 'NGK_10': 'Nagarkurnool Block', 'NGK_11': 'Padra Block', 'NGK_12': 'Peddakothapalle Block', 'NGK_13': 'Pentlavelli Block', 'NGK_14': 'Telkapalle Block', 'NGK_15': 'Thimmajipet Block', 'NGK_16': 'Uppununthala Block', 'NGK_17': 'Urkonda Block', 'NGK_18': 'Vangoor Block', 'NGK_19': 'Veldanda Block', 'NGK_20': 'Chinnambavi Block',

  'NLG_TS_01': 'Adavidevulapally Block', 'NLG_TS_02': 'Anumula / Haliya Block', 'NLG_TS_03': 'Chandampet Block', 'NLG_TS_04': 'Chandur Block', 'NLG_TS_05': 'Chityala Block', 'NLG_TS_06': 'Damaracherla Block', 'NLG_TS_07': 'Devarakonda Block', 'NLG_TS_08': 'Gundlapally Block', 'NLG_TS_09': 'Gurrampode Block', 'NLG_TS_10': 'Kangal Block', 'NLG_TS_11': 'Kattangur Block', 'NLG_TS_12': 'Kethepally Block', 'NLG_TS_13': 'Kondamallepally Block', 'NLG_TS_14': 'Madugulapally Block', 'NLG_TS_15': 'Marriguda Block', 'NLG_TS_16': 'Miryalaguda Block', 'NLG_TS_17': 'Munugode Block', 'NLG_TS_18': 'Nakrekal Block', 'NLG_TS_19': 'Nalgonda Block', 'NLG_TS_20': 'Narketpally Block', 'NLG_TS_21': 'Nereducherla Block', 'NLG_TS_22': 'Nidamanoor Block', 'NLG_TS_23': 'Peddavoora Block', 'NLG_TS_24': 'Sali Gouraram Block', 'NLG_TS_25': 'Shaligouraram Block', 'NLG_TS_26': 'Thipparthy Block', 'NLG_TS_27': 'Tirumalagiri Sagar Block', 'NLG_TS_28': 'Tripuraram Block', 'NLG_TS_29': 'Vemulapally Block', 'NLG_TS_30': 'Nampally Block', 'NLG_TS_31': 'Gudur Block',

  'NPT_01': 'Damaragidda Block', 'NPT_02': 'Dhanwada Block', 'NPT_03': 'Gundumal Block', 'NPT_04': 'Kosgi Block', 'NPT_05': 'Krishna Block', 'NPT_06': 'Maddur Block', 'NPT_07': 'Maganoor Block', 'NPT_08': 'Makthal Block', 'NPT_09': 'Marikal Block', 'NPT_10': 'Narayanpet Block', 'NPT_11': 'Narva Block', 'NPT_12': 'Utkoor Block',

  'NRM_TS_01': 'Basar Block', 'NRM_TS_02': 'Bhainsa Block', 'NRM_TS_03': 'Dasturabad Block', 'NRM_TS_04': 'Dilawarpur Block', 'NRM_TS_05': 'Kaddampeddur Block', 'NRM_TS_06': 'Khanapur Block', 'NRM_TS_07': 'Kubeer Block', 'NRM_TS_08': 'Kuntala Block', 'NRM_TS_09': 'Laxmanchanda Block', 'NRM_TS_10': 'Mamda Block', 'NRM_TS_11': 'Mudhole Block', 'NRM_TS_12': 'Narsapur G Block', 'NRM_TS_13': 'Nirmal Rural Block', 'NRM_TS_14': 'Nirmal Urban Block', 'NRM_TS_15': 'Pembi Block', 'NRM_TS_16': 'Sarangapur Block', 'NRM_TS_17': 'Soan Block', 'NRM_TS_18': 'Tanur Block', 'NRM_TS_19': 'Lokeshwaram Block',

  'NZB_01': 'Armoor Block', 'NZB_02': 'Balkonda Block', 'NZB_03': 'Bheemgal Block', 'NZB_04': 'Bodhan Block', 'NZB_05': 'Chandur Block', 'NZB_06': 'Dichpally Block', 'NZB_07': 'Dharpally Block', 'NZB_08': 'Indalwai Block', 'NZB_09': 'Jakranpally Block', 'NZB_10': 'Kammarpally Block', 'NZB_11': 'Kotgiri Block', 'NZB_12': 'Makloor Block', 'NZB_13': 'Mendon Block', 'NZB_14': 'Mopal Block', 'NZB_15': 'Mortad Block', 'NZB_16': 'Mosra Block', 'NZB_17': 'Navipet Block', 'NZB_18': 'Nizamabad North Block', 'NZB_19': 'Nizamabad Rural Block', 'NZB_20': 'Nizamabad South Block', 'NZB_21': 'Ranjal Block', 'NZB_22': 'Rudrur Block', 'NZB_23': 'Sirikonda Block', 'NZB_24': 'Varni Block', 'NZB_25': 'Velpur Block', 'NZB_26': 'Yedapally Block', 'NZB_27': 'Ergatla Block', 'NZB_28': 'Mupkal Block', 'NZB_29': 'Alur Block',

  'PDL_01': 'Anthergoan Block', 'PDL_02': 'Dharmaram Block', 'PDL_03': 'Eligaid Block', 'PDL_04': 'Julapalle Block', 'PDL_05': 'Kamanpur Block', 'PDL_06': 'Manthani Block', 'PDL_07': 'Mutharam Manthani Block', 'PDL_08': 'Odela Block', 'PDL_09': 'Palakurthy Block', 'PDL_10': 'Peddapalli Block', 'PDL_11': 'Ramagundam Block', 'PDL_12': 'Sulthanabad Block', 'PDL_13': 'Tenuguppa / Ramagiri Block',

  'RSC_01': 'Boinpalle Block', 'RSC_02': 'Chandurthi Block', 'RSC_03': 'Ellanthakunta / Illanthakunta Block', 'RSC_04': 'Gambhiraopet Block', 'RSC_05': 'Konaraopet Block', 'RSC_06': 'Mustabad Block', 'RSC_07': 'Rudrangi Block', 'RSC_08': 'Sircilla Block', 'RSC_09': 'Thangallapalli Block', 'RSC_10': 'Vemulawada Block', 'RSC_11': 'Vemulawada Rural Block', 'RSC_12': 'Veernapalli Block', 'RSC_13': 'Yellareddypet Block',

  'RRD_01': 'Abdullapurmet Block', 'RRD_02': 'Amangal Block', 'RRD_03': 'Chevella Block', 'RRD_04': 'Farooqnagar Block', 'RRD_05': 'Gandipet Block', 'RRD_06': 'Hayathnagar Block', 'RRD_07': 'Ibrahimpatnam Block', 'RRD_08': 'Jilled Chowdariguda Block', 'RRD_09': 'Kadthal Block', 'RRD_10': 'Kandukur Block', 'RRD_11': 'Keshampet Block', 'RRD_12': 'Kothur Block', 'RRD_13': 'Madgul Block', 'RRD_14': 'Maheshwaram Block', 'RRD_15': 'Manchal Block', 'RRD_16': 'Moinabad Block', 'RRD_17': 'Nandigama Block', 'RRD_18': 'Rajendranagar Block', 'RRD_19': 'Saroornagar Block', 'RRD_20': 'Serilingampally Block', 'RRD_21': 'Shabad Block', 'RRD_22': 'Shamshabad Block', 'RRD_23': 'Talakondapalle Block', 'RRD_24': 'Yacharam Block', 'RRD_25': 'Balanagar Rural Block', 'RRD_26': 'Kondurg Block',

  'SGR_TS_01': 'Ameenpur Block', 'SGR_TS_02': 'Andole Block', 'SGR_TS_03': 'Choutuppal / Chowtakur Block', 'SGR_TS_04': 'Gummadidala Block', 'SGR_TS_05': 'Hathnoora Block', 'SGR_TS_06': 'Jharasangam Block', 'SGR_TS_07': 'Jinnaram Block', 'SGR_TS_08': 'Kalher Block', 'SGR_TS_09': 'Kandi Block', 'SGR_TS_10': 'Kangti Block', 'SGR_TS_11': 'Kohir Block', 'SGR_TS_12': 'Kondapur Block', 'SGR_TS_13': 'Manoor Block', 'SGR_TS_14': 'Mogudampally Block', 'SGR_TS_15': 'Munipally Block', 'SGR_TS_16': 'Nagalgidda Block', 'SGR_TS_17': 'Narayankhed Block', 'SGR_TS_18': 'Nyalkal Block', 'SGR_TS_19': 'Patancheru Block', 'SGR_TS_20': 'Pulkal Block', 'SGR_TS_21': 'Raikode Block', 'SGR_TS_22': 'Ramchandrapuram Block', 'SGR_TS_23': 'Sadasivpet Block', 'SGR_TS_24': 'Sangareddy Block', 'SGR_TS_25': 'Sirgapoor Block', 'SGR_TS_26': 'Vatpally Block',

  'SDP_01': 'Akbarpet-Bhoompally Block', 'SDP_02': 'Bejjanki Block', 'SDP_03': 'Cheriyal Block', 'SDP_04': 'Chinnakodur Block', 'SDP_05': 'Dhoolmitta Block', 'SDP_06': 'Doultabad Block', 'SDP_07': 'Gajwel Block', 'SDP_08': 'Husnabad Block', 'SDP_09': 'Jagdevpur Block', 'SDP_10': 'Kondapak Block', 'SDP_11': 'Koheda Block', 'SDP_12': 'Komuravelli Block', 'SDP_13': 'Markook Block', 'SDP_14': 'Mirdoddi Block', 'SDP_15': 'Mulugu Block', 'SDP_16': 'Nangnoor Block', 'SDP_17': 'Narayanraopet Block', 'SDP_18': 'Raipole Block', 'SDP_19': 'Siddipet Rural Block', 'SDP_20': 'Siddipet Urban Block', 'SDP_21': 'Thoguta Block', 'SDP_22': 'Wargal Block', 'SDP_23': 'Kohanapally Block',

  'SRY_01': 'Ananthagiri Block', 'SRY_02': 'Atmakur S Block', 'SRY_03': 'Chilkur Block', 'SRY_04': 'Chinthakani / Chivvemla Block', 'SRY_05': 'Garidepally Block', 'SRY_06': 'Huzurnagar Block', 'SRY_07': 'Jajireddygudem Block', 'SRY_08': 'Kodad Block', 'SRY_09': 'Maddirala Block', 'SRY_10': 'Mattampally Block', 'SRY_11': 'Mellachervu Block', 'SRY_12': 'Mothey Block', 'SRY_13': 'Munagala Block', 'SRY_14': 'Nadigudem Block', 'SRY_15': 'Nagaram Block', 'SRY_16': 'Nereducherla Block', 'SRY_17': 'Nuthanakal Block', 'SRY_18': 'Palakeedu Block', 'SRY_19': 'Penpahad Block', 'SRY_20': 'Suryapet Block', 'SRY_21': 'Thirumalagiri Block', 'SRY_22': 'Thungathurthy Block', 'SRY_23': 'Mellacheruvu Block',

  'VKB_01': 'Bantwaram Block', 'VKB_02': 'Basheerabad Block', 'VKB_03': 'Chowdapur Block', 'VKB_04': 'Dharur Block', 'VKB_05': 'Doma Block', 'VKB_06': 'Doultabad Block', 'VKB_07': 'Kodhagal / Kodangal Block', 'VKB_08': 'Kotepally Block', 'VKB_09': 'Kulkacherla Block', 'VKB_10': 'Marpalle Block', 'VKB_11': 'Mominpet Block', 'VKB_12': 'Nawabpet Block', 'VKB_13': 'Pargi Block', 'VKB_14': 'Peddemul Block', 'VKB_15': 'Pudur Block', 'VKB_16': 'Tandur Block', 'VKB_17': 'Vikarabad Block', 'VKB_18': 'Yalal Block',

  'WNP_01': 'Amarchinta Block', 'WNP_02': 'Atmakur Block', 'WNP_03': 'Chinnambavi Block', 'WNP_04': 'Ghanpur Block', 'WNP_05': 'Gopalpeta Block', 'WNP_06': 'Kothakota Block', 'WNP_07': 'Madanapur Block', 'WNP_08': 'Pangal Block', 'WNP_09': 'Pebbair Block', 'WNP_10': 'Peddamandadi Block', 'WNP_11': 'Revally Block', 'WNP_12': 'Srirangapur Block', 'WNP_13': 'Veepanagandla Block', 'WNP_14': 'Wanaparthy Block',

  'WRG_01': 'Chennaraopet Block', 'WRG_02': 'Duggondi Block', 'WRG_03': 'Geesugonda Block', 'WRG_04': 'Khanapur Block', 'WRG_05': 'Nallabelly Block', 'WRG_06': 'Narsampet Block', 'WRG_07': 'Nekkonda Block', 'WRG_08': 'Parvathagiri Block', 'WRG_09': 'Rayaparthy Block', 'WRG_10': 'Sangem Block', 'WRG_11': 'Wardhannapet Block', 'WRG_12': 'Khila Warangal Block', 'WRG_13': 'Warangal Block',

  'YDB_01': 'Addagudur Block', 'YDB_02': 'Alair Block', 'YDB_03': 'Atmakur M Block', 'YDB_04': 'Bibinagar Block', 'YDB_05': 'Bhongir / Bhuvanagiri Block', 'YDB_06': 'Bommalaramaram Block', 'YDB_07': 'Choutuppal Block', 'YDB_08': 'Gundala Block', 'YDB_09': 'Mothkur Block', 'YDB_10': 'Narayanpur Block', 'YDB_11': 'Pochampally Block', 'YDB_12': 'Rajapet Block', 'YDB_13': 'Ramannapet Block', 'YDB_14': 'Turkapally Block', 'YDB_15': 'Valigonda Block', 'YDB_16': 'Yadagirigutta Block', 'YDB_17': 'Bhoodan Pochampally Block',
  // --- MANIPUR (MN) 70 BLOCKS ACROSS 16 DISTRICTS ---
  'BSP_01': 'Bishnupur Block', 'BSP_02': 'Moirang Block', 'BSP_03': 'Nambol Block',
  'CDL_01': 'Chandel Block', 'CDL_02': 'Chakpikarong Block', 'CDL_03': 'Khengjoy Block',
  'CCP_01': 'Churachandpur Block', 'CCP_02': 'Henglep Block', 'CCP_03': 'Samulamlan Block', 'CCP_04': 'Saikot Block', 'CCP_05': 'Sangaikot Block', 'CCP_06': 'Singngat Block', 'CCP_07': 'Suangdoh Block', 'CCP_08': 'Tuibong Block',
  'IE_01': 'Keirao Bitra Block', 'IE_02': 'Sawombung Block', 'IE_03': 'Porompat Block',
  'IW_01': 'Haorang Sabal Block', 'IW_02': 'Lamphelpat Block', 'IW_03': 'Patsoi Block', 'IW_04': 'Wangoi Block',
  'JRB_01': 'Jiribam Block', 'JRB_02': 'Borobekra Block',
  'KCG_MN_01': 'Kakching Block', 'KCG_MN_02': 'Waikhong Block',
  'KMJ_01': 'Kamjong Block', 'KMJ_02': 'Kasom Khullen Block', 'KMJ_03': 'Phungyar Block', 'KMJ_04': 'Sahamphung Block',
  'KPI_01': 'Kangpokpi Block', 'KPI_02': 'Champhai Block', 'KPI_03': 'Bungte Chiru Block', 'KPI_04': 'Kangchup Geljang Block', 'KPI_05': 'Saikul Block', 'KPI_06': 'Saitu Gamphazol Block', 'KPI_07': 'T. Waichong Block', 'KPI_08': 'Tujing Waichong Block', 'KPI_09': 'Island Block',
  'NNY_01': 'Noney / Longmai Block', 'NNY_02': 'Haochong Block', 'NNY_03': 'Khoupum Block', 'NNY_04': 'Nungba Block',
  'PZL_01': 'Pherzawl Block', 'PZL_02': 'Parbung / Tipaimukh Block', 'PZL_03': 'Thanlon Block', 'PZL_04': 'Vangai Range Block',
  'SPT_01': 'Mao Maram Block', 'SPT_02': 'Paomata Block', 'SPT_03': 'Purul Block', 'SPT_04': 'Willong Block', 'SPT_05': 'Chilivai Phaibung Block', 'SPT_06': 'Song Song Block', 'SPT_07': 'Tadubi Block',
  'TML_01': 'Tamenglong Block', 'TML_02': 'Tamei Block', 'TML_03': 'Tousem Block',
  'TNP_01': 'Tengnoupal Block', 'TNP_02': 'Machii Block', 'TNP_03': 'Moreh Block',
  'THB_01': 'Thoubal Block', 'THB_02': 'Lilong Block', 'THB_03': 'Wangjing Tentha Block',
  'UKR_01': 'Ukhrul Block', 'UKR_02': 'Chingai Block', 'UKR_03': 'Jessami Block', 'UKR_04': 'Lungchong Meiphai Block',

  // --- MEGHALAYA (ML) 56 C&RD BLOCKS ACROSS 12 DISTRICTS ---
  'EWK_01': 'Mairang Block', 'EWK_02': 'Mawthadraishan Block',
  'EGH_01': 'Samanda Block', 'EGH_02': 'Songsak Block', 'EGH_03': 'Dambo Rongjeng Block',
  'EJH_01': 'Khliehriat Block', 'EJH_02': 'Saipung Block',
  'EKH_01': 'Mawkynrew Block', 'EKH_02': 'Mawphlang Block', 'EKH_03': 'Mawsynram Block', 'EKH_04': 'Mylliem Block', 'EKH_05': 'Pynursla Block', 'EKH_06': 'Shella Bholaganj Block', 'EKH_07': 'Khatarshnong Laitkroh Block', 'EKH_08': 'Mawryngkneng Block', 'EKH_09': 'Sohiong Block', 'EKH_10': 'Bhoirymbong Block', 'EKH_11': 'Mawpat Block',
  'NGH_01': 'Resubelpara Block', 'NGH_02': 'Bajengdoba Block', 'NGH_03': 'Kharkutta Block',
  'RBH_01': 'Umling Block', 'RBH_02': 'Umsning Block', 'RBH_03': 'Jirang Block', 'RBH_04': 'Bhoirymbong Block',
  'SGH_01': 'Baghmara Block', 'SGH_02': 'Chokpot Block', 'SGH_03': 'Rongara Block', 'SGH_04': 'Gasuapara Block',
  'SWG_01': 'Betasing Block', 'SWG_02': 'Zikzak Block', 'SWG_03': 'Rerapara Block',
  'SWK_01': 'Mawkyrwat Block', 'SWK_02': 'Ranikor Block',
  'WGH_01': 'Dalu Block', 'WGH_02': 'Gambegre Block', 'WGH_03': 'Rongram Block', 'WGH_04': 'Selsella Block', 'WGH_05': 'Tikrikilla Block', 'WGH_06': 'Dadenggre Block', 'WGH_07': 'Demdema Block',
  'WJH_01': 'Thadlaskein Block', 'WJH_02': 'Laskein Block', 'WJH_03': 'Amlarem Block',
  'WKH_01': 'Nongstoin Block', 'WKH_02': 'Mawshynrut Block', 'WKH_03': 'Rambrai Nongspung Block',

  // --- MIZORAM (MZ) 28 RD BLOCKS ACROSS 11 DISTRICTS ---
  'AZL_01': 'Aibawk Block', 'AZL_02': 'Darlawn Block', 'AZL_03': 'Phullen Block', 'AZL_04': 'Thingsulthliah Block', 'AZL_05': 'Tlangnuam Block',
  'CMP_01': 'Champhai Block', 'CMP_02': 'Khawbung Block',
  'HNT_01': 'Hnahthial Block',
  'KWZ_01': 'Khawzawl Block',
  'KLB_MZ_01': 'Bilkhawthlir Block', 'KLB_MZ_02': 'Thingdawl Block',
  'LTL_01': 'Lawngtlai Block', 'LTL_02': 'Chawngte Block', 'LTL_03': 'Sangau Block', 'LTL_04': 'Bungtlang South Block',
  'LGL_01': 'Lunglei Block', 'LGL_02': 'Bunghmun Block', 'LGL_03': 'Lungsen Block',
  'MMT_01': 'Zawlnuam Block', 'MMT_02': 'West Phaileng Block', 'MMT_03': 'Reiek Block',
  'STL_01': 'Ngopa Block', 'STL_02': 'Saitual Block',
  'SRC_01': 'Serchhip Block', 'SRC_02': 'East Lungdar Block',
  'SIH_01': 'Siaha Block', 'SIH_02': 'Tuipang Block',

  // --- NAGALAND (NL) 76 RD BLOCKS ACROSS 16 DISTRICTS ---
  'CKM_NL_01': 'Chümoukedima Block', 'CKM_NL_02': 'Medziphema Block', 'CKM_NL_03': 'Dhansiripar Block',
  'DMP_01': 'Kuhuboto Block',
  'KPH_01': 'Kiphire Sadar Block', 'KPH_02': 'Pungro Block', 'KPH_03': 'Sitimi Block', 'KPH_04': 'Khongsa Block', 'KPH_05': 'Seyochung Block',
  'KHM_NL_01': 'Kohima Block', 'KHM_NL_02': 'Jakhama Block', 'KHM_NL_03': 'Sechu Zubza Block', 'KHM_NL_04': 'Tseminyu Rural / Chiephobozou Block', 'KHM_NL_05': 'Botsa Block',
  'LLG_01': 'Longleng Block', 'LLG_02': 'Tamlu Block', 'LLG_03': 'Sakshi Block',
  'MKC_01': 'Ongpangkong North Block', 'MKC_02': 'Ongpangkong South Block', 'MKC_03': 'Changtongya Block', 'MKC_04': 'Mangkolemba Block', 'MKC_05': 'Kobulong Block', 'MKC_06': 'Alongkima Block',
  'MON_01': 'Mon Block', 'MON_02': 'Chen Block', 'MON_03': 'Tobu Block', 'MON_04': 'Tizit Block', 'MON_05': 'Phomching Block', 'MON_06': 'Wakching Block', 'MON_07': 'Aboi Block', 'MON_08': 'Mopong Block',
  'NLD_01': 'Niuland Block', 'NLD_02': 'Aghunaqa Block',
  'NKL_01': 'Noklak Block', 'NKL_02': 'Thonoknyu Block',
  'PRN_01': 'Peren Block', 'PRN_02': 'Jalukie Block', 'PRN_03': 'Tening Block', 'PRN_04': 'Nsong Block', 'PRN_05': 'Athibung Block',
  'PHK_01': 'Phek Block', 'PHK_02': 'Pfutsero Block', 'PHK_03': 'Meluri Block', 'PHK_04': 'Chizami Block', 'PHK_05': 'Chozuba Block', 'PHK_06': 'Kikruma Block', 'PHK_07': 'Sekruzu Block', 'PHK_08': 'Weziho Block',
  'SMT_NL_01': 'Shamator Block', 'SMT_NL_02': 'Chessore Block',
  'TSM_01': 'Tseminyu Block',
  'TSG_01': 'Tuensang Sadar Block', 'TSG_02': 'Longkhim Block', 'TSG_03': 'Noksen Block', 'TSG_04': 'Chare Block', 'TSG_05': 'Panso Block', 'TSG_06': 'Sangsangnyu Block',
  'WKH_NL_01': 'Wokha Block', 'WKH_NL_02': 'Bhandari Block', 'WKH_NL_03': 'Sanis Block', 'WKH_NL_04': 'Wozhuro Block', 'WKH_NL_05': 'Chukitong Block', 'WKH_NL_06': 'Ralan Block', 'WKH_NL_07': 'Changpang Block',
  'ZHB_01': 'Zunheboto Block', 'ZHB_02': 'Akokoro Block', 'ZHB_03': 'Suruhuto Block', 'ZHB_04': 'Aghunato Block', 'ZHB_05': 'Pugoboto Block', 'ZHB_06': 'Satakha Block', 'ZHB_07': 'Tokiye Block', 'ZHB_08': 'Asuto Block',

  // --- TRIPURA (TR) 58 RD BLOCKS ACROSS 8 DISTRICTS ---
  'DHL_TR_01': 'Ambassa Block', 'DHL_TR_02': 'Chawmanu Block', 'DHL_TR_03': 'Dumburnagar Block', 'DHL_TR_04': 'Ganganagar Block', 'DHL_TR_05': 'Manu Block', 'DHL_TR_06': 'Salema Block', 'DHL_TR_07': 'Rupaichhari Block', 'DHL_TR_08': 'Surma Block',
  'GMT_01': 'Amarpur Block', 'GMT_02': 'Kakraban Block', 'GMT_03': 'Karbook Block', 'GMT_04': 'Killa Block', 'GMT_05': 'Matarbari Block', 'GMT_06': 'Ompi Block', 'GMT_07': 'Silachhari Block', 'GMT_08': 'Tepania Block',
  'KHW_01': 'Khowai Block', 'KHW_02': 'Padmabil Block', 'KHW_03': 'Tulashikhar Block', 'KHW_04': 'Teliamura Block', 'KHW_05': 'Kalyanpur Block', 'KHW_06': 'Mungiakami Block',
  'NTR_TR_01': 'Damcherra Block', 'NTR_TR_02': 'Dasda Block', 'NTR_TR_03': 'Jampui Hills Block', 'NTR_TR_04': 'Kadamtala Block', 'NTR_TR_05': 'Kalacherra Block', 'NTR_TR_06': 'Panisagar Block', 'NTR_TR_07': 'Pencharthal Block', 'NTR_TR_08': 'Yubarajnagar Block',
  'SPH_01': 'Bishalgarh Block', 'SPH_02': 'Charilam Block', 'SPH_03': 'Jampuijala Block', 'SPH_04': 'Kathalia Block', 'SPH_05': 'Mohanbhog Block', 'SPH_06': 'Nalchar Block', 'SPH_07': 'Boxanagar Block',
  'STR_TR_01': 'Bharat Chandra Nagar Block', 'STR_TR_02': 'Bokafa Block', 'STR_TR_03': 'Hrishyamukh Block', 'STR_TR_04': 'Jolaibari Block', 'STR_TR_05': 'Poangbari Block', 'STR_TR_06': 'Rajnagar Block', 'STR_TR_07': 'Rupaichari Block', 'STR_TR_08': 'Satchand Block',
  'UNK_01': 'Chandipur Block', 'UNK_02': 'Gournagar Block', 'UNK_03': 'Kumarghat Block', 'UNK_04': 'Pecharthal Block',
  'WTR_01': 'Bamutia Block', 'WTR_02': 'Belbari Block', 'WTR_03': 'Dukli Block', 'WTR_04': 'Hezamara Block', 'WTR_05': 'Jirania Block', 'WTR_06': 'Lefunga Block', 'WTR_07': 'Mandwi Block', 'WTR_08': 'Mohanpur Block', 'WTR_09': 'Old Agartala Block',

  // --- SIKKIM (SK) 34 BAC BLOCKS ACROSS 6 DISTRICTS ---
  'GTK_01': 'Khamdong Block', 'GTK_02': 'Martam Block', 'GTK_03': 'Nandok Block', 'GTK_04': 'Rakdong Tintek Block', 'GTK_05': 'Ranka Block',
  'GYL_01': 'Chumbong Block', 'GYL_02': 'Daramdin Block', 'GYL_03': 'Dentam Block', 'GYL_04': 'Gyalshing Block', 'GYL_05': 'Hee-Martam Block', 'GYL_06': 'Yuksom Block',
  'MGN_01': 'Chungthang Block', 'MGN_02': 'Dzongu Block', 'MGN_03': 'Kabi Tingda Block', 'MGN_04': 'Mangan Block',
  'NMC_SK_01': 'Jorethang Block', 'NMC_SK_02': 'Namchi Block', 'NMC_SK_03': 'Ravangla Block', 'NMC_SK_04': 'Sikip Block', 'NMC_SK_05': 'Sumbuk Block', 'NMC_SK_06': 'Temi Tarku Block', 'NMC_SK_07': 'Yangang Block',
  'PKY_01': 'Duga Block', 'PKY_02': 'Pakyong Block', 'PKY_03': 'Parakha Block', 'PKY_04': 'Regu Block', 'PKY_05': 'Rhenock Block', 'PKY_06': 'Rongli Block',
  'SRG_SK_01': 'Baiguney Block', 'SRG_SK_02': 'Chakung Block', 'SRG_SK_03': 'Mangalbarey Block', 'SRG_SK_04': 'Rinchenpong Block', 'SRG_SK_05': 'Soreng Block', 'SRG_SK_06': 'Timberbong Block',

  // --- ARUNACHAL PRADESH (AR) 129+ CD BLOCKS ACROSS 27 DISTRICTS ---
  'AJW_01': 'Chaglagam Block', 'AJW_02': 'Hayuliang Block', 'AJW_03': 'Hawai Block', 'AJW_04': 'Kibithoo Block', 'AJW_05': 'Manchal Block', 'AJW_06': 'Metengliang Block', 'AJW_07': 'Walong Block',
  'CHG_01': 'Bordumsa Block', 'CHG_02': 'Changlang Block', 'CHG_03': 'Diyun Block', 'CHG_04': 'Kharsang Block', 'CHG_05': 'Miao Block', 'CHG_06': 'Nampong Block', 'CHG_07': 'Vijoynagar Block',
  'DBV_01': 'Anini Block', 'DBV_02': 'Anelih Block', 'DBV_03': 'Etalin Block', 'DBV_04': 'Kronli Block', 'DBV_05': 'Mipi Block',
  'EKM_AR_01': 'Bameng Block', 'EKM_AR_02': 'Chayangtajo Block', 'EKM_AR_03': 'Pakke Kessang / Seppa Block', 'EKM_AR_04': 'Pipu Block', 'EKM_AR_05': 'Sawa Block', 'EKM_AR_06': 'Seppa Block', 'EKM_AR_07': 'Khenewa Block',
  'ESG_01': 'Mebo Block', 'ESG_02': 'Pasighat Block', 'ESG_03': 'Ruksin Block', 'ESG_04': 'Sille-Oyan Block',
  'KML_01': 'Dollungmukh Block', 'KML_02': 'Gepen Block', 'KML_03': 'Kamporijo Block', 'KML_04': 'Puchigeko Block', 'KML_05': 'Raga Block',
  'KRD_AR_01': 'Chambang Block', 'KRD_AR_02': 'Gangte Block', 'KRD_AR_03': 'Palin Block', 'KRD_AR_04': 'Pipsorang Block', 'KRD_AR_05': 'Tali Block', 'KRD_AR_06': 'Yangte Block',
  'KRK_01': 'Damin Block', 'KRK_02': 'Koloriang Block', 'KRK_03': 'Nyapin Block', 'KRK_04': 'Phassang Block', 'KRK_05': 'Sangram Block', 'KRK_06': 'Sarli Block',
  'LPD_01': 'Basar Block', 'LPD_02': 'Daring Block', 'LPD_03': 'Sago Block', 'LPD_04': 'Tirbin Block',
  'LHT_01': 'Tezu Block', 'LHT_02': 'Wakro Block', 'LHT_03': 'Sunpura Block',
  'LDG_01': 'Kanubari Block', 'LDG_02': 'Lawnu Block', 'LDG_03': 'Longding Block', 'LDG_04': 'Pangchao Block', 'LDG_05': 'Pumao Block', 'LDG_06': 'Wakka Block',
  'LDV_01': 'Dambuk Block', 'LDV_02': 'Desali Block', 'LDV_03': 'Hunli Block', 'LDV_04': 'Roing Block',
  'LWS_01': 'Gensi Block', 'LWS_02': 'Koyu Block', 'LWS_03': 'Likabali Block', 'LWS_04': 'Nari Block',
  'LSS_01': 'Yachuli Block', 'LSS_02': 'Ziro I Block', 'LSS_03': 'Ziro II Block',
  'NMS_01': 'Chowkham Block', 'NMS_02': 'Lathao Block', 'NMS_03': 'Namsai Block', 'NMS_04': 'Piyong Block',
  'PKK_01': 'Pakke Kessang Block', 'PKK_02': 'Pijerang Block', 'PKK_03': 'Passa Valley Block', 'PKK_04': 'Seijosa Block',
  'PPP_01': 'Balijan Block', 'PPP_02': 'Doimukh Block', 'PPP_03': 'Kimin Block', 'PPP_04': 'Mengio Block', 'PPP_05': 'Sagalee Block', 'PPP_06': 'Taraso Block',
  'SYM_01': 'Mechuka Block', 'SYM_02': 'Monigong Block', 'SYM_03': 'Pidi Block', 'SYM_04': 'Tato Block',
  'SNG_AR_01': 'Boleng Block', 'SNG_AR_02': 'Kaying Block', 'SNG_AR_03': 'Pangin Block', 'SNG_AR_04': 'Payum Block', 'SNG_AR_05': 'Rebo-Perging Block', 'SNG_AR_06': 'Riga Block', 'SNG_AR_07': 'Rumgong Block',
  'TWG_01': 'Jang Block', 'TWG_02': 'Kitpi Block', 'TWG_03': 'Lumla Block', 'TWG_04': 'Mukto Block', 'TWG_05': 'Tawang Block', 'TWG_06': 'Zemithang Block',
  'TRP_01': 'Deomali Block', 'TRP_02': 'Khonsa Block', 'TRP_03': 'Laju Block', 'TRP_04': 'Namsang Block', 'TRP_05': 'Soha Block',
  'UPS_01': 'Gelling Block', 'UPS_02': 'Jengging Block', 'UPS_03': 'Mariyang Block', 'UPS_04': 'Singa Block', 'UPS_05': 'Tuting Block', 'UPS_06': 'Yingkiong Block',
  'USS_01': 'Baririjo Block', 'USS_02': 'Daporijo Block', 'USS_03': 'Dumporijo Block', 'USS_04': 'Giba Block', 'USS_05': 'Nacho Block', 'USS_06': 'Payeng Block', 'USS_07': 'Siyum Block', 'USS_08': 'Taliha Block',
  'WKM_01': 'Dirang Block', 'WKM_02': 'Kalaktang Block', 'WKM_03': 'Nafra Block', 'WKM_04': 'Rupa Block', 'WKM_05': 'Singchung Block', 'WKM_06': 'Thembang Block', 'WKM_07': 'Thrizino Block',
  'WSG_01': 'Aalo East Block', 'WSG_02': 'Aalo West Block', 'WSG_03': 'Bagra Block', 'WSG_04': 'Darak Block', 'WSG_05': 'Liromoba Block', 'WSG_06': 'Yomcha Block',
  'ICC_01': 'Naharlagun / Banderdewa Block', 'ICC_02': 'Itanagar Rural Block',
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
  'MDB_01': 'Andhratharhi Block', 'MDB_02': 'Babubarhi Block', 'MDB_03': 'Basopatti Block', 'MDB_04': 'Benipatti Block', 'MDB_05': 'Bisfi Block', 'MDB_06': 'Ghoghardiha Block', 'MDB_07': 'Harlakhi Block', 'MDB_08': 'Jhanjharpur Block', 'MDB_09': 'Kaluahi Block', 'MDB_10': 'Khajauli Block', 'MDB_11': 'Ladania Block', 'MDB_12': 'Lakhnaur Block', 'MDB_13': 'Laukaha Block', 'MDB_14': 'Laukahi Block', 'MDB_15': 'Madhepur Block', 'MDB_16': 'Rahika Block', 'MDB_17': 'Pandaul Block', 'MDB_18': 'Phulparas Block', 'MDB_19': 'Rajnagar Block', 'MDB_20': 'Madhwapur Block',
  'MNG_01': 'Asarganj Block', 'MNG_02': 'Bariarpur Block', 'MNG_03': 'Dharhara Block', 'MNG_04': 'Haveli Kharagpur Block', 'MNG_05': 'Jamalpur Block', 'MNG_06': 'Munger Sadar Block', 'MNG_07': 'Sangrampur Block', 'MNG_08': 'Tarapur Block', 'MNG_09': 'Tetiha Bambar Block',
  'MUZ_01': 'Aurai Block', 'MUZ_02': 'Bandra Block', 'MUZ_03': 'Motipur Block', 'MUZ_04': 'Bochahan Block', 'MUZ_05': 'Gaighat Block', 'MUZ_06': 'Kanti Block', 'MUZ_07': 'Katra Block', 'MUZ_08': 'Kurhani Block', 'MUZ_09': 'Marwan Block', 'MUZ_10': 'Minapur Block', 'MUZ_11': 'Moraul Block', 'MUZ_12': 'Mushahari Block', 'MUZ_13': 'Paroo Block', 'MUZ_14': 'Sahebganj Block', 'MUZ_15': 'Sakra Block', 'MUZ_16': 'Saraiya Block',
  'NAL_01': 'Asthawan Block', 'NAL_02': 'Ben Block', 'NAL_03': 'Biharsharif Block', 'NAL_04': 'Bind Block', 'NAL_05': 'Chandi Block', 'NAL_06': 'Ekangarsarai Block', 'NAL_07': 'Giriyak Block', 'NAL_08': 'Harnaut Block', 'NAL_09': 'Hilsa Block', 'NAL_10': 'Islampur Block', 'NAL_11': 'Karai Parsurai Block', 'NAL_12': 'Katrisarai Block', 'NAL_13': 'Nagarnausa Block', 'NAL_14': 'Noorsarai Block', 'NAL_15': 'Parwalpur Block', 'NAL_16': 'Rahui Block', 'NAL_17': 'Rajgir Block', 'NAL_18': 'Sarmera Block', 'NAL_19': 'Silao Block', 'NAL_20': 'Tharthari Block',
  'NWD_01': 'Akbarpur Block', 'NWD_02': 'Gobindpur Block', 'NWD_03': 'Hisua Block', 'NWD_04': 'Kashichak Block', 'NWD_05': 'Kowakol Block', 'NWD_06': 'Meskaur Block', 'NWD_07': 'Nardiganj Block', 'NWD_08': 'Narhat Block', 'NWD_09': 'Nawada Block', 'NWD_10': 'Pakribarawan Block', 'NWD_11': 'Rajauli Block', 'NWD_12': 'Roh Block', 'NWD_13': 'Sirdala Block', 'NWD_14': 'Warisaliganj Block',
  'PAT_BR_01': 'Athmalgola Block', 'PAT_BR_02': 'Bakhtiarpur Block', 'PAT_BR_03': 'Barh Block', 'PAT_BR_04': 'Belchi Block', 'PAT_BR_05': 'Bihta Block', 'PAT_BR_06': 'Bikram Block', 'PAT_BR_07': 'Daniyawan Block', 'PAT_BR_08': 'Khusrupur Block', 'PAT_BR_09': 'Dhanarua Block', 'PAT_BR_10': 'Dulhin Bazar Block', 'PAT_BR_11': 'Fatuha Block', 'PAT_BR_12': 'Ghoswari Block', 'PAT_BR_13': 'Maner Block', 'PAT_BR_14': 'Masaurhi Block', 'PAT_BR_15': 'Mokama Block', 'PAT_BR_16': 'Naubatpur Block', 'PAT_BR_17': 'Paliganj Block', 'PAT_BR_18': 'Pandarak Block', 'PAT_BR_19': 'Patna Sadar Block', 'PAT_BR_20': 'Phulwari Sharif Block', 'PAT_BR_21': 'Punpun Block', 'PAT_BR_22': 'Sampatchak Block', 'PAT_BR_23': 'Danapur Block',
  'PUR_01': 'Amour Block', 'PUR_02': 'Baisa Block', 'PUR_03': 'Baisi Block', 'PUR_04': 'Banmankhi Block', 'PUR_05': 'Barhara Kothi Block', 'PUR_06': 'Bhawanipur Block', 'PUR_07': 'Dagarua Block', 'PUR_08': 'Dhamdaha Block', 'PUR_09': 'Jalalgarh Block', 'PUR_10': 'Kasba Block', 'PUR_11': 'Krityanand Nagar Block', 'PUR_12': 'Purnia East Block', 'PUR_13': 'Rupouli Block', 'PUR_14': 'Srinagar Block',
  'RHT_01': 'Akorhi Gola Block', 'RHT_02': 'Bikramganj Block', 'RHT_03': 'Chenari Block', 'RHT_04': 'Dawath Block', 'RHT_05': 'Dehri Block', 'RHT_06': 'Dinara Block', 'RHT_07': 'Karakat Block', 'RHT_08': 'Kargahar Block', 'RHT_09': 'Kochas Block', 'RHT_10': 'Nasriganj Block', 'RHT_11': 'Nauhatta Block', 'RHT_12': 'Nokha Block', 'RHT_13': 'Rajpur Block', 'RHT_14': 'Rohtas Block', 'RHT_15': 'Sanjhauli Block', 'RHT_16': 'Sasaram Block', 'RHT_17': 'Sheosagar Block', 'RHT_18': 'Suryapura Block', 'RHT_19': 'Tilouthu Block',
  'SHS_01': 'Banma Itahri Block', 'SHS_02': 'Kahara Block', 'SHS_03': 'Mahishi Block', 'SHS_04': 'Nauhatta Block', 'SHS_05': 'Patarghat Block', 'SHS_06': 'Paterhi Belsar Block', 'SHS_07': 'Salkhua Block', 'SHS_08': 'Sattar Kattaiya Block', 'SHS_09': 'Saur Bazar Block', 'SHS_10': 'Simri Bakhtiarpur Block', 'SHS_11': 'Sonbarsa Block',
  'SMT_01': 'Bibhutipur Block', 'SMT_02': 'Bithan Block', 'SMT_03': 'Dalsinghsarai Block', 'SMT_04': 'Hasanpur Block', 'SMT_05': 'Kalyanpur Block', 'SMT_06': 'Khanpur Block', 'SMT_07': 'Mohanpur Block', 'SMT_08': 'Mohiuddin Nagar Block', 'SMT_09': 'Morwa Block', 'SMT_10': 'Patori Block', 'SMT_11': 'Pusa Block', 'SMT_12': 'Rosera Block', 'SMT_13': 'Samastipur Block', 'SMT_14': 'Sarairanjan Block', 'SMT_15': 'Shivaji Nagar Block', 'SMT_16': 'Singhia Block', 'SMT_17': 'Tajpur Block', 'SMT_18': 'Ujiarpur Block', 'SMT_19': 'Vidyapati Nagar Block', 'SMT_20': 'Warishnagar Block',
  'SRN_01': 'Amnour Block', 'SRN_02': 'Baniapur Block', 'SRN_03': 'Chapra Block', 'SRN_04': 'Dariyapur Block', 'SRN_05': 'Dighwara Block', 'SRN_06': 'Ekma Block', 'SRN_07': 'Garkha Block', 'SRN_08': 'Ishuapur Block', 'SRN_09': 'Jalalpur Block', 'SRN_10': 'Lahladpur Block', 'SRN_11': 'Maker Block', 'SRN_12': 'Manjhi Block', 'SRN_13': 'Marhaura Block', 'SRN_14': 'Mashrakh Block', 'SRN_15': 'Nagra Block', 'SRN_16': 'Panapur Block', 'SRN_17': 'Parsa Block', 'SRN_18': 'Rivilganj Block', 'SRN_19': 'Sonepur Block', 'SRN_20': 'Taraiya Block',
  'SKP_01': 'Ariari Block', 'SKP_02': 'Barbigha Block', 'SKP_03': 'Chewara Block', 'SKP_04': 'Ghat Kusumbha Block', 'SKP_05': 'Sheikhpura Block', 'SKP_06': 'Shekhopur Sarai Block',
  'SHH_01': 'Dumri Katsari Block', 'SHH_02': 'Piprarhi Block', 'SHH_03': 'Purnahiya Block', 'SHH_04': 'Sheohar Block', 'SHH_05': 'Tariyani Chowk Block',
  'STM_01': 'Bairgania Block', 'STM_02': 'Bajpatti Block', 'STM_03': 'Bathanaha Block', 'STM_04': 'Belsand Block', 'STM_05': 'Bokra Block', 'STM_06': 'Charaut Block', 'STM_07': 'Dumra Block', 'STM_08': 'Nanpur Block', 'STM_09': 'Parihar Block', 'STM_10': 'Parsauni Block', 'STM_11': 'Pupri Block', 'STM_12': 'Riga Block', 'STM_13': 'Runnisaidpur Block', 'STM_14': 'Sursand Block', 'STM_15': 'Sonbarsa Block', 'STM_16': 'Suppi Block', 'STM_17': 'Majorganj Block',
  'SWN_01': 'Andar Block', 'SWN_02': 'Barharia Block', 'SWN_03': 'Basantpur Block', 'SWN_04': 'Bhagwanpur Hat Block', 'SWN_05': 'Darauli Block', 'SWN_06': 'Daraundha Block', 'SWN_07': 'Goreyakothi Block', 'SWN_08': 'Guthani Block', 'SWN_09': 'Hasanpura Block', 'SWN_10': 'Hussainganj Block', 'SWN_11': 'Jiradei Block', 'SWN_12': 'Lakri Nabiganj Block', 'SWN_13': 'Maharajganj Block', 'SWN_14': 'Mairwa Block', 'SWN_15': 'Nautan Block', 'SWN_16': 'Pachrukhi Block', 'SWN_17': 'Raghunathpur Block', 'SWN_18': 'Siswan Block', 'SWN_19': 'Siwan Block',
  'SPL_01': 'Basantpur Block', 'SPL_02': 'Chhatapur Block', 'SPL_03': 'Kishanpur Block', 'SPL_04': 'Marauna Block', 'SPL_05': 'Nirmali Block', 'SPL_06': 'Pipra Block', 'SPL_07': 'Pratapganj Block', 'SPL_08': 'Raghopur Block', 'SPL_09': 'Saraigarh Bhaptiyahi Block', 'SPL_10': 'Supaul Block', 'SPL_11': 'Triveniganj Block',
  'VSH_01': 'Bhagwanpur Block', 'VSH_02': 'Bidupur Block', 'VSH_03': 'Chehra Kalan Block', 'VSH_04': 'Desri Block', 'VSH_05': 'Goraul Block', 'VSH_06': 'Hajipur Block', 'VSH_07': 'Jandaha Block', 'VSH_08': 'Lalganj Block', 'VSH_09': 'Mahnar Block', 'VSH_10': 'Mahua Block', 'VSH_11': 'Patedhi Belsar Block', 'VSH_12': 'Patepur Block', 'VSH_13': 'Raghopur Block', 'VSH_14': 'Rajaapakar Block', 'VSH_15': 'Sahdei Buzurg Block', 'VSH_16': 'Vaishali Block',
  'WCM_01': 'Bagaha I Block', 'WCM_02': 'Bagaha II Block', 'WCM_03': 'Bairia Block', 'WCM_04': 'Bettiah Block', 'WCM_05': 'Bhitaha Block', 'WCM_06': 'Chanpatia Block', 'WCM_07': 'Gaunaha Block', 'WCM_08': 'Jogapatti Block', 'WCM_09': 'Lauriya Block', 'WCM_10': 'Madhubani Block', 'WCM_11': 'Mainatand Block', 'WCM_12': 'Majhaulia Block', 'WCM_13': 'Narkatiaganj Block', 'WCM_14': 'Nautan Block', 'WCM_15': 'Piprasi Block', 'WCM_16': 'Ramnagar Block', 'WCM_17': 'Sikta Block', 'WCM_18': 'Thakaraha Block',
  // --- KARNATAKA (KA) 230+ TALUKAS ACROSS 31 DISTRICTS ---
  'BGK_01': 'Badami Block', 'BGK_02': 'Bagalkote Block', 'BGK_03': 'Bilagi Block', 'BGK_04': 'Hunagund Block', 'BGK_05': 'Jamkhandi Block', 'BGK_06': 'Mudhol Block', 'BGK_07': 'Ilkal Block', 'BGK_08': 'Rabkavi Banhatti Block', 'BGK_09': 'Guledgudda Block',
  'BLR_KA_01': 'Ballari Block', 'BLR_KA_02': 'Kurugodu Block', 'BLR_KA_03': 'Kampli Block', 'BLR_KA_04': 'Sandur Block', 'BLR_KA_05': 'Siruguppa Block',
  'BLG_KA_01': 'Athani Block', 'BLG_KA_02': 'Bailhongal Block', 'BLG_KA_03': 'Belagavi Block', 'BLG_KA_04': 'Chikkodi Block', 'BLG_KA_05': 'Gokak Block', 'BLG_KA_06': 'Hukkeri Block', 'BLG_KA_07': 'Khanapur Block', 'BLG_KA_08': 'Ramdurg Block', 'BLG_KA_09': 'Raybag Block', 'BLG_KA_10': 'Saundatti Block', 'BLG_KA_11': 'Kagawad Block', 'BLG_KA_12': 'Mudalagi Block', 'BLG_KA_13': 'Nippani Block', 'BLG_KA_14': 'Kittur Block', 'BLG_KA_15': 'Yaragatti Block',
  'BGR_01': 'Devanahalli Block', 'BGR_02': 'Doddaballapura Block', 'BGR_03': 'Hosakote Block', 'BGR_04': 'Nelamangala Block',
  'BGU_01': 'Bengaluru North Block', 'BGU_02': 'Bengaluru South Block', 'BGU_03': 'Bengaluru East Block', 'BGU_04': 'Anekal Block', 'BGU_05': 'Yelahanka Block',
  'BDR_01': 'Aurad Block', 'BDR_02': 'Basavakalyan Block', 'BDR_03': 'Bhalki Block', 'BDR_04': 'Bidar Block', 'BDR_05': 'Humnabad Block', 'BDR_06': 'Chitgoppa Block', 'BDR_07': 'Hulsoor Block', 'BDR_08': 'Kamalanagar Block',
  'CRN_01': 'Chamarajanagara Block', 'CRN_02': 'Gundlupete Block', 'CRN_03': 'Kollegala Block', 'CRN_04': 'Yelandur Block', 'CRN_05': 'Hanur Block',
  'CKB_01': 'Bagepalli Block', 'CKB_02': 'Chikkaballapura Block', 'CKB_03': 'Chintamani Block', 'CKB_04': 'Gauribidanur Block', 'CKB_05': 'Gudibanda Block', 'CKB_06': 'Sidlaghatta Block', 'CKB_07': 'Chelur Block',
  'CKM_01': 'Chikkamagaluru Block', 'CKM_02': 'Kadur Block', 'CKM_03': 'Koppa Block', 'CKM_04': 'Mudigere Block', 'CKM_05': 'Narasimharajapura Block', 'CKM_06': 'Sringeri Block', 'CKM_07': 'Tarikere Block', 'CKM_08': 'Ajampura Block', 'CKM_09': 'Kalasa Block',
  'CTA_01': 'Challakere Block', 'CTA_02': 'Chitradurga Block', 'CTA_03': 'Holalkere Block', 'CTA_04': 'Hosadurga Block', 'CTA_05': 'Molakalmuru Block', 'CTA_06': 'Hiriyur Block',
  'DKN_01': 'Bantwal Block', 'DKN_02': 'Belthangady Block', 'DKN_03': 'Mangaluru Block', 'DKN_04': 'Puttur Block', 'DKN_05': 'Sullia Block', 'DKN_06': 'Kadaba Block', 'DKN_07': 'Moodbidri Block', 'DKN_08': 'Ullal Block',
  'DVG_01': 'Channagiri Block', 'DVG_02': 'Davanagere Block', 'DVG_03': 'Harihara Block', 'DVG_04': 'Honnali Block', 'DVG_05': 'Jagalur Block', 'DVG_06': 'Nyamathi Block',
  'DHW_01': 'Dharwad Block', 'DHW_02': 'Hubballi Rural Block', 'DHW_03': 'Kalghatgi Block', 'DHW_04': 'Kundgol Block', 'DHW_05': 'Navalgund Block', 'DHW_06': 'Alnavar Block', 'DHW_07': 'Annigeri Block', 'DHW_08': 'Hubballi Urban Block',
  'GDG_01': 'Gadag Block', 'GDG_02': 'Mundargi Block', 'GDG_03': 'Nargund Block', 'GDG_04': 'Ron Block', 'GDG_05': 'Shirhatti Block', 'GDG_06': 'Gajendragad Block', 'GDG_07': 'Lakshmeshwar Block',
  'HSN_01': 'Alur Block', 'HSN_02': 'Arkalgud Block', 'HSN_03': 'Arsikere Block', 'HSN_04': 'Belur Block', 'HSN_05': 'Channarayapatna Block', 'HSN_06': 'Hassan Block', 'HSN_07': 'Holenarasipura Block', 'HSN_08': 'Sakleshpur Block',
  'HVR_01': 'Byadgi Block', 'HVR_02': 'Hangal Block', 'HVR_03': 'Haveri Block', 'HVR_04': 'Hirekerur Block', 'HVR_05': 'Ranebennur Block', 'HVR_06': 'Savanur Block', 'HVR_07': 'Shiggaon Block', 'HVR_08': 'Rattihalli Block',
  'KLB_01': 'Afzalpur Block', 'KLB_02': 'Aland Block', 'KLB_03': 'Chincholi Block', 'KLB_04': 'Chitapur Block', 'KLB_05': 'Kalaburagi Block', 'KLB_06': 'Jevargi Block', 'KLB_07': 'Sedam Block', 'KLB_08': 'Kamalapur Block', 'KLB_09': 'Yedrami Block', 'KLB_10': 'Shahabad Block', 'KLB_11': 'Kalagi Block',
  'KDG_01': 'Madikeri Block', 'KDG_02': 'Somwarpet Block', 'KDG_03': 'Virajpet Block', 'KDG_04': 'Ponnampet Block', 'KDG_05': 'Kushalnagar Block',
  'KLR_01': 'Bangarapet Block', 'KLR_02': 'Kolar Block', 'KLR_03': 'Malur Block', 'KLR_04': 'Mulbagal Block', 'KLR_05': 'Srinivaspur Block', 'KLR_06': 'KGF Block',
  'KPL_01': 'Gangavathi Block', 'KPL_02': 'Koppal Block', 'KPL_03': 'Kushtagi Block', 'KPL_04': 'Yelbarga Block', 'KPL_05': 'Kanakagiri Block', 'KPL_06': 'Kuknoor Block', 'KPL_07': 'Karatagi Block',
  'MDY_01': 'Krishnarajpete Block', 'MDY_02': 'Maddur Block', 'MDY_03': 'Malavalli Block', 'MDY_04': 'Mandya Block', 'MDY_05': 'Nagamangala Block', 'MDY_06': 'Pandavapura Block', 'MDY_07': 'Shrirangapattana Block',
  'MYS_01': 'Heggadadevankote Block', 'MYS_02': 'Hunsur Block', 'MYS_03': 'Krishnarajanagara Block', 'MYS_04': 'Mysuru Block', 'MYS_05': 'Nanjangud Block', 'MYS_06': 'Piriyapatna Block', 'MYS_07': 'T. Narasipura Block', 'MYS_08': 'Saragur Block', 'MYS_09': 'Saligrama Block',
  'RCR_01': 'Devadurga Block', 'RCR_02': 'Lingsugur Block', 'RCR_03': 'Manvi Block', 'RCR_04': 'Raichur Block', 'RCR_05': 'Sindhanur Block', 'RCR_06': 'Maski Block', 'RCR_07': 'Sirwar Block',
  'RMN_01': 'Channapatna Block', 'RMN_02': 'Kanakapura Block', 'RMN_03': 'Magadi Block', 'RMN_04': 'Ramanagara Block', 'RMN_05': 'Harohalli Block',
  'SHM_01': 'Bhadravathi Block', 'SHM_02': 'Hosanagara Block', 'SHM_03': 'Sagara Block', 'SHM_04': 'Shikaripura Block', 'SHM_05': 'Shivamogga Block', 'SHM_06': 'Soraba Block', 'SHM_07': 'Thirthahalli Block',
  'TMK_01': 'Chikkanayakanahalli Block', 'TMK_02': 'Gubbi Block', 'TMK_03': 'Koratagere Block', 'TMK_04': 'Kunigal Block', 'TMK_05': 'Madhugiri Block', 'TMK_06': 'Pavagada Block', 'TMK_07': 'Sira Block', 'TMK_08': 'Tiptur Block', 'TMK_09': 'Tumakuru Block', 'TMK_10': 'Turuvekere Block',
  'UDP_KA_01': 'Karkala Block', 'UDP_KA_02': 'Kundapura Block', 'UDP_KA_03': 'Udupi Block', 'UDP_KA_04': 'Brahmavara Block', 'UDP_KA_05': 'Byndoor Block', 'UDP_KA_06': 'Kaup Block', 'UDP_KA_07': 'Hebri Block',
  'UKN_01': 'Ankola Block', 'UKN_02': 'Bhatkal Block', 'UKN_03': 'Haliyal Block', 'UKN_04': 'Honnavar Block', 'UKN_05': 'Karwar Block', 'UKN_06': 'Kumta Block', 'UKN_07': 'Mundgod Block', 'UKN_08': 'Siddapur Block', 'UKN_09': 'Sirsi Block', 'UKN_10': 'Joida Block', 'UKN_11': 'Yellapur Block', 'UKN_12': 'Dandeli Block',
  'VJN_01': 'Hosapete Block', 'VJN_02': 'Hagaribommanahalli Block', 'VJN_03': 'Harapanahalli Block', 'VJN_04': 'Hoovina Hadagali Block', 'VJN_05': 'Kotturu Block', 'VJN_06': 'Kudligi Block',
  'VJP_01': 'Basavana Bagewadi Block', 'VJP_02': 'Vijayapura Block', 'VJP_03': 'Indi Block', 'VJP_04': 'Muddebihal Block', 'VJP_05': 'Sindagi Block', 'VJP_06': 'Chadchan Block', 'VJP_07': 'Devara Hippargi Block', 'VJP_08': 'Kolhar Block', 'VJP_09': 'Nidagundi Block', 'VJP_10': 'Babaleshwar Block', 'VJP_11': 'Tikota Block', 'VJP_12': 'Talikoti Block', 'VJP_13': 'Almel Block',
  'YDG_01': 'Shahapur Block', 'YDG_02': 'Shorapur Block', 'YDG_03': 'Yadgir Block', 'YDG_04': 'Gurmatkal Block', 'YDG_05': 'Hunsagi Block', 'YDG_06': 'Vadagera Block',

  // --- CHHATTISGARH (CG) 146 BLOCKS ACROSS 33 DISTRICTS ---
  'BLD_CG_01': 'Balod Block', 'BLD_CG_02': 'Dondi Block', 'BLD_CG_03': 'Dondi Luhara Block', 'BLD_CG_04': 'Gunderdehi Block', 'BLD_CG_05': 'Gurur Block',

  'BDB_01': 'Baloda Bazar Block', 'BDB_02': 'Bhatapara Block', 'BDB_03': 'Kasdol Block', 'BDB_04': 'Palari Block', 'BDB_05': 'Simga Block',

  'BLR_CG_01': 'Balrampur Block', 'BLR_CG_02': 'Kusmi Block', 'BLR_CG_03': 'Rajpur Block', 'BLR_CG_04': 'Ramanujganj Block', 'BLR_CG_05': 'Samri Block', 'BLR_CG_06': 'Shankargarh Block', 'BLR_CG_07': 'Wadrafnagar Block',

  'BST_CG_01': 'Bastanar Block', 'BST_CG_02': 'Bastar Block', 'BST_CG_03': 'Bakawand Block', 'BST_CG_04': 'Darbha Block', 'BST_CG_05': 'Jagdalpur Block', 'BST_CG_06': 'Lohandiguda Block', 'BST_CG_07': 'Tokapal Block',

  'BMT_01': 'Bemetara Block', 'BMT_02': 'Berla Block', 'BMT_03': 'Nawagarh Block', 'BMT_04': 'Saja Block',

  'BJP_01': 'Bhairamgarh Block', 'BJP_02': 'Bhopalpatnam Block', 'BJP_03': 'Bijapur Block', 'BJP_04': 'Usoor Block',

  'BLP_CG_01': 'Bilha Block', 'BLP_CG_02': 'Kota Block', 'BLP_CG_03': 'Masturi Block', 'BLP_CG_04': 'Takhatpur Block',

  'DTW_01': 'Dantewada Block', 'DTW_02': 'Geedam Block', 'DTW_03': 'Katekalyan Block', 'DTW_04': 'Kuwakonda Block',

  'DHM_01': 'Dhamtari Block', 'DHM_02': 'Kurud Block', 'DHM_03': 'Magarlod Block', 'DHM_04': 'Nagri Block',

  'DRG_01': 'Dhamdha Block', 'DRG_02': 'Durg Block', 'DRG_03': 'Patan Block',

  'GRB_01': 'Chhura Block', 'GRB_02': 'Fingeshwar Block', 'GRB_03': 'Gariaband Block', 'GRB_04': 'Mainpur Block', 'GRB_05': 'Deobhog Block',

  'GPM_01': 'Gaurella I Block', 'GPM_02': 'Pendra II Block', 'GPM_03': 'Marwahi Block',

  'JJC_01': 'Akaltara Block', 'JJC_02': 'Baloda Block', 'JJC_03': 'Bamhindih Block', 'JJC_04': 'Champa Block', 'JJC_05': 'Janjgir Block', 'JJC_06': 'Nawagarh Block', 'JJC_07': 'Pamgarh Block',

  'JSP_CG_01': 'Bagicha Block', 'JSP_CG_02': 'Duldula Block', 'JSP_CG_03': 'Farasabahar Block', 'JSP_CG_04': 'Jashpur Block', 'JSP_CG_05': 'Kansabel Block', 'JSP_CG_06': 'Kunkuri Block', 'JSP_CG_07': 'Manora Block', 'JSP_CG_08': 'Pathalgaon Block',

  'KBD_01': 'Bodla Block', 'KBD_02': 'Kawardha Block', 'KBD_03': 'Pandariya Block', 'KBD_04': 'Sahaspur Lohara Block',

  'KNK_01': 'Antagarh Block', 'KNK_02': 'Bhanupratappur Block', 'KNK_03': 'Charama Block', 'KNK_04': 'Durgukondal Block', 'KNK_05': 'Kanker Block', 'KNK_06': 'Koyalibeda Block', 'KNK_07': 'Narharpur Block',

  'KCG_01': 'Chhuikhadan Block', 'KCG_02': 'Gandai Block', 'KCG_03': 'Khairagarh Block',

  'KDG_CG_01': 'Bade Rajpur Block', 'KDG_CG_02': 'Farasgaon Block', 'KDG_CG_03': 'Keshkal Block', 'KDG_CG_04': 'Kondagaon Block', 'KDG_CG_05': 'Makdi Block',

  'KRB_01': 'Kartala Block', 'KRB_02': 'Katghora Block', 'KRB_03': 'Korba Block', 'KRB_04': 'Pali Block', 'KRB_05': 'Poundi Uproda Block',

  'KRY_01': 'Baikunthpur Block', 'KRY_02': 'Sonhat Block',

  'MSM_01': 'Bagbahara Block', 'MSM_02': 'Basna Block', 'MSM_03': 'Mahasamund Block', 'MSM_04': 'Pithora Block', 'MSM_05': 'Saraipali Block',

  'MCB_01': 'Bharatpur Block', 'MCB_02': 'Khadgawan Block', 'MCB_03': 'Manendragarh Block',

  'MMA_01': 'Ambagarh Chowki Block', 'MMA_02': 'Manpur Block', 'MMA_03': 'Mohla Block',

  'MGL_01': 'Lormi Block', 'MGL_02': 'Mungeli Block', 'MGL_03': 'Pathariya Block',

  'NRP_01': 'Narayanpur Block', 'NRP_02': 'Orchha Block',

  'RGH_01': 'Gharghoda Block', 'RGH_02': 'Kharsia Block', 'RGH_03': 'Lailunga Block', 'RGH_04': 'Pussore Block', 'RGH_05': 'Raigarh Block', 'RGH_06': 'Tamnar Block',

  'RPR_01': 'Abhanpur Block', 'RPR_02': 'Arang Block', 'RPR_03': 'Dharsiwa Block', 'RPR_04': 'Tilda Block',

  'RJN_01': 'Chhuria Block', 'RJN_02': 'Dongargaon Block', 'RJN_03': 'Dongargarh Block', 'RJN_04': 'Rajnandgaon Block',

  'SKT_01': 'Dabhra Block', 'SKT_02': 'Jaijaipur Block', 'SKT_03': 'Malkharoda Block', 'SKT_04': 'Sakti Block',

  'SGB_01': 'Baramkela Block', 'SGB_02': 'Bilaigarh Block', 'SGB_03': 'Sarangarh Block',

  'SKM_01': 'Chhindgarh Block', 'SKM_02': 'Konta Block', 'SKM_03': 'Sukma Block',

  'SRJ_01': 'Bhaiyathan Block', 'SRJ_02': 'Odaragi Block', 'SRJ_03': 'Pratappur Block', 'SRJ_04': 'Premnagar Block', 'SRJ_05': 'Ramanujnagar Block', 'SRJ_06': 'Surajpur Block',

  'SRG_01': 'Ambikapur Block', 'SRG_02': 'Batauli Block', 'SRG_03': 'Lakhanpur Block', 'SRG_04': 'Lundra Block', 'SRG_05': 'Mainpat Block', 'SRG_06': 'Sitapur Block', 'SRG_07': 'Udaipur Block',

  // --- ASSAM (AS) 234+ BLOCKS ACROSS 35 DISTRICTS ---
  'BJL_01': 'Bajali Block', 'BJL_02': 'Bhawanipur Block', 'BJL_03': 'Jalah Block',

  'BKS_01': 'Baksa Block', 'BKS_02': 'Barama Block', 'BKS_03': 'Baska Block', 'BKS_04': 'Dhamdhama Block', 'BKS_05': 'Goreswar Block', 'BKS_06': 'Jalah Block', 'BKS_07': 'Nagrijuli Block', 'BKS_08': 'Tamulpur Block',

  'BRP_01': 'Barpeta Block', 'BRP_02': 'Bhabanipur Block', 'BRP_03': 'Chenga Block', 'BRP_04': 'Gobardhana Block', 'BRP_05': 'Gomaphulbari Block', 'BRP_06': 'Mandia Block', 'BRP_07': 'Pakabetbari Block', 'BRP_08': 'Rupshi Block', 'BRP_09': 'Sarthebari Block',

  'BSW_AS_01': 'Baghmara Block', 'BSW_AS_02': 'Behali Block', 'BSW_AS_03': 'Biswanath Block', 'BSW_AS_04': 'Chaiduar Block', 'BSW_AS_05': 'Pub-Chaiduar Block', 'BSW_AS_06': 'Sakomatha Block', 'BSW_AS_07': 'Sootea Block',

  'BNG_AS_01': 'Boitamari Block', 'BNG_AS_02': 'Dangtol Block', 'BNG_AS_03': 'Manikpur Block', 'BNG_AS_04': 'Srijangram Block', 'BNG_AS_05': 'Tapattary Block',

  'CCH_01': 'Banskandi Block', 'CCH_02': 'Binnakandi Block', 'CCH_03': 'Katigorah Block', 'CCH_04': 'Kalain Block', 'CCH_05': 'Lakhipur Block', 'CCH_06': 'Narsingpur Block', 'CCH_07': 'Palonghat Block', 'CCH_08': 'Raja Bazar Block', 'CCH_09': 'Salchapra Block', 'CCH_10': 'Silchar Block', 'CCH_11': 'Sonai Block', 'CCH_12': 'Tapang Block', 'CCH_13': 'Udharbond Block', 'CCH_14': 'Barjalenga Block', 'CCH_15': 'Borkhola Block',

  'CRD_01': 'Lakwa Block', 'CRD_02': 'Mahmora Block', 'CRD_03': 'Sapekhati Block', 'CRD_04': 'Sonari Block',

  'CRG_01': 'Borobazar Block', 'CRG_02': 'Manikpur Block', 'CRG_03': 'Sidli-Chirang Block',

  'DRG_AS_01': 'Bechimari Block', 'DRG_AS_02': 'Dalgaon-Sialmari Block', 'DRG_AS_03': 'Kalaigaon Block', 'DRG_AS_04': 'Kharupetia Block', 'DRG_AS_05': 'Mangaldai Block', 'DRG_AS_06': 'Pachim-Mangaldai Block', 'DRG_AS_07': 'Pub-Mangaldai Block', 'DRG_AS_08': 'Sipajhar Block',

  'DMJ_01': 'Bordoloni Block', 'DMJ_02': 'Dhemaji Block', 'DMJ_03': 'Machkhowa Block', 'DMJ_04': 'Murkongselek Block', 'DMJ_05': 'Sissiborgaon Block',

  'DHB_01': 'Agomoni Block', 'DHB_02': 'Bilasipara Block', 'DHB_03': 'Birshing Jarua Block', 'DHB_04': 'Chapar-Salkocha Block', 'DHB_05': 'Debattar Hasdaha Block', 'DHB_06': 'Gauripur Block', 'DHB_07': 'Golakganj Block', 'DHB_08': 'Jamadarhat Block', 'DHB_09': 'Mahamaya Block', 'DHB_10': 'Nayeralga Block', 'DHB_11': 'Rupshi Block', 'DHB_12': 'Tulamora Block',

  'DBR_01': 'Barbaruah Block', 'DBR_02': 'Joypur Block', 'DBR_03': 'Khowang Block', 'DBR_04': 'Lahoal Block', 'DBR_05': 'Panitola Block', 'DBR_06': 'Tengakhat Block', 'DBR_07': 'Tingkhong Block',

  'DMH_AS_01': 'Diyungbra Block', 'DMH_AS_02': 'Harangajao Block', 'DMH_AS_03': 'Jatinga Valley Block', 'DMH_AS_04': 'Mahur Block', 'DMH_AS_05': 'New Sangbar Block',

  'GLP_01': 'Balijana Block', 'GLP_02': 'Jaleswar Block', 'GLP_03': 'Kharmuza Block', 'GLP_04': 'Krishnai Block', 'GLP_05': 'Kuchdhowa Block', 'GLP_06': 'Lakhipur Block', 'GLP_07': 'Matia Block', 'GLP_08': 'Rangjuli Block',

  'GLT_01': 'Bokakhat Block', 'GLT_02': 'Golaghat Central Block', 'GLT_03': 'Golaghat East Block', 'GLT_04': 'Golaghat North Block', 'GLT_05': 'Golaghat South Block', 'GLT_06': 'Golaghat West Block', 'GLT_07': 'Kakodonga Block', 'GLT_08': 'Morongi Block',

  'HLK_01': 'Algapur Block', 'HLK_02': 'Hailakandi Block', 'HLK_03': 'Katlicherra Block', 'HLK_04': 'Lala Block', 'HLK_05': 'South Hailakandi Block',

  'HOJ_01': 'Dhalpukhuri Block', 'HOJ_02': 'Jugijan Block', 'HOJ_03': 'Lummerding Block', 'HOJ_04': 'Odalbakra Block', 'HOJ_05': 'Udali Block',

  'JRH_01': 'Central Jorhat Block', 'JRH_02': 'East Jorhat Block', 'JRH_03': 'Jorhat Block', 'JRH_04': 'Kaliapani Block', 'JRH_05': 'Majuli / Ujani Block', 'JRH_06': 'North West Jorhat Block', 'JRH_07': 'Titabor Block',

  'KRM_01': 'Bezera Block', 'KRM_02': 'Chandrapur Block', 'KRM_03': 'Dimoria Block', 'KRM_04': 'Rani Block', 'KRM_05': 'Sualkuchi Block',

  'KRR_AS_01': 'Bangaon Block', 'KRR_AS_02': 'Boko Block', 'KRR_AS_03': 'Chamaria Block', 'KRR_AS_04': 'Chaygaon Block', 'KRR_AS_05': 'Goroimari Block', 'KRR_AS_06': 'Hajo Block', 'KRR_AS_07': 'Kamalpur Block', 'KRR_AS_08': 'Rampur Block', 'KRR_AS_09': 'Rangia Block', 'KRR_AS_10': 'Sualkuchi Block', 'KRR_AS_11': 'Tukreshwari Block',

  'KBA_01': 'Bokajan Block', 'KBA_02': 'Chinthong Block', 'KBA_03': 'Howraghat Block', 'KBA_04': 'Lumbajong Block', 'KBA_05': 'Nilip Block', 'KBA_06': 'Rongmongwe Block', 'KBA_07': 'Samyangphon Block', 'KBA_08': 'Silonijan Block', 'KBA_09': 'Socheng Block',

  'KMG_01': 'Badarpur Block', 'KMG_02': 'Dulavcherra Block', 'KMG_03': 'Karimganj North Block', 'KMG_04': 'Karimganj South Block', 'KMG_05': 'Lowairpoa Block', 'KMG_06': 'Patharkandi Block', 'KMG_07': 'Ramkrishna Nagar Block',

  'KKR_AS_01': 'Dotma Block', 'KKR_AS_02': 'Gossaigaon Block', 'KKR_AS_03': 'Hatidhura Block', 'KKR_AS_04': 'Kachugaon Block', 'KKR_AS_05': 'Kokrajhar Block', 'KKR_AS_06': 'Mahamaya Block', 'KKR_AS_07': 'Rupshi Block',

  'LKP_AS_01': 'Bihpuria Block', 'LKP_AS_02': 'Dhakuakhana Block', 'LKP_AS_03': 'Ghilamara Block', 'LKP_AS_04': 'Karunabari Block', 'LKP_AS_05': 'Lakhimpur Block', 'LKP_AS_06': 'Narayanpur Block', 'LKP_AS_07': 'Nowboicha Block', 'LKP_AS_08': 'Telahi Block', 'LKP_AS_09': 'Bordoibam Boginadi Block',

  'MJL_01': 'Majuli Block', 'MJL_02': 'Ujani Majuli Block',

  'MRG_01': 'Batadraba Block', 'MRG_02': 'Bhurbandha Block', 'MRG_03': 'Dolongghat Block', 'MRG_04': 'Kapili Block', 'MRG_05': 'Lahorighat Block', 'MRG_06': 'Mayang Block', 'MRG_07': 'Moirabari Block',

  'NGN_01': 'Bajiagaon Block', 'NGN_02': 'Barhampur Block', 'NGN_03': 'Batadraba Block', 'NGN_04': 'Dolongghat Block', 'NGN_05': 'Juria Block', 'NGN_06': 'Kaliabor Block', 'NGN_07': 'Kathiatoli Block', 'NGN_08': 'Khumtai Block', 'NGN_09': 'Laokhowa Block', 'NGN_10': 'Pachim Kaliabor Block', 'NGN_11': 'Raha Block', 'NGN_12': 'Rupahi Block',

  'NLB_01': 'Borigog Banbhag Block', 'NLB_02': 'Barkhetri Block', 'NLB_03': 'Madupur Block', 'NLB_04': 'Nalbari Block', 'NLB_05': 'Pub Nalbari Block', 'NLB_06': 'Paschim Nalbari Block', 'NLB_07': 'Tihu Block',

  'SVS_01': 'Amguri Block', 'SVS_02': 'Demow Block', 'SVS_03': 'Gaurisagar Block', 'SVS_04': 'Nazira Block', 'SVS_05': 'Sivasagar Block',

  'SNT_01': 'Balipara Block', 'SNT_02': 'Bihaguri Block', 'SNT_03': 'Borgang Block', 'SNT_04': 'Dhekiajuli Block', 'SNT_05': 'Gabharu Block', 'SNT_06': 'Naduar Block', 'SNT_07': 'Rangapara Block',

  'SSM_01': 'Fekamari Block', 'SSM_02': 'Mankachar Block', 'SSM_03': 'South Salmara Block',

  'TMP_01': 'Nagrijuli Block', 'TMP_02': 'Tamulpur Block', 'TMP_03': 'Goreswar Rural Block', 'TMP_04': 'Kumarikata Block',

  'TSK_01': 'Guijan Block', 'TSK_02': 'Hapjan Block', 'TSK_03': 'Kakopathar Block', 'TSK_04': 'Margherita Block', 'TSK_05': 'Sadiya Block', 'TSK_06': 'Saikhowa Block', 'TSK_07': 'Tinsukia Block',

  'UDL_01': 'Bhergaon Block', 'UDL_02': 'Kalaigaon Block', 'UDL_03': 'Khoirabari Block', 'UDL_04': 'Mazbat Block', 'UDL_05': 'Odalguri / Udalguri Block', 'UDL_06': 'Rowta Block',

  'WKA_01': 'Amri Block', 'WKA_02': 'Chinthong Block', 'WKA_03': 'Rongkhang Block', 'WKA_04': 'Socheng Block',
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
  // --- KERALA (KL) 152 BLOCK PANCHAYATS ACROSS 14 DISTRICTS ---
  'ALP_01': 'Ambalappuzha Block', 'ALP_02': 'Aryad Block', 'ALP_03': 'Bharanikkavu Block', 'ALP_04': 'Champakkulam Block', 'ALP_05': 'Chengannur Block', 'ALP_06': 'Haripad Block', 'ALP_07': 'Kanjikkuzhy Block', 'ALP_08': 'Mavelikkara Block', 'ALP_09': 'Muthukulam Block', 'ALP_10': 'Pattanakkad Block', 'ALP_11': 'Thaickattussery Block', 'ALP_12': 'Veliyanad Block',

  'EKM_01': 'Alangad Block', 'EKM_02': 'Angamaly Block', 'EKM_03': 'Edappally Block', 'EKM_04': 'Koovappady Block', 'EKM_05': 'Kothamangalam Block', 'EKM_06': 'Mulanthuruthy Block', 'EKM_07': 'Muvattupuzha Block', 'EKM_08': 'Parakkadavu Block', 'EKM_09': 'Pampakuda Block', 'EKM_10': 'Palluruthy Block', 'EKM_11': 'Vadavucode Block', 'EKM_12': 'Vazhakkulam Block', 'EKM_13': 'Vypin Block', 'EKM_14': 'Paravur Block',

  'IDK_01': 'Adimaly Block', 'IDK_02': 'Azutha / Peerumade Block', 'IDK_03': 'Devikulam Block', 'IDK_04': 'Elamdesam Block', 'IDK_05': 'Idukki Block', 'IDK_06': 'Kattappana Block', 'IDK_07': 'Nedumkandam Block', 'IDK_08': 'Thodupuzha Block',

  'KNR_KL_01': 'Edakkad Block', 'KNR_KL_02': 'Irikkur Block', 'KNR_KL_03': 'Iritty Block', 'KNR_KL_04': 'Kalliasseri Block', 'KNR_KL_05': 'Kannur Block', 'KNR_KL_06': 'Kuthuparamba Block', 'KNR_KL_07': 'Panoor Block', 'KNR_KL_08': 'Payyannur Block', 'KNR_KL_09': 'Peravoor Block', 'KNR_KL_10': 'Thalassery Block', 'KNR_KL_11': 'Taliparamba Block',

  'KSG_KL_01': 'Kanhangad Block', 'KSG_KL_02': 'Karadka Block', 'KSG_KL_03': 'Kasaragod Block', 'KSG_KL_04': 'Manjeshwaram Block', 'KSG_KL_05': 'Nileshwaram Block', 'KSG_KL_06': 'Parappa Block',

  'KLM_01': 'Anchal Block', 'KLM_02': 'Chadayamangalam Block', 'KLM_03': 'Chavara Block', 'KLM_04': 'Chittumala Block', 'KLM_05': 'Ithikkara Block', 'KLM_06': 'Kottarakkara Block', 'KLM_07': 'Mukhathala Block', 'KLM_08': 'Oachira Block', 'KLM_09': 'Pathanapuram Block', 'KLM_10': 'Sasthamcotta Block', 'KLM_11': 'Vettikkavala Block',

  'KTM_01': 'Erattupetta Block', 'KTM_02': 'Ettumanoor Block', 'KTM_03': 'Kaduthuruthy Block', 'KTM_04': 'Kanjirappally Block', 'KTM_05': 'Lalam Block', 'KTM_06': 'Madappally Block', 'KTM_07': 'Pallom Block', 'KTM_08': 'Pampady Block', 'KTM_09': 'Uzhavoor Block', 'KTM_10': 'Vazhoor Block', 'KTM_11': 'Vaikom Block',

  'KKD_01': 'Balusseri Block', 'KKD_02': 'Chelannur Block', 'KKD_03': 'Koduvally Block', 'KKD_04': 'Kozhikode Block', 'KKD_05': 'Kunnamangalam Block', 'KKD_06': 'Kunnummal Block', 'KKD_07': 'Melady Block', 'KKD_08': 'Panthalayani Block', 'KKD_09': 'Perambra Block', 'KKD_10': 'Thodannur Block', 'KKD_11': 'Thuneri Block', 'KKD_12': 'Vadakara Block',

  'MLP_01': 'Areacode Block', 'MLP_02': 'Kalikavu Block', 'MLP_03': 'Kondotty Block', 'MLP_04': 'Kuttippuram Block', 'MLP_05': 'Malappuram Block', 'MLP_06': 'Mankada Block', 'MLP_07': 'Nilambur Block', 'MLP_08': 'Perinthalmanna Block', 'MLP_09': 'Perumpadappu Block', 'MLP_10': 'Ponnani Block', 'MLP_11': 'Tanur Block', 'MLP_12': 'Tirur Block', 'MLP_13': 'Tirurangadi Block', 'MLP_14': 'Vengara Block', 'MLP_15': 'Wandoor Block',

  'PLK_01': 'Alathur Block', 'PLK_02': 'Attappady Block', 'PLK_03': 'Chittur Block', 'PLK_04': 'Kollengode Block', 'PLK_05': 'Kuzhalmannam Block', 'PLK_06': 'Malampuzha Block', 'PLK_07': 'Mannarkkad Block', 'PLK_08': 'Nemmara Block', 'PLK_09': 'Ottappalam Block', 'PLK_10': 'Palakkad Block', 'PLK_11': 'Pattambi Block', 'PLK_12': 'Shornur Block', 'PLK_13': 'Sreekrishnapuram Block', 'PLK_14': 'Thrithala Block',

  'PTA_01': 'Elanthoor Block', 'PTA_02': 'Koipuram Block', 'PTA_03': 'Konni Block', 'PTA_04': 'Mallappally Block', 'PTA_05': 'Pandalam Block', 'PTA_06': 'Parakode Block', 'PTA_07': 'Pulikeezhu Block', 'PTA_08': 'Ranni Block',

  'TVM_KL_01': 'Athiyannoor Block', 'TVM_KL_02': 'Chirayinkeezhu Block', 'TVM_KL_03': 'Kilimanoor Block', 'TVM_KL_04': 'Nedumangad Block', 'TVM_KL_05': 'Nemom Block', 'TVM_KL_06': 'Parassala Block', 'TVM_KL_07': 'Perumkadavila Block', 'TVM_KL_08': 'Pothencode Block', 'TVM_KL_09': 'Vamanapuram Block', 'TVM_KL_10': 'Varkala Block', 'TVM_KL_11': 'Vellanad Block',

  'TSR_01': 'Anthikkad Block', 'TSR_02': 'Chalakudy Block', 'TSR_03': 'Chavakkad Block', 'TSR_04': 'Cherpu Block', 'TSR_05': 'Chowannur Block', 'TSR_06': 'Kodakara Block', 'TSR_07': 'Mala Block', 'TSR_08': 'Mathilakam Block', 'TSR_09': 'Mullassery Block', 'TSR_10': 'Ollukkara Block', 'TSR_11': 'Pazhayannur Block', 'TSR_12': 'Puzhakkal Block', 'TSR_13': 'Thalikulam Block', 'TSR_14': 'Vellangallur Block', 'TSR_15': 'Wadakkanchery Block', 'TSR_16': 'Irjalakuda Block',

  'WYD_01': 'Kalpetta Block', 'WYD_02': 'Mananthavady Block', 'WYD_03': 'Panamaram Block', 'WYD_04': 'Sulthan Bathery Block',

  // --- ODISHA (OD) 314 BLOCKS ACROSS 30 DISTRICTS ---
  'ANG_01': 'Angul Block', 'ANG_02': 'Athamallik Block', 'ANG_03': 'Banarpal Block', 'ANG_04': 'Chhendipada Block', 'ANG_05': 'Kaniha Block', 'ANG_06': 'Kishorenagar Block', 'ANG_07': 'Pallahara Block', 'ANG_08': 'Talcher Block',

  'BLG_OD_01': 'Agla Block', 'BLG_OD_02': 'Balangir Block', 'BLG_OD_03': 'Bangomunda Block', 'BLG_OD_04': 'Belpara Block', 'BLG_OD_05': 'Deogaon Block', 'BLG_OD_06': 'Gudvella Block', 'BLG_OD_07': 'Khaprakhol Block', 'BLG_OD_08': 'Loisingha Block', 'BLG_OD_09': 'Muribahal Block', 'BLG_OD_10': 'Patnagarh Block', 'BLG_OD_11': 'Puintala Block', 'BLG_OD_12': 'Saintala Block', 'BLG_OD_13': 'Titilagarh Block', 'BLG_OD_14': 'Turekela Block',

  'BLS_OD_01': 'Bahanaga Block', 'BLS_OD_02': 'Balasore Sadar Block', 'BLS_OD_03': 'Baliapal Block', 'BLS_OD_04': 'Basta Block', 'BLS_OD_05': 'Bhograi Block', 'BLS_OD_06': 'Jaleswar Block', 'BLS_OD_07': 'Khaira Block', 'BLS_OD_08': 'Nilgiri Block', 'BLS_OD_09': 'Oupada Block', 'BLS_OD_10': 'Remuna Block', 'BLS_OD_11': 'Simulia Block', 'BLS_OD_12': 'Soro Block',

  'BRG_01': 'Ambabhona Block', 'BRG_02': 'Attabira Block', 'BRG_03': 'Barpali Block', 'BRG_04': 'Bargarh Block', 'BRG_05': 'Bhatli Block', 'BRG_06': 'Bheden Block', 'BRG_07': 'Bijepur Block', 'BRG_08': 'Gaisilet Block', 'BRG_09': 'Jharbandh Block', 'BRG_10': 'Padampur Block', 'BRG_11': 'Paikmal Block', 'BRG_12': 'Sohella Block',

  'BDK_01': 'Basudevpur Block', 'BDK_02': 'Bhadrak Block', 'BDK_03': 'Bhandaripokhari Block', 'BDK_04': 'Bonth Block', 'BDK_05': 'Chandbali Block', 'BDK_06': 'Dhamnagar Block', 'BDK_07': 'Tihidi Block',

  'BDH_01': 'Boudh Block', 'BDH_02': 'Harbhanga Block', 'BDH_03': 'Kantamal Block',

  'CTC_01': 'Athagarh Block', 'CTC_02': 'Banki Block', 'CTC_03': 'Banki-Dampada Block', 'CTC_04': 'Baramba Block', 'CTC_05': 'Baranga Block', 'CTC_06': 'Cuttack Sadar Block', 'CTC_07': 'Kantapada Block', 'CTC_08': 'Mahanga Block', 'CTC_09': 'Narasinghpur Block', 'CTC_10': 'Niali Block', 'CTC_11': 'Nischintakoili Block', 'CTC_12': 'Salepur Block', 'CTC_13': 'Tangi-Choudwar Block', 'CTC_14': 'Tigiria Block',

  'DGH_01': 'Barkote Block', 'DGH_02': 'Reamal Block', 'DGH_03': 'Tileibani Block',

  'DNK_01': 'Bhuban Block', 'DNK_02': 'Dhenkanal Sadar Block', 'DNK_03': 'Gondia Block', 'DNK_04': 'Hindol Block', 'DNK_05': 'Kamakhyanagar Block', 'DNK_06': 'Kankadahad Block', 'DNK_07': 'Odapada Block', 'DNK_08': 'Parjang Block',

  'GJP_01': 'Gosani Block', 'GJP_02': 'Gumma Block', 'GJP_03': 'Kashinagar Block', 'GJP_04': 'Mohana Block', 'GJP_05': 'Nuagada Block', 'GJP_06': 'R.Udayagiri Block', 'GJP_07': 'Rayagada Block',

  'GNJ_01': 'Aska Block', 'GNJ_02': 'Bellaguntha Block', 'GNJ_03': 'Bhanjanagar Block', 'GNJ_04': 'Beguniapada Block', 'GNJ_05': 'Buguda Block', 'GNJ_06': 'Chhatrapur Block', 'GNJ_07': 'Chikiti Block', 'GNJ_08': 'Dharakote Block', 'GNJ_09': 'Digapahandi Block', 'GNJ_10': 'Ganjam Block', 'GNJ_11': 'Hinjilicut Block', 'GNJ_12': 'Jagannathprasad Block', 'GNJ_13': 'Kabisuryanagar Block', 'GNJ_14': 'Khallikote Block', 'GNJ_15': 'Kukudakhandi Block', 'GNJ_16': 'Patrapur Block', 'GNJ_17': 'Polasara Block', 'GNJ_18': 'Purusottampur Block', 'GNJ_19': 'Rangeilunda Block', 'GNJ_20': 'Sanakhemundi Block', 'GNJ_21': 'Sheragada Block', 'GNJ_22': 'Surada Block',

  'JSP_01': 'Balikuda Block', 'JSP_02': 'Biridi Block', 'JSP_03': 'Erasama Block', 'JSP_04': 'Jagatsinghpur Block', 'JSP_05': 'Kujang Block', 'JSP_06': 'Naugaon Block', 'JSP_07': 'Raghunathpur Block', 'JSP_08': 'Tirtol Block',

  'JJP_01': 'Barchana Block', 'JJP_02': 'Bari Block', 'JJP_03': 'Binjharpur Block', 'JJP_04': 'Danagadi Block', 'JJP_05': 'Dasarathpur Block', 'JJP_06': 'Dharmasala Block', 'JJP_07': 'Jajpur Block', 'JJP_08': 'Korei Block', 'JJP_09': 'Rasulpur Block', 'JJP_10': 'Sukinda Block',

  'JSG_01': 'Jharsuguda Block', 'JSG_02': 'Kirmira Block', 'JSG_03': 'Kolabira Block', 'JSG_04': 'Laikera Block', 'JSG_05': 'Lakhanpur Block',

  'KLH_01': 'Bhawanipatna Block', 'KLH_02': 'Dharmagarh Block', 'KLH_03': 'Golamunda Block', 'KLH_04': 'Jaipatna Block', 'KLH_05': 'Junagarh Block', 'KLH_06': 'Kalampur Block', 'KLH_07': 'Karlamunda Block', 'KLH_08': 'Kesinga Block', 'KLH_09': 'Koksara Block', 'KLH_10': 'Lanjigarh Block', 'KLH_11': 'Madanpur Rampur Block', 'KLH_12': 'Narala Block', 'KLH_13': 'Thuamul Rampur Block',

  'KND_01': 'Baliguda Block', 'KND_02': 'Chakapad Block', 'KND_03': 'Daringbadi Block', 'KND_04': 'G.Udayagiri Block', 'KND_05': 'K.Nuagaon Block', 'KND_06': 'Khajuripada Block', 'KND_07': 'Kotagarh Block', 'KND_08': 'Phiringia Block', 'KND_09': 'Phulbani Block', 'KND_10': 'Raikia Block', 'KND_11': 'Tikabali Block', 'KND_12': 'Tumudibandha Block',

  'KNP_OD_01': 'Aul Block', 'KNP_OD_02': 'Derabish Block', 'KNP_OD_03': 'Garadpur Block', 'KNP_OD_04': 'Kendrapara Block', 'KNP_OD_05': 'Mahakalapada Block', 'KNP_OD_06': 'Marshaghai Block', 'KNP_OD_07': 'Pattamundai Block', 'KNP_OD_08': 'Rajkanika Block', 'KNP_OD_09': 'Rajnagar Block',

  'KJR_01': 'Anandapur Block', 'KJR_02': 'Banspal Block', 'KJR_03': 'Champua Block', 'KJR_04': 'Ghasipura Block', 'KJR_05': 'Ghatgaon Block', 'KJR_06': 'Harichandanpur Block', 'KJR_07': 'Hatadihi Block', 'KJR_08': 'Jhumpura Block', 'KJR_09': 'Joda Block', 'KJR_10': 'Kendujhar Sadar Block', 'KJR_11': 'Patna Block', 'KJR_12': 'Saharpada Block', 'KJR_13': 'Telkoi Block',

  'KRD_01': 'Balianta Block', 'KRD_02': 'Balipatna Block', 'KRD_03': 'Banapur Block', 'KRD_04': 'Begunia Block', 'KRD_05': 'Bhubaneswar Block', 'KRD_06': 'Bolagarh Block', 'KRD_07': 'Chilika Block', 'KRD_08': 'Jatani Block', 'KRD_09': 'Khordha Block', 'KRD_10': 'Tangi Block',

  'KPT_OD_01': 'Bandhugaon Block', 'KPT_OD_02': 'Borigumma Block', 'KPT_OD_03': 'Dasamantapur Block', 'KPT_OD_04': 'Jeypore Block', 'KPT_OD_05': 'Koraput Block', 'KPT_OD_06': 'Kotpad Block', 'KPT_OD_07': 'Kundura Block', 'KPT_OD_08': 'Lamtaput Block', 'KPT_OD_09': 'Laxmipur Block', 'KPT_OD_10': 'Nandapur Block', 'KPT_OD_11': 'Narayanpatna Block', 'KPT_OD_12': 'Pottangi Block', 'KPT_OD_13': 'Semiliguda Block', 'KPT_OD_14': 'Boipariguda Block',

  'MLK_OD_01': 'Chitrakonda Block', 'MLK_OD_02': 'Kalimela Block', 'MLK_OD_03': 'Khairput Block', 'MLK_OD_04': 'Korkunda Block', 'MLK_OD_05': 'Malkangiri Block', 'MLK_OD_06': 'Mathili Block', 'MLK_OD_07': 'Podia Block',

  'MBJ_01': 'Badasahi Block', 'MBJ_02': 'Bahalda Block', 'MBJ_03': 'Bangriposi Block', 'MBJ_04': 'Baripada Block', 'MBJ_05': 'Betnoti Block', 'MBJ_06': 'Bijatala Block', 'MBJ_07': 'Bisoi Block', 'MBJ_08': 'Gopabandhunagar Block', 'MBJ_09': 'Jamda Block', 'MBJ_10': 'Jhashipur Block', 'MBJ_11': 'Kaptipada Block', 'MBJ_12': 'Karanjia Block', 'MBJ_13': 'Khunta Block', 'MBJ_14': 'Kuliana Block', 'MBJ_15': 'Kusumi Block', 'MBJ_16': 'Morada Block', 'MBJ_17': 'Rairangpur Block', 'MBJ_18': 'Raruan Block', 'MBJ_19': 'Rasgovindpur Block', 'MBJ_20': 'Samakhunta Block', 'MBJ_21': 'Saraskana Block', 'MBJ_22': 'Sukruli Block', 'MBJ_23': 'Suliapada Block', 'MBJ_24': 'Thakurmunda Block', 'MBJ_25': 'Tiring Block', 'MBJ_26': 'Udala Block',

  'NBP_01': 'Chandahandi Block', 'NBP_02': 'Dabugam Block', 'NBP_03': 'Jharigam Block', 'NBP_04': 'Kodinga Block', 'NBP_05': 'Kosagumuda Block', 'NBP_06': 'Nabarangpur Block', 'NBP_07': 'Nandahandi Block', 'NBP_08': 'Papadahandi Block', 'NBP_09': 'Raighar Block', 'NBP_10': 'Tentulikhunti Block', 'NBP_11': 'Umerkote Block',

  'NYG_01': 'Bhapur Block', 'NYG_02': 'Daspalla Block', 'NYG_03': 'Gania Block', 'NYG_04': 'Khandapada Block', 'NYG_05': 'Nayagarh Block', 'NYG_06': 'Nuagaon Block', 'NYG_07': 'Odagaon Block', 'NYG_08': 'Ranpur Block',

  'NPD_01': 'Boden Block', 'NPD_02': 'Komna Block', 'NPD_03': 'Nuapada Block', 'NPD_04': 'Khariar Block', 'NPD_05': 'Sinapali Block',

  'PRI_01': 'Astharang Block', 'PRI_02': 'Brahmagiri Block', 'PRI_03': 'Delanga Block', 'PRI_04': 'Gop Block', 'PRI_05': 'Kakatpur Block', 'PRI_06': 'Kanas Block', 'PRI_07': 'Krushnaprasad Block', 'PRI_08': 'Nimapada Block', 'PRI_09': 'Pipili Block', 'PRI_10': 'Puri Sadar Block', 'PRI_11': 'Satyabadi Block',

  'RYG_01': 'Bissam Cuttack Block', 'RYG_02': 'Chandrapur Block', 'RYG_03': 'Gudari Block', 'RYG_04': 'Gunupur Block', 'RYG_05': 'Kalyansingpur Block', 'RYG_06': 'Kashipur Block', 'RYG_07': 'Kolnara Block', 'RYG_08': 'Muniguda Block', 'RYG_09': 'Padmapur Block', 'RYG_10': 'Ramanaguda Block', 'RYG_11': 'Rayagada Block',

  'SBP_01': 'Bamra Block', 'SBP_02': 'Dhankauda Block', 'SBP_03': 'Jamankira Block', 'SBP_04': 'Jujomura Block', 'SBP_05': 'Kuchinda Block', 'SBP_06': 'Maneswar Block', 'SBP_07': 'Naktideul Block', 'SBP_08': 'Rairakhol Block', 'SBP_09': 'Rengali Block',

  'SBP_OD_01': 'Birmaharajpur Block', 'SBP_OD_02': 'Dunguripali Block', 'SBP_OD_03': 'Sonepur Block', 'SBP_OD_04': 'Tarva Block', 'SBP_OD_05': 'Ullunda Block', 'SBP_OD_06': 'Binika Block',

  'SNG_OD_01': 'Bargaon Block', 'SNG_OD_02': 'Bisra Block', 'SNG_OD_03': 'Bonaigarh Block', 'SNG_OD_04': 'Gurundia Block', 'SNG_OD_05': 'Hemgir Block', 'SNG_OD_06': 'Koilakonda Block', 'SNG_OD_07': 'Kuanrmunda Block', 'SNG_OD_08': 'Kutra Block', 'SNG_OD_09': 'Lathikata Block', 'SNG_OD_10': 'Lephripara Block', 'SNG_OD_11': 'Nuagaon Block', 'SNG_OD_12': 'Rajgangpur Block', 'SNG_OD_13': 'Subdega Block', 'SNG_OD_14': 'Sundargarh Block', 'SNG_OD_15': 'Tangarpali Block', 'SNG_OD_16': 'Gurundia Block', 'SNG_OD_17': 'Lahunipara Block',

  // --- JHARKHAND (JH) 264 BLOCKS ACROSS 24 DISTRICTS ---
  'BKO_01': 'Bermo Block', 'BKO_02': 'Chandankiyari Block', 'BKO_03': 'Chandrapura Block', 'BKO_04': 'Chas Block', 'BKO_05': 'Gumia Block', 'BKO_06': 'Jaridih Block', 'BKO_07': 'Kasmar Block', 'BKO_08': 'Nawadih Block', 'BKO_09': 'Petarwar Block',

  'CTR_01': 'Chatra Block', 'CTR_02': 'Gidhour Block', 'CTR_03': 'Hunterganj Block', 'CTR_04': 'Itkhori Block', 'CTR_05': 'Kanhachatti Block', 'CTR_06': 'Kunda Block', 'CTR_07': 'Lawalong Block', 'CTR_08': 'Mayurhand Block', 'CTR_09': 'Pathalgada Block', 'CTR_10': 'Pratappur Block', 'CTR_11': 'Simaria Block', 'CTR_12': 'Tandwa Block',

  'DGR_01': 'Deoghar Block', 'DGR_02': 'Devipur Block', 'DGR_03': 'Karon Block', 'DGR_04': 'Madhupur Block', 'DGR_05': 'Margomunda Block', 'DGR_06': 'Mohanpur Block', 'DGR_07': 'Palojori Block', 'DGR_08': 'Sarath Block', 'DGR_09': 'Sarwan Block', 'DGR_10': 'Sonaraithari Block',

  'DHN_01': 'Baghmara Block', 'DHN_02': 'Baliapur Block', 'DHN_03': 'Dhanbad Block', 'DHN_04': 'Govindpur Block', 'DHN_05': 'Nirsa Block', 'DHN_06': 'Purba Tundi Block', 'DHN_07': 'Topchanchi Block', 'DHN_08': 'Tundi Block', 'DHN_09': 'Egarkund Block', 'DHN_10': 'Kaliasole Block',

  'DMK_01': 'Dumka Block', 'DMK_02': 'Gopikandar Block', 'DMK_03': 'Jama Block', 'DMK_04': 'Jarmundi Block', 'DMK_05': 'Kathikund Block', 'DMK_06': 'Masalia Block', 'DMK_07': 'Ramgarh Block', 'DMK_08': 'Ranishwar Block', 'DMK_09': 'Saraiyahat Block', 'DMK_10': 'Shikaripara Block',

  'ESB_01': 'Baharagora Block', 'ESB_02': 'Borasol / Boram Block', 'ESB_03': 'Chakulia Block', 'ESB_04': 'Dhalbhumgarh Block', 'ESB_05': 'Dumaria Block', 'ESB_06': 'Ghatshila Block', 'ESB_07': 'Golmuri-Cum-Jugsalai Block', 'ESB_08': 'Gura Bandha Block', 'ESB_09': 'Musabani Block', 'ESB_10': 'Patamda Block', 'ESB_11': 'Potka Block',

  'GRH_01': 'Bhandaria Block', 'GRH_02': 'Bhawnathpur Block', 'GRH_03': 'Chiniya Block', 'GRH_04': 'Danda Block', 'GRH_05': 'Dandai Block', 'GRH_06': 'Dhurki Block', 'GRH_07': 'Garhwa Block', 'GRH_08': 'Kandi Block', 'GRH_09': 'Ketar Block', 'GRH_10': 'Kharaundhi Block', 'GRH_11': 'Majhiaon Block', 'GRH_12': 'Meral Block', 'GRH_13': 'Nagar Untari Block', 'GRH_14': 'Ramkanda Block', 'GRH_15': 'Ramna Block', 'GRH_16': 'Ranka Block', 'GRH_17': 'Sagre / Sagma Block', 'GRH_18': 'Bardiha Block', 'GRH_19': 'Kharoundhi Block', 'GRH_20': 'Barwadih Block',

  'GRD_01': 'Bagodar Block', 'GRD_02': 'Bengabad Block', 'GRD_03': 'Birni Block', 'GRD_04': 'Deori Block', 'GRD_05': 'Dhanwar Block', 'GRD_06': 'Dumri Block', 'GRD_07': 'Gandey Block', 'GRD_08': 'Gawan Block', 'GRD_09': 'Giridih Block', 'GRD_10': 'Jamua Block', 'GRD_11': 'Pirtand Block', 'GRD_12': 'Sariya Block', 'GRD_13': 'Tisri Block',

  'GDD_01': 'Boarijor Block', 'GDD_02': 'Godda Block', 'GDD_03': 'Mahagama Block', 'GDD_04': 'Meherma Block', 'GDD_05': 'Pathargama Block', 'GDD_06': 'Poreyahat Block', 'GDD_07': 'Sundarpahari Block', 'GDD_08': 'Thakurgangti Block', 'GDD_09': 'Basantrai Block',

  'GML_01': 'Albert Ekka / Jari Block', 'GML_02': 'Bishunpur Block', 'GML_03': 'Basia Block', 'GML_04': 'Chainpur Block', 'GML_05': 'Dumri Block', 'GML_06': 'Ghaghra Block', 'GML_07': 'Gumla Block', 'GML_08': 'Kamdara Block', 'GML_09': 'Palkot Block', 'GML_10': 'Raidih Block', 'GML_11': 'Sisai Block', 'GML_12': 'Verni / Bharno Block',

  'HZB_01': 'Barkagaon Block', 'HZB_02': 'Barhi Block', 'HZB_03': 'Barkatha Block', 'HZB_04': 'Bishungarh Block', 'HZB_05': 'Chauparan Block', 'HZB_06': 'Churchu Block', 'HZB_07': 'Daru Block', 'HZB_08': 'Daru / Ichak Block', 'HZB_09': 'Katkamsandi Block', 'HZB_10': 'Katkamdag Block', 'HZB_11': 'Keredari Block', 'HZB_12': 'Padma Block', 'HZB_13': 'Sadar Hazaribagh Block', 'HZB_14': 'Tati Jhariya Block', 'HZB_15': 'Chalkusha Block', 'HZB_16': 'Dadi Block',

  'JMT_01': 'Fatehpur Block', 'JMT_02': 'Jamtara Block', 'JMT_03': 'Karmatanr Block', 'JMT_04': 'Kundhit Block', 'JMT_05': 'Nala Block', 'JMT_06': 'Narayanpur Block',

  'KHT_JH_01': 'Arki Block', 'KHT_JH_02': 'Karra Block', 'KHT_JH_03': 'Khunti Block', 'KHT_JH_04': 'Murhu Block', 'KHT_JH_05': 'Rania Block', 'KHT_JH_06': 'Torpa Block',

  'KOD_01': 'Chandwara Block', 'KOD_02': 'Domchanch Block', 'KOD_03': 'Jainagar Block', 'KOD_04': 'Koderma Block', 'KOD_05': 'Markacho Block', 'KOD_06': 'Satgawan Block',

  'LTH_01': 'Balumath Block', 'LTH_02': 'Bariyatu Block', 'LTH_03': 'Barwadih Block', 'LTH_04': 'Chandwa Block', 'LTH_05': 'Garu Block', 'LTH_06': 'Herhanj Block', 'LTH_07': 'Latehar Block', 'LTH_08': 'Mahuadanr Block', 'LTH_09': 'Manika Block',

  'LHD_01': 'Bhandra Block', 'LHD_02': 'Kisko Block', 'LHD_03': 'Kuru Block', 'LHD_04': 'Lohardaga Block', 'LHD_05': 'Peshrar Block', 'LHD_06': 'Sennan / Senha Block',

  'PKR_01': 'Amrapara Block', 'PKR_02': 'Hiranpur Block', 'PKR_03': 'Littipara Block', 'PKR_04': 'Maheshpur Block', 'PKR_05': 'Pakur Block', 'PKR_06': 'Pakuria Block',

  'PLM_01': 'Chainpur Block', 'PLM_02': 'Chhatarpur Block', 'PLM_03': 'Hariharganj Block', 'PLM_04': 'Hussainabad Block', 'PLM_05': 'Haidernagar Block', 'PLM_06': 'Lesliganj / Nilamber Pitamberpur Block', 'PLM_07': 'Manatu Block', 'PLM_08': 'Medininagar / Daltonganj Block', 'PLM_09': 'Mohammadganj Block', 'PLM_10': 'Nawa Bazar Block', 'PLM_11': 'Pandu Block', 'PLM_12': 'Panki Block', 'PLM_13': 'Patan Block', 'PLM_14': 'Pipra Block', 'PLM_15': 'Satbarwa Block', 'PLM_16': 'Tarhasi Block', 'PLM_17': 'Untari Road Block', 'PLM_18': 'Bishrampur Block',

  'RMG_01': 'Chitarpur Block', 'RMG_02': 'Dulmi Block', 'RMG_03': 'Gola Block', 'RMG_04': 'Mandu Block', 'RMG_05': 'Patratu Block', 'RMG_06': 'Ramgarh Block',

  'RNC_01': 'Angara Block', 'RNC_02': 'Bero Block', 'RNC_03': 'Bundu Block', 'RNC_04': 'Burmu Block', 'RNC_05': 'Chanho Block', 'RNC_06': 'Itki Block', 'RNC_07': 'Kanke Block', 'RNC_08': 'Khelari Block', 'RNC_09': 'Lapung Block', 'RNC_10': 'Mandar Block', 'RNC_11': 'Nagri Block', 'RNC_12': 'Namkum Block', 'RNC_13': 'Ormanjhi Block', 'RNC_14': 'Rahe Block', 'RNC_15': 'Ratu Block', 'RNC_16': 'Silli Block', 'RNC_17': 'Sonahatu Block', 'RNC_18': 'Tamar Block',

  'SBG_01': 'Barhait Block', 'SBG_02': 'Barharwa Block', 'SBG_03': 'Borio Block', 'SBG_04': 'Mandro Block', 'SBG_05': 'Pathna Block', 'SBG_06': 'Rajmahal Block', 'SBG_07': 'Sahibganj Block', 'SBG_08': 'Taljhari Block', 'SBG_09': 'Udhwa Block',

  'SKR_JH_01': 'Chandil Block', 'SKR_JH_02': 'Gamharia Block', 'SKR_JH_03': 'Gobindpur / Rajnagar Block', 'SKR_JH_04': 'Ichagarh Block', 'SKR_JH_05': 'Kharsawan Block', 'SKR_JH_06': 'Kukru Block', 'SKR_JH_07': 'Nimdih Block', 'SKR_JH_08': 'Seraikela Block', 'SKR_JH_09': 'Kuchai Block',

  'SMD_01': 'Bano Block', 'SMD_02': 'Bansjhor Block', 'SMD_03': 'Bolba Block', 'SMD_04': 'Jaldega Block', 'SMD_05': 'Kersai Block', 'SMD_06': 'Kolebira Block', 'SMD_07': 'Kurdeg Block', 'SMD_08': 'Pakartanr Block', 'SMD_09': 'Simdega Block', 'SMD_10': 'Thethaitangar Block',

  'WSB_01': 'Bandgaon Block', 'WSB_02': 'Chaibasa Block', 'WSB_03': 'Chakradharpur Block', 'WSB_04': 'Goilkera Block', 'WSB_05': 'Gudri Block', 'WSB_06': 'Hatgamharia Block', 'WSB_07': 'Jagannathpur Block', 'WSB_08': 'Jhinkpani Block', 'WSB_09': 'Khuntpani Block', 'WSB_10': 'Kumardungi Block', 'WSB_11': 'Majhgaon Block', 'WSB_12': 'Manoharpur Block', 'WSB_13': 'Noamundi Block', 'WSB_14': 'Sonua Block', 'WSB_15': 'Tanto Block', 'WSB_16': 'Tonto / Tatanagar rural Block', 'WSB_17': 'Anandpur Block',
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
  // --- GOA (GA) 12 TALUKAS / BLOCKS ACROSS 2 DISTRICTS ---
  'NG_01': 'Bardez Block', 'NG_02': 'Bicholim Block', 'NG_03': 'Pernem Block', 'NG_04': 'Ponda Block', 'NG_05': 'Sattari Block', 'NG_06': 'Tiswadi Block',
  'SG_01': 'Canacona Block', 'SG_02': 'Mormugao Block', 'SG_03': 'Salcete Block', 'SG_04': 'Sanguem Block', 'SG_05': 'Quepem Block', 'SG_06': 'Dharbandora Block',

  // --- JAMMU & KASHMIR (JK) 285 BLOCKS ACROSS 20 DISTRICTS ---
  'ANT_01': 'Achabal Block', 'ANT_02': 'Anantnag Block', 'ANT_03': 'Bijbehara Block', 'ANT_04': 'Breng Block', 'ANT_05': 'Dhkulam Block', 'ANT_06': 'Hiller Block', 'ANT_07': 'Khoveripora Block', 'ANT_08': 'Larnoo Block', 'ANT_09': 'Mattan Block', 'ANT_10': 'Pahalgam Block', 'ANT_11': 'Qazigund Block', 'ANT_12': 'Sagul / Sagam Block', 'ANT_13': 'Shangus Block', 'ANT_14': 'Vessu Block', 'ANT_15': 'Shahabad Block', 'ANT_16': 'Verinag Block',
  'BND_JK_01': 'Arin Block', 'BND_JK_02': 'Baktoor Block', 'BND_JK_03': 'Bandipora Block', 'BND_JK_04': 'Bonavan Block', 'BND_JK_05': 'Gurez Block', 'BND_JK_06': 'Hajin Block', 'BND_JK_07': 'Naidkhai Block', 'BND_JK_08': 'Nowgam Block', 'BND_JK_09': 'Sumbal Block', 'BND_JK_10': 'Tulail Block', 'BND_JK_11': 'Ganstan Block', 'BND_JK_12': 'Aloosa Block',
  'BRM_01': 'Baramulla Block', 'BRM_02': 'Boniyar Block', 'BRM_03': 'Chandil Wanigam Block', 'BRM_04': 'Kunzer Block', 'BRM_05': 'Kandi Block', 'BRM_06': 'Nadihal Block', 'BRM_07': 'Narwah Block', 'BRM_08': 'Pattan Block', 'BRM_09': 'Rafiabad Block', 'BRM_10': 'Rohama Block', 'BRM_11': 'Sangrama Block', 'BRM_12': 'Sherabad Khore Block', 'BRM_13': 'Singhpore Block', 'BRM_14': 'Tangmarg Block', 'BRM_15': 'Uri Block', 'BRM_16': 'Wagoora Block', 'BRM_17': 'Zaingeer Block', 'BRM_18': 'Zaloora Block', 'BRM_19': 'Khellan Block',
  'BDG_01': 'Beerwah Block', 'BDG_02': 'B.K. Pora Block', 'BDG_03': 'Budgam Block', 'BDG_04': 'Chadoora Block', 'BDG_05': 'Charar-i-Sharief Block', 'BDG_06': 'Khag Block', 'BDG_07': 'Khan Sahib Block', 'BDG_08': 'Magam Block', 'BDG_09': 'Narbal Block', 'BDG_10': 'Pakherpora Block', 'BDG_11': 'Parnewa Block', 'BDG_12': 'Rathsun Block', 'BDG_13': 'Soibugh Block', 'BDG_14': 'Surasyar Block', 'BDG_15': 'Waterhail Block', 'BDG_16': 'Nagir Block', 'BDG_17': 'Sanoor Kalipora Block',
  'DOD_01': 'Assar Block', 'DOD_02': 'Bhaderwah Block', 'DOD_03': 'Bhalla Block', 'DOD_04': 'Bhagwah Block', 'DOD_05': 'Bhelesh Block', 'DOD_06': 'Chilly Pingal Block', 'DOD_07': 'Chiralla Block', 'DOD_08': 'Doda Block', 'DOD_09': 'Ghat Block', 'DOD_10': 'Gundna Block', 'DOD_11': 'Kahara Block', 'DOD_12': 'Kashtigarh Block', 'DOD_13': 'Khellani Block', 'DOD_14': 'Marmat Block', 'DOD_15': 'Thathri Block', 'DOD_16': 'Jakhyas Block', 'DOD_17': 'Gandoh Block',
  'GBL_01': 'Ganderbal Block', 'GBL_02': 'Gund Block', 'GBL_03': 'Kangan Block', 'GBL_04': 'Lar Block', 'GBL_05': 'Manigam Block', 'GBL_06': 'Safapora Block', 'GBL_07': 'Sherpathri Block', 'GBL_08': 'Wakura Block',
  'JMU_JK_01': 'Akhnoor Block', 'JMU_JK_02': 'Arnia Block', 'JMU_JK_03': 'Bhalwal Block', 'JMU_JK_04': 'Bhalwal Brahmana Block', 'JMU_JK_05': 'Bishnah Block', 'JMU_JK_06': 'Chowki Choura Block', 'JMU_JK_07': 'Dansal Block', 'JMU_JK_08': 'Khour Block', 'JMU_JK_09': 'Maira Mandrian Block', 'JMU_JK_10': 'Mandal Phallian Block', 'JMU_JK_11': 'Marh Block', 'JMU_JK_12': 'Mathwar Block', 'JMU_JK_13': 'Miran Sahib Block', 'JMU_JK_14': 'Nagrota Block', 'JMU_JK_15': 'Pargwal Block', 'JMU_JK_16': 'RS Pura Block', 'JMU_JK_17': 'Samwan Block', 'JMU_JK_18': 'Satwari Block', 'JMU_JK_19': 'Suchetgarh Block', 'JMU_JK_20': 'Kharah Balli Block',
  'KTH_01': 'Bani Block', 'KTH_02': 'Barnoti Block', 'KTH_03': 'Basholi Block', 'KTH_04': 'Billawar Block', 'KTH_05': 'Bhoond Block', 'KTH_06': 'Ding Amb Block', 'KTH_07': 'Duggain Block', 'KTH_08': 'Duggan Block', 'KTH_09': 'Hiranagar Block', 'KTH_10': 'Kathua Block', 'KTH_11': 'Keerian Gandyal Block', 'KTH_12': 'Kharote Block', 'KTH_13': 'Mahanpur Block', 'KTH_14': 'Mandli Block', 'KTH_15': 'Marheen Block', 'KTH_16': 'Nagri Parole Block', 'KTH_17': 'Nagrota Gujroo Block', 'KTH_18': 'Rajbagh Block', 'KTH_19': 'Dhar Mahanpur Block',
  'KST_01': 'Bounjwah Block', 'KST_02': 'Chhatroo Block', 'KST_03': 'Dachhan Block', 'KST_04': 'Drabshalla Block', 'KST_05': 'Inderwal Block', 'KST_06': 'Kishtwar Block', 'KST_07': 'Marwah Block', 'KST_08': 'Mughal Maidan Block', 'KST_09': 'Nagseni Block', 'KST_10': 'Padder Block', 'KST_11': 'Palmar Block', 'KST_12': 'Thakrie Block', 'KST_13': 'Warwan Block',
  'KLG_01': 'Behibagh Block', 'KLG_02': 'D.H. Pora Block', 'KLG_03': 'Devsar Block', 'KLG_04': 'Frisal Block', 'KLG_05': 'Kulgam Block', 'KLG_06': 'Kund Block', 'KLG_07': 'Manzgam Block', 'KLG_08': 'Pahloo Block', 'KLG_09': 'Pombay Block', 'KLG_10': 'Qaimoh Block', 'KLG_11': 'DK Marg Block',
  'KPW_01': 'Drugmulla Block', 'KPW_02': 'Handwara Block', 'KPW_03': 'Hyhama Block', 'KPW_04': 'Kalaroos Block', 'KPW_05': 'Kandi Block', 'KPW_06': 'Keran Block', 'KPW_07': 'Krajham Block', 'KPW_08': 'Kupwara Block', 'KPW_09': 'Machil Block', 'KPW_10': 'Mawar Block', 'KPW_11': 'Meelyal Block', 'KPW_12': 'Nutnussa Block', 'KPW_13': 'Qadirabad Block', 'KPW_14': 'Qaziabad Block', 'KPW_15': 'Rajwar Block', 'KPW_16': 'Ramhal Block', 'KPW_17': 'Reddi Chowkibal Block', 'KPW_18': 'Sogam Block', 'KPW_19': 'Tangdar Block', 'KPW_20': 'Teetwal Block', 'KPW_21': 'Trehgam Block', 'KPW_22': 'Wavoora Block', 'KPW_23': 'Tarathpora Block', 'KPW_24': 'Villgam Block',
  'PCH_01': 'Balakote Block', 'PCH_02': 'Buffliaz Block', 'PCH_03': 'Haveli Block', 'PCH_04': 'Loran Block', 'PCH_05': 'Mandi Block', 'PCH_06': 'Mankote Block', 'PCH_07': 'Mendhar Block', 'PCH_08': 'Nangali Block', 'PCH_09': 'Poonch Block', 'PCH_10': 'Sathra Block', 'PCH_11': 'Surankote Block',
  'PLW_JK_01': 'Aripal Block', 'PLW_JK_02': 'Achan Block', 'PLW_JK_03': 'Awantipora Block', 'PLW_JK_04': 'Kakapora Block', 'PLW_JK_05': 'Litter Block', 'PLW_JK_06': 'Newa Block', 'PLW_JK_07': 'Pampore Block', 'PLW_JK_08': 'Pulwama Block', 'PLW_JK_09': 'Shadimarg Block', 'PLW_JK_10': 'Tral Block', 'PLW_JK_11': 'Ichgoz Block',
  'RJR_01': 'Budhal Block', 'RJR_02': 'Darhal Block', 'RJR_03': 'Doongi Block', 'RJR_04': 'Kalakote Block', 'RJR_05': 'Khawas Block', 'RJR_06': 'Kotranka Block', 'RJR_07': 'Lamberi Block', 'RJR_08': 'Manjakote Block', 'RJR_09': 'Moughla Block', 'RJR_10': 'Nowshera Block', 'RJR_11': 'Plangarh Block', 'RJR_12': 'Qila Darhal Block', 'RJR_13': 'Rajouri Block', 'RJR_14': 'Seman Block', 'RJR_15': 'Sunderbani Block', 'RJR_16': 'Thanamandi Block', 'RJR_17': 'Panjgrain Block', 'RJR_18': 'Dhangri Block', 'RJR_19': 'Siot Block',
  'RBN_01': 'Banihal Block', 'RBN_02': 'Batote Block', 'RBN_03': 'Gandi Block', 'RBN_04': 'Gool Block', 'RBN_05': 'Khari Block', 'RBN_06': 'Ramsoo Block', 'RBN_07': 'Ramban Block', 'RBN_08': 'Sangaldan Block', 'RBN_09': 'Ukheral Block', 'RBN_10': 'Rajgarh Block', 'RBN_11': 'Mankote Block',
  'RSI_01': 'Arnas Block', 'RSI_02': 'Chassana Block', 'RSI_03': 'Jirri Block', 'RSI_04': 'Katra Block', 'RSI_05': 'Mahore Block', 'RSI_06': 'Panthal Block', 'RSI_07': 'Pouni Block', 'RSI_08': 'Reasi Block', 'RSI_09': 'Thikri Block', 'RSI_10': 'Bhomag Block', 'RSI_11': 'Gulabgarh Block', 'RSI_12': 'Thuroo Block',
  'SMB_JK_01': 'Bari Brahmana Block', 'SMB_JK_02': 'Ghagwal Block', 'SMB_JK_03': 'Nud Block', 'SMB_JK_04': 'Purmandal Block', 'SMB_JK_05': 'Rajpura Block', 'SMB_JK_06': 'Ramgarh Block', 'SMB_JK_07': 'Samba Block', 'SMB_JK_08': 'Sumb Block', 'SMB_JK_09': 'Vijaypur Block',
  'SHP_JK_01': 'Shopian Block', 'SHP_JK_02': 'Imamsahib Block', 'SHP_JK_03': 'Keller Block', 'SHP_JK_04': 'Kanjikullah Block', 'SHP_JK_05': 'Ramnagri Block', 'SHP_JK_06': 'Hermain Block', 'SHP_JK_07': 'Zainapora Block', 'SHP_JK_08': 'Kapran Block', 'SHP_JK_09': 'Chitragam Block',
  'SRN_JK_01': 'Harwan Block', 'SRN_JK_02': 'Khonmoh Block', 'SRN_JK_03': 'Qamarwari Block', 'SRN_JK_04': 'Srinagar Urban Block',
  'UDH_01': 'Basantgarh Block', 'UDH_02': 'Chenani Block', 'UDH_03': 'Dudu Block', 'UDH_04': 'Ghordi Block', 'UDH_05': 'Jaganoo Block', 'UDH_06': 'Khoon Block', 'UDH_07': 'Kulwanta Block', 'UDH_08': 'Majalta Block', 'UDH_09': 'Moungri Block', 'UDH_10': 'Narsoo Block', 'UDH_11': 'Panchari Block', 'UDH_12': 'Parli Dhar Block', 'UDH_13': 'Ramnagar Block', 'UDH_14': 'Sewna Block', 'UDH_15': 'Tikri Block', 'UDH_16': 'Udhampur Block', 'UDH_17': 'Latti Marothi Block',

  // --- LADAKH (LA) 31 BLOCKS ACROSS 2 DISTRICTS ---
  'LEH_01': 'Chuchot Block', 'LEH_02': 'Diskit Block', 'LEH_03': 'Durbuk Block', 'LEH_04': 'Kharu Block', 'LEH_05': 'Khaltsi Block', 'LEH_06': 'Leh Block', 'LEH_07': 'Nimoo Block', 'LEH_08': 'Nyoma Block', 'LEH_09': 'Panamik Block', 'LEH_10': 'Rong Block', 'LEH_11': 'Saspol Block', 'LEH_12': 'Skurbuchan Block', 'LEH_13': 'Thiksay Block', 'LEH_14': 'Singay Lalok Block', 'LEH_15': 'Turtuk Block', 'LEH_16': 'Rupsho Block',
  'KGL_01': 'Bhimbat Block', 'KGL_02': 'Chiktan Block', 'KGL_03': 'Drass Block', 'KGL_04': 'Kargil Block', 'KGL_05': 'Lotchum Block', 'KGL_06': 'Lungnak Block', 'KGL_07': 'Pashkum Block', 'KGL_08': 'Sankoo Block', 'KGL_09': 'Shakar Block', 'KGL_10': 'Shardigol Block', 'KGL_11': 'TSG / Trespone Block', 'KGL_12': 'Tai Suru Block', 'KGL_13': 'Zanskar Block', 'KGL_14': 'Khangral Block', 'KGL_15': 'Barsoo Block',

  // --- PUDUCHERRY (PY) 6 COMMUNES ACROSS 4 DISTRICTS ---
  'PDY_01': 'Ariyankuppam Block', 'PDY_02': 'Villianur Block', 'PDY_03': 'Oulgaret / Urban Block',
  'KRK_PY_01': 'Karaikal Block', 'KRK_PY_02': 'Nedungadu Block', 'KRK_PY_03': 'Kottucherry Block',
  'MAH_01': 'Mahe Rural / Sub-Taluk Block',
  'YAN_01': 'Yanam Rural / Sub-Taluk Block',

  // --- ANDAMAN & NICOBAR ISLANDS (AN) 9 BLOCKS ACROSS 3 DISTRICTS ---
  'NIC_01': 'Car Nicobar Block', 'NIC_02': 'Nancowrie Block', 'NIC_03': 'Campbell Bay / Great Nicobar Block',
  'NMA_01': 'Diglipur Block', 'NMA_02': 'Mayabunder Block', 'NMA_03': 'Rangat Block',
  'SAN_01': 'Ferrargunj Block', 'SAN_02': 'Prothrapur Block', 'SAN_03': 'Little Andaman Block',

  // --- DADRA AND NAGAR HAVELI AND DAMAN AND DIU (DNHDD) 3 DISTRICTS ---
  'DNH_01': 'Dadra Block', 'DNH_02': 'Silvassa Block', 'DNH_03': 'Khanvel Block',
  'DMN_01': 'Daman Rural / Moti Daman Block', 'DMN_02': 'Nani Daman Block',
  'DIU_01': 'Diu Rural / Fudam & Vanakbara Block',

  // --- LAKSHADWEEP (LD) 1 DISTRICT / 10 SUB-DIVISIONS ---
  'LKD_01': 'Agatti Block', 'LKD_02': 'Amini Block', 'LKD_03': 'Andrott Block', 'LKD_04': 'Bitra Block', 'LKD_05': 'Chetlat Block', 'LKD_06': 'Kadmat Block', 'LKD_07': 'Kalpeni Block', 'LKD_08': 'Kavaratti Block', 'LKD_09': 'Kiltan Block', 'LKD_10': 'Minicoy Block',

  // --- CHANDIGARH (CH) 1 DISTRICT ---
  'CHD_UT_01': 'Chandigarh CD Block Rural',

  // --- DELHI (DL) 11 REVENUE DISTRICTS (33 SUB-DIVISIONS) ---
  'CDL_DL_01': 'Civil Lines Block', 'CDL_DL_02': 'Karol Bagh Block', 'CDL_DL_03': 'Kotwali Block',
  'EDL_01': 'Gandhi Nagar Block', 'EDL_02': 'Mayur Vihar Block', 'EDL_03': 'Preet Vihar Block',
  'NDL_DL_01': 'Chanakyapuri Block', 'NDL_DL_02': 'Delhi Cantonment Block', 'NDL_DL_03': 'Vasant Vihar Block',
  'NDL_NORTH_01': 'Alipur Block', 'NDL_NORTH_02': 'Model Town Block', 'NDL_NORTH_03': 'Narela Block',
  'NED_01': 'Karawal Nagar Block', 'NED_02': 'Seelampur Block', 'NED_03': 'Yamuna Vihar Block',
  'NWD_DL_01': 'Kanjhawala Block', 'NWD_DL_02': 'Rohini Block', 'NWD_DL_03': 'Saraswati Vihar Block',
  'SHD_DL_01': 'Seemapuri Block', 'SHD_DL_02': 'Shahdara Block', 'SHD_DL_03': 'Vivek Vihar Block',
  'SDL_01': 'Hauz Khas Block', 'SDL_02': 'Mehrauli Block', 'SDL_03': 'Saket Block',
  'SED_01': 'Defence Colony Block', 'SED_02': 'Kalkaji Block', 'SED_03': 'Sarita Vihar Block',
  'SWD_01': 'Dwarka Block', 'SWD_02': 'Kapashera Block', 'SWD_03': 'Najafgarh Block',
  'WDL_01': 'Patel Nagar Block', 'WDL_02': 'Punjabi Bagh Block', 'WDL_03': 'Rajouri Garden Block',
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

