import { corDaTemperatura, textoSobre, gradienteCss } from './cores.js';

const CHAVE = 'mapa-de-calor:v1';
const MAX = 10; // intensidade máxima por categoria

// Temperatura: -100 = gelado/amigável · 0 = neutro · +100 = fervendo/nojento
const CATEGORIAS_PADRAO = [
  { id: 'amigavel', nome: 'Amigável', emoji: '😊', temp: -100 },
  { id: 'civilizado', nome: 'Civilizado', emoji: '🎩', temp: -65 },
  { id: 'mercador', nome: 'Mercador / Negociador', emoji: '🤝', temp: -15 },
  { id: 'neutro', nome: 'Neutro', emoji: '😐', temp: 0 },
  { id: 'competitivo', nome: 'Competitivo', emoji: '🏆', temp: 25 },
  { id: 'chatice', nome: 'Chatice', emoji: '🙄', temp: 55 },
  { id: 'toxicidade', nome: 'Toxicidade', emoji: '☢️', temp: 80 },
  { id: 'fedor', nome: 'Fedor', emoji: '🦨', temp: 100 },
];

const EXEMPLO = [
  { nome: 'Fulano', emoji: '🧔', notas: { fedor: 8, chatice: 5, competitivo: 3 } },
  { nome: 'Ciclano', emoji: '🧑‍💼', notas: { mercador: 9, civilizado: 6 } },
  { nome: 'Beltrano', emoji: '😇', notas: { amigavel: 10, civilizado: 7 } },
  { nome: 'Zé Ninguém', emoji: '🫥', notas: {} },
  { nome: 'Tretinha', emoji: '😈', notas: { toxicidade: 9, competitivo: 8, chatice: 6 } },
  { nome: 'Gente Fina', emoji: '🤗', notas: { amigavel: 7, competitivo: 4 } },
];

// ---------- Estado ----------

const novoId = () => Math.random().toString(36).slice(2, 10);

function estadoInicial() {
  return { categorias: structuredClone(CATEGORIAS_PADRAO), pessoas: [], ordenacao: 'quente' };
}

function carregar() {
  try {
    const bruto = JSON.parse(localStorage.getItem(CHAVE));
    if (validar(bruto)) return bruto;
  } catch {}
  return estadoInicial();
}

function validar(e) {
  return (
    e &&
    Array.isArray(e.categorias) &&
    Array.isArray(e.pessoas) &&
    e.categorias.every((c) => c.id && typeof c.nome === 'string' && Number.isFinite(c.temp)) &&
    e.pessoas.every((p) => p.id && typeof p.nome === 'string' && p.notas && typeof p.notas === 'object')
  );
}

let estado = carregar();

function salvar() {
  localStorage.setItem(CHAVE, JSON.stringify(estado));
}

function atualizar() {
  salvar();
  render();
}

// ---------- Cálculo ----------

/**
 * Temperatura geral de um indivíduo.
 * Média das temperaturas das categorias, ponderada pela intensidade,
 * escalada pela maior intensidade (1 ponto de fedor ≠ 10 pontos de fedor).
 * Sem nenhuma classificação → 0 (neutro).
 */
function temperatura(pessoa) {
  let somaPeso = 0;
  let somaTemp = 0;
  let maior = 0;
  for (const c of estado.categorias) {
    const v = pessoa.notas[c.id] || 0;
    if (!v) continue;
    somaPeso += v;
    somaTemp += v * c.temp;
    maior = Math.max(maior, v);
  }
  if (!somaPeso) return 0;
  return (somaTemp / somaPeso) * (maior / MAX);
}

function rotulo(temp) {
  if (temp <= -60) return 'Gelado';
  if (temp <= -20) return 'Frio';
  if (temp < 20) return 'Neutro';
  if (temp < 60) return 'Quente';
  return 'Fervendo';
}

const fmt = (t) => (t > 0 ? '+' : '') + Math.round(t);

function pintar(el, temp) {
  el.style.background = corDaTemperatura(temp);
  el.style.color = textoSobre(temp);
}

function pessoasOrdenadas() {
  const lista = estado.pessoas.map((p) => ({ p, t: temperatura(p) }));
  const ord = estado.ordenacao;
  if (ord === 'nome') lista.sort((a, b) => a.p.nome.localeCompare(b.p.nome, 'pt-BR'));
  else if (ord === 'frio') lista.sort((a, b) => a.t - b.t);
  else lista.sort((a, b) => b.t - a.t);
  return lista;
}

const categoriasOrdenadas = () => [...estado.categorias].sort((a, b) => a.temp - b.temp);

// ---------- Helpers DOM ----------

const $ = (sel) => document.querySelector(sel);

function el(tag, props = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e[k] = v;
  }
  e.append(...filhos.filter((f) => f != null));
  return e;
}

// ---------- Render ----------

function render() {
  renderCategorias();
  renderMapa();
  renderTermometro();
  $('#ordenacao').value = estado.ordenacao;
}

