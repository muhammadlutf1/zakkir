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
	"command.nothingPlaying": "لا يوجد شيء قيد التشغيل.",
	"command.joinBlocked": "أنا بالفعل في قناة صوتية مع أعضاء آخرين.",
	"command.manageGuildRequired":
		"تحتاج إلى صلاحية إدارة الخادم لاستخدام هذا الأمر.",
	"command.skipped": "**<:forward:1384273873427759278> تم التخطي**",
	"command.nowPlaying": "**<:play:1384273884622229514> يُشغَّل الآن** {label}.",
	"command.nothingToSkip": "لا يوجد شيء قيد التشغيل للتخطي.",
	"command.playbackEnded":
		"انتهت قائمة التشغيل — لا يوجد شيء في قائمة الانتظار.",
	"command.queueCleared": "✅ تم مسح قائمة الانتظار.",
	"command.onlyQueued": "يوجد {count} من التلاوات في قائمة الانتظار.",
	"command.removed": "تمت إزالة التلاوة من الموضع {position}.",
	"command.repeatSet":
		"**<:repeat:1384278335114449060> تم ضبط وضع التكرار على {mode}.**",
	// Player panel (`/panel` and auto-post)
	"panel.showing": "🎛️ لوحة المشغّل معروضة الآن.",
	"panel.title": "سورة {surah} بصوت القارئ {reciter}",
	"panel.repeatMode": "وضع التكرار: {mode}",
	"panel.note":
		'ملاحظة: للتخطي دون إفراغ المقاطع السابقة (بالترتيب)، اضبط وضع التكرار على "تكرار القائمة" أولًا',
	"panel.noTracks": "لا توجد مقاطع في قائمة الانتظار",
	"panel.buttonPause": "إيقاف مؤقت",
	"panel.buttonResume": "متابعة",
	"panel.buttonStop": "إيقاف",
	"panel.buttonSkip": "تخطي",
	"panel.buttonLoop": "تكرار",
	"panel.repeatOff": "إيقاف",
	"panel.repeatCurrent": "الحالي",
	"panel.repeatAll": "تكرار الكل",
	"panel.finished": "انتهت قائمة التشغيل — استخدم `/play` لإضافة المزيد.",
	"panel.stoppedBy": "**أوقف المشغّل** {user}.",
	"panel.paused": "<:pause:1384273881040289924> تم الإيقاف المؤقت.",
	"panel.resumed": "<:play:1384273884622229514> استؤنف التشغيل.",
	"panel.jumpedTo": "**<:play:1384273884622229514> انتقل إلى** {label}.",
	"panel.radioTitle": "راديو: {station}",
	// Repeat-mode names fed into `command.repeatSet`
	"repeat.mode.off": "إيقاف",
	"repeat.mode.current": "تكرار الحالي",
	"repeat.mode.all": "تكرار القائمة",
	// Radio
	"command.radioStationNotFound":
		'<:error:1385171040098979961> محطة الراديو "{station}" غير موجودة.',
	"command.radioStarted": "📻 يتم الآن تشغيل راديو **{station}**.",
	"command.radioConfirmPrompt":
		"📻 راديو **{station}** قيد التشغيل. هل تريد إيقاف الراديو وتشغيل **{label}**؟",
	"command.radioConfirmYes": "نعم، شغّلها",
	"command.radioConfirmNo": "لا، استمر في الراديو",
	"command.radioContinuing": "📻 مستمر في راديو **{station}**.",
	"command.radioStopped": "📻 تم إيقاف الراديو.",
	"notice.radioFailed":
		"<:error:1385171040098979961> فشل راديو **{station}** بعد عدة محاولات — تم إيقافه.",
	// `/preferences` confirmations and notices
	"preferences.languageSet": "🌐 تم ضبط لغة واجهة الخادم على **{lang}**.",
	"preferences.reciterSet": "🎙️ تم ضبط القارئ الافتراضي على **{reciter}**.",
	"preferences.rewayahSet": "📖 تم ضبط الرواية الافتراضية على **{rewayah}**.",
	"preferences.notFound":
		"<:error:1385171040098979961> تعذّر العثور على {what}.",
	"preferences.reciter": "القارئ",
	"preferences.rewayah": "الرواية",
	// `/preferences` summary shown when no subcommand is selected
	"preferences.current": "🎛️ **التفضيلات الحالية للخادم**",
	"preferences.showLanguage": "اللغة: **{lang}**",
	"preferences.showReciter": "القارئ الافتراضي: **{reciter}**",
	"preferences.showRewayah": "الرواية الافتراضية: **{rewayah}**",
	"preferences.unset": "غير محدد",
	"language.name.en": "الإنجليزية",
	"language.name.ar": "العربية",
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
