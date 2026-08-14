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
  // Haryana (HR) - All 22 Official Districts
  { stateCode: 'HR', stateName: 'Haryana', districtCode: 'AMB', districtName: 'Ambala' },
  { stateCode: 'HR', stateName: 'Haryana', districtCode: 'BHW', districtName: 'Bhiwani' },
  { stateCode: 'HR', stateName: 'Haryana', districtCode: 'CKD', districtName: 'Charkhi Dadri' },
  { stateCode: 'HR', stateName: 'Haryana', districtCode: 'FBD', districtName: 'Faridabad' },
  { stateCode: 'HR', stateName: 'Haryana', districtCode: 'FTB', districtName: 'Fatehabad' },
  { stateCode: 'HR', stateName: 'Haryana', districtCode: 'GGM', districtName: 'Gurugram' },
  { stateCode: 'HR', stateName: 'Haryana', districtCode: 'HSR', districtName: 'Hisar' },
  { stateCode: 'HR', stateName: 'Haryana', districtCode: 'JHJ', districtName: 'Jhajjar' },
  { stateCode: 'HR', stateName: 'Haryana', districtCode: 'JND', districtName: 'Jind' },
  { stateCode: 'HR', stateName: 'Haryana', districtCode: 'KTL', districtName: 'Kaithal' },
  { stateCode: 'HR', stateName: 'Haryana', districtCode: 'KRL', districtName: 'Karnal' },
  { stateCode: 'HR', stateName: 'Haryana', districtCode: 'KKR', districtName: 'Kurukshetra' },
  { stateCode: 'HR', stateName: 'Haryana', districtCode: 'MHG', districtName: 'Mahendragarh' },
  { stateCode: 'HR', stateName: 'Haryana', districtCode: 'NUH', districtName: 'Nuh' },
  { stateCode: 'HR', stateName: 'Haryana', districtCode: 'PLW', districtName: 'Palwal' },
  { stateCode: 'HR', stateName: 'Haryana', districtCode: 'PKL', districtName: 'Panchkula' },
  { stateCode: 'HR', stateName: 'Haryana', districtCode: 'PNP', districtName: 'Panipat' },
  { stateCode: 'HR', stateName: 'Haryana', districtCode: 'REW', districtName: 'Rewari' },
  { stateCode: 'HR', stateName: 'Haryana', districtCode: 'RTK', districtName: 'Rohtak' },
  { stateCode: 'HR', stateName: 'Haryana', districtCode: 'SRS', districtName: 'Sirsa' },
  { stateCode: 'HR', stateName: 'Haryana', districtCode: 'SNP', districtName: 'Sonipat' },
  { stateCode: 'HR', stateName: 'Haryana', districtCode: 'YNR', districtName: 'Yamunanagar' },
  // Himachal Pradesh (HP) - All 12 Official Districts
  { stateCode: 'HP', stateName: 'Himachal Pradesh', districtCode: 'BLP', districtName: 'Bilaspur' },
  { stateCode: 'HP', stateName: 'Himachal Pradesh', districtCode: 'CHM', districtName: 'Chamba' },
  { stateCode: 'HP', stateName: 'Himachal Pradesh', districtCode: 'HMR', districtName: 'Hamirpur' },
  { stateCode: 'HP', stateName: 'Himachal Pradesh', districtCode: 'KNG', districtName: 'Kangra' },
  { stateCode: 'HP', stateName: 'Himachal Pradesh', districtCode: 'KNR', districtName: 'Kinnaur' },
  { stateCode: 'HP', stateName: 'Himachal Pradesh', districtCode: 'KLU', districtName: 'Kullu' },
  { stateCode: 'HP', stateName: 'Himachal Pradesh', districtCode: 'LHS', districtName: 'Lahaul and Spiti' },
  { stateCode: 'HP', stateName: 'Himachal Pradesh', districtCode: 'MND', districtName: 'Mandi' },
  { stateCode: 'HP', stateName: 'Himachal Pradesh', districtCode: 'SML', districtName: 'Shimla' },
  { stateCode: 'HP', stateName: 'Himachal Pradesh', districtCode: 'SMR', districtName: 'Sirmaur' },
  { stateCode: 'HP', stateName: 'Himachal Pradesh', districtCode: 'SLN', districtName: 'Solan' },
  { stateCode: 'HP', stateName: 'Himachal Pradesh', districtCode: 'UNA', districtName: 'Una' },
  // Uttarakhand (UK) - All 13 Official Districts
  { stateCode: 'UK', stateName: 'Uttarakhand', districtCode: 'ALM', districtName: 'Almora' },
  { stateCode: 'UK', stateName: 'Uttarakhand', districtCode: 'BAG', districtName: 'Bageshwar' },
  { stateCode: 'UK', stateName: 'Uttarakhand', districtCode: 'CPW', districtName: 'Champawat' },
  { stateCode: 'UK', stateName: 'Uttarakhand', districtCode: 'DDN', districtName: 'Dehradun' },
  { stateCode: 'UK', stateName: 'Uttarakhand', districtCode: 'HWR', districtName: 'Haridwar' },
  { stateCode: 'UK', stateName: 'Uttarakhand', districtCode: 'NTL', districtName: 'Nainital' },
  { stateCode: 'UK', stateName: 'Uttarakhand', districtCode: 'PAU', districtName: 'Pauri Garhwal' },
  { stateCode: 'UK', stateName: 'Uttarakhand', districtCode: 'PTH', districtName: 'Pithoragarh' },
  { stateCode: 'UK', stateName: 'Uttarakhand', districtCode: 'RPY', districtName: 'Rudraprayag' },
  { stateCode: 'UK', stateName: 'Uttarakhand', districtCode: 'TEH', districtName: 'Tehri Garhwal' },
  { stateCode: 'UK', stateName: 'Uttarakhand', districtCode: 'USN', districtName: 'Udham Singh Nagar' },
  { stateCode: 'UK', stateName: 'Uttarakhand', districtCode: 'UTK', districtName: 'Uttarkashi' },
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
  // Punjab (PB) - All 23 Official Districts
  { stateCode: 'PB', stateName: 'Punjab', districtCode: 'ASR', districtName: 'Amritsar' },
  { stateCode: 'PB', stateName: 'Punjab', districtCode: 'BNL', districtName: 'Barnala' },
  { stateCode: 'PB', stateName: 'Punjab', districtCode: 'BTH', districtName: 'Bathinda' },
  { stateCode: 'PB', stateName: 'Punjab', districtCode: 'FDK', districtName: 'Faridkot' },
  { stateCode: 'PB', stateName: 'Punjab', districtCode: 'FGS', districtName: 'Fatehgarh Sahib' },
  { stateCode: 'PB', stateName: 'Punjab', districtCode: 'FZK', districtName: 'Fazilka' },
  { stateCode: 'PB', stateName: 'Punjab', districtCode: 'FZP', districtName: 'Ferozepur' },
  { stateCode: 'PB', stateName: 'Punjab', districtCode: 'GSP', districtName: 'Gurdaspur' },
  { stateCode: 'PB', stateName: 'Punjab', districtCode: 'HSP', districtName: 'Hoshiarpur' },
  { stateCode: 'PB', stateName: 'Punjab', districtCode: 'JAL', districtName: 'Jalandhar' },
  { stateCode: 'PB', stateName: 'Punjab', districtCode: 'KPT', districtName: 'Kapurthala' },
  { stateCode: 'PB', stateName: 'Punjab', districtCode: 'LDH', districtName: 'Ludhiana' },
  { stateCode: 'PB', stateName: 'Punjab', districtCode: 'MLK', districtName: 'Malerkotla' },
  { stateCode: 'PB', stateName: 'Punjab', districtCode: 'MNS', districtName: 'Mansa' },
  { stateCode: 'PB', stateName: 'Punjab', districtCode: 'MOG', districtName: 'Moga' },
  { stateCode: 'PB', stateName: 'Punjab', districtCode: 'PTK', districtName: 'Pathankot' },
  { stateCode: 'PB', stateName: 'Punjab', districtCode: 'PAT', districtName: 'Patiala' },
  { stateCode: 'PB', stateName: 'Punjab', districtCode: 'RUP', districtName: 'Rupnagar' },
  { stateCode: 'PB', stateName: 'Punjab', districtCode: 'SAS', districtName: 'SAS Nagar (Mohali)' },
  { stateCode: 'PB', stateName: 'Punjab', districtCode: 'SBS', districtName: 'SBS Nagar (Nawanshahr)' },
  { stateCode: 'PB', stateName: 'Punjab', districtCode: 'MKS', districtName: 'Sri Muktsar Sahib' },
  { stateCode: 'PB', stateName: 'Punjab', districtCode: 'SNG', districtName: 'Sangrur' },
  { stateCode: 'PB', stateName: 'Punjab', districtCode: 'TTN', districtName: 'Tarn Taran' },
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
  // Uttar Pradesh (UP) - All 75 Official Districts
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'AGR', districtName: 'Agra' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'ALG', districtName: 'Aligarh' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'AMB_UP', districtName: 'Ambedkar Nagar' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'AMT', districtName: 'Amethi' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'AMR', districtName: 'Amroha' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'AUR', districtName: 'Auraiya' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'AYO', districtName: 'Ayodhya' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'AZM', districtName: 'Azamgarh' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'BGP', districtName: 'Baghpat' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'BHR', districtName: 'Bahraich' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'BAL', districtName: 'Ballia' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'BLR', districtName: 'Balrampur' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'BND', districtName: 'Banda' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'BBK', districtName: 'Barabanki' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'BLY', districtName: 'Bareilly' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'BST', districtName: 'Basti' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'BHD', districtName: 'Bhadohi' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'BJN', districtName: 'Bijnor' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'BDN', districtName: 'Budaun' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'BLS', districtName: 'Bulandshahr' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'CND', districtName: 'Chandauli' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'CKT', districtName: 'Chitrakoot' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'DEO', districtName: 'Deoria' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'ETH', districtName: 'Etah' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'ETW', districtName: 'Etawah' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'FRK', districtName: 'Farrukhabad' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'FTP', districtName: 'Fatehpur' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'FZB', districtName: 'Firozabad' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'GBN', districtName: 'Gautam Buddha Nagar' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'GZB', districtName: 'Ghaziabad' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'GZP', districtName: 'Ghazipur' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'GND', districtName: 'Gonda' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'GKP', districtName: 'Gorakhpur' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'HMP', districtName: 'Hamirpur' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'HPR', districtName: 'Hapur' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'HRD', districtName: 'Hardoi' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'HTR', districtName: 'Hathras' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'JLN', districtName: 'Jalaun' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'JNP', districtName: 'Jaunpur' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'JHS', districtName: 'Jhansi' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'KNJ', districtName: 'Kannauj' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'KPD', districtName: 'Kanpur Dehat' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'KPN', districtName: 'Kanpur Nagar' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'KSG', districtName: 'Kasganj' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'KSH', districtName: 'Kaushambi' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'KSHN', districtName: 'Kushinagar' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'LKP', districtName: 'Lakhimpur Kheri' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'LLT', districtName: 'Lalitpur' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'LKO', districtName: 'Lucknow' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'MHJ', districtName: 'Maharajganj' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'MHB', districtName: 'Mahoba' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'MNP', districtName: 'Mainpuri' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'MTH', districtName: 'Mathura' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'MAU', districtName: 'Mau' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'MRT', districtName: 'Meerut' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'MZP', districtName: 'Mirzapur' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'MBD', districtName: 'Moradabad' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'MZF', districtName: 'Muzaffarnagar' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'PLB', districtName: 'Pilibhit' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'PRT', districtName: 'Pratapgarh' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'PRY', districtName: 'Prayagraj' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'RBL', districtName: 'Raebareli' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'RMP', districtName: 'Rampur' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'SHR', districtName: 'Saharanpur' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'SMB', districtName: 'Sambhal' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'SKN', districtName: 'Sant Kabir Nagar' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'SPN', districtName: 'Shahjahanpur' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'SML_UP', districtName: 'Shamli' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'SRV', districtName: 'Shravasti' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'SDN', districtName: 'Siddharthnagar' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'STP', districtName: 'Sitapur' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'SNB', districtName: 'Sonbhadra' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'SLT', districtName: 'Sultanpur' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'UNA_UP', districtName: 'Unnao' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'VNS', districtName: 'Varanasi' },
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
 * Fetch district code, canonical name, and parent state details from district input (name, code, or numeric index 1..N).
 * Example: "Ludhiana" -> { code: "LDH", name: "Ludhiana", stateCode: "PB", stateName: "Punjab" }
 * Example (with state=PB): "5" -> { code: "PAT", name: "Patiala", stateCode: "PB", stateName: "Punjab" }
 */
