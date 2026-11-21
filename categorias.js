// Cada categoria é um eixo com dois lados. A nota vai de -MAX a +MAX:
//   positivo = o lado principal (nome/emoji), negativo = o oposto, 0 = neutro.
// `temp` diz quanto o lado principal esquenta (+) ou esfria (-) a temperatura geral;
// o oposto faz o contrário. -100 = gelado/amigável · +100 = fervendo/nojento.
export const CATEGORIAS = [
  { id: 'amigavel', eixo: 'Amizade', nome: 'Amigável', emoji: '😊', temp: -100, oposto: { nome: 'Hostil', emoji: '😠' } },
  { id: 'civilizado', eixo: 'Educação', nome: 'Civilizado', emoji: '🎩', temp: -65, oposto: { nome: 'Bárbaro', emoji: '🪓' } },
  { id: 'mercador', eixo: 'Negócios', nome: 'Mercador', emoji: '🤝', temp: -15, oposto: { nome: 'Caloteiro', emoji: '💸' } },
  { id: 'competitivo', eixo: 'Competição', nome: 'Competitivo', emoji: '🏆', temp: 25, oposto: { nome: 'Desencanado', emoji: '😴' } },
  { id: 'chatice', eixo: 'Chatice', nome: 'Chato', emoji: '🙄', temp: 55, oposto: { nome: 'Divertido', emoji: '😄' } },
  { id: 'toxicidade', eixo: 'Toxicidade', nome: 'Tóxico', emoji: '☢️', temp: 80, oposto: { nome: 'Gente boa', emoji: '🌱' } },
  { id: 'fedor', eixo: 'Cheiro', nome: 'Fedorento', emoji: '🦨', temp: 100, oposto: { nome: 'Cheiroso', emoji: '🌸' } },
];

export const MAX = 10;

/** Os dois lados de um eixo, do frio para o quente. */
export function polos(c) {
  const principal = { nome: c.nome, emoji: c.emoji };
  return c.temp < 0 ? { frio: principal, quente: c.oposto } : { frio: c.oposto, quente: principal };
}

/** Nota guardada (positivo = lado principal) → posição no eixo frio (-) ↔ quente (+). */
export const paraQuente = (c, v) => (c.temp < 0 ? -v : v);
