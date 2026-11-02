import type { Preset } from './types';

export type Lang = 'en' | 'fr' | 'es';

export interface Copy {
  help: string;
  placeholder: string;
  suggestions: readonly [string, string, string];
  working: string;
  cannotRetrieve: string;
  signIn: string;
  dismiss: string;
  send: string;
  minimize: string;
  presets: Record<Preset, string>;
}

const copy: Record<Lang, Copy> = {
  en: {
    help: 'How can I help you?',
    placeholder: 'Type a message',
    suggestions: ['What can you do?', 'Help me find something', 'I have a question'],
    working: 'Working…',
    cannotRetrieve: "I can't retrieve that right now.",
    signIn: 'Sign in to continue.',
    dismiss: 'Dismiss',
    send: 'Send',
    minimize: 'Minimize',
    presets: { ask: 'Ask', help: 'Help', question: '?', chat: 'Chat', info: 'Info' },
  },
  fr: {
    help: 'Comment puis-je vous aider ?',
    placeholder: 'Écrivez un message',
    suggestions: ['Que puis-je faire ?', 'Aidez-moi à trouver quelque chose', "J'ai une question"],
    working: 'En cours…',
    cannotRetrieve: 'Je ne peux pas récupérer cela pour le moment.',
    signIn: 'Connectez-vous pour continuer.',
    dismiss: 'Fermer',
    send: 'Envoyer',
    minimize: 'Réduire',
    presets: { ask: 'Demander', help: 'Aide', question: '?', chat: 'Discuter', info: 'Infos' },
  },
  es: {
    help: '¿Cómo puedo ayudarle?',
    placeholder: 'Escriba un mensaje',
    suggestions: ['¿Qué puede hacer?', 'Ayúdeme a encontrar algo', 'Tengo una pregunta'],
    working: 'En curso…',
    cannotRetrieve: 'No puedo recuperar eso en este momento.',
    signIn: 'Inicie sesión para continuar.',
    dismiss: 'Cerrar',
    send: 'Enviar',
    minimize: 'Minimizar',
    presets: { ask: 'Preguntar', help: 'Ayuda', question: '?', chat: 'Chatear', info: 'Info' },
  },
};

export function resolveLanguage(
  locale?: string | null,
  documentLang?: string | null,
  navigatorLang?: string | null,
): Lang {
  const candidates = [locale, documentLang, navigatorLang, 'en'];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const tag = candidate.trim().toLowerCase();
    if (tag.startsWith('fr')) return 'fr';
    if (tag.startsWith('es')) return 'es';
    if (tag.startsWith('en')) return 'en';
  }
  return 'en';
}

export function getCopy(lang: Lang): Copy {
  return copy[lang];
}
