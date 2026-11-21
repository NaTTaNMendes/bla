import { corDaTemperatura, textoSobre, gradienteCss } from './cores.js';

const CHAVE = 'mapa-de-calor:v1';
const MAX = 10; // intensidade máxima por categoria

// Temperatura: -100 = gelado/amigável · 0 = neutro · +100 = fervendo/nojento
const CATEGORIAS_PADRAO = [
  { id: 'amigavel', nome: 'Amigável', emoji: '😊', temp: -100 },
  { id: 'civilizado', nome: 'Civilizado', emoji: '🎩', temp: -65 },
  { id: 'mercador', nome: 'Mercador', emoji: '🤝', temp: -15 },
  { id: 'neutro', nome: 'Neutro', emoji: '😐', temp: 0 },
  { id: 'competitivo', nome: 'Competitivo', emoji: '🏆', temp: 25 },
  { id: 'chatice', nome: 'Chatice', emoji: '🙄', temp: 55 },
  { id: 'toxicidade', nome: 'Toxicidade', emoji: '☢️', temp: 80 },
  { id: 'fedor', nome: 'Fedor', emoji: '🦨', temp: 100 },
];

const EXEMPLO = [
  ['Fulano', { fedor: 8, chatice: 5, competitivo: 3 }],
  ['Ciclano', { mercador: 9, civilizado: 6 }],
  ['Beltrano', { amigavel: 10, civilizado: 7 }],
  ['Zé Ninguém', {}],
  ['Tretinha', { toxicidade: 9, competitivo: 8, chatice: 6 }],
  ['Gente Fina', { amigavel: 7, competitivo: 4 }],
];

// ---------- Estado ----------

const novoId = () => Math.random().toString(36).slice(2, 10);
const estadoInicial = () => ({ categorias: structuredClone(CATEGORIAS_PADRAO), pessoas: [], ordenacao: 'quente' });

function validar(e) {
  return (
    e &&
    Array.isArray(e.categorias) &&
    Array.isArray(e.pessoas) &&
    e.categorias.every((c) => c.id && typeof c.nome === 'string' && Number.isFinite(c.temp)) &&
    e.pessoas.every((p) => p.id && typeof p.nome === 'string' && p.notas && typeof p.notas === 'object')
  );
}

function carregar() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE));
    if (validar(salvo)) return { ordenacao: 'quente', ...salvo };
  } catch {}
  return estadoInicial();
}

let estado = carregar();

function atualizar() {
  localStorage.setItem(CHAVE, JSON.stringify(estado));
  render();
}

// ---------- Cálculo ----------

/**
 * Temperatura geral de um indivíduo: média das temperaturas das categorias,
 * ponderada pela intensidade e escalada pela maior nota
 * (1 ponto de fedor esquenta menos que 10). Sem classificação → 0 (neutro).
 */
function temperatura(pessoa) {
  let peso = 0, soma = 0, maior = 0;
  for (const c of estado.categorias) {
    const v = pessoa.notas[c.id] || 0;
    if (!v) continue;
    peso += v;
    soma += v * c.temp;
    maior = Math.max(maior, v);
  }
  return peso ? (soma / peso) * (maior / MAX) : 0;
}

const fmt = (t) => (t > 0 ? '+' : '') + Math.round(t);

function pintar(el, temp) {
  el.style.background = corDaTemperatura(temp);
  el.style.color = textoSobre(temp);
}

const categoriasOrdenadas = () => [...estado.categorias].sort((a, b) => a.temp - b.temp);

function pessoasOrdenadas() {
  const lista = estado.pessoas.map((p) => ({ p, t: temperatura(p) }));
  if (estado.ordenacao === 'nome') lista.sort((a, b) => a.p.nome.localeCompare(b.p.nome, 'pt-BR'));
  else if (estado.ordenacao === 'frio') lista.sort((a, b) => a.t - b.t);
  else lista.sort((a, b) => b.t - a.t);
  return lista;
}

// ---------- DOM ----------

const $ = (sel) => document.querySelector(sel);

function el(tag, props = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k.includes('-')) e.setAttribute(k, v);
    else e[k] = v;
  }
  e.append(...filhos.filter((f) => f != null));
  return e;
}

function render() {
  renderMapa();
  renderCategorias();
}

function renderMapa() {
  const tabela = $('#mapa');
  const cats = categoriasOrdenadas();
  const lista = pessoasOrdenadas();
  const vazio = lista.length === 0;

  $('#vazio').hidden = !vazio;
  $('#dica').hidden = vazio;
  tabela.hidden = vazio;
  if (vazio) return tabela.replaceChildren();

  const seta = (ord) => (estado.ordenacao === ord ? ' ↓' : '');
  const cab = el(
    'tr',
    {},
    el('th', {
      class: 'nome ordenavel',
      textContent: `${lista.length} ${lista.length === 1 ? 'indivíduo' : 'indivíduos'}${seta('nome')}`,
      title: 'Ordenar por nome',
      onclick: () => ordenar('nome'),
    }),
    ...cats.map((c) =>
      el('th', { title: `${c.nome} (${fmt(c.temp)})` }, c.emoji ? el('span', { class: 'emoji', textContent: c.emoji }) : null, c.nome),
    ),
    el('th', {
      class: 'ordenavel',
      textContent: `Temperatura${estado.ordenacao === 'frio' ? ' ↑' : seta('quente')}`,
      title: 'Alternar entre mais quente e mais frio primeiro',
      onclick: () => ordenar(estado.ordenacao === 'quente' ? 'frio' : 'quente'),
    }),
  );

  const linhas = lista.map(({ p, t }) => {
    const total = el('td', { class: 'total', textContent: fmt(t) });
    pintar(total, t);
    return el(
      'tr',
      {},
      el('td', { class: 'nome', textContent: p.nome, title: 'Editar', onclick: () => abrirEdicao(p.id) }),
      ...cats.map((c) => {
        const v = p.notas[c.id] || 0;
        const td = el('td', {
          class: v ? 'cel' : 'cel zero',
          textContent: v || '',
          title: `${p.nome} · ${c.nome}: ${v}`,
          dataset: { pessoa: p.id, cat: c.id },
        });
        if (v) pintar(td, (c.temp * v) / MAX);
        return td;
      }),
      total,
    );
  });

  tabela.replaceChildren(el('thead', {}, cab), el('tbody', {}, ...linhas));
}

