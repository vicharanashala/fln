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
      { code: 'KMR', name: 'Kamrup' },
      { code: 'NGN', name: 'Nagaon' },
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
      { code: 'RPR', name: 'Raipur' },
      { code: 'BSP', name: 'Bilaspur' },
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
      { code: 'RNC', name: 'Ranchi' },
      { code: 'DHD', name: 'Dhanbad' },
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
      { code: 'TVM', name: 'Thiruvananthapuram' },
      { code: 'EKM', name: 'Ernakulam' },
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
      { code: 'MUM', name: 'Mumbai' },
      { code: 'PUN', name: 'Pune' },
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
      { code: 'BBS', name: 'Bhubaneswar' },
      { code: 'CTC', name: 'Cuttack' },
    ],
  },
  {
    code: 'PB', name: 'Punjab',
    districts: [
      { code: 'LDH', name: 'Ludhiana' },
      { code: 'ASR', name: 'Amritsar' },
    ],
  },
  {
    code: 'RJ', name: 'Rajasthan',
    districts: [
      { code: 'JAI', name: 'Jaipur' },
      { code: 'JDP', name: 'Jodhpur' },
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
      { code: 'CHN', name: 'Chennai' },
      { code: 'CBE', name: 'Coimbatore' },
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
    ],
  },
  {
    code: 'WB', name: 'West Bengal',
    districts: [
      { code: 'KOL', name: 'Kolkata' },
      { code: 'HWR', name: 'Howrah' },
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
