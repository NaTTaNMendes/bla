import { corDaTemperatura, textoSobre, gradienteCss } from './cores.js';

const MAX = 10;

let estado = { categorias: [], pessoas: [], eu: null, precisaConvite: false };
let aba = 'mapa';
let ordenacao = 'quente'; // mapa: quente | frio | nome
let filtroRanking = 'quente'; // ranking: quente | frio | id de categoria

// ---------- API ----------

async function api(metodo, url, corpo) {
  const r = await fetch(url, {
    method: metodo,
    headers: corpo ? { 'Content-Type': 'application/json' } : {},
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(dados.erro || 'Algo deu errado.');
  return dados;
}

async function recarregar() {
  estado = await api('GET', '/api/estado');
  render();
}

// ---------- Cálculo ----------

/**
 * Temperatura: média das temperaturas das categorias, ponderada pela intensidade
 * e escalada pela maior nota (1 de fedor esquenta menos que 10). Sem nota → 0.
 */
function temperatura(notas) {
  let peso = 0, soma = 0, maior = 0;
  for (const c of estado.categorias) {
    const v = notas[c.id] || 0;
    if (!v) continue;
    peso += v;
    soma += v * c.temp;
    maior = Math.max(maior, v);
  }
  return peso ? (soma / peso) * (maior / MAX) : 0;
}

const fmt = (t) => (Math.round(t) > 0 ? '+' : '') + Math.round(t);
const num = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','));

function pintar(el, temp) {
  el.style.background = corDaTemperatura(temp);
  el.style.color = textoSobre(temp);
}

const categoriasOrdenadas = () => [...estado.categorias].sort((a, b) => a.temp - b.temp);
const comTemperatura = () => estado.pessoas.map((p) => ({ p, t: temperatura(p.medias) }));

// ---------- DOM ----------

const $ = (sel) => document.querySelector(sel);

function el(tag, props = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e[k] = v;
  }
  e.append(...filhos.filter((f) => f != null));
  return e;
}

function render() {
  const logado = Boolean(estado.eu);
  $('#conta').replaceChildren(
    ...(logado
      ? [el('span', { textContent: estado.eu.usuario }), el('button', { class: 'link', textContent: 'Sair', onclick: sair })]
      : [el('button', { class: 'link destaque', textContent: 'Entrar', onclick: () => abrirLogin() })]),
  );
  $('#form-pessoas').hidden = !logado;
  $('#convite-entrar').hidden = logado;

  for (const b of document.querySelectorAll('.aba')) b.classList.toggle('ativa', b.dataset.aba === aba);
  $('#aba-mapa').hidden = aba !== 'mapa';
  $('#aba-ranking').hidden = aba !== 'ranking';
  if (aba === 'mapa') renderMapa();
  else renderRanking();
}

function renderMapa() {
  const tabela = $('#mapa');
  const cats = categoriasOrdenadas();
  const lista = comTemperatura();
  if (ordenacao === 'nome') lista.sort((a, b) => a.p.nome.localeCompare(b.p.nome, 'pt-BR'));
  else if (ordenacao === 'frio') lista.sort((a, b) => a.t - b.t);
  else lista.sort((a, b) => b.t - a.t);

  const vazio = lista.length === 0;
  $('#vazio').hidden = !vazio;
  $('#dica').hidden = vazio;
  tabela.hidden = vazio;
  if (vazio) return tabela.replaceChildren();

  const cab = el(
    'tr',
    {},
    el('th', {
      class: 'nome ordenavel',
      textContent: `${lista.length} ${lista.length === 1 ? 'indivíduo' : 'indivíduos'}${ordenacao === 'nome' ? ' ↓' : ''}`,
      title: 'Ordenar por nome',
      onclick: () => ((ordenacao = 'nome'), render()),
    }),
    ...cats.map((c) => el('th', { title: `${c.nome} (${fmt(c.temp)})` }, el('span', { class: 'emoji', textContent: c.emoji }), c.nome)),
    el('th', {
      class: 'ordenavel',
      textContent: `Temperatura${ordenacao === 'frio' ? ' ↑' : ordenacao === 'quente' ? ' ↓' : ''}`,
      title: 'Alternar entre mais quente e mais frio primeiro',
      onclick: () => ((ordenacao = ordenacao === 'quente' ? 'frio' : 'quente'), render()),
    }),
    el('th', { textContent: 'Votos' }),
  );

  const linhas = lista.map(({ p, t }) => {
    const total = el('td', { class: 'total', textContent: fmt(t) });
    pintar(total, t);
    const votei = Object.keys(p.meuVoto).length > 0;
    return el(
      'tr',
      { class: 'linha', title: estado.eu ? 'Clique para votar' : 'Entre para votar', onclick: () => abrirVoto(p.id) },
      el('td', { class: 'nome' }, p.nome, votei ? el('span', { class: 'votei', textContent: ' •', title: 'Você votou' }) : null),
      ...cats.map((c) => {
        const v = p.medias[c.id] || 0;
        const td = el('td', { class: v ? 'cel' : 'cel zero', textContent: v ? num(v) : '', title: `${p.nome} · ${c.nome}: ${num(v)}` });
        if (v) pintar(td, (c.temp * v) / MAX);
        return td;
      }),
      total,
      el('td', { class: 'votos', textContent: p.votantes }),
    );
  });

  tabela.replaceChildren(el('thead', {}, cab), el('tbody', {}, ...linhas));
}

