import * as vscode from "vscode";
import enBundle from "../l10n/bundle.l10n.json" with { type: "json" };
import zhCnBundle from "../l10n/bundle.l10n.zh-cn.json" with { type: "json" };

export type Locale = "en" | "zh-cn";

const BUNDLES: Record<Locale, Record<string, string>> = {
  en: enBundle as Record<string, string>,
  "zh-cn": zhCnBundle as Record<string, string>,
};

let cachedLocale: Locale | undefined;
let cacheKey: string | undefined;

export function getLanguageSetting(): string {
  return vscode.workspace.getConfiguration("pi-agent-studio").get<string>("language", "auto");
}

/** Resolve the effective locale: explicit "en"/"zh-cn" wins, "auto" follows the
 *  VS Code display language (falling back to English). */
export function getLocale(): Locale {
  const key = `${getLanguageSetting()}:${vscode.env.language ?? ""}`;
  if (cacheKey === key && cachedLocale) return cachedLocale;
  cacheKey = key;
  cachedLocale = resolveLocale(getLanguageSetting());
  return cachedLocale;
}

function resolveLocale(setting: string): Locale {
  if (setting === "en" || setting === "zh-cn") return setting;
  const lang = (vscode.env.language || "en").toLowerCase();
  if (lang === "zh-cn" || lang === "zh-hans" || lang.startsWith("zh-cn")) return "zh-cn";
  return "en";
}

/** Translate a source-string key with vscode.l10n-style {0}/{1} placeholders.
 *  Falls back to the English bundle, then to the key itself. */
export function t(key: string, ...args: (string | number)[]): string {
  const bundle = BUNDLES[getLocale()];
  let msg = bundle[key] ?? BUNDLES.en[key] ?? key;
  if (args.length > 0) {
    msg = msg.replace(/\{(\d+)\}/g, (match, idx: string) => {
      const arg = args[Number(idx)];
      return arg === undefined ? match : String(arg);
    });
  }
  return msg;
}

/** Serialized i18n state for extension-host webviews (sessions/settings
 *  sidebars): the resolved locale plus the active bundle, injected into the
 *  HTML so client-side scripts can translate dynamically. */
export function getWebviewI18n(): { lang: Locale; bundle: Record<string, string> } {
  const locale = getLocale();
  return { lang: locale, bundle: BUNDLES[locale] };
}
