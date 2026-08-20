import type { MessageCatalog } from "./en";

/**
 * Arabic message catalog. The wording and custom Discord emotes are lifted
 * from the Quran bot (`langs/ar.js`), adapted to this bot's message keys.
 * `as const satisfies MessageCatalog` keeps the literal values while the
 * compiler enforces that this catalog covers every key the English one does.
 */
export const ar = {
	// Recitation outcome feedback (`formatPlayResult`)
	"play.addedToQueue": "✅ تمت إضافة **{label}** إلى قائمة التشغيل.",
	"play.started": "**<:play:1384273884622229514> جارٍ تشغيل** {label}.",
	"play.failed":
		"<:error:1385171040098979961> تعذّر تشغيل {surah}. تم إرسال إشعار إلى القناة.",
	// The recitation label rendered across play/notice/picker surfaces
	"recitation.label": "{surah} بصوت {reciter} ({rewayah})",
	// Rewayah picker
	"picker.header":
		"الروايات المتاحة لسورة **{surah} ({number})** للقارئ **{reciter}**:",
	"picker.prompt": "اختر رواية لتشغيلها.",
	"picker.timeoutNoDefault":
		"لم يتم الاختيار — لا توجد رواية افتراضية محددة. تم إلغاء التشغيل.",
	// Player notices
	"notice.unreachable":
		"<:error:1385171040098979961> تعذّر تشغيل {label} — البث غير متاح.",
	"notice.playbackFailed": "<:error:1385171040098979961> فشل تشغيل {label}.",
	// Slash-command replies
	"command.notInVoice": "يرجى الانضمام إلى قناة صوتية أولاً.",
	"command.needVoice": "أهلًا! يرجى الانضمام إلى القناة الصوتية معي 😄",
	"command.joined": "تم الانضمام إلى {channel}!",
	"command.playNotFound":
		'إدخال السورة "{input}" غير صحيح. يرجى التحقق من `suwar/` والمحاولة مرة أخرى! <:error:1385171040098979961>',
	"command.reciterNotFound":
		'إدخال القارئ "{reciter}" غير صحيح. يرجى التحقق من `reciters/` والمحاولة مرة أخرى! <:error:1385171040098979961>',
	"command.noDefaultReciter":
		"لا يوجد قارئ افتراضي مُحدد لهذا الخادم. مرّر <reciter> للعب.",
	"command.reciterMissing": "القارئ غير موجود.",
	"command.noRecitation":
		"لا توجد تلاوة لسورة {surah} ({number}) بصوت {reciter}.",
	"command.noStream":
		"لا يوجد بث متاح لسورة {surah} بصوت {reciter} ({rewayah}).",
	"command.resolveStreamFailed": "تعذر تحليل بث سورة {number}.",
	"command.resolveFailed": "تعذّر حلّ هذه التلاوة.",
	"command.notConnected": "أنا لست متصلًا بقناة صوتية في هذا الخادم.",
	"command.skipped": "**<:forward:1384273873427759278> تم التخطي**",
	"command.nowPlaying": "**<:play:1384273884622229514> يُشغَّل الآن** {label}.",
	"command.nothingToSkip": "لا يوجد شيء قيد التشغيل للتخطي.",
	"command.playbackEnded": "انتهت قائمة التشغيل — لا يوجد شيء في قائمة الانتظار.",
	"command.queueCleared": "✅ تم مسح قائمة الانتظار.",
	"command.onlyQueued": "يوجد {count} من التلاوات في قائمة الانتظار.",
	"command.removed": "تمت إزالة التلاوة من الموضع {position}.",
	"command.repeatSet":
		"**<:repeat:1384278335114449060> تم ضبط وضع التكرار على {mode}.**",
	// Generic interaction error fallbacks
	"error.componentGeneric": "حدث خطأ أثناء معالجة هذا المكوّن!",
	"error.commandGeneric": "حدث خطأ أثناء تنفيذ هذا الأمر!",
	// Custom Discord emotes used inside the messages above
	"emote.playing": "<:play:1384273884622229514>",
	"emote.queued": "✅",
	"emote.failed": "<:error:1385171040098979961>",
	"emote.picker": "<:play:1384273884622229514>",
	"emote.notice": "<:error:1385171040098979961>",
} as const satisfies MessageCatalog;