function renderRanking() {
  const filtros = [
    { id: 'quente', rotulo: '🔥 Mais quente' },
    { id: 'frio', rotulo: '❄️ Mais frio' },
    ...categoriasOrdenadas().map((c) => ({ id: c.id, rotulo: `${c.emoji} ${c.nome}` })),
  ];
  $('#filtros').replaceChildren(
    ...filtros.map((f) =>
      el('button', {
        class: 'filtro' + (f.id === filtroRanking ? ' ativo' : ''),
        textContent: f.rotulo,
        onclick: () => ((filtroRanking = f.id), render()),
      }),
    ),
  );

  let itens;
  const cat = estado.categorias.find((c) => c.id === filtroRanking);
  if (cat) {
    itens = estado.pessoas
      .map((p) => ({ p, v: p.medias[cat.id] || 0 }))
      .filter((x) => x.v > 0)
      .sort((a, b) => b.v - a.v)
      .map(({ p, v }) => ({ p, valor: num(v), temp: (cat.temp * v) / MAX, largura: v / MAX }));
  } else {
    const sinal = filtroRanking === 'frio' ? -1 : 1;
    itens = comTemperatura()
      .filter(({ p, t }) => p.votantes > 0 && Math.sign(Math.round(t)) === sinal)
      .sort((a, b) => sinal * (b.t - a.t))
      .map(({ p, t }) => ({ p, valor: `${fmt(t)}°`, temp: t, largura: Math.abs(t) / 100 }));
  }

  $('#ranking-vazio').hidden = itens.length > 0;
  const medalhas = ['🥇', '🥈', '🥉'];
  $('#ranking').replaceChildren(
    ...itens.map(({ p, valor, temp, largura }, i) => {
      const barra = el('span', { class: 'rank-barra' });
      barra.style.width = `${Math.max(4, largura * 100)}%`;
      barra.style.background = corDaTemperatura(temp);
      const pill = el('span', { class: 'temp', textContent: valor });
      pintar(pill, temp);
      return el(
        'li',
        { onclick: () => abrirVoto(p.id), title: estado.eu ? 'Clique para votar' : '' },
        el('span', { class: 'posicao', textContent: medalhas[i] || `${i + 1}º` }),
        el('span', { class: 'rank-nome' }, p.nome, el('small', { textContent: `${p.votantes} ${p.votantes === 1 ? 'voto' : 'votos'}` })),
        el('span', { class: 'rank-trilho' }, barra),
        pill,
      );
    }),
  );
}

// ---------- Voto ----------

const dialogoVoto = $('#dialogo-voto');
let votando = null;
let rascunho = {};

function abrirVoto(id) {
  if (!estado.eu) return abrirLogin();
  votando = estado.pessoas.find((p) => p.id === id);
  if (!votando) return;
  rascunho = { ...votando.meuVoto };
  $('#voto-nome').textContent = votando.nome;
  const tGrupo = temperatura(votando.medias);
  $('#voto-info').textContent = votando.votantes
    ? `Média do grupo: ${fmt(tGrupo)}° com ${votando.votantes} ${votando.votantes === 1 ? 'voto' : 'votos'}`
    : 'Ninguém votou ainda — seja o primeiro.';
  $('#btn-remover').hidden = votando.criadoPor !== estado.eu.id;

  $('#voto-sliders').replaceChildren(
    ...categoriasOrdenadas().map((c) => {
      const saida = el('output');
      const mostrar = () => {
        const v = rascunho[c.id] || 0;
        saida.textContent = v;
        if (v) pintar(saida, (c.temp * v) / MAX);
        else saida.removeAttribute('style');
      };
      mostrar();
      return el(
        'label',
        { class: 'slider' },
        el('span', { textContent: `${c.emoji} ${c.nome}` }),
        el('input', {
          type: 'range',
          min: 0,
          max: MAX,
          value: rascunho[c.id] || 0,
          oninput: (ev) => {
            const v = Number(ev.target.value);
            if (v) rascunho[c.id] = v;
            else delete rascunho[c.id];
            mostrar();
            mostrarResumo();
          },
        }),
        saida,
      );
    }),
  );
  mostrarResumo();
  dialogoVoto.showModal();
}

