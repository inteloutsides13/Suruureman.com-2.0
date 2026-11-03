const PERSIAN_LANGUAGE_CODES = ["persian", "farsi"] as const;

export function poemLanguageFilterValues(language: string): readonly string[] {
  return language === "persian" || language === "farsi"
    ? PERSIAN_LANGUAGE_CODES
    : [language];
}

export function poemLanguageMatchesFilter(poemLanguage: string, filterLanguage: string): boolean {
  return poemLanguageFilterValues(filterLanguage).includes(poemLanguage);
}