function renderCategorias() {
  $('#lista-categorias').replaceChildren(
    ...categoriasOrdenadas().map((c) => {
      const valor = el('span', { class: 'temp', textContent: fmt(c.temp) });
      pintar(valor, c.temp);
      return el(
        'li',
        {},
        el('span', { textContent: `${c.emoji ? c.emoji + ' ' : ''}${c.nome}` }),
        el('input', {
          type: 'range',
          min: -100,
          max: 100,
          step: 5,
          value: c.temp,
          'aria-label': `Temperatura de ${c.nome}`,
          oninput: (ev) => {
            c.temp = Number(ev.target.value);
            valor.textContent = fmt(c.temp);
            pintar(valor, c.temp);
          },
          onchange: atualizar,
        }),
        valor,
        el('button', { class: 'link perigo remover', textContent: 'remover', onclick: () => removerCategoria(c.id) }),
      );
    }),
  );
}

// ---------- Ações ----------

function ordenar(ord) {
  estado.ordenacao = ord;
  atualizar();
}

/** Adiciona vários nomes de uma vez (vírgula, ponto e vírgula ou quebra de linha). Ignora repetidos. */
function adicionarPessoas(texto) {
  const existentes = new Set(estado.pessoas.map((p) => p.nome.toLowerCase()));
  let novos = 0;
  for (const nome of texto.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)) {
    if (existentes.has(nome.toLowerCase())) continue;
    existentes.add(nome.toLowerCase());
    estado.pessoas.push({ id: novoId(), nome, notas: {} });
    novos++;
  }
  if (novos) atualizar();
}

function ajustarNota(pessoaId, catId, delta, zerar = false) {
  const p = estado.pessoas.find((x) => x.id === pessoaId);
  if (!p) return;
  const nova = zerar ? 0 : Math.max(0, Math.min(MAX, (p.notas[catId] || 0) + delta));
  if (nova) p.notas[catId] = nova;
  else delete p.notas[catId];
  atualizar();
}

function removerCategoria(id) {
  if (estado.categorias.length <= 1) return alert('Precisa ter pelo menos uma categoria.');
  const c = estado.categorias.find((x) => x.id === id);
  if (!confirm(`Remover "${c.nome}"? As notas dessa categoria serão apagadas.`)) return;
  estado.categorias = estado.categorias.filter((x) => x.id !== id);
  for (const p of estado.pessoas) delete p.notas[id];
  atualizar();
}

// ---------- Edição ----------

const dialogo = $('#dialogo');
let editando = null;
let rascunho = null;

function abrirEdicao(id) {
  editando = estado.pessoas.find((x) => x.id === id);
  if (!editando) return;
  rascunho = { ...editando.notas };
  $('#editar-nome').value = editando.nome;

  $('#editar-sliders').replaceChildren(
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
        el('span', { textContent: `${c.emoji ? c.emoji + ' ' : ''}${c.nome}` }),
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
  dialogo.showModal();
}

function mostrarResumo() {
  const t = temperatura({ notas: rascunho });
  const span = $('#editar-temp');
  span.textContent = fmt(t);
  pintar(span, t);
}

$('#form-editar').addEventListener('submit', () => {
  editando.nome = $('#editar-nome').value.trim() || editando.nome;
  editando.notas = rascunho;
  atualizar();
});
$('#btn-cancelar').addEventListener('click', () => dialogo.close());
$('#btn-excluir').addEventListener('click', () => {
  if (!confirm(`Excluir "${editando.nome}"?`)) return;
  estado.pessoas = estado.pessoas.filter((x) => x !== editando);
  dialogo.close();
  atualizar();
});

// ---------- Eventos ----------

const campoNomes = $('#nomes');
$('#form-pessoas').addEventListener('submit', (ev) => {
  ev.preventDefault();
  adicionarPessoas(campoNomes.value);
  campoNomes.value = '';
  campoNomes.rows = 1;
  campoNomes.focus();
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

const catTemp = $('#cat-temp');
const catValor = $('#cat-temp-valor');
const mostrarTempNova = () => {
  catValor.textContent = fmt(Number(catTemp.value));
  pintar(catValor, Number(catTemp.value));
};
catTemp.addEventListener('input', mostrarTempNova);
mostrarTempNova();

$('#form-categoria').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const nome = $('#cat-nome').value.trim();
  if (!nome) return;
  estado.categorias.push({ id: novoId(), nome, temp: Number(catTemp.value) });
  ev.target.reset();
  mostrarTempNova();
  atualizar();
});

$('#btn-exemplo').addEventListener('click', () => {
  for (const [nome, notas] of EXEMPLO) estado.pessoas.push({ id: novoId(), nome, notas: { ...notas } });
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

$('#barra').style.background = gradienteCss();
render();