export function fetchDistrictCode(input?: string, parentState?: string): { code: string | null; name: string | null; stateCode: string | null; stateName: string | null } {
  if (!input || !input.trim()) return { code: null, name: null, stateCode: null, stateName: null };
  const clean = input.trim().toLowerCase();

  // 1. Direct match in lookup (code, name, or alias)
  const match = DISTRICT_LOOKUP[clean];
  if (match) {
    return {
      code: match.code,
      name: match.name,
      stateCode: match.stateCode || null,
      stateName: match.stateName || null,
    };
  }

  // 2. Numeric district index lookup (e.g. "1", "5", "01", "05")
  if (/^\d{1,2}$/.test(clean)) {
    const num = parseInt(clean, 10);
    const targetStateCode = parentState ? fetchStateCode(parentState).code : null;
    const stateDistricts = targetStateCode 
      ? MASTER_GEO_DATA.filter((m) => m.stateCode === targetStateCode)
      : MASTER_GEO_DATA;

    if (num >= 1 && num <= stateDistricts.length) {
      const item = stateDistricts[num - 1];
      return {
        code: item.districtCode,
        name: item.districtName,
        stateCode: item.stateCode,
        stateName: item.stateName,
      };
    }
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
  isExplicitDistrict?: boolean;
} {
  if (!input || !input.trim()) {
    return { code: null, name: null, districtCode: null, districtName: null, stateCode: null, stateName: null, isExplicitDistrict: false };
  }

  const rawInput = input.trim();
  const cleanInput = rawInput.toLowerCase();
  
  // 1. Resolve parent district if provided
  let distInfo = parentDistrict ? fetchDistrictCode(parentDistrict, parentState) : null;
  let stateInfo = parentState ? fetchStateCode(parentState) : null;

  // 2. Check if user typed numeric block code e.g. "01", "1", "02", "2", "5"
  if (/^\d{1,2}$/.test(rawInput)) {
    const num = parseInt(rawInput, 10);
    const numStr = num.toString().padStart(2, '0');

    if (distInfo && distInfo.code) {
      const constructedCode = `${distInfo.code}-${numStr}`;
      const keyUnderscore = `${distInfo.code}_${numStr}`;
      const blockName = BLOCK_NAMES[keyUnderscore] || `${distInfo.name} Block ${num}`;

      return {
        code: constructedCode,
        name: blockName,
        districtCode: distInfo.code,
        districtName: distInfo.name,
        stateCode: distInfo.stateCode || stateInfo?.code || null,
        stateName: distInfo.stateName || stateInfo?.name || null,
        isExplicitDistrict: false,
      };
    }

    // If parent district is not explicitly provided:
    const sCode = stateInfo?.code || null;
    const sName = stateInfo?.name || null;
    
    return {
      code: `${sCode ? sCode + '-' : ''}${numStr}`,
      name: `Block ${num}`,
      districtCode: null,
      districtName: null,
      stateCode: sCode,
      stateName: sName,
      isExplicitDistrict: false,
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
      isExplicitDistrict: false,
    };
  }

  const finalCode = reverseMatchedCode || rawInput.toUpperCase().replace(/_/g, '-');

  // Extract District Code prefix (e.g. "HWH" from "HWH-01")
  const distCodePrefix = finalCode.split('-')[0];
  const resolvedDist = fetchDistrictCode(distCodePrefix, parentState);
  const hasExplicitDistrictInInput = Boolean(resolvedDist.code);

  if (!matchedName && (resolvedDist.name || distInfo?.name)) {
    const numMatch = finalCode.match(/\d+/);
    const blockNum = numMatch ? parseInt(numMatch[0], 10) : '';
    const dName = resolvedDist.name || distInfo?.name || '';
    matchedName = blockNum ? `${dName} Block ${blockNum}` : `${dName} Block`;
  }

  return {
    code: finalCode,
    name: matchedName,
    districtCode: resolvedDist.code || distInfo?.code || null,
    districtName: resolvedDist.name || distInfo?.name || null,
    stateCode: resolvedDist.stateCode || distInfo?.stateCode || stateInfo?.code || null,
    stateName: resolvedDist.stateName || distInfo?.stateName || stateInfo?.name || null,
    isExplicitDistrict: hasExplicitDistrictInInput,
  };
}

/**
 * Smart Geo Details Resolver with cross-inference between state, district, & block inputs.
 */
export function fetchGeoDetails(stateInput?: string, districtInput?: string, blockInput?: string): GeoLookupResult {
  let stateRes = fetchStateCode(stateInput);
  let districtRes = fetchDistrictCode(districtInput, stateRes.code || stateInput || undefined);
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
    const distCheck = fetchDistrictCode(stateInput, stateRes.code || stateInput);
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

/**
 * Auto-suggest districts matching search query for the specified state.
 * Example: parentState="PB", query="a" -> [{ code: 'ASR', name: 'Amritsar', ... }]
 */
export function getDistrictSuggestions(
  query: string,
  parentState?: string
): { code: string; name: string; stateCode: string; stateName: string }[] {
  const cleanQ = (query || '').trim().toLowerCase();
  const stateRes = parentState ? fetchStateCode(parentState) : null;
  const targetStateCode = stateRes?.code || (parentState?.trim().toUpperCase() ?? null);

  let pool = MASTER_GEO_DATA;
  if (targetStateCode) {
    pool = pool.filter((m) => m.stateCode === targetStateCode);
  }

  if (!cleanQ) {
    return pool.map((item) => ({
      code: item.districtCode,
      name: item.districtName,
      stateCode: item.stateCode,
      stateName: item.stateName,
    }));
  }

  const startsWithMatches: typeof MASTER_GEO_DATA = [];
  const containsMatches: typeof MASTER_GEO_DATA = [];

  for (const item of pool) {
    const nameLower = item.districtName.toLowerCase();
    const codeLower = item.districtCode.toLowerCase();

    if (nameLower.startsWith(cleanQ) || codeLower.startsWith(cleanQ)) {
      startsWithMatches.push(item);
    } else if (nameLower.includes(cleanQ) || codeLower.includes(cleanQ)) {
      containsMatches.push(item);
    }
  }

  const combined = [...startsWithMatches, ...containsMatches];
  const seen = new Set<string>();

  return combined
    .filter((item) => {
      if (seen.has(item.districtCode)) return false;
      seen.add(item.districtCode);
      return true;
    })
    .map((item) => ({
      code: item.districtCode,
      name: item.districtName,
      stateCode: item.stateCode,
      stateName: item.stateName,
    }));
}

/**
 * Auto-suggest blocks matching search query for the specified district & state.
 * Example: parentDistrict="ASR", query="1" -> [
 *   { code: 'ASR-01', name: 'Amritsar Block 1', districtCode: 'ASR', districtName: 'Amritsar', stateCode: 'PB', stateName: 'Punjab' },
 *   { code: 'ASR-10', name: 'Tarsikka Block', districtCode: 'ASR', districtName: 'Amritsar', stateCode: 'PB', stateName: 'Punjab' }
 * ]
 */
export function getBlockSuggestions(
  query: string,
  parentDistrict?: string,
  parentState?: string
): { code: string; name: string; districtCode: string; districtName: string; stateCode: string; stateName: string }[] {
  const cleanQ = (query || '').trim().toLowerCase();

  const distRes = parentDistrict ? fetchDistrictCode(parentDistrict, parentState) : null;
  const stateRes = parentState ? fetchStateCode(parentState) : null;

  const targetDistCode = distRes?.code || (parentDistrict?.trim().toUpperCase() ?? null);
  const targetDistName = distRes?.name || parentDistrict || 'District';
  const targetStateCode = distRes?.stateCode || stateRes?.code || 'PB';
  const targetStateName = distRes?.stateName || stateRes?.name || 'State';

  if (!targetDistCode) {
    return [];
  }

  const candidateBlocks: { code: string; name: string; districtCode: string; districtName: string; stateCode: string; stateName: string }[] = [];
  const prefixKey = `${targetDistCode}_`;
  const customEntries = Object.entries(BLOCK_NAMES).filter(([k]) => k.startsWith(prefixKey));

  if (customEntries.length > 0) {
    for (const [k, name] of customEntries) {
      const codeStr = k.replace(/_/g, '-');
      candidateBlocks.push({
        code: codeStr,
        name: name,
        districtCode: targetDistCode,
        districtName: targetDistName,
        stateCode: targetStateCode,
        stateName: targetStateName,
      });
    }
  } else {
    for (let i = 1; i <= 10; i++) {
      const numStr = i.toString().padStart(2, '0');
      const bCode = `${targetDistCode}-${numStr}`;
      const bName = `${targetDistName} Block ${i}`;
      candidateBlocks.push({
        code: bCode,
        name: bName,
        districtCode: targetDistCode,
        districtName: targetDistName,
        stateCode: targetStateCode,
        stateName: targetStateName,
      });
    }
  }

  if (!cleanQ) {
    return candidateBlocks;
  }

  const startsWithMatches: typeof candidateBlocks = [];
  const containsMatches: typeof candidateBlocks = [];

  for (const block of candidateBlocks) {
    const codeLower = block.code.toLowerCase();
    const nameLower = block.name.toLowerCase();
    const numPart = block.code.split('-').pop() || '';
    const numInt = parseInt(numPart, 10).toString();

    if (
      codeLower.startsWith(cleanQ) ||
      nameLower.startsWith(cleanQ) ||
      numPart.startsWith(cleanQ) ||
      numInt === cleanQ
    ) {
      startsWithMatches.push(block);
    } else if (codeLower.includes(cleanQ) || nameLower.includes(cleanQ)) {
      containsMatches.push(block);
    }
  }

  const combined = [...startsWithMatches, ...containsMatches];
  const seen = new Set<string>();
  return combined.filter((b) => {
    if (seen.has(b.code)) return false;
    seen.add(b.code);
    return true;
  });
}

