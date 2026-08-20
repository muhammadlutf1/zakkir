import type { Locale } from "../i18n/locale";

export interface Surah {
	number: number;
	/** Arabic canonical name — always present and the fallback for every locale. */
	name: string;
	/** Localized variants keyed by locale; a missing locale falls back to `name`. */
	names?: Partial<Record<Locale, string>>;
}

/**
 * The fixed list of 114 suwar. The Arabic name is canonical; each surah also
 * carries an English variant now, with other locales added later.
 */
const SURAH_TABLE: Array<[number, string, string]> = [
	[1, "الفاتحة", "Al-Fatihah"],
	[2, "البقرة", "Al-Baqarah"],
	[3, "آل عمران", "Aal-Imran"],
	[4, "النساء", "An-Nisa"],
	[5, "المائدة", "Al-Ma'idah"],
	[6, "الأنعام", "Al-An'am"],
	[7, "الأعراف", "Al-A'raf"],
	[8, "الأنفال", "Al-Anfal"],
	[9, "التوبة", "At-Tawbah"],
	[10, "يونس", "Yunus"],
	[11, "هود", "Hud"],
	[12, "يوسف", "Yusuf"],
	[13, "الرعد", "Ar-Ra'd"],
	[14, "إبراهيم", "Ibrahim"],
	[15, "الحجر", "Al-Hijr"],
	[16, "النحل", "An-Nahl"],
	[17, "الإسراء", "Al-Isra"],
	[18, "الكهف", "Al-Kahf"],
	[19, "مريم", "Maryam"],
	[20, "طه", "Ta-Ha"],
	[21, "الأنبياء", "Al-Anbiya"],
	[22, "الحج", "Al-Hajj"],
	[23, "المؤمنون", "Al-Mu'minun"],
	[24, "النور", "An-Nur"],
	[25, "الفرقان", "Al-Furqan"],
	[26, "الشعراء", "Ash-Shu'ara"],
	[27, "النمل", "An-Naml"],
	[28, "القصص", "Al-Qasas"],
	[29, "العنكبوت", "Al-Ankabut"],
	[30, "الروم", "Ar-Rum"],
	[31, "لقمان", "Luqman"],
	[32, "السجدة", "As-Sajdah"],
	[33, "الأحزاب", "Al-Ahzab"],
	[34, "سبأ", "Saba"],
	[35, "فاطر", "Fatir"],
	[36, "يس", "Ya-Sin"],
	[37, "الصافات", "As-Saffat"],
	[38, "ص", "Sad"],
	[39, "الزمر", "Az-Zumar"],
	[40, "غافر", "Ghafir"],
	[41, "فصلت", "Fussilat"],
	[42, "الشورى", "Ash-Shura"],
	[43, "الزخرف", "Az-Zukhruf"],
	[44, "الدخان", "Ad-Dukhan"],
	[45, "الجاثية", "Al-Jathiyah"],
	[46, "الأحقاف", "Al-Ahqaf"],
	[47, "محمد", "Muhammad"],
	[48, "الفتح", "Al-Fath"],
	[49, "الحجرات", "Al-Hujurat"],
	[50, "ق", "Qaf"],
	[51, "الذاريات", "Adh-Dhariyat"],
	[52, "الطور", "At-Tur"],
	[53, "النجم", "An-Najm"],
	[54, "القمر", "Al-Qamar"],
	[55, "الرحمن", "Ar-Rahman"],
	[56, "الواقعة", "Al-Waqi'ah"],
	[57, "الحديد", "Al-Hadid"],
	[58, "المجادلة", "Al-Mujadila"],
	[59, "الحشر", "Al-Hashr"],
	[60, "الممتحنة", "Al-Mumtahanah"],
	[61, "الصف", "As-Saf"],
	[62, "الجمعة", "Al-Jumu'ah"],
	[63, "المنافقون", "Al-Munafiqun"],
	[64, "التغابن", "At-Taghabun"],
	[65, "الطلاق", "At-Talaq"],
	[66, "التحريم", "At-Tahrim"],
	[67, "الملك", "Al-Mulk"],
	[68, "القلم", "Al-Qalam"],
	[69, "الحاقة", "Al-Haqqah"],
	[70, "المعارج", "Al-Ma'arij"],
	[71, "نوح", "Nuh"],
	[72, "الجن", "Al-Jinn"],
	[73, "المزمل", "Al-Muzzammil"],
	[74, "المدثر", "Al-Muddaththir"],
	[75, "القيامة", "Al-Qiyamah"],
	[76, "الإنسان", "Al-Insan"],
	[77, "المرسلات", "Al-Mursalat"],
	[78, "النبأ", "An-Naba"],
	[79, "النازعات", "An-Nazi'at"],
	[80, "عبس", "Abasa"],
	[81, "التكوير", "At-Takwir"],
	[82, "الانفطار", "Al-Infitar"],
	[83, "المطففين", "Al-Mutaffifin"],
	[84, "الانشقاق", "Al-Inshiqaq"],
	[85, "البروج", "Al-Buruj"],
	[86, "الطارق", "At-Tariq"],
	[87, "الأعلى", "Al-A'la"],
	[88, "الغاشية", "Al-Ghashiyah"],
	[89, "الفجر", "Al-Fajr"],
	[90, "البلد", "Al-Balad"],
	[91, "الشمس", "Ash-Shams"],
	[92, "الليل", "Al-Layl"],
	[93, "الضحى", "Ad-Duha"],
	[94, "الشرح", "Ash-Sharh"],
	[95, "التين", "At-Tin"],
	[96, "العلق", "Al-Alaq"],
	[97, "القدر", "Al-Qadr"],
	[98, "البينة", "Al-Bayyinah"],
	[99, "الزلزلة", "Az-Zalzalah"],
	[100, "العاديات", "Al-Adiyat"],
	[101, "القارعة", "Al-Qari'ah"],
	[102, "التكاثر", "At-Takathur"],
	[103, "العصر", "Al-Asr"],
	[104, "الهمزة", "Al-Humazah"],
	[105, "الفيل", "Al-Fil"],
	[106, "قريش", "Quraysh"],
	[107, "الماعون", "Al-Ma'un"],
	[108, "الكوثر", "Al-Kawthar"],
	[109, "الكافرون", "Al-Kafirun"],
	[110, "النصر", "An-Nasr"],
	[111, "المسد", "Al-Masad"],
	[112, "الإخلاص", "Al-Ikhlas"],
	[113, "الفلق", "Al-Falaq"],
	[114, "الناس", "An-Nas"],
];

export const SURAH_LIST: Surah[] = SURAH_TABLE.map(([number, ar, en]) => ({
	number,
	name: ar,
	names: { en },
}));

/** The name of a surah in a locale, falling back to the Arabic canonical name. */
export function surahName(surah: Surah, locale: Locale): string {
	if (locale === "ar") return surah.name;
	return surah.names?.[locale] ?? surah.name;
}

/** Every known name of a surah (canonical Arabic plus localized variants). */
function allNames(surah: Surah): string[] {
	return [surah.name, ...Object.values(surah.names ?? {})];
}

/**
 * Resolves a surah given by number (1-114), numeric string, or name. Name
 * input is matched case-insensitively against every known locale's name, so a
 * user typing "Al-Kahf" or "الكهف" both resolve to surah 18.
 */
export function resolveSurah(input: string | number): Surah | undefined {
	if (typeof input === "number") return SURAH_LIST.find((s) => s.number === input);

	const trimmed = input.trim();

	if (/^\d+$/.test(trimmed))
		return SURAH_LIST.find((s) => s.number === Number(trimmed));

	const normalized = trimmed.toLowerCase();

	return SURAH_LIST.find((s) =>
		allNames(s).some((name) => name.toLowerCase() === normalized),
	);
}