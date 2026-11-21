import { corDaTemperatura, textoSobre, gradienteCss } from './cores.js';
import { CATEGORIAS, MAX, MARCADOR } from './categorias.js';

let dados = { repositorio: '', pessoas: [], votos: {} };
let pessoas = []; // pessoas com médias calculadas
let aba = 'mapa';
let ordenacao = 'quente'; // mapa: quente | frio | nome
let filtroRanking = 'quente'; // ranking: quente | frio | id de categoria

// Lembra o último voto enviado deste navegador, para já abrir os sliders preenchidos.
const CHAVE_MEUS = 'mapa-de-calor:meus-votos';
const meusVotos = JSON.parse(localStorage.getItem(CHAVE_MEUS) || '{}');

// ---------- Dados ----------

async function recarregar() {
  const r = await fetch(`dados.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Não consegui carregar os dados.');
  dados = await r.json();
  pessoas = dados.pessoas.map((p) => {
    const votos = Object.values(dados.votos[p.id] || {});
    const medias = {};
    for (const voto of votos) for (const [cat, v] of Object.entries(voto)) medias[cat] = (medias[cat] || 0) + v;
    for (const cat in medias) medias[cat] = Math.round((medias[cat] / votos.length) * 10) / 10;
    return { ...p, votantes: votos.length, medias, t: temperatura(medias) };
  });
  render();
}

/** Abre uma issue pronta no GitHub; o Actions processa o pedido que vai no bloco JSON. */
function abrirIssue(titulo, texto, pedido) {
  const corpo = `${texto}\n\nÉ só confirmar criando a issue. O robô registra e fecha em cerca de 1 minuto.\n\n${MARCADOR}\n\`\`\`json\n${JSON.stringify(pedido)}\n\`\`\`\n`;
  const url = `https://github.com/${dados.repositorio}/issues/new?${new URLSearchParams({ title: titulo, body: corpo })}`;
  window.open(url, '_blank', 'noopener');
}

// ---------- Cálculo ----------

/**
 * Temperatura: média das temperaturas das categorias, ponderada pela intensidade
 * e escalada pela maior nota (1 de fedor esquenta menos que 10). Sem nota → 0.
 */
function temperatura(notas) {
  let peso = 0, soma = 0, maior = 0;
  for (const c of CATEGORIAS) {
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
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

function pintar(el, temp) {
  el.style.background = corDaTemperatura(temp);
  el.style.color = textoSobre(temp);
}

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
  for (const b of document.querySelectorAll('.aba')) b.classList.toggle('ativa', b.dataset.aba === aba);
  $('#aba-mapa').hidden = aba !== 'mapa';
  $('#aba-ranking').hidden = aba !== 'ranking';
  if (aba === 'mapa') renderMapa();
  else renderRanking();
}

function renderMapa() {
  const tabela = $('#mapa');
  const lista = [...pessoas];
  if (ordenacao === 'nome') lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
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
      textContent: plural(lista.length, 'indivíduo', 'indivíduos') + (ordenacao === 'nome' ? ' ↓' : ''),
      title: 'Ordenar por nome',
      onclick: () => ((ordenacao = 'nome'), render()),
    }),
    ...CATEGORIAS.map((c) => el('th', { title: `${c.nome} (${fmt(c.temp)})` }, el('span', { class: 'emoji', textContent: c.emoji }), c.nome)),
    el('th', {
      class: 'ordenavel',
      textContent: `Temperatura${ordenacao === 'frio' ? ' ↑' : ordenacao === 'quente' ? ' ↓' : ''}`,
      title: 'Alternar entre mais quente e mais frio primeiro',
      onclick: () => ((ordenacao = ordenacao === 'quente' ? 'frio' : 'quente'), render()),
    }),
    el('th', { textContent: 'Votos' }),
  );

  const linhas = lista.map((p) => {
    const total = el('td', { class: 'total', textContent: fmt(p.t) });
    pintar(total, p.t);
    return el(
      'tr',
      { class: 'linha', title: 'Clique para votar', onclick: () => abrirVoto(p.id) },
      el('td', { class: 'nome', textContent: p.nome }),
      ...CATEGORIAS.map((c) => {
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
    ...CATEGORIAS.map((c) => ({ id: c.id, rotulo: `${c.emoji} ${c.nome}` })),
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
  const cat = CATEGORIAS.find((c) => c.id === filtroRanking);
  if (cat) {
    itens = pessoas
      .filter((p) => p.medias[cat.id] > 0)
      .sort((a, b) => b.medias[cat.id] - a.medias[cat.id])
      .map((p) => {
        const v = p.medias[cat.id];
        return { p, valor: num(v), temp: (cat.temp * v) / MAX, largura: v / MAX };
      });
  } else {
    const sinal = filtroRanking === 'frio' ? -1 : 1;
    itens = pessoas
      .filter((p) => p.votantes > 0 && Math.sign(Math.round(p.t)) === sinal)
      .sort((a, b) => sinal * (b.t - a.t))
      .map((p) => ({ p, valor: `${fmt(p.t)}°`, temp: p.t, largura: Math.abs(p.t) / 100 }));
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
        { onclick: () => abrirVoto(p.id), title: 'Clique para votar' },
        el('span', { class: 'posicao', textContent: medalhas[i] || `${i + 1}º` }),
        el('span', { class: 'rank-nome' }, p.nome, el('small', { textContent: plural(p.votantes, 'voto', 'votos') })),
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
  votando = pessoas.find((p) => p.id === id);
  if (!votando) return;
  rascunho = { ...(meusVotos[id] || {}) };
  $('#voto-nome').textContent = votando.nome;
  $('#voto-info').textContent = votando.votantes
    ? `Média do grupo: ${fmt(votando.t)}° com ${plural(votando.votantes, 'voto', 'votos')} · adicionado por @${votando.criadoPor}`
    : `Ninguém votou ainda — seja o primeiro. · adicionado por @${votando.criadoPor}`;

  $('#voto-sliders').replaceChildren(
    ...CATEGORIAS.map((c) => {
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

$('#form-voto').addEventListener('submit', () => {
  const notas = { ...rascunho };
  const linhas = CATEGORIAS.filter((c) => notas[c.id]).map((c) => `| ${c.emoji} ${c.nome} | ${notas[c.id]} |`);
  const texto = linhas.length
    ? `Voto em **${votando.nome}**\n\n| Categoria | Nota |\n|---|---|\n${linhas.join('\n')}`
    : `Apagar meu voto em **${votando.nome}**`;
  abrirIssue(`Voto: ${votando.nome}`, texto, { tipo: 'voto', pessoa: votando.id, notas });
  meusVotos[votando.id] = notas;
  localStorage.setItem(CHAVE_MEUS, JSON.stringify(meusVotos));
});

$('#btn-remover').addEventListener('click', () => {
  abrirIssue(
    `Remover: ${votando.nome}`,
    `Remover **${votando.nome}** do mapa (só funciona para quem adicionou, @${votando.criadoPor}, ou para o dono do repositório).`,
    { tipo: 'remover', pessoa: votando.id },
  );
  dialogoVoto.close();
});

for (const b of document.querySelectorAll('[data-fechar]')) b.addEventListener('click', () => b.closest('dialog').close());

// ---------- Adicionar ----------

const campoNomes = $('#nomes');
$('#form-pessoas').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const nomes = campoNomes.value.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
  if (!nomes.length) return;
  let titulo = `Adicionar: ${nomes.join(', ')}`;
  if (titulo.length > 80) titulo = `Adicionar ${nomes.length} indivíduos`;
  abrirIssue(titulo, `Adicionar ao mapa:\n\n${nomes.map((n) => `- ${n}`).join('\n')}`, { tipo: 'adicionar', nomes });
  campoNomes.value = '';
  campoNomes.rows = 1;
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

// Busca os dados de novo de tempos em tempos para mostrar votos novos.
setInterval(() => !document.hidden && !dialogoVoto.open && recarregar().catch(() => {}), 30_000);
window.addEventListener('focus', () => !dialogoVoto.open && recarregar().catch(() => {}));

$('#barra').style.background = gradienteCss();
recarregar().catch((e) => alert(e.message));