function renderCategorias() {
  const ul = $('#lista-categorias');
  ul.replaceChildren(
    ...categoriasOrdenadas().map((c) => {
      const pill = el('span', { class: 'pill', textContent: fmt(c.temp) });
      pintar(pill, c.temp);
      const slider = el('input', {
        type: 'range',
        min: -100,
        max: 100,
        step: 5,
        value: c.temp,
        title: 'Temperatura da categoria',
        oninput: (ev) => {
          c.temp = Number(ev.target.value);
          pill.textContent = fmt(c.temp);
          pintar(pill, c.temp);
        },
        onchange: atualizar,
      });
      const remover = el('button', {
        class: 'btn-icone',
        textContent: '✕',
        title: `Remover "${c.nome}"`,
        onclick: () => removerCategoria(c.id),
      });
      return el(
        'li',
        {},
        el('span', { textContent: c.emoji || '🏷️' }),
        el('span', { class: 'cat-nome', textContent: c.nome, title: c.nome }),
        slider,
        pill,
        remover,
      );
    }),
  );
}

function renderMapa() {
  const tabela = $('#mapa');
  const cats = categoriasOrdenadas();
  const lista = pessoasOrdenadas();

  $('#vazio').hidden = lista.length > 0;
  tabela.hidden = lista.length === 0;
  if (!lista.length) return tabela.replaceChildren();

  const cab = el(
    'tr',
    {},
    el('th', { class: 'col-nome', textContent: 'Indivíduo' }),
    ...cats.map((c) => {
      const barra = el('span', { class: 'cat-temp' });
      barra.style.background = corDaTemperatura(c.temp);
      return el(
        'th',
        { title: `${c.nome} (${fmt(c.temp)}°)` },
        el('span', { class: 'cat-emoji', textContent: c.emoji || '🏷️' }),
        c.nome,
        barra,
      );
    }),
    el('th', { class: 'col-total', textContent: '🌡️ Temperatura' }),
  );

  const linhas = lista.map(({ p, t }) =>
    el(
      'tr',
      {},
      el('td', {
        class: 'col-nome',
        textContent: `${p.emoji || '🙂'} ${p.nome}`,
        title: 'Clique para editar',
        onclick: () => abrirEdicao(p.id),
      }),
      ...cats.map((c) => {
        const v = p.notas[c.id] || 0;
        const td = el('td', {
          class: 'cel' + (v ? '' : ' zero'),
          textContent: v || '·',
          title: `${p.nome} · ${c.nome}: ${v}/${MAX}`,
          dataset: { pessoa: p.id, cat: c.id },
        });
        pintar(td, (c.temp * v) / MAX);
        if (!v) td.style.color = '';
        return td;
      }),
      (() => {
        const td = el('td', { class: 'cel-total' }, `${fmt(t)}°`, el('small', { textContent: rotulo(t) }));
        pintar(td, t);
        return td;
      })(),
    ),
  );

  tabela.replaceChildren(el('thead', {}, cab), el('tbody', {}, ...linhas));
}

function renderTermometro() {
  $('.termometro-barra').style.background = gradienteCss();
  const caixa = $('#termometro-marcadores');
  const lista = estado.pessoas.map((p) => ({ p, t: temperatura(p) })).sort((a, b) => a.t - b.t);

  // Empilha marcadores que ficariam sobrepostos em "faixas".
  const LARG = 9; // largura aproximada de um marcador, em % da barra
  const ultimaPorFaixa = [];
  const marcadores = lista.map(({ p, t }) => {
    const pos = (t + 100) / 2;
    let faixa = ultimaPorFaixa.findIndex((ult) => pos - ult >= LARG);
    if (faixa === -1) faixa = ultimaPorFaixa.length;
    ultimaPorFaixa[faixa] = pos;

    const bolha = el('span', { class: 'bolha', textContent: `${p.emoji || '🙂'} ${p.nome}` });
    pintar(bolha, t);
    const m = el('div', { class: 'marcador', title: `${p.nome}: ${fmt(t)}° (${rotulo(t)})`, onclick: () => abrirEdicao(p.id) }, bolha);
    m.style.left = `${pos}%`;
    m.style.top = `${faixa * 30}px`;
    return m;
  });

  caixa.style.height = `${Math.max(1, ultimaPorFaixa.length) * 30 + 10}px`;
  caixa.replaceChildren(...marcadores);
}

// ---------- Ações ----------

function ajustarNota(pessoaId, catId, delta, zerar = false) {
  const p = estado.pessoas.find((x) => x.id === pessoaId);
  if (!p) return;
  const atual = p.notas[catId] || 0;
  const nova = zerar ? 0 : Math.max(0, Math.min(MAX, atual + delta));
  if (nova) p.notas[catId] = nova;
  else delete p.notas[catId];
  atualizar();
}

function removerCategoria(id) {
  if (estado.categorias.length <= 1) return alert('Precisa ter pelo menos uma categoria.');
  const c = estado.categorias.find((x) => x.id === id);
  if (!confirm(`Remover a categoria "${c.nome}"? As notas dela serão apagadas.`)) return;
  estado.categorias = estado.categorias.filter((x) => x.id !== id);
  for (const p of estado.pessoas) delete p.notas[id];
  atualizar();
}