function mostrarResumo() {
  const t = temperatura(rascunho);
  const span = $('#voto-temp');
  span.textContent = fmt(t);
  pintar(span, t);
}

$('#form-voto').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  try {
    await api('PUT', `/api/votos/${votando.id}`, { notas: rascunho });
    dialogoVoto.close();
    await recarregar();
  } catch (e) {
    alert(e.message);
  }
});

$('#btn-remover').addEventListener('click', async () => {
  if (!confirm(`Remover "${votando.nome}" do mapa? Os votos de todo mundo nele serão apagados.`)) return;
  try {
    await api('DELETE', `/api/pessoas/${votando.id}`);
    dialogoVoto.close();
    await recarregar();
  } catch (e) {
    alert(e.message);
  }
});

for (const b of document.querySelectorAll('[data-fechar]')) b.addEventListener('click', () => b.closest('dialog').close());

// ---------- Conta ----------

const dialogoLogin = $('#dialogo-login');
let criandoConta = false;

function modoLogin(criar) {
  criandoConta = criar;
  $('#login-titulo').textContent = criar ? 'Criar conta' : 'Entrar';
  $('#login-enviar').textContent = criar ? 'Criar conta' : 'Entrar';
  $('#login-pergunta').textContent = criar ? 'Já tem conta?' : 'Não tem conta?';
  $('#login-trocar').textContent = criar ? 'Entrar' : 'Criar conta';
  $('#login-senha').autocomplete = criar ? 'new-password' : 'current-password';
  $('#login-convite').hidden = !(criar && estado.precisaConvite);
  $('#login-convite').required = criar && estado.precisaConvite;
  $('#login-erro').hidden = true;
}

function abrirLogin(criar = false) {
  modoLogin(criar);
  dialogoLogin.showModal();
  $('#login-usuario').focus();
}

$('#login-trocar').addEventListener('click', () => modoLogin(!criandoConta));
for (const b of document.querySelectorAll('[data-abrir-login]')) b.addEventListener('click', () => abrirLogin(true));
dialogoLogin.addEventListener('click', (ev) => ev.target === dialogoLogin && dialogoLogin.close());

$('#form-login').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  try {
    await api('POST', criandoConta ? '/api/registrar' : '/api/entrar', {
      usuario: $('#login-usuario').value,
      senha: $('#login-senha').value,
      convite: $('#login-convite').value,
    });
    dialogoLogin.close();
    ev.target.reset();
    await recarregar();
  } catch (e) {
    $('#login-erro').textContent = e.message;
    $('#login-erro').hidden = false;
  }
});

async function sair() {
  await api('POST', '/api/sair');
  await recarregar();
}

// ---------- Adicionar ----------

const campoNomes = $('#nomes');
$('#form-pessoas').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (!campoNomes.value.trim()) return;
  try {
    await api('POST', '/api/pessoas', { nomes: campoNomes.value });
    campoNomes.value = '';
    campoNomes.rows = 1;
    await recarregar();
  } catch (e) {
    alert(e.message);
  }
});
// Enter adiciona; Shift+Enter quebra linha. O campo cresce ao colar uma lista.
campoNomes.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && !ev.shiftKey) {
    ev.preventDefault();
    $('#form-pessoas').requestSubmit();
  }
});
campoNomes.addEventListener('input', () => {
  campoNomes.rows = Math.min(8, campoNomes.value.split('\n').length);
});

// ---------- Abas e atualização ----------

for (const b of document.querySelectorAll('.aba')) {
  b.addEventListener('click', () => {
    aba = b.dataset.aba;
    render();
  });
}

// Mostra votos novos de outras pessoas sem precisar recarregar a página.
const algumDialogoAberto = () => dialogoVoto.open || dialogoLogin.open;
setInterval(() => !document.hidden && !algumDialogoAberto() && recarregar().catch(() => {}), 20_000);
window.addEventListener('focus', () => !algumDialogoAberto() && recarregar().catch(() => {}));

$('#barra').style.background = gradienteCss();
recarregar().catch((e) => alert(e.message));
