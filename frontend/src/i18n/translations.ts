/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Central translation dictionary.
// To add a new language: add an entry to SUPPORTED_LANGUAGES below, then add
// a matching block here with the same keys as `en`. Components never
// hardcode user-facing strings — they call t('key') so every language stays
// in sync from one place.

export type LanguageCode = 'en' | 'hi';

export const SUPPORTED_LANGUAGES: { code: LanguageCode; label: string; nativeLabel: string }[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
];

type TranslationKeys =
  | 'portal.name'
  | 'portal.tagline'
  | 'landing.signIn'
  | 'landing.heroBadge'
  | 'landing.heroTitle'
  | 'landing.heroSubtitle'
  | 'landing.stat.statesDistricts'
  | 'landing.stat.statesDistrictsDesc'
  | 'landing.stat.registeredSchools'
  | 'landing.stat.registeredSchoolsDesc'
  | 'landing.stat.studentsTracked'
  | 'landing.stat.studentsTrackedDesc'
  | 'landing.stat.assessmentsConducted'
  | 'landing.stat.assessmentsConductedDesc'
  | 'landing.stat.nationalFlnScore'
  | 'landing.stat.nationalFlnScoreDesc'
  | 'landing.vision.title'
  | 'landing.vision.body'
  | 'landing.curriculum.title'
  | 'landing.curriculum.body'
  | 'login.title'
  | 'login.subtitle'
  | 'login.badge'
  | 'login.emailLabel'
  | 'login.emailPlaceholder'
  | 'login.passwordLabel'
  | 'login.submit'
  | 'login.submitting'
  | 'login.back'
  | 'language.select';