// ---------- Diálogo de edição ----------

const dialogo = $('#dialogo-pessoa');
let editandoId = null;
let rascunho = null;

function abrirEdicao(id) {
  const p = estado.pessoas.find((x) => x.id === id);
  if (!p) return;
  editandoId = id;
  rascunho = { ...p, notas: { ...p.notas } };
  $('#editar-nome').value = p.nome;
  $('#editar-emoji').value = p.emoji || '';

  $('#editar-sliders').replaceChildren(
    ...categoriasOrdenadas().map((c) => {
      const saida = el('output');
      const atualizarSaida = () => {
        const v = rascunho.notas[c.id] || 0;
        saida.textContent = v;
        pintar(saida, (c.temp * v) / MAX);
      };
      atualizarSaida();
      const slider = el('input', {
        type: 'range',
        min: 0,
        max: MAX,
        step: 1,
        value: rascunho.notas[c.id] || 0,
        oninput: (ev) => {
          const v = Number(ev.target.value);
          if (v) rascunho.notas[c.id] = v;
          else delete rascunho.notas[c.id];
          atualizarSaida();
          atualizarResumo();
        },
      });
      return el(
        'label',
        { class: 'slider-linha' },
        el('span', { textContent: c.emoji || '🏷️' }),
        el('span', { textContent: c.nome }),
        slider,
        saida,
      );
    }),
  );
  atualizarResumo();
  dialogo.showModal();
}

function atualizarResumo() {
  const t = temperatura(rascunho);
  const pill = $('#editar-temp');
  pill.textContent = `${fmt(t)}° · ${rotulo(t)}`;
  pintar(pill, t);
}

$('#form-editar').addEventListener('submit', () => {
  const p = estado.pessoas.find((x) => x.id === editandoId);
  if (!p) return;
  p.nome = $('#editar-nome').value.trim() || p.nome;
  p.emoji = $('#editar-emoji').value.trim();
  p.notas = rascunho.notas;
  atualizar();
});

$('#btn-cancelar').addEventListener('click', () => dialogo.close());

$('#btn-excluir-pessoa').addEventListener('click', () => {
  const p = estado.pessoas.find((x) => x.id === editandoId);
  if (!p || !confirm(`Excluir "${p.nome}" do mapa?`)) return;
  estado.pessoas = estado.pessoas.filter((x) => x.id !== editandoId);
  dialogo.close();
  atualizar();
});

// ---------- Eventos ----------

$('#form-pessoa').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const nome = $('#pessoa-nome').value.trim();
  if (!nome) return;
  estado.pessoas.push({ id: novoId(), nome, emoji: $('#pessoa-emoji').value.trim(), notas: {} });
  ev.target.reset();
  $('#pessoa-nome').focus();
  atualizar();
});

const catTemp = $('#cat-temp');
const catPreview = $('#cat-temp-preview');
function atualizarPreviewCategoria() {
  const t = Number(catTemp.value);
  catPreview.textContent = fmt(t);
  pintar(catPreview, t);
}
catTemp.addEventListener('input', atualizarPreviewCategoria);
atualizarPreviewCategoria();

$('#form-categoria').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const nome = $('#cat-nome').value.trim();
  if (!nome) return;
  estado.categorias.push({ id: novoId(), nome, emoji: $('#cat-emoji').value.trim(), temp: Number(catTemp.value) });
  ev.target.reset();
  atualizarPreviewCategoria();
  atualizar();
});

// Clique: +1 · Botão direito: −1 · Shift+clique: zera
const mapa = $('#mapa');
mapa.addEventListener('click', (ev) => {
  const td = ev.target.closest('td.cel');
  if (td) ajustarNota(td.dataset.pessoa, td.dataset.cat, 1, ev.shiftKey);
});
mapa.addEventListener('contextmenu', (ev) => {
  const td = ev.target.closest('td.cel');
  if (!td) return;
  ev.preventDefault();
  ajustarNota(td.dataset.pessoa, td.dataset.cat, -1);
});

$('#ordenacao').addEventListener('change', (ev) => {
  estado.ordenacao = ev.target.value;
  atualizar();
});

$('#btn-exemplo').addEventListener('click', () => {
  for (const ex of EXEMPLO) estado.pessoas.push({ id: novoId(), ...structuredClone(ex) });
  atualizar();
});

$('#btn-exportar').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(estado, null, 2)], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: 'mapa-de-calor.json' });
  a.click();
  URL.revokeObjectURL(a.href);
});

$('#input-importar').addEventListener('change', async (ev) => {
  const arquivo = ev.target.files[0];
  ev.target.value = '';
  if (!arquivo) return;
  try {
    const dados = JSON.parse(await arquivo.text());
    if (!validar(dados)) throw new Error('formato inválido');
    estado = { ordenacao: 'quente', ...dados };
    atualizar();
  } catch (e) {
    alert(`Não deu pra importar: ${e.message}`);
  }
});

$('#btn-resetar').addEventListener('click', () => {
  if (!confirm('Apagar todos os indivíduos e voltar às categorias padrão?')) return;
  estado = estadoInicial();
  atualizar();
});

render();
