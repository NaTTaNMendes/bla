// Temperatura: -100 = gelado/amigável · 0 = neutro · +100 = fervendo/nojento
export const CATEGORIAS = [
  { id: 'amigavel', nome: 'Amigável', emoji: '😊', temp: -100 },
  { id: 'civilizado', nome: 'Civilizado', emoji: '🎩', temp: -65 },
  { id: 'mercador', nome: 'Mercador', emoji: '🤝', temp: -15 },
  { id: 'neutro', nome: 'Neutro', emoji: '😐', temp: 0 },
  { id: 'competitivo', nome: 'Competitivo', emoji: '🏆', temp: 25 },
  { id: 'chatice', nome: 'Chatice', emoji: '🙄', temp: 55 },
  { id: 'toxicidade', nome: 'Toxicidade', emoji: '☢️', temp: 80 },
  { id: 'fedor', nome: 'Fedor', emoji: '🦨', temp: 100 },
];

export const MAX = 10;

// Marcador que identifica as issues geradas pelo site.
export const MARCADOR = '<!-- mapa-de-calor -->';
