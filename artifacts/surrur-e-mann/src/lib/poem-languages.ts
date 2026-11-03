import {
  CreatePoemLanguage,
  type CreatePoemLanguage as PoemLanguageCode,
} from "@workspace/api-client-react";

export interface PoemLanguageOption {
  value: PoemLanguageCode;
  label: string;
  labelUrdu: string;
  title: string;
  titleUrdu: string;
  description: string;
  noPoems: string;
  comingSoon: string;
}

export const POEM_LANGUAGES = [
  {
    value: CreatePoemLanguage.urdu,
    label: "Urdu",
    labelUrdu: "اردو",
    title: "Urdu Poetry",
    titleUrdu: "اردو شاعری",
    description: "Browse the complete Urdu poetry collection — ghazals, nazms, qasidas, marsiyas and more from the masters of Urdu literature.",
    noPoems: "اردو اشعار دستیاب نہیں ہیں",
    comingSoon: "No Urdu poems found",
  },
  {
    value: CreatePoemLanguage.punjabi,
    label: "Punjabi",
    labelUrdu: "پنجابی",
    title: "Punjabi Poetry",
    titleUrdu: "پنجابی شاعری",
    description: "Explore Punjabi poetry — kafis, dohas, barahmasa and more from the rich Punjabi literary tradition.",
    noPoems: "پنجابی اشعار جلد آ رہے ہیں",
    comingSoon: "Punjabi poetry coming soon",
  },
  {
    value: CreatePoemLanguage.arabic,
    label: "Arabic",
    labelUrdu: "عربی",
    title: "Arabic Poetry",
    titleUrdu: "عربی شاعری",
    description: "Discover classical Arabic poetry — qasidas, ghazals, muallaqat and more from the golden age of Arabic literature.",
    noPoems: "عربی اشعار قریب ہے",
    comingSoon: "Arabic poetry coming soon",
  },
  {
    value: CreatePoemLanguage.persian,
    label: "Persian",
    labelUrdu: "فارسی",
    title: "Persian Poetry",
    titleUrdu: "فارسی شاعری",
    description: "Experience Persian poetry — ghazals, rubais, masnavis and more from the immortal masters of Persian verse.",
    noPoems: "فارسی اشعار عنقریب",
    comingSoon: "Persian poetry coming soon",
  },
  {
    value: CreatePoemLanguage.hindi,
    label: "Hindi",
    labelUrdu: "ہندی",
    title: "Hindi Poetry",
    titleUrdu: "ہندی شاعری",
    description: "Browse poems written in Hindi.",
    noPoems: "ہندی اشعار دستیاب نہیں ہیں",
    comingSoon: "Hindi poetry coming soon",
  },
  {
    value: CreatePoemLanguage.siraiki,
    label: "Siraiki",
    labelUrdu: "سرائیکی",
    title: "Siraiki Poetry",
    titleUrdu: "سرائیکی شاعری",
    description: "Browse poems written in Siraiki.",
    noPoems: "سرائیکی اشعار دستیاب نہیں ہیں",
    comingSoon: "Siraiki poetry coming soon",
  },
  {
    value: CreatePoemLanguage.english,
    label: "English",
    labelUrdu: "انگریزی",
    title: "English Poetry",
    titleUrdu: "انگریزی شاعری",
    description: "Browse poems written in English.",
    noPoems: "انگریزی اشعار دستیاب نہیں ہیں",
    comingSoon: "English poetry coming soon",
  },
  {
    value: CreatePoemLanguage.spanish,
    label: "Spanish / Español",
    labelUrdu: "ہسپانوی",
    title: "Spanish / Español Poetry",
    titleUrdu: "ہسپانوی شاعری",
    description: "Browse poems written in Spanish / Español.",
    noPoems: "ہسپانوی اشعار دستیاب نہیں ہیں",
    comingSoon: "Spanish / Español poetry coming soon",
  },
  {
    value: CreatePoemLanguage["punjabi-shahmukhi"],
    label: "Punjabi (Shahmukhi)",
    labelUrdu: "پنجابی (شاہ مکھی)",
    title: "Punjabi (Shahmukhi) Poetry",
    titleUrdu: "شاہ مکھی پنجابی شاعری",
    description: "Browse Punjabi poetry written in the Shahmukhi script.",
    noPoems: "شاہ مکھی پنجابی اشعار دستیاب نہیں ہیں",
    comingSoon: "Punjabi (Shahmukhi) poetry coming soon",
  },
] as const satisfies readonly PoemLanguageOption[];

export function getPoemLanguage(value: string): PoemLanguageOption | undefined {
  const canonicalValue = value === CreatePoemLanguage.farsi
    ? CreatePoemLanguage.persian
    : value;
  return POEM_LANGUAGES.find((language) => language.value === canonicalValue);
}

export function getPoemLanguageLabel(value: string): string {
  if (value === CreatePoemLanguage.farsi) return "Persian (legacy Farsi)";
  return getPoemLanguage(value)?.label ?? value;
}
