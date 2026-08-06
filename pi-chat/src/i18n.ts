import zhCn from "./locales/zh-cn.json";

type Bundle = Record<string, string>;

const lang: string =
  typeof (window as any).__PI_LANG__ === "string" ? (window as any).__PI_LANG__ : "en";

const bundle: Bundle = lang === "zh-cn" ? (zhCn as Bundle) : {};

export function t(key: string, ...args: (string | number)[]): string {
  let s = bundle[key] ?? key;
  if (args.length > 0) {
    for (let i = 0; i < args.length; i++) {
      s = s.split(`{${i}}`).join(String(args[i]));
    }
  }
  return s;
}

export function getLang(): string {
  return lang;
}
