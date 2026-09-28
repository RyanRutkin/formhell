import { createContext, useContext, useMemo, useRef, type ReactNode } from "react";
import { defaultMessages, type FormHellMessages } from "./messages";

export type FormHellMessageValues = Record<string, string | number>;

export type FormHellTextDirection = "ltr" | "rtl";

/** Returning undefined falls through to `messages`, then to the built-in English defaults. */
export type FormHellTranslate = (
  key: string,
  values?: FormHellMessageValues,
  defaultMessage?: string
) => string | undefined;

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export type FormHellMessagesOverride = DeepPartial<FormHellMessages>;

export interface FormHellLocaleContextValue {
  locale: string;
  direction: FormHellTextDirection;
  messages: FormHellMessages;
  formatMessage: (key: string, values?: FormHellMessageValues) => string;
}

export interface FormHellLocaleProviderProps {
  locale?: string;
  direction?: FormHellTextDirection;
  messages?: FormHellMessagesOverride;
  translate?: FormHellTranslate;
  children: ReactNode;
}

const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur", "ps", "sd", "ug", "yi", "dv", "ckb", "nqo", "rhg"]);

export function resolveDirection(locale: string): FormHellTextDirection {
  try {
    const resolved = new Intl.Locale(locale) as Intl.Locale & {
      textInfo?: { direction?: string };
      getTextInfo?: () => { direction?: string };
    };
    const textInfo = typeof resolved.getTextInfo === "function" ? resolved.getTextInfo() : resolved.textInfo;

    if (textInfo?.direction === "rtl" || textInfo?.direction === "ltr") {
      return textInfo.direction;
    }

    return RTL_LANGUAGES.has(resolved.language) ? "rtl" : "ltr";
  } catch {
    const language = locale.split("-")[0]?.toLowerCase() ?? "";
    return RTL_LANGUAGES.has(language) ? "rtl" : "ltr";
  }
}

const fallbackContextValue: FormHellLocaleContextValue = {
  locale: "en",
  direction: "ltr",
  messages: defaultMessages,
  formatMessage: (key, values) => interpolate(getMessageAtPath(defaultMessages, key), values)
};

const LocaleContext = createContext<FormHellLocaleContextValue | null>(null);

export function FormHellLocaleProvider({
  locale = "en",
  direction,
  messages,
  translate,
  children
}: FormHellLocaleProviderProps) {
  // Held in a ref so an inline translator identity does not invalidate the context on every render.
  const translateRef = useRef<FormHellTranslate | undefined>(translate);
  translateRef.current = translate;

  const value = useMemo<FormHellLocaleContextValue>(() => {
    const mergedMessages = mergeMessages(defaultMessages, messages);

    return {
      locale,
      direction: direction ?? resolveDirection(locale),
      messages: mergedMessages,
      formatMessage: (key, values) => {
        const defaultMessage = getMessageAtPath(mergedMessages, key);
        const translated = translateRef.current?.(key, values, defaultMessage);

        // Interpolating the result is idempotent, so host libraries that only
        // echo back the default message still get placeholders filled in.
        return interpolate(typeof translated === "string" ? translated : defaultMessage, values);
      }
    };
  }, [direction, locale, messages]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useFormHellLocale(): FormHellLocaleContextValue {
  return useContext(LocaleContext) ?? fallbackContextValue;
}

function mergeMessages(base: FormHellMessages, overrides?: FormHellMessagesOverride): FormHellMessages {
  if (!overrides) {
    return base;
  }

  return mergeRecords(base as unknown as Record<string, unknown>, overrides as Record<string, unknown>) as unknown as FormHellMessages;
}

function mergeRecords(base: Record<string, unknown>, overrides: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };

  for (const [key, overrideValue] of Object.entries(overrides)) {
    if (overrideValue === undefined) {
      continue;
    }

    const baseValue = base[key];
    result[key] =
      isPlainObject(baseValue) && isPlainObject(overrideValue)
        ? mergeRecords(baseValue, overrideValue)
        : overrideValue;
  }

  return result;
}

function getMessageAtPath(messages: FormHellMessages, path: string): string {
  let current: unknown = messages;

  for (const segment of path.split(".")) {
    if (!isPlainObject(current)) {
      return path;
    }

    current = current[segment];
  }

  return typeof current === "string" ? current : path;
}

function interpolate(template: string, values?: FormHellMessageValues): string {
  if (!values) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : match
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
