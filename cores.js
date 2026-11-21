// Gradiente divergente frio ↔ neutro ↔ quente, interpolado em OKLab
// para que a transição entre as cores fique suave e sem "lama" no meio.

// Paradas do gradiente: [temperatura, cor]
export const PARADAS = [
  [-100, '#1e3a8a'], // gelado — amigável
  [-70, '#2563eb'],
  [-40, '#60a5fa'],
  [-15, '#c7dcfb'],
  [0, '#e7e5e4'], // neutro
  [15, '#fde68a'],
  [40, '#fb923c'],
  [70, '#dc2626'],
  [100, '#7f1d1d'], // fervendo — nojento
];

const hexParaRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
};

const paraLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const paraSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function rgbParaOklab([r, g, b]) {
  [r, g, b] = [r, g, b].map(paraLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabParaRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => Math.min(1, Math.max(0, paraSrgb(c))));
}

const PARADAS_LAB = PARADAS.map(([t, hex]) => [t, rgbParaOklab(hexParaRgb(hex))]);

/** Cor [r,g,b] (0–1) para uma temperatura entre -100 e 100. */
function rgbDaTemperatura(temp) {
  const t = Math.max(-100, Math.min(100, temp));
  for (let i = 0; i < PARADAS_LAB.length - 1; i++) {
    const [t0, c0] = PARADAS_LAB[i];
    const [t1, c1] = PARADAS_LAB[i + 1];
    if (t <= t1) {
      const k = (t - t0) / (t1 - t0);
      return oklabParaRgb(c0.map((v, j) => v + (c1[j] - v) * k));
    }
  }
  return oklabParaRgb(PARADAS_LAB.at(-1)[1]);
}

/** Cor CSS para uma temperatura entre -100 e 100. */
export function corDaTemperatura(temp) {
  const [r, g, b] = rgbDaTemperatura(temp).map((v) => Math.round(v * 255));
  return `rgb(${r} ${g} ${b})`;
}

/** Cor de texto legível (preto ou branco) sobre a cor da temperatura. */
export function textoSobre(temp) {
  const [r, g, b] = rgbDaTemperatura(temp).map(paraLinear);
  const luminancia = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminancia > 0.3 ? '#111' : '#fff';
}

/** CSS linear-gradient com todas as paradas (para barras/legendas). */
export function gradienteCss(direcao = '90deg') {
  const passos = [];
  for (let t = -100; t <= 100; t += 10) {
    passos.push(`${corDaTemperatura(t)} ${(t + 100) / 2}%`);
  }
  return `linear-gradient(${direcao}, ${passos.join(', ')})`;
}
