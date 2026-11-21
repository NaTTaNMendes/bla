// Mapa de Calor — servidor sem dependências: node:http + node:sqlite + node:crypto
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const PORTA = Number(process.env.PORT) || 8080;
const DB_PATH = process.env.DB_PATH || './dados/mapa.db';
const CONVITE = process.env.CODIGO_CONVITE || ''; // se definido, é exigido para criar conta
const PUBLICO = path.resolve('public');
const MAX = 10;

// Temperatura: -100 = gelado/amigável · 0 = neutro · +100 = fervendo/nojento
const CATEGORIAS = [
  { id: 'amigavel', nome: 'Amigável', emoji: '😊', temp: -100 },
  { id: 'civilizado', nome: 'Civilizado', emoji: '🎩', temp: -65 },
  { id: 'mercador', nome: 'Mercador', emoji: '🤝', temp: -15 },
  { id: 'neutro', nome: 'Neutro', emoji: '😐', temp: 0 },
  { id: 'competitivo', nome: 'Competitivo', emoji: '🏆', temp: 25 },
  { id: 'chatice', nome: 'Chatice', emoji: '🙄', temp: 55 },
  { id: 'toxicidade', nome: 'Toxicidade', emoji: '☢️', temp: 80 },
  { id: 'fedor', nome: 'Fedor', emoji: '🦨', temp: 100 },
];
const IDS_CATEGORIAS = new Set(CATEGORIAS.map((c) => c.id));

// ---------- Banco ----------

mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY,
    usuario TEXT NOT NULL UNIQUE COLLATE NOCASE,
    senha TEXT NOT NULL,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sessoes (
    token TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS pessoas (
    id INTEGER PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE COLLATE NOCASE,
    criado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS votos (
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    pessoa_id INTEGER NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
    categoria TEXT NOT NULL,
    valor INTEGER NOT NULL CHECK (valor BETWEEN 1 AND 10),
    PRIMARY KEY (usuario_id, pessoa_id, categoria)
  );
`);

const sql = {
  usuarioPorNome: db.prepare('SELECT id, usuario, senha FROM usuarios WHERE usuario = ?'),
  criarUsuario: db.prepare('INSERT INTO usuarios (usuario, senha) VALUES (?, ?)'),
  criarSessao: db.prepare('INSERT INTO sessoes (token, usuario_id) VALUES (?, ?)'),
  apagarSessao: db.prepare('DELETE FROM sessoes WHERE token = ?'),
  usuarioDaSessao: db.prepare(
    'SELECT u.id, u.usuario FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token = ?',
  ),
  pessoas: db.prepare(`
    SELECT p.id, p.nome, p.criado_por AS criadoPor, u.usuario AS criadoPorNome
    FROM pessoas p LEFT JOIN usuarios u ON u.id = p.criado_por
    ORDER BY p.nome`),
  votantes: db.prepare('SELECT pessoa_id AS id, COUNT(DISTINCT usuario_id) AS n FROM votos GROUP BY pessoa_id'),
  somas: db.prepare('SELECT pessoa_id AS id, categoria, SUM(valor) AS soma FROM votos GROUP BY pessoa_id, categoria'),
  meusVotos: db.prepare('SELECT pessoa_id AS id, categoria, valor FROM votos WHERE usuario_id = ?'),
  criarPessoa: db.prepare('INSERT OR IGNORE INTO pessoas (nome, criado_por) VALUES (?, ?)'),
  pessoa: db.prepare('SELECT id, criado_por AS criadoPor FROM pessoas WHERE id = ?'),
  apagarPessoa: db.prepare('DELETE FROM pessoas WHERE id = ?'),
  limparVotos: db.prepare('DELETE FROM votos WHERE usuario_id = ? AND pessoa_id = ?'),
  votar: db.prepare('INSERT INTO votos (usuario_id, pessoa_id, categoria, valor) VALUES (?, ?, ?, ?)'),
};

function transacao(fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// ---------- Senhas e sessões ----------

function hashSenha(senha) {
  const sal = randomBytes(16);
  return `${sal.toString('hex')}:${scryptSync(senha, sal, 32).toString('hex')}`;
}

function conferirSenha(senha, guardada) {
  const [sal, hash] = guardada.split(':');
  const calculado = scryptSync(senha, Buffer.from(sal, 'hex'), 32);
  return timingSafeEqual(calculado, Buffer.from(hash, 'hex'));
}

const hashToken = (t) => createHash('sha256').update(t).digest('hex');

function lerCookie(req, nome) {
  for (const parte of (req.headers.cookie || '').split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nome) return decodeURIComponent(v.join('='));
  }
  return null;
}

function usuarioAtual(req) {
  const token = lerCookie(req, 'sessao');
  return token ? sql.usuarioDaSessao.get(hashToken(token)) || null : null;
}

function iniciarSessao(req, res, usuarioId) {
  const token = randomBytes(32).toString('hex');
  sql.criarSessao.run(hashToken(token), usuarioId);
  const seguro = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `sessao=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${seguro}`);
}

// Limite simples de tentativas de login/cadastro por IP
const tentativas = new Map();
function limitado(req) {
  const ip = req.headers['fly-client-ip'] || req.socket.remoteAddress;
  const agora = Date.now();
  const t = tentativas.get(ip);
  if (!t || t.ate < agora) {
    tentativas.set(ip, { n: 1, ate: agora + 10 * 60_000 });
    return false;
  }
  return ++t.n > 20;
}

// ---------- Estado agregado ----------

function estado(usuario) {
  const votantes = new Map(sql.votantes.all().map((r) => [r.id, r.n]));
  const medias = new Map();
  for (const { id, categoria, soma } of sql.somas.all()) {
    if (!medias.has(id)) medias.set(id, {});
    medias.get(id)[categoria] = Math.round((soma / votantes.get(id)) * 10) / 10;
  }
  const meus = {};
  if (usuario) {
    for (const { id, categoria, valor } of sql.meusVotos.all(usuario.id)) (meus[id] ||= {})[categoria] = valor;
  }
  return {
    categorias: CATEGORIAS,
    precisaConvite: Boolean(CONVITE),
    eu: usuario,
    pessoas: sql.pessoas.all().map((p) => ({
      ...p,
      votantes: votantes.get(p.id) || 0,
      medias: medias.get(p.id) || {},
      meuVoto: meus[p.id] || {},
    })),
  };
}

// ---------- HTTP ----------

class ErroHttp extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

function json(res, status, dados) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(dados));
}

async function lerCorpo(req) {
  // Exigir JSON também protege contra envio de formulários de outros sites (CSRF).
  if (!(req.headers['content-type'] || '').includes('application/json')) throw new ErroHttp(415, 'Envie JSON.');
  let corpo = '';
  for await (const parte of req) {
    corpo += parte;
    if (corpo.length > 20_000) throw new ErroHttp(413, 'Muito grande.');
  }
  try {
    return corpo ? JSON.parse(corpo) : {};
  } catch {
    throw new ErroHttp(400, 'JSON inválido.');
  }
}

function exigirUsuario(req) {
  const u = usuarioAtual(req);
  if (!u) throw new ErroHttp(401, 'Entre na sua conta para contribuir.');
  return u;
}

const rotas = {
  'GET /api/estado': (req) => estado(usuarioAtual(req)),

  'POST /api/registrar': async (req, res) => {
    if (limitado(req)) throw new ErroHttp(429, 'Muitas tentativas. Espere alguns minutos.');
    const { usuario = '', senha = '', convite = '' } = await lerCorpo(req);
    const nome = String(usuario).trim();
    if (!/^[\p{L}\p{N}_.-]{3,20}$/u.test(nome)) throw new ErroHttp(400, 'Usuário: 3 a 20 letras, números, ponto, hífen ou _.');
    if (String(senha).length < 6) throw new ErroHttp(400, 'A senha precisa de pelo menos 6 caracteres.');
    if (CONVITE && convite !== CONVITE) throw new ErroHttp(403, 'Código de convite errado.');
    if (sql.usuarioPorNome.get(nome)) throw new ErroHttp(409, 'Esse usuário já existe.');
    const { lastInsertRowid } = sql.criarUsuario.run(nome, hashSenha(String(senha)));
    iniciarSessao(req, res, Number(lastInsertRowid));
    return { ok: true };
  },

  'POST /api/entrar': async (req, res) => {
    if (limitado(req)) throw new ErroHttp(429, 'Muitas tentativas. Espere alguns minutos.');
    const { usuario = '', senha = '' } = await lerCorpo(req);
    const u = sql.usuarioPorNome.get(String(usuario).trim());
    if (!u || !conferirSenha(String(senha), u.senha)) throw new ErroHttp(401, 'Usuário ou senha errados.');
    iniciarSessao(req, res, u.id);
    return { ok: true };
  },

  'POST /api/sair': async (req, res) => {
    const token = lerCookie(req, 'sessao');
    if (token) sql.apagarSessao.run(hashToken(token));
    res.setHeader('Set-Cookie', 'sessao=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    return { ok: true };
  },

  // Aceita vários nomes de uma vez: separados por vírgula, ponto e vírgula ou quebra de linha.
  'POST /api/pessoas': async (req) => {
    const u = exigirUsuario(req);
    const { nomes = '' } = await lerCorpo(req);
    const lista = String(nomes)
      .split(/[,;\n]+/)
      .map((s) => s.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    if (lista.some((n) => n.length > 40)) throw new ErroHttp(400, 'Nome muito longo (máximo 40 caracteres).');
    if (lista.length > 100) throw new ErroHttp(400, 'No máximo 100 nomes por vez.');
    const novos = transacao(() => lista.reduce((n, nome) => n + Number(sql.criarPessoa.run(nome, u.id).changes), 0));
    return { novos };
  },

  'DELETE /api/pessoas/:id': async (req, res, id) => {
    const u = exigirUsuario(req);
    const p = sql.pessoa.get(id);
    if (!p) throw new ErroHttp(404, 'Indivíduo não encontrado.');
    if (p.criadoPor !== u.id) throw new ErroHttp(403, 'Só quem adicionou pode remover.');
    sql.apagarPessoa.run(id);
    return { ok: true };
  },

  // Substitui o voto do usuário para um indivíduo: { notas: { fedor: 8, chatice: 3 } }
  'PUT /api/votos/:id': async (req, res, id) => {
    const u = exigirUsuario(req);
    if (!sql.pessoa.get(id)) throw new ErroHttp(404, 'Indivíduo não encontrado.');
    const { notas = {} } = await lerCorpo(req);
    const validas = Object.entries(notas).filter(([cat, v]) => IDS_CATEGORIAS.has(cat) && Number.isInteger(v) && v >= 1 && v <= MAX);
    transacao(() => {
      sql.limparVotos.run(u.id, id);
      for (const [cat, v] of validas) sql.votar.run(u.id, id, cat, v);
    });
    return { ok: true };
  },
};

function acharRota(metodo, url) {
  const exata = rotas[`${metodo} ${url}`];
  if (exata) return [exata];
  const m = url.match(/^(\/api\/[a-z]+)\/(\d+)$/);
  if (m && rotas[`${metodo} ${m[1]}/:id`]) return [rotas[`${metodo} ${m[1]}/:id`], Number(m[2])];
  return [];
}

const TIPOS = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };

async function servirArquivo(req, res, url) {
  const arquivo = path.join(PUBLICO, path.normalize(url === '/' ? '/index.html' : url));
  if (!arquivo.startsWith(PUBLICO + path.sep)) return json(res, 404, { erro: 'Não encontrado.' });
  try {
    const conteudo = await readFile(arquivo);
    res.writeHead(200, { 'Content-Type': `${TIPOS[path.extname(arquivo)] || 'application/octet-stream'}; charset=utf-8` });
    res.end(conteudo);
  } catch {
    json(res, 404, { erro: 'Não encontrado.' });
  }
}

const servidor = http.createServer(async (req, res) => {
  try {
    let url;
    try {
      url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    } catch {
      throw new ErroHttp(400, 'Endereço inválido.');
    }
    if (!url.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { erro: 'Método não permitido.' });
      return await servirArquivo(req, res, url);
    }
    const [rota, id] = acharRota(req.method, url);
    if (!rota) return json(res, 404, { erro: 'Rota não encontrada.' });
    json(res, 200, await rota(req, res, id));
  } catch (e) {
    if (!(e instanceof ErroHttp)) console.error(e);
    json(res, e.status || 500, { erro: e instanceof ErroHttp ? e.message : 'Erro interno.' });
  }
});

servidor.listen(PORTA, () => console.log(`Mapa de Calor em http://localhost:${PORTA}`));
