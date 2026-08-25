/**
 * English message catalog. The wording and custom Discord emotes are lifted
 * from the Quran bot (`langs/en.js`), adapted to this bot's message keys.
 * `en` is the canonical catalog: its keys define the message set every locale
 * must cover (`keyof typeof en`), and `ar` is type-checked against it.
 */
export const en = {
	// Recitation outcome feedback (`formatPlayResult`)
	"play.addedToQueue": "✅ Added **{label}** to the queue.",
	"play.started": "**<:play:1384273884622229514> Playing** {label}.",
	"play.failed":
		"<:error:1385171040098979961> Couldn't play {surah}. A notice was posted to the channel.",
	// The recitation label rendered across play/notice/picker surfaces
	"recitation.label": "{surah} by {reciter} ({rewayah})",
	// Rewayah picker
	"picker.header":
		"Available riwayat for Surah **{surah} ({number})** by **{reciter}**:",
	"picker.prompt": "Pick a riwayah to play it.",
	"picker.timeoutNoDefault":
		"Nothing picked — no default riwayah is set. Playback cancelled.",
	// Player notices
	"notice.unreachable":
		"<:error:1385171040098979961> Couldn't play {label} — the stream is unreachable.",
	"notice.playbackFailed":
		"<:error:1385171040098979961> Playback of {label} failed.",
	// Slash-command replies
	"command.notInVoice": "You need to join a voice channel first!",
	"command.needVoice": "Hey! Join the same voice channel as me first 😄",
	"command.joined": "Joined {channel}!",
	"command.playNotFound":
		'<:error:1385171040098979961> Incorrect surah input "{input}". Check `/suwar` and try again!',
	"command.reciterNotFound":
		'<:error:1385171040098979961> Incorrect reciter input "{reciter}". Check `/reciters` and try again!',
	"command.noDefaultReciter":
		"No default reciter is set for this server. Pass a <reciter> to play.",
	"command.reciterMissing": "Reciter not found.",
	"command.noRecitation":
		"{reciter} has no recitation of Surah {surah} ({number}).",
	"command.noStream":
		"No stream available for Surah {surah} by {reciter} ({rewayah}).",
	"command.resolveStreamFailed":
		"Could not resolve a stream for surah {number}.",
	"command.resolveFailed": "Couldn't resolve that recitation.",
	"command.notConnected":
		"I'm not connected to a voice channel in this server.",
	"command.nothingPlaying": "Nothing is playing.",
	"command.joinBlocked": "I'm already in {channel} with other members.",
	"command.manageGuildRequired":
		"You need the Manage Server permission to use this command.",
	"command.skipped": "**<:forward:1384273873427759278> Skipped**",
	"command.nowPlaying": "**<:play:1384273884622229514> Now playing** {label}.",
	"command.nothingToSkip": "Nothing is playing to skip.",
	"command.playbackEnded": "Queue finished — nothing is queued.",
	"command.queueCleared": "✅ Cleared the queue.",
	"command.onlyQueued": "There are only {count} queued recitation{s}.",
	"command.removed": "Removed queued recitation at position {position}.",
	"command.repeatSet":
		"**<:repeat:1384278335114449060> Loop mode set to {mode}.**",
	// Player panel (`/panel` and auto-post)
	"panel.showing": "🎛️ The player panel is up.",
	"panel.title": "Surah {surah} by {reciter}",
	"panel.repeatMode": "Repeat Mode: {mode}",
	"panel.note":
		"Note: To skip without clearing previous tracks (in order), set loop mode to 'All' first",
	"panel.noTracks": "No tracks queued",
	"panel.buttonPause": "Pause",
	"panel.buttonResume": "Resume",
	"panel.buttonStop": "Stop",
	"panel.buttonSkip": "Skip",
	"panel.buttonLoop": "Loop",
	"panel.repeatOff": "Off",
	"panel.repeatCurrent": "Current",
	"panel.repeatAll": "All",
	"panel.finished": "Queue finished — use `/play` to add more.",
	"panel.stoppedBy": "**Player stopped** by {user}.",
	"panel.paused": "<:pause:1384273881040289924> Paused.",
	"panel.resumed": "<:play:1384273884622229514> Resumed.",
	"panel.jumpedTo": "**<:play:1384273884622229514> Jumped to** {label}.",
	"panel.radioTitle": "Radio: {station}",
	// Repeat-mode names fed into `command.repeatSet`
	"repeat.mode.off": "Off",
	"repeat.mode.current": "Repeat Current",
	"repeat.mode.all": "Repeat All",
	// Radio
	"command.radioStationNotFound":
		'<:error:1385171040098979961> Radio station "{station}" not found.',
	"command.radioStarted": "📻 Now playing radio **{station}**.",
	"command.radioConfirmPrompt":
		"📻 Radio **{station}** is playing. Do you want to stop the radio and play **{label}**?",
	"command.radioConfirmYes": "Yes, play it",
	"command.radioConfirmNo": "No, keep radio",
	"command.radioContinuing": "📻 Continuing radio **{station}**.",
	"command.radioStopped": "📻 Radio stopped.",
	"notice.radioFailed":
		"<:error:1385171040098979961> Radio **{station}** failed after retries — stopped.",
	// `/preferences` confirmations and notices
	"preferences.languageSet": "🌐 Server UI language set to **{lang}**.",
	"preferences.reciterSet": "🎙️ Default reciter set to **{reciter}**.",
	"preferences.rewayahSet": "📖 Default rewayah set to **{rewayah}**.",
	"preferences.notFound":
		"<:error:1385171040098979961> That {what} couldn't be found.",
	"preferences.reciter": "reciter",
	"preferences.rewayah": "rewayah",
	// `/preferences` summary shown when no subcommand is selected
	"preferences.current": "🎛️ **Current server preferences**",
	"preferences.showLanguage": "Language: **{lang}**",
	"preferences.showReciter": "Default reciter: **{reciter}**",
	"preferences.showRewayah": "Default rewayah: **{rewayah}**",
	"preferences.unset": "not set",
	"language.name.en": "English",
	"language.name.ar": "العربية",
	// Vote (Gate tracer bullet)
	"vote.prompt": "Vote to skip **{label}** — cast your vote:",
	"vote.promptInitiator":
		"**{initiator}** wants to skip **{label}** — cast your vote:",
	"vote.alreadyVoted": "You already voted in this vote.",
	"vote.passed": "✅ Vote passed — skipped **{label}**.",
	"vote.rejected": "❌ Vote failed — not enough votes to skip.",
	"vote.cancelled": "🚫 Vote cancelled — initiator left the voice channel.",
	"vote.replaced": "🔄 Vote replaced by a new proposal.",
	"vote.started": "Vote started — please vote in the channel.",
	// Generic interaction error fallbacks
	"error.componentGeneric": "There was an error while handling that component!",
	"error.commandGeneric": "There was an error while executing this command!",
	// Custom Discord emotes used inside the messages above
	"emote.playing": "<:play:1384273884622229514>",
	"emote.queued": "✅",
	"emote.failed": "<:error:1385171040098979961>",
	"emote.picker": "<:play:1384273884622229514>",
	"emote.notice": "<:error:1385171040098979961>",
} as const;

/** Every message key the bot knows — derived from the English catalog. */
export type MessageKey = keyof typeof en;

/** The shape a locale dictionary must satisfy: every key, as a string. */
export type MessageCatalog = { readonly [K in MessageKey]: string };
