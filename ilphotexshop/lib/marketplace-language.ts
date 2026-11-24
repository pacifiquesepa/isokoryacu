import { supportedLanguages, type Language } from "@/lib/marketplace-i18n";

const storageKey = "ilphotox-language";
const languageChangeEvent = "ilphotox-language-change";
let currentLanguage: Language = "en";

export function subscribeToMarketplaceLanguage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(languageChangeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(languageChangeEvent, onChange);
  };
}

export function getMarketplaceLanguageSnapshot(): Language {
  try {
    const savedLanguage = window.localStorage.getItem(storageKey);
    const language = supportedLanguages.find(
      (option) => option === savedLanguage,
    );
    currentLanguage = language ?? currentLanguage;
  } catch (caught) {
    console.error("Could not read the selected language", caught);
  }
  return currentLanguage;
}

export function getServerMarketplaceLanguageSnapshot(): Language {
  return "en";
}

export function setMarketplaceLanguage(language: Language) {
  currentLanguage = language;
  try {
    window.localStorage.setItem(storageKey, language);
  } catch (caught) {
    console.error("Failed to save the selected language", caught);
  }
  window.dispatchEvent(new Event(languageChangeEvent));
}
