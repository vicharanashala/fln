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
  // Bihar (BR) - All 38 Official Districts
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'ARA', districtName: 'Araria' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'ARW', districtName: 'Arwal' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'AUR_BR', districtName: 'Aurangabad' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'BNK', districtName: 'Banka' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'BGS', districtName: 'Begusarai' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'BGP_BR', districtName: 'Bhagalpur' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'BHP', districtName: 'Bhojpur' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'BXR', districtName: 'Buxar' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'DBG', districtName: 'Darbhanga' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'ECM', districtName: 'East Champaran' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'GAY', districtName: 'Gaya' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'GPL', districtName: 'Gopalganj' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'JMU', districtName: 'Jamui' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'JHD', districtName: 'Jehanabad' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'KMR_BR', districtName: 'Kaimur' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'KTR', districtName: 'Katihar' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'KHG', districtName: 'Khagaria' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'KSG_BR', districtName: 'Kishanganj' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'LKS', districtName: 'Lakhisarai' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'MDP', districtName: 'Madhepura' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'MDB', districtName: 'Madhubani' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'MNG', districtName: 'Munger' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'MUZ', districtName: 'Muzaffarpur' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'NAL', districtName: 'Nalanda' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'NWD', districtName: 'Nawada' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'PAT_BR', districtName: 'Patna' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'PUR', districtName: 'Purnia' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'RHT', districtName: 'Rohtas' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'SHS', districtName: 'Saharsa' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'SMT', districtName: 'Samastipur' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'SRN_BR', districtName: 'Saran' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'SKP', districtName: 'Sheikhpura' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'SHH', districtName: 'Sheohar' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'STM', districtName: 'Sitamarhi' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'SWN', districtName: 'Siwan' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'SPL', districtName: 'Supaul' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'VSH', districtName: 'Vaishali' },
  { stateCode: 'BR', stateName: 'Bihar', districtCode: 'WCM', districtName: 'West Champaran' },
  // Chhattisgarh (CG)
  { stateCode: 'CG', stateName: 'Chhattisgarh', districtCode: 'RPR', districtName: 'Raipur' },
  { stateCode: 'CG', stateName: 'Chhattisgarh', districtCode: 'BSP', districtName: 'Bilaspur' },
  // Goa (GA)
  { stateCode: 'GA', stateName: 'Goa', districtCode: 'NGO', districtName: 'North Goa' },
  { stateCode: 'GA', stateName: 'Goa', districtCode: 'SGO', districtName: 'South Goa' },
  // Gujarat (GJ) - All 33 Official Districts
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'AHM', districtName: 'Ahmedabad' },
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'AMR_GJ', districtName: 'Amreli' },
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'AND', districtName: 'Anand' },
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'ARV', districtName: 'Aravalli' },
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'BNK_GJ', districtName: 'Banaskantha' },
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'BRH', districtName: 'Bharuch' },
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'BHV', districtName: 'Bhavnagar' },
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'BTD', districtName: 'Botad' },
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'CHU_GJ', districtName: 'Chhota Udaipur' },
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'DHD', districtName: 'Dahod' },
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'DNG_GJ', districtName: 'Dang' },
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'DBD', districtName: 'Devbhumi Dwarka' },
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'GDN', districtName: 'Gandhinagar' },
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'GSM', districtName: 'Gir Somnath' },
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'JMN', districtName: 'Jamnagar' },
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'JND_GJ', districtName: 'Junagadh' },
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'KCH', districtName: 'Kachchh' },
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'KHD_GJ', districtName: 'Kheda' },
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'MSG', districtName: 'Mahisagar' },
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'MSN', districtName: 'Mehsana' },
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'MRB', districtName: 'Morbi' },
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'NRM', districtName: 'Narmada' },
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'NVS', districtName: 'Navsari' },
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'PNC', districtName: 'Panchmahal' },
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'PTN', districtName: 'Patan' },
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'PBD', districtName: 'Porbandar' },
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'RJK', districtName: 'Rajkot' },
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'SBK', districtName: 'Sabarkantha' },
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'SRT', districtName: 'Surat' },
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'SRN_GJ', districtName: 'Surendranagar' },
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'TAP', districtName: 'Tapi' },
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'VDR', districtName: 'Vadodara' },
  { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'VLS', districtName: 'Valsad' },
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
  // Jharkhand (JH) - All 24 Official Districts
  { stateCode: 'JH', stateName: 'Jharkhand', districtCode: 'BKO', districtName: 'Bokaro' },
  { stateCode: 'JH', stateName: 'Jharkhand', districtCode: 'CTR', districtName: 'Chatra' },
  { stateCode: 'JH', stateName: 'Jharkhand', districtCode: 'DGR', districtName: 'Deoghar' },
  { stateCode: 'JH', stateName: 'Jharkhand', districtCode: 'DHN', districtName: 'Dhanbad' },
  { stateCode: 'JH', stateName: 'Jharkhand', districtCode: 'DMK', districtName: 'Dumka' },
  { stateCode: 'JH', stateName: 'Jharkhand', districtCode: 'ESB', districtName: 'East Singhbhum' },
  { stateCode: 'JH', stateName: 'Jharkhand', districtCode: 'GRH', districtName: 'Garhwa' },
  { stateCode: 'JH', stateName: 'Jharkhand', districtCode: 'GRD', districtName: 'Giridih' },
  { stateCode: 'JH', stateName: 'Jharkhand', districtCode: 'GDD', districtName: 'Godda' },
  { stateCode: 'JH', stateName: 'Jharkhand', districtCode: 'GML', districtName: 'Gumla' },
  { stateCode: 'JH', stateName: 'Jharkhand', districtCode: 'HZB', districtName: 'Hazaribagh' },
  { stateCode: 'JH', stateName: 'Jharkhand', districtCode: 'JMT', districtName: 'Jamtara' },
  { stateCode: 'JH', stateName: 'Jharkhand', districtCode: 'KHT_JH', districtName: 'Khunti' },
  { stateCode: 'JH', stateName: 'Jharkhand', districtCode: 'KOD', districtName: 'Koderma' },
  { stateCode: 'JH', stateName: 'Jharkhand', districtCode: 'LTH', districtName: 'Latehar' },
  { stateCode: 'JH', stateName: 'Jharkhand', districtCode: 'LHD', districtName: 'Lohardaga' },
  { stateCode: 'JH', stateName: 'Jharkhand', districtCode: 'PKR', districtName: 'Pakur' },
  { stateCode: 'JH', stateName: 'Jharkhand', districtCode: 'PLM', districtName: 'Palamu' },
  { stateCode: 'JH', stateName: 'Jharkhand', districtCode: 'RMG', districtName: 'Ramgarh' },
  { stateCode: 'JH', stateName: 'Jharkhand', districtCode: 'RNC', districtName: 'Ranchi' },
  { stateCode: 'JH', stateName: 'Jharkhand', districtCode: 'SBG', districtName: 'Sahibganj' },
  { stateCode: 'JH', stateName: 'Jharkhand', districtCode: 'SKR_JH', districtName: 'Seraikela Kharsawan' },
  { stateCode: 'JH', stateName: 'Jharkhand', districtCode: 'SMD', districtName: 'Simdega' },
  { stateCode: 'JH', stateName: 'Jharkhand', districtCode: 'WSB', districtName: 'West Singhbhum' },
  // Karnataka (KA)
  { stateCode: 'KA', stateName: 'Karnataka', districtCode: 'BNG', districtName: 'Bangalore' },
  { stateCode: 'KA', stateName: 'Karnataka', districtCode: 'MYS', districtName: 'Mysore' },
  // Kerala (KL) - All 14 Official Districts
  { stateCode: 'KL', stateName: 'Kerala', districtCode: 'ALP', districtName: 'Alappuzha' },
  { stateCode: 'KL', stateName: 'Kerala', districtCode: 'EKM', districtName: 'Ernakulam' },
  { stateCode: 'KL', stateName: 'Kerala', districtCode: 'IDK', districtName: 'Idukki' },
  { stateCode: 'KL', stateName: 'Kerala', districtCode: 'KNR_KL', districtName: 'Kannur' },
  { stateCode: 'KL', stateName: 'Kerala', districtCode: 'KSG_KL', districtName: 'Kasaragod' },
  { stateCode: 'KL', stateName: 'Kerala', districtCode: 'KLM', districtName: 'Kollam' },
  { stateCode: 'KL', stateName: 'Kerala', districtCode: 'KTM', districtName: 'Kottayam' },
  { stateCode: 'KL', stateName: 'Kerala', districtCode: 'KKD', districtName: 'Kozhikode' },
  { stateCode: 'KL', stateName: 'Kerala', districtCode: 'MLP', districtName: 'Malappuram' },
  { stateCode: 'KL', stateName: 'Kerala', districtCode: 'PLK', districtName: 'Palakkad' },
  { stateCode: 'KL', stateName: 'Kerala', districtCode: 'PTA', districtName: 'Pathanamthitta' },
  { stateCode: 'KL', stateName: 'Kerala', districtCode: 'TVM_KL', districtName: 'Thiruvananthapuram' },
  { stateCode: 'KL', stateName: 'Kerala', districtCode: 'TSR', districtName: 'Thrissur' },
  { stateCode: 'KL', stateName: 'Kerala', districtCode: 'WYD', districtName: 'Wayanad' },
  // Madhya Pradesh (MP) - All 55 Official Districts
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'AGM', districtName: 'Agar Malwa' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'ALR', districtName: 'Alirajpur' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'ANP', districtName: 'Anuppur' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'ASH', districtName: 'Ashoknagar' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'BLG', districtName: 'Balaghat' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'BRW', districtName: 'Barwani' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'BTL', districtName: 'Betul' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'BHN', districtName: 'Bhind' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'BHP_MP', districtName: 'Bhopal' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'BUR', districtName: 'Burhanpur' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'CHT', districtName: 'Chhatarpur' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'CHW', districtName: 'Chhindwara' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'DMH', districtName: 'Damoh' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'DTA', districtName: 'Datia' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'DWS', districtName: 'Dewas' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'DHR', districtName: 'Dhar' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'DND', districtName: 'Dindori' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'GNA', districtName: 'Guna' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'GWL', districtName: 'Gwalior' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'HRD_MP', districtName: 'Harda' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'IND', districtName: 'Indore' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'JBL', districtName: 'Jabalpur' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'JHB', districtName: 'Jhabua' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'KTN', districtName: 'Katni' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'KHD', districtName: 'Khandwa' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'KHG_MP', districtName: 'Khargone' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'MHR', districtName: 'Maihar' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'MDL', districtName: 'Mandla' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'MND_MP', districtName: 'Mandsaur' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'MGJ', districtName: 'Mauganj' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'MRN', districtName: 'Morena' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'NMP', districtName: 'Narmadapuram' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'NSP', districtName: 'Narsinghpur' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'NMC', districtName: 'Neemuch' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'NWR', districtName: 'Niwari' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'PND', districtName: 'Pandhurna' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'PAN', districtName: 'Panna' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'RSN', districtName: 'Raisen' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'RJG', districtName: 'Rajgarh' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'RTL', districtName: 'Ratlam' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'REW_MP', districtName: 'Rewa' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'SGR', districtName: 'Sagar' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'STN', districtName: 'Satna' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'SHR_MP', districtName: 'Sehore' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'SNO', districtName: 'Seoni' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'SHD', districtName: 'Shahdol' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'SJP', districtName: 'Shajapur' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'SHP_MP', districtName: 'Sheopur' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'SVP', districtName: 'Shivpuri' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'SDH', districtName: 'Sidhi' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'SNG_MP', districtName: 'Singrauli' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'TKM', districtName: 'Tikamgarh' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'UJN', districtName: 'Ujjain' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'UMR', districtName: 'Umaria' },
  { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'VDS', districtName: 'Vidisha' },
  // Maharashtra (MH) - All 36 Official Districts
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'AHM_MH', districtName: 'Ahmednagar / Ahilyanagar' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'AKL', districtName: 'Akola' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'AMR_MH', districtName: 'Amravati' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'CSN', districtName: 'Chhatrapati Sambhaji Nagar' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'BED', districtName: 'Beed' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'BHD_MH', districtName: 'Bhandara' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'BLD', districtName: 'Buldhana' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'CHD', districtName: 'Chandrapur' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'DHL', districtName: 'Dhule' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'GDC', districtName: 'Gadchiroli' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'GND_MH', districtName: 'Gondia' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'HNG', districtName: 'Hingoli' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'JLG', districtName: 'Jalgaon' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'JLN_MH', districtName: 'Jalna' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'KLP_MH', districtName: 'Kolhapur' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'LTR', districtName: 'Latur' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'MMC', districtName: 'Mumbai City' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'MMS', districtName: 'Mumbai Suburban' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'NGP', districtName: 'Nagpur' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'NND', districtName: 'Nanded' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'NDB', districtName: 'Nandurbar' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'NSK', districtName: 'Nashik' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'DHR_MH', districtName: 'Dharashiv / Osmanabad' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'PLG', districtName: 'Palghar' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'PBN', districtName: 'Parbhani' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'PUN', districtName: 'Pune' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'RGD', districtName: 'Raigad' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'RTN', districtName: 'Ratnagiri' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'SGL', districtName: 'Sangli' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'STR', districtName: 'Satara' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'SND', districtName: 'Sindhudurg' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'SLP', districtName: 'Solapur' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'THN', districtName: 'Thane' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'WRD', districtName: 'Wardha' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'WSM', districtName: 'Washim' },
  { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'YTL', districtName: 'Yavatmal' },
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
  // Odisha (OD) - All 30 Official Districts
  { stateCode: 'OD', stateName: 'Odisha', districtCode: 'ANG', districtName: 'Angul' },
  { stateCode: 'OD', stateName: 'Odisha', districtCode: 'BLG_OD', districtName: 'Balangir' },
  { stateCode: 'OD', stateName: 'Odisha', districtCode: 'BLS_OD', districtName: 'Balasore' },
  { stateCode: 'OD', stateName: 'Odisha', districtCode: 'BRG', districtName: 'Bargarh' },
  { stateCode: 'OD', stateName: 'Odisha', districtCode: 'BDK', districtName: 'Bhadrak' },
  { stateCode: 'OD', stateName: 'Odisha', districtCode: 'BDH', districtName: 'Boudh' },
  { stateCode: 'OD', stateName: 'Odisha', districtCode: 'CTC', districtName: 'Cuttack' },
  { stateCode: 'OD', stateName: 'Odisha', districtCode: 'DGH', districtName: 'Deoghar' },
  { stateCode: 'OD', stateName: 'Odisha', districtCode: 'DNK', districtName: 'Dhenkanal' },
  { stateCode: 'OD', stateName: 'Odisha', districtCode: 'GJP', districtName: 'Gajapati' },
  { stateCode: 'OD', stateName: 'Odisha', districtCode: 'GNJ', districtName: 'Ganjam' },
  { stateCode: 'OD', stateName: 'Odisha', districtCode: 'JSP', districtName: 'Jagatsinghpur' },
  { stateCode: 'OD', stateName: 'Odisha', districtCode: 'JJP', districtName: 'Jajpur' },
  { stateCode: 'OD', stateName: 'Odisha', districtCode: 'JSG', districtName: 'Jharsuguda' },
  { stateCode: 'OD', stateName: 'Odisha', districtCode: 'KLH', districtName: 'Kalahandi' },
  { stateCode: 'OD', stateName: 'Odisha', districtCode: 'KND', districtName: 'Kandhamal' },
  { stateCode: 'OD', stateName: 'Odisha', districtCode: 'KNP_OD', districtName: 'Kendrapara' },
  { stateCode: 'OD', stateName: 'Odisha', districtCode: 'KJR', districtName: 'Kendujhar / Keonjhar' },
  { stateCode: 'OD', stateName: 'Odisha', districtCode: 'KRD', districtName: 'Khordha' },
  { stateCode: 'OD', stateName: 'Odisha', districtCode: 'KPT_OD', districtName: 'Koraput' },
  { stateCode: 'OD', stateName: 'Odisha', districtCode: 'MLK_OD', districtName: 'Malkangiri' },
  { stateCode: 'OD', stateName: 'Odisha', districtCode: 'MBJ', districtName: 'Mayurbhanj' },
  { stateCode: 'OD', stateName: 'Odisha', districtCode: 'NBP', districtName: 'Nabarangpur' },
  { stateCode: 'OD', stateName: 'Odisha', districtCode: 'NYG', districtName: 'Nayagarh' },
  { stateCode: 'OD', stateName: 'Odisha', districtCode: 'NPD', districtName: 'Nuapada' },
  { stateCode: 'OD', stateName: 'Odisha', districtCode: 'PRI', districtName: 'Puri' },
  { stateCode: 'OD', stateName: 'Odisha', districtCode: 'RYG', districtName: 'Rayagada' },
  { stateCode: 'OD', stateName: 'Odisha', districtCode: 'SBP', districtName: 'Sambalpur' },
  { stateCode: 'OD', stateName: 'Odisha', districtCode: 'SBP_OD', districtName: 'Subarnapur / Sonepur' },
  { stateCode: 'OD', stateName: 'Odisha', districtCode: 'SNG_OD', districtName: 'Sundargarh' },
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
  // Rajasthan (RJ) - All 50 Official Districts
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'AJM', districtName: 'Ajmer' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'ALW', districtName: 'Alwar' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'APG', districtName: 'Anupgarh' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'BLT', districtName: 'Balotra' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'BSW', districtName: 'Banswara' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'BRN', districtName: 'Baran' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'BMR', districtName: 'Barmer' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'BWR', districtName: 'Beawar' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'BHT', districtName: 'Bharatpur' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'BHL', districtName: 'Bhilwara' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'BKN', districtName: 'Bikaner' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'BND_RJ', districtName: 'Bundi' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'CTG', districtName: 'Chittorgarh' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'CHR', districtName: 'Churu' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'DSA', districtName: 'Dausa' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'DEG', districtName: 'Deeg' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'DHP', districtName: 'Dholpur' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'DKC', districtName: 'Didwana-Kuchaman' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'DNG', districtName: 'Dungarpur' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'GGN', districtName: 'Sri Ganganagar' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'GPC', districtName: 'Gangapur City' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'HNM', districtName: 'Hanumangarh' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'JPR', districtName: 'Jaipur' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'JSM', districtName: 'Jaisalmer' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'JLR', districtName: 'Jalore' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'JHL', districtName: 'Jhalawar' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'JJN', districtName: 'Jhunjhunu' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'JDH', districtName: 'Jodhpur' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'KRL_RJ', districtName: 'Karauli' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'KKR_RJ', districtName: 'Kekri' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'KHT', districtName: 'Khairthal-Tijara' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'KTA', districtName: 'Kota' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'KPB', districtName: 'Kotputli-Behror' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'NGR', districtName: 'Nagaur' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'NKT', districtName: 'Neem Ka Thana' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'PLI', districtName: 'Pali' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'PHL', districtName: 'Phalodi' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'PRT_RJ', districtName: 'Pratapgarh' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'RJS', districtName: 'Rajsamand' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'SLB', districtName: 'Salumbar' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'SNC', districtName: 'Sanchore' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'SWM', districtName: 'Sawai Madhopur' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'SHP', districtName: 'Shahpura' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'SKR', districtName: 'Sikar' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'SRH', districtName: 'Sirohi' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'TNK', districtName: 'Tonk' },
  { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'UDP', districtName: 'Udaipur' },
  // Sikkim (SK)
  { stateCode: 'SK', stateName: 'Sikkim', districtCode: 'ESK', districtName: 'East Sikkim' },
  { stateCode: 'SK', stateName: 'Sikkim', districtCode: 'WSK', districtName: 'West Sikkim' },
  // Tamil Nadu (TN) - All 38 Official Districts
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'ARI', districtName: 'Ariyalur' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'CGP', districtName: 'Chengalpattu' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'CHN', districtName: 'Chennai' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'CBE', districtName: 'Coimbatore' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'CUD', districtName: 'Cuddalore' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'DPI', districtName: 'Dharmapuri' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'DGL', districtName: 'Dindigul' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'ERD', districtName: 'Erode' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'KLK', districtName: 'Kallakurichi' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'KCP', districtName: 'Kancheepuram' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'KKM', districtName: 'Kanniyakumari' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'KRR', districtName: 'Karur' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'KGI', districtName: 'Krishnagiri' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'MDU', districtName: 'Madurai' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'MYD', districtName: 'Mayiladuthurai' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'NGP_TN', districtName: 'Nagapattinam' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'NMK', districtName: 'Namakkal' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'PBL', districtName: 'Perambalur' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'PDK', districtName: 'Pudukkottai' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'RMD', districtName: 'Ramanathapuram' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'RPT', districtName: 'Ranipet' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'SLM', districtName: 'Salem' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'SVG', districtName: 'Sivaganga' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'TKS', districtName: 'Tenkasi' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'TNJ', districtName: 'Thanjavur' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'NLG', districtName: 'The Nilgiris' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'THN_TN', districtName: 'Theni' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'TLR', districtName: 'Thiruvallur' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'TVR', districtName: 'Thiruvarur' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'TUT', districtName: 'Thoothukudi / Tuticorin' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'TRI', districtName: 'Tiruchirappalli' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'TNV', districtName: 'Tirunelveli' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'TPR_TN', districtName: 'Tirupathur' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'TPR', districtName: 'Tiruppur' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'TVM_TN', districtName: 'Tiruvannamalai' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'VEL', districtName: 'Vellore' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'VLP', districtName: 'Viluppuram' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'VRD', districtName: 'Virudhunagar' },
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
  // West Bengal (WB) - All 23 Official Districts
  { stateCode: 'WB', stateName: 'West Bengal', districtCode: 'APD', districtName: 'Alipurduar' },
  { stateCode: 'WB', stateName: 'West Bengal', districtCode: 'BNK_WB', districtName: 'Bankura' },
  { stateCode: 'WB', stateName: 'West Bengal', districtCode: 'BRB', districtName: 'Birbhum' },
  { stateCode: 'WB', stateName: 'West Bengal', districtCode: 'COB', districtName: 'Cooch Behar' },
  { stateCode: 'WB', stateName: 'West Bengal', districtCode: 'DDN_WB', districtName: 'Dakshin Dinajpur' },
  { stateCode: 'WB', stateName: 'West Bengal', districtCode: 'DAR', districtName: 'Darjeeling' },
  { stateCode: 'WB', stateName: 'West Bengal', districtCode: 'HGL', districtName: 'Hooghly' },
  { stateCode: 'WB', stateName: 'West Bengal', districtCode: 'HWH', districtName: 'Howrah' },
  { stateCode: 'WB', stateName: 'West Bengal', districtCode: 'JPG', districtName: 'Jalpaiguri' },
  { stateCode: 'WB', stateName: 'West Bengal', districtCode: 'JHG', districtName: 'Jhargram' },
  { stateCode: 'WB', stateName: 'West Bengal', districtCode: 'KLP', districtName: 'Kalimpong' },
  { stateCode: 'WB', stateName: 'West Bengal', districtCode: 'KOL', districtName: 'Kolkata' },
  { stateCode: 'WB', stateName: 'West Bengal', districtCode: 'MLD', districtName: 'Malda' },
  { stateCode: 'WB', stateName: 'West Bengal', districtCode: 'MSD', districtName: 'Murshidabad' },
  { stateCode: 'WB', stateName: 'West Bengal', districtCode: 'NAD', districtName: 'Nadia' },
  { stateCode: 'WB', stateName: 'West Bengal', districtCode: 'N24', districtName: 'North 24 Parganas' },
  { stateCode: 'WB', stateName: 'West Bengal', districtCode: 'PBD_WB', districtName: 'Paschim Bardhaman' },
  { stateCode: 'WB', stateName: 'West Bengal', districtCode: 'PMD', districtName: 'Paschim Medinipur' },
  { stateCode: 'WB', stateName: 'West Bengal', districtCode: 'PRB', districtName: 'Purba Bardhaman' },
  { stateCode: 'WB', stateName: 'West Bengal', districtCode: 'EGM', districtName: 'Purba Medinipur' },
  { stateCode: 'WB', stateName: 'West Bengal', districtCode: 'PUR_WB', districtName: 'Purulia' },
  { stateCode: 'WB', stateName: 'West Bengal', districtCode: 'S24', districtName: 'South 24 Parganas' },
  { stateCode: 'WB', stateName: 'West Bengal', districtCode: 'UDN', districtName: 'Uttar Dinajpur' },
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
  ahmednagar: { code: 'AHM_MH', name: 'Ahmednagar / Ahilyanagar', stateCode: 'MH', stateName: 'Maharashtra' },
  ahilyanagar: { code: 'AHM_MH', name: 'Ahmednagar / Ahilyanagar', stateCode: 'MH', stateName: 'Maharashtra' },
  aurangabad: { code: 'CSN', name: 'Chhatrapati Sambhaji Nagar', stateCode: 'MH', stateName: 'Maharashtra' },
  osmanabad: { code: 'DHR_MH', name: 'Dharashiv / Osmanabad', stateCode: 'MH', stateName: 'Maharashtra' },
  dharashiv: { code: 'DHR_MH', name: 'Dharashiv / Osmanabad', stateCode: 'MH', stateName: 'Maharashtra' },
  mumbai: { code: 'MMC', name: 'Mumbai City', stateCode: 'MH', stateName: 'Maharashtra' },
  tuticorin: { code: 'TUT', name: 'Thoothukudi / Tuticorin', stateCode: 'TN', stateName: 'Tamil Nadu' },
  thoothukudi: { code: 'TUT', name: 'Thoothukudi / Tuticorin', stateCode: 'TN', stateName: 'Tamil Nadu' },
  trichy: { code: 'TRI', name: 'Tiruchirappalli', stateCode: 'TN', stateName: 'Tamil Nadu' },
  tiruchirappalli: { code: 'TRI', name: 'Tiruchirappalli', stateCode: 'TN', stateName: 'Tamil Nadu' },
  tanjore: { code: 'TNJ', name: 'Thanjavur', stateCode: 'TN', stateName: 'Tamil Nadu' },
  thanjavur: { code: 'TNJ', name: 'Thanjavur', stateCode: 'TN', stateName: 'Tamil Nadu' },
  ooty: { code: 'NLG', name: 'The Nilgiris', stateCode: 'TN', stateName: 'Tamil Nadu' },
  nilgiris: { code: 'NLG', name: 'The Nilgiris', stateCode: 'TN', stateName: 'Tamil Nadu' },
  the_nilgiris: { code: 'NLG', name: 'The Nilgiris', stateCode: 'TN', stateName: 'Tamil Nadu' },
  nagapattinam: { code: 'NGP_TN', name: 'Nagapattinam', stateCode: 'TN', stateName: 'Tamil Nadu' },
  theni: { code: 'THN_TN', name: 'Theni', stateCode: 'TN', stateName: 'Tamil Nadu' },
  tirupathur: { code: 'TPR_TN', name: 'Tirupathur', stateCode: 'TN', stateName: 'Tamil Nadu' },
  tiruvannamalai: { code: 'TVM_TN', name: 'Tiruvannamalai', stateCode: 'TN', stateName: 'Tamil Nadu' },
  // Kerala Aliases
  trivandrum: { code: 'TVM_KL', name: 'Thiruvananthapuram', stateCode: 'KL', stateName: 'Kerala' },
  thiruvananthapuram: { code: 'TVM_KL', name: 'Thiruvananthapuram', stateCode: 'KL', stateName: 'Kerala' },
  calicut: { code: 'KKD', name: 'Kozhikode', stateCode: 'KL', stateName: 'Kerala' },
  kozhikode: { code: 'KKD', name: 'Kozhikode', stateCode: 'KL', stateName: 'Kerala' },
  cochin: { code: 'EKM', name: 'Ernakulam', stateCode: 'KL', stateName: 'Kerala' },
  cannanore: { code: 'KNR_KL', name: 'Kannur', stateCode: 'KL', stateName: 'Kerala' },
  quilon: { code: 'KLM', name: 'Kollam', stateCode: 'KL', stateName: 'Kerala' },
  alleppey: { code: 'ALP', name: 'Alappuzha', stateCode: 'KL', stateName: 'Kerala' },
  trichur: { code: 'TSR', name: 'Thrissur', stateCode: 'KL', stateName: 'Kerala' },
  palghat: { code: 'PLK', name: 'Palakkad', stateCode: 'KL', stateName: 'Kerala' },
  // Odisha Aliases
  keonjhar: { code: 'KJR', name: 'Kendujhar / Keonjhar', stateCode: 'OD', stateName: 'Odisha' },
  kendujhar: { code: 'KJR', name: 'Kendujhar / Keonjhar', stateCode: 'OD', stateName: 'Odisha' },
  sonepur: { code: 'SBP_OD', name: 'Subarnapur / Sonepur', stateCode: 'OD', stateName: 'Odisha' },
  subarnapur: { code: 'SBP_OD', name: 'Subarnapur / Sonepur', stateCode: 'OD', stateName: 'Odisha' },
  balangir: { code: 'BLG_OD', name: 'Balangir', stateCode: 'OD', stateName: 'Odisha' },
  balasore: { code: 'BLS_OD', name: 'Balasore', stateCode: 'OD', stateName: 'Odisha' },
  kendrapara: { code: 'KNP_OD', name: 'Kendrapara', stateCode: 'OD', stateName: 'Odisha' },
  koraput: { code: 'KPT_OD', name: 'Koraput', stateCode: 'OD', stateName: 'Odisha' },
  malkangiri: { code: 'MLK_OD', name: 'Malkangiri', stateCode: 'OD', stateName: 'Odisha' },
  sundargarh: { code: 'SNG_OD', name: 'Sundargarh', stateCode: 'OD', stateName: 'Odisha' },
  // Jharkhand Aliases
  seraikela: { code: 'SKR_JH', name: 'Seraikela Kharsawan', stateCode: 'JH', stateName: 'Jharkhand' },
  khunti: { code: 'KHT_JH', name: 'Khunti', stateCode: 'JH', stateName: 'Jharkhand' },
  daltonganj: { code: 'PLM', name: 'Palamu', stateCode: 'JH', stateName: 'Jharkhand' },
  jamshedpur: { code: 'ESB', name: 'East Singhbhum', stateCode: 'JH', stateName: 'Jharkhand' },
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

