// Regras do mapa, usadas igualzinho pelo site (navegador) e pelo GitHub Actions (Node).
//
// Cada pedido (adicionar, votar, remover) vira uma mensagem no ntfy.sh assinada com uma
// chave anônima gerada no navegador de quem votou. A assinatura garante que ninguém
// consegue mudar ou apagar o voto de outra pessoa, sem precisar de conta nem login.
import { CATEGORIAS, MAX } from './categorias.js';

const IDS = new Set(CATEGORIAS.map((c) => c.id));
const ALGORITMO = { name: 'ECDSA', namedCurve: 'P-256' };
const ASSINATURA = { name: 'ECDSA', hash: 'SHA-256' };
const texto = (s) => new TextEncoder().encode(s);

const paraB64u = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export const dadosVazios = () => ({ pessoas: [], votos: {}, relogio: {}, ultimo: null });

export const limparNome = (n) => String(n).trim().replace(/\s+/g, ' ');

/** "Zé  Ninguém" → "ze-ninguem": evita o mesmo nome duas vezes. */
export function chaveDoNome(nome) {
  return limparNome(nome)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ---------- Identidade anônima ----------

export async function novaIdentidade() {
  const par = await crypto.subtle.generateKey(ALGORITMO, true, ['sign', 'verify']);
  return {
    privada: await crypto.subtle.exportKey('jwk', par.privateKey),
    publica: await crypto.subtle.exportKey('jwk', par.publicKey),
  };
}

/** Id público e anônimo de quem votou: um resumo da chave pública. */
export async function idDoVotante({ x, y }) {
  return paraB64u(await crypto.subtle.digest('SHA-256', texto(`${x}.${y}`))).slice(0, 16);
}

/** Monta a mensagem assinada que vai para o ntfy. */
export async function assinar(identidade, pedido) {
  const chave = await crypto.subtle.importKey('jwk', identidade.privada, ALGORITMO, false, ['sign']);
  const corpo = JSON.stringify({ ...pedido, ts: Date.now() });
  const assinatura = await crypto.subtle.sign(ASSINATURA, chave, texto(corpo));
  return JSON.stringify({ k: { x: identidade.publica.x, y: identidade.publica.y }, p: corpo, s: paraB64u(assinatura) });
}

async function verificar(mensagem) {
  try {
    const env = JSON.parse(mensagem);
    if (typeof env?.k?.x !== 'string' || typeof env.k.y !== 'string' || typeof env.p !== 'string' || typeof env.s !== 'string')
      return null;
    const chave = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: env.k.x, y: env.k.y }, ALGORITMO, false, ['verify']);
    if (!(await crypto.subtle.verify(ASSINATURA, chave, deB64u(env.s), texto(env.p)))) return null;
    return { votante: await idDoVotante(env.k), pedido: JSON.parse(env.p) };
  } catch {
    return null;
  }
}

// ---------- Aplicar pedidos ----------

function aplicar(dados, votante, pedido) {
  const pessoa = dados.pessoas.find((p) => p.id === pedido.pessoa);

  if (pedido.tipo === 'adicionar') {
    if (!Array.isArray(pedido.nomes) || pedido.nomes.length > 100) return false;
    const existentes = new Set(dados.pessoas.map((p) => chaveDoNome(p.nome)));
    for (const bruto of pedido.nomes) {
      const nome = limparNome(bruto);
      const id = chaveDoNome(nome);
      if (!id || nome.length > 40 || existentes.has(id)) continue;
      existentes.add(id);
      dados.pessoas.push({ id, nome, criador: votante });
    }
    return true;
  }

  if (pedido.tipo === 'voto') {
    if (!pessoa || !pedido.notas || typeof pedido.notas !== 'object') return false;
    const notas = {};
    for (const [cat, v] of Object.entries(pedido.notas)) {
      if (!IDS.has(cat)) continue; // categoria que não existe mais: ignora
      if (!Number.isInteger(v) || v < -MAX || v > MAX) return false;
      if (v !== 0) notas[cat] = v;
    }
    dados.votos[pessoa.id] ||= {};
    if (Object.keys(notas).length) dados.votos[pessoa.id][votante] = notas;
    else delete dados.votos[pessoa.id][votante];
    return true;
  }

  if (pedido.tipo === 'remover') {
    if (!pessoa || pessoa.criador !== votante) return false;
    dados.pessoas = dados.pessoas.filter((p) => p !== pessoa);
    delete dados.votos[pessoa.id];
    return true;
  }

  return false;
}

/**
 * Aplica, em ordem, as mensagens do ntfy aos dados. Mensagens inválidas, com assinatura
 * falsa ou repetidas (reenviadas) são ignoradas, então aplicar duas vezes não muda nada.
 */
export async function aplicarMensagens(dados, mensagens) {
  for (const m of mensagens) {
    dados.ultimo = m.id;
    const r = await verificar(m.message);
    if (!r) continue;
    const { votante, pedido } = r;
    const ts = pedido?.ts;
    if (!Number.isFinite(ts) || ts <= (dados.relogio[votante] || 0) || ts > m.time * 1000 + 5 * 60_000) continue;
    if (aplicar(dados, votante, pedido)) dados.relogio[votante] = ts;
  }
  return dados;
}

// ---------- ntfy ----------

/** Mensagens do tópico depois de `desde` (id da última já aplicada), em ordem. */
export async function buscarMensagens(base, topico, desde) {
  const r = await fetch(`${base}/${topico}/json?poll=1&since=${encodeURIComponent(desde || 'all')}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`ntfy respondeu ${r.status}`);
  return (await r.text())
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((e) => e.event === 'message');
}

export async function enviar(base, topico, mensagem) {
  const r = await fetch(`${base}/${topico}`, { method: 'POST', body: mensagem });
  if (!r.ok) throw new Error(`ntfy respondeu ${r.status}`);
}
