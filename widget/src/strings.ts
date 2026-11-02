import type { Lang, Preset } from "./types";

export interface Copy {
  greeting: string;
  placeholder: string;
  suggestions: readonly [string, string, string];
  working: string;
  cannotRetrieve: string;
  signIn: string;
  dismiss: string;
  send: string;
  minimize: string;
  launcher: Record<Preset, string>;
  /** Non-factual preview reply. Not a live account status. */
  previewLine: string;
}

export const STRINGS: Record<Lang, Copy> = {
  en: {
    greeting: "How can I help you?",
    placeholder: "Type a message",
    suggestions: ["What can you do?", "Help me find something", "I have a question"],
    working: "Working…",
    cannotRetrieve: "I can't retrieve that right now.",
    signIn: "Sign in to continue.",
    dismiss: "Dismiss",
    send: "Send",
    minimize: "Minimize",
    launcher: { ask: "Ask", help: "Help", question: "?", chat: "Chat", info: "Info" },
    previewLine: "This preview has no live account connection.",
  },
  fr: {
    greeting: "Comment puis-je vous aider ?",
    placeholder: "Écrivez un message",
    suggestions: ["Que puis-je faire ?", "Aidez-moi à trouver quelque chose", "J'ai une question"],
    working: "En cours…",
    cannotRetrieve: "Je ne peux pas récupérer cela pour le moment.",
    signIn: "Connectez-vous pour continuer.",
    dismiss: "Fermer",
    send: "Envoyer",
    minimize: "Réduire",
    launcher: { ask: "Demander", help: "Aide", question: "?", chat: "Discuter", info: "Infos" },
    previewLine: "Cet aperçu n'a aucune connexion à un compte en direct.",
  },
  es: {
    greeting: "¿Cómo puedo ayudarle?",
    placeholder: "Escriba un mensaje",
    suggestions: ["¿Qué puede hacer?", "Ayúdeme a encontrar algo", "Tengo una pregunta"],
    working: "En curso…",
    cannotRetrieve: "No puedo recuperar eso en este momento.",
    signIn: "Inicie sesión para continuar.",
    dismiss: "Cerrar",
    send: "Enviar",
    minimize: "Minimizar",
    launcher: { ask: "Preguntar", help: "Ayuda", question: "?", chat: "Chatear", info: "Info" },
    previewLine: "Esta vista previa no tiene conexión a una cuenta en vivo.",
  },
};

export function stringsFor(lang: Lang): Copy {
  return STRINGS[lang];
}

export function allSuggestionTexts(): string[] {
  return (Object.keys(STRINGS) as Lang[]).flatMap((lang) => [...STRINGS[lang].suggestions]);
}
