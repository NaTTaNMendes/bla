// Processa uma issue aberta pelo site (voto, adicionar ou remover) e atualiza public/dados.json.
// Lê o evento do GitHub em GITHUB_EVENT_PATH e escreve a resposta (markdown) no stdout.
// Nunca lança erro: problemas viram uma resposta explicando o que houve.
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { CATEGORIAS, MAX, MARCADOR } from '../public/categorias.js';

const ARQUIVO = new URL('../public/dados.json', import.meta.url);
const IDS = new Set(CATEGORIAS.map((c) => c.id));

class Recusa extends Error {}

function lerPedido(corpo) {
  const depois = corpo.split(MARCADOR)[1];
  const bloco = depois && depois.match(/```json\s*([\s\S]*?)```/);
  if (!bloco) throw new Recusa('Não encontrei os dados do pedido. Use os botões do site para abrir a issue.');
  try {
    return JSON.parse(bloco[1]);
  } catch {
    throw new Recusa('Os dados do pedido estão corrompidos. Use os botões do site para abrir a issue.');
  }
}

const nomeDe = (dados, id) => dados.pessoas.find((p) => p.id === id)?.nome;

function votar(dados, autor, { pessoa, notas }) {
  const nome = nomeDe(dados, pessoa);
  if (!nome) throw new Recusa('Esse indivíduo não existe (talvez tenha sido removido).');
  if (!notas || typeof notas !== 'object') throw new Recusa('Voto sem notas.');
  const validas = {};
  for (const [cat, v] of Object.entries(notas)) {
    if (!IDS.has(cat)) throw new Recusa(`Categoria desconhecida: ${cat}`);
    if (!Number.isInteger(v) || v < 0 || v > MAX) throw new Recusa(`Nota inválida em ${cat}: use 0 a ${MAX}.`);
    if (v > 0) validas[cat] = v;
  }
  dados.votos[pessoa] ||= {};
  if (Object.keys(validas).length) {
    dados.votos[pessoa][autor] = validas;
    return `✅ Voto de @${autor} em **${nome}** registrado.`;
  }
  delete dados.votos[pessoa][autor];
  return `✅ Voto de @${autor} em **${nome}** apagado (todas as notas em 0).`;
}

function adicionar(dados, autor, { nomes }) {
  if (!Array.isArray(nomes)) throw new Recusa('Lista de nomes inválida.');
  const limpos = nomes.map((n) => String(n).trim().replace(/\s+/g, ' ')).filter(Boolean);
  if (!limpos.length) throw new Recusa('Nenhum nome informado.');
  if (limpos.length > 100) throw new Recusa('No máximo 100 nomes por vez.');
  if (limpos.some((n) => n.length > 40)) throw new Recusa('Nome muito longo (máximo 40 caracteres).');

  const existentes = new Set(dados.pessoas.map((p) => p.nome.toLowerCase()));
  const novos = [];
  for (const nome of limpos) {
    if (existentes.has(nome.toLowerCase())) continue;
    existentes.add(nome.toLowerCase());
    dados.pessoas.push({ id: randomBytes(4).toString('hex'), nome, criadoPor: autor });
    novos.push(nome);
  }
  if (!novos.length) return 'ℹ️ Todos esses nomes já estavam no mapa.';
  return `✅ Adicionado${novos.length > 1 ? 's' : ''}: ${novos.map((n) => `**${n}**`).join(', ')}.`;
}

function remover(dados, autor, ehDono, { pessoa }) {
  const p = dados.pessoas.find((x) => x.id === pessoa);
  if (!p) throw new Recusa('Esse indivíduo não existe (talvez já tenha sido removido).');
  if (p.criadoPor !== autor && !ehDono) throw new Recusa(`Só quem adicionou (@${p.criadoPor}) ou o dono do repositório pode remover **${p.nome}**.`);
  dados.pessoas = dados.pessoas.filter((x) => x !== p);
  delete dados.votos[pessoa];
  return `🗑️ **${p.nome}** foi removido do mapa.`;
}

function processar() {
  const evento = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const { issue } = evento;
  if (issue.user.type === 'Bot') throw new Recusa('Pedidos de bots são ignorados.');
  const autor = issue.user.login;
  const ehDono = issue.author_association === 'OWNER';

  const pedido = lerPedido(issue.body || '');
  const dados = JSON.parse(readFileSync(ARQUIVO, 'utf8'));
  if (process.env.GITHUB_REPOSITORY) dados.repositorio = process.env.GITHUB_REPOSITORY;

  let resposta;
  if (pedido.tipo === 'voto') resposta = votar(dados, autor, pedido);
  else if (pedido.tipo === 'adicionar') resposta = adicionar(dados, autor, pedido);
  else if (pedido.tipo === 'remover') resposta = remover(dados, autor, ehDono, pedido);
  else throw new Recusa('Tipo de pedido desconhecido.');

  writeFileSync(ARQUIVO, JSON.stringify(dados, null, 2) + '\n');
  return `${resposta}\n\nO site atualiza em cerca de 1 minuto.`;
}

let saida;
try {
  saida = processar();
} catch (e) {
  saida = e instanceof Recusa ? `❌ ${e.message}` : '❌ Erro inesperado ao processar o pedido.';
  if (!(e instanceof Recusa)) console.error(e);
}
process.stdout.write(saida + '\n');