export const translations: Record<LanguageCode, Record<TranslationKeys, string>> = {
  en: {
    'portal.name': 'FLN Portal',
    'portal.tagline': 'Foundational Literacy & Numeracy',
    'landing.signIn': 'Sign In to Dashboard',
    'landing.heroBadge': 'Foundational Literacy and Numeracy (FLN) National Assessment Scheme',
    'landing.heroTitle': 'Foundational Literacy and Numeracy (FLN) Assessment & Grader',
    'landing.heroSubtitle':
      'A state-of-the-art adaptive evaluation, diagnostics, and customized diagnostic worksheet pipeline. Empowering district admin teams, school principals, teachers, and field-level volunteers to elevate primary student learning outcomes under NEP guidelines.',
    'landing.stat.statesDistricts': 'States & Districts',
    'landing.stat.statesDistrictsDesc': 'Across India',
    'landing.stat.registeredSchools': 'Registered Schools',
    'landing.stat.registeredSchoolsDesc': 'Active institutions',
    'landing.stat.studentsTracked': 'Students Tracked',
    'landing.stat.studentsTrackedDesc': 'Enrolled learners',
    'landing.stat.assessmentsConducted': 'Assessments Conducted',
    'landing.stat.assessmentsConductedDesc': 'Worksheets generated',
    'landing.stat.nationalFlnScore': 'National Avg FLN Level',
    'landing.stat.nationalFlnScoreDesc': 'Average student level',
    'landing.vision.title': 'Our Vision',
    'landing.vision.body':
      "To enable all children of Class 3/4 to read with comprehension and write, perform basic mathematical operations, and acquire foundational math skills by providing them with customized assessments and remedial worksheets.",
    'landing.curriculum.title': 'Curriculum Integration',
    'landing.curriculum.body':
      "Our unified model defines 59 cumulative proficiency levels mapped precisely to Class 1, 2, 3, and 4 standards across foundational numeracy strands. Utilizing a specialized evaluation system, we generate diagnostic assessments on demand to pinpoint students' exact gaps.",
    'login.title': 'FLN Portal Login',
    'login.subtitle': 'Foundational Literacy and Numeracy (FLN) assessment scheme',
    'login.badge': 'AUTHORIZED DEPARTMENTAL SIGN-IN',
    'login.emailLabel': 'Official Email Address / SSO Username',
    'login.emailPlaceholder': 'enter mail or username',
    'login.passwordLabel': 'Official Access Password',
    'login.submit': 'Secure Sign In',
    'login.submitting': 'Verifying Digital Certificate Signature...',
    'login.back': 'Back to Public Information Portal',
    'language.select': 'Language',
  },
  hi: {
    'portal.name': 'एफएलएन पोर्टल',
    'portal.tagline': 'बुनियादी साक्षरता और संख्यात्मकता',
    'landing.signIn': 'डैशबोर्ड में साइन इन करें',
    'landing.heroBadge': 'बुनियादी साक्षरता और संख्यात्मकता (एफएलएन) राष्ट्रीय मूल्यांकन योजना',
    'landing.heroTitle': 'बुनियादी साक्षरता और संख्यात्मकता (एफएलएन) मूल्यांकन एवं ग्रेडर',
    'landing.heroSubtitle':
      'एक अत्याधुनिक अनुकूली मूल्यांकन, निदान और अनुकूलित निदान वर्कशीट प्रणाली। जिला प्रशासन, स्कूल प्राचार्यों, शिक्षकों और क्षेत्रीय स्वयंसेवकों को एनईपी दिशानिर्देशों के तहत प्राथमिक छात्रों के सीखने के परिणामों को बेहतर बनाने हेतु सशक्त बनाना।',
    'landing.stat.statesDistricts': 'राज्य और जिले',
    'landing.stat.statesDistrictsDesc': 'पूरे भारत में',
    'landing.stat.registeredSchools': 'पंजीकृत स्कूल',
    'landing.stat.registeredSchoolsDesc': 'सक्रिय संस्थान',
    'landing.stat.studentsTracked': 'ट्रैक किए गए छात्र',
    'landing.stat.studentsTrackedDesc': 'नामांकित शिक्षार्थी',
    'landing.stat.assessmentsConducted': 'आयोजित मूल्यांकन',
    'landing.stat.assessmentsConductedDesc': 'जनरेट की गई वर्कशीट',
    'landing.stat.nationalFlnScore': 'राष्ट्रीय औसत एफएलएन स्तर',
    'landing.stat.nationalFlnScoreDesc': 'औसत छात्र स्तर',
    'landing.vision.title': 'हमारा दृष्टिकोण',
    'landing.vision.body':
      'कक्षा 3/4 के सभी बच्चों को समझ के साथ पढ़ने और लिखने, बुनियादी गणितीय संक्रियाएं करने और अनुकूलित मूल्यांकन तथा उपचारात्मक वर्कशीट के माध्यम से बुनियादी गणित कौशल प्राप्त करने में सक्षम बनाना।',
    'landing.curriculum.title': 'पाठ्यक्रम एकीकरण',
    'landing.curriculum.body':
      'हमारा एकीकृत मॉडल कक्षा 1, 2, 3 और 4 के मानकों के अनुरूप बुनियादी संख्यात्मकता क्षेत्रों में 59 संचयी दक्षता स्तर परिभाषित करता है। एक विशेष मूल्यांकन प्रणाली का उपयोग करते हुए, हम छात्रों की सटीक कमियों का पता लगाने के लिए मांग पर निदान मूल्यांकन तैयार करते हैं।',
    'login.title': 'एफएलएन पोर्टल लॉगिन',
    'login.subtitle': 'बुनियादी साक्षरता और संख्यात्मकता (एफएलएन) मूल्यांकन योजना',
    'login.badge': 'अधिकृत विभागीय साइन-इन',
    'login.emailLabel': 'आधिकारिक ईमेल पता / एसएसओ उपयोगकर्ता नाम',
    'login.emailPlaceholder': 'मेल या उपयोगकर्ता नाम दर्ज करें',
    'login.passwordLabel': 'आधिकारिक एक्सेस पासवर्ड',
    'login.submit': 'सुरक्षित साइन इन',
    'login.submitting': 'डिजिटल प्रमाणपत्र हस्ताक्षर सत्यापित हो रहा है...',
    'login.back': 'सार्वजनिक सूचना पोर्टल पर वापस जाएं',
    'language.select': 'भाषा',
  },
};
