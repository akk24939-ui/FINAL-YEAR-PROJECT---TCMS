const translations = {
  en: {
    nav_home: 'Home',
    nav_about: 'About',
    nav_features: 'Features',
    nav_login: 'Login',
    nav_register: 'Register',
    hero_tagline: 'Privilege with Responsibility',
    hero_subtitle: "Tamil Nadu's first digital platform for regulated, responsible alcohol consumption — protecting consumers, families, and communities.",
    cta_register: 'Register as Consumer →',
    cta_operator: 'Shop Operator Login →',
    stat_shops: '6,860+ Shops',
    stat_districts: '38 Districts',
    stat_roles: '5 User Roles',
    stat_secure: '100% Secure',
    stat_age: 'Legal Age 21+',
    about_title: 'What is Smart TASMAC?',
    about_body: 'Smart TASMAC is an initiative by the Prohibition & Excise Department, Government of Tamil Nadu, to bring transparency, safety, and consumer empowerment to alcohol retail. Consumers can set personal limits, track purchases, and receive health guidance — all under state supervision.',
    roles_title: 'Who Can Use This Platform?',
    features_title: 'Key Features',
    how_title: 'How It Works',
    stats_title: 'Tamil Nadu at a Glance',
    trust_title: 'Trusted by Government of Tamil Nadu',
    footer_legal: 'This platform uses mock data for educational purposes. Not affiliated with actual Aadhaar services.',
    footer_helpline: 'Alcohol Helpline: 1800-425-4477',
  },
  ta: {
    nav_home: 'முகப்பு',
    nav_about: 'பற்றி',
    nav_features: 'அம்சங்கள்',
    nav_login: 'உள்நுழை',
    nav_register: 'பதிவு செய்',
    hero_tagline: 'உரிமையோடு பொறுப்பு',
    hero_subtitle: 'தமிழ்நாட்டின் முதல் டிஜிட்டல் மது கட்டுப்பாட்டு தளம் — நுகர்வோர், குடும்பங்கள் மற்றும் சமூகங்களை பாதுகாக்கிறது.',
    cta_register: 'நுகர்வோராக பதிவு செய் →',
    cta_operator: 'கடை ஆபரேட்டர் உள்நுழைவு →',
    stat_shops: '6,860+ கடைகள்',
    stat_districts: '38 மாவட்டங்கள்',
    stat_roles: '5 பயனர் பாத்திரங்கள்',
    stat_secure: '100% பாதுகாப்பானது',
    stat_age: 'சட்ட வயது 21+',
    about_title: 'Smart TASMAC என்றால் என்ன?',
    about_body: 'Smart TASMAC என்பது தமிழ்நாடு அரசின் தடை மற்றும் கலால் துறையின் முயற்சி. நுகர்வோர் தங்கள் தினசரி வரம்புகளை அமைக்கவும், கொள்முதல் வரலாற்றை கண்காணிக்கவும் உதவுகிறது.',
    roles_title: 'யார் இந்த தளத்தை பயன்படுத்தலாம்?',
    features_title: 'முக்கிய அம்சங்கள்',
    how_title: 'எவ்வாறு செயல்படுகிறது',
    stats_title: 'தமிழ்நாடு ஒரு பார்வையில்',
    trust_title: 'தமிழ்நாடு அரசால் நம்பகமானது',
    footer_legal: 'இந்த தளம் கல்வி நோக்கங்களுக்காக போலி தரவை பயன்படுத்துகிறது.',
    footer_helpline: 'மது உதவி எண்: 1800-425-4477',
  },
} as const

export type Lang = 'en' | 'ta'
export type TranslationKey = keyof typeof translations.en

export const t = (lang: Lang, key: TranslationKey): string => {
  return translations[lang][key] || translations.en[key] || key
}

export default translations
