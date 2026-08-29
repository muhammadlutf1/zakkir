import type { MessageCatalog, MessageKey } from "./messages";
import { ar, en } from "./messages";

/** The locales the bot currently ships, in the API's `language` values. */
export const LOCALES = ["ar", "en"] as const;

export type Locale = (typeof LOCALES)[number];

const catalogs: Record<Locale, MessageCatalog> = { ar, en };

/** Narrowing guard for stored/unknown locale strings. */
export function isLocale(value: string | undefined | null): value is Locale {
	return value === "ar" || value === "en";
}

export type InterpolationParams = Record<string, string | number>;

/**
 * Renders a template's `{var}` placeholders from a params map. Placeholders
 * without a matching param are left as-is so a missing value is visible.
 */
export function t(template: string, params: InterpolationParams = {}): string {
	return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) =>
		params[key] !== undefined ? String(params[key]) : match,
	);
}

/**
 * A locale bound to its message catalog. The single object every
 * user-facing rendering site asks for; it resolves keys against the catalog
 * for its locale and interpolates `{var}` placeholders.
 */
export interface Localizable {
	t(key: MessageKey, params?: InterpolationParams): string;
}

/** Builds the translator for a locale. */
export function localizable(locale: Locale): Localizable {
	return {
		t(key, params) {
			return t(catalogs[locale][key], params);
		},
	};
}
