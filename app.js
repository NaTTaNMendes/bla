import { corDaTemperatura, textoSobre, gradienteCss } from './cores.js';
import { CATEGORIAS, MAX, polos, paraQuente } from './categorias.js';
import { NTFY, TOPICO } from './config.js';
import { dadosVazios, novaIdentidade, idDoVotante, assinar, aplicarMensagens, buscarMensagens, enviar } from './logica.js';

let dados = dadosVazios();
let pessoas = []; // pessoas com médias calculadas
let eu = null; // id anônimo deste navegador
let identidade = null;
let aba = 'mapa';
let busca = '';
let ordenacao = 'quente'; // mapa: quente | frio | nome
let filtroRanking = 'quente'; // ranking: quente | frio | id de categoria
let ladoRanking = 'quente'; // ranking de categoria: lado quente ou frio do eixo

// ---------- Identidade anônima (fica só neste navegador) ----------

const CHAVE_IDENTIDADE = 'mapa-de-calor:identidade';

async function carregarIdentidade() {
  try {
    identidade = JSON.parse(localStorage.getItem(CHAVE_IDENTIDADE));
  } catch {}
  if (!identidade?.privada) {
    identidade = await novaIdentidade();
    try {
      localStorage.setItem(CHAVE_IDENTIDADE, JSON.stringify(identidade));
    } catch {}
  }
  eu = await idDoVotante(identidade.publica);
}

// ---------- Dados ----------

/** Dados consolidados (dados.json) + pedidos que ainda estão só no ntfy. */
async function recarregar() {
  const r = await fetch(`dados.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Não consegui carregar os dados.');
  const novos = await r.json();
  try {
    await aplicarMensagens(novos, await buscarMensagens(NTFY, TOPICO, novos.ultimo));
  } catch (e) {
    console.warn('Votos recentes indisponíveis:', e);
  }
  dados = novos;
  pessoas = dados.pessoas.map((p) => {
    const votos = Object.values(dados.votos[p.id] || {});
    const medias = {};
    for (const voto of votos) for (const [cat, v] of Object.entries(voto)) medias[cat] = (medias[cat] || 0) + v;
    for (const cat in medias) medias[cat] = Math.round((medias[cat] / votos.length) * 10) / 10;
    return { ...p, votantes: votos.length, medias, t: temperatura(medias), meuVoto: dados.votos[p.id]?.[eu] || {} };
  });
  render();
}

async function pedir(pedido) {
  await enviar(NTFY, TOPICO, await assinar(identidade, pedido));
  await recarregar();
}

// ---------- Cálculo ----------

/**
 * Temperatura geral (-100 a +100): média das temperaturas de cada lado votado,
 * ponderada pela força da nota e escalada pela nota mais forte
 * (1 de fedor esquenta menos que 10). Tudo neutro → 0.
 */
function temperatura(notas) {
  let peso = 0, soma = 0, maior = 0;
  for (const c of CATEGORIAS) {
    const v = notas[c.id] || 0;
    if (!v) continue;
    peso += Math.abs(v);
    soma += v * c.temp;
    maior = Math.max(maior, Math.abs(v));
  }
  return peso ? (soma / peso) * (maior / MAX) : 0;
}

/** Cor de uma nota média numa categoria. */
const calorDaNota = (c, v) => (v * c.temp) / MAX;

const fmt = (t) => (Math.round(t) > 0 ? '+' : '') + Math.round(t);
const num = (v) => {
  const a = Math.abs(v);
  return Number.isInteger(a) ? String(a) : a.toFixed(1).replace('.', ',');
};
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const normalizar = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Lado do eixo para onde a nota aponta. */
function lado(c, v) {
  const p = polos(c);
  return paraQuente(c, v) > 0 ? p.quente : p.frio;
}

function rotulo(t) {
  if (t <= -60) return 'Gelado';
  if (t <= -20) return 'Frio';
  if (t < 20) return 'Neutro';
  if (t < 60) return 'Quente';
  return 'Fervendo';
}

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

let avisoTimer;
function avisar(msg, erro = false) {
  const a = $('#status');
  a.textContent = msg;
  a.classList.toggle('erro', erro);
  a.hidden = false;
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => (a.hidden = true), 3500);
}

const visiveis = () => (busca ? pessoas.filter((p) => normalizar(p.nome).includes(busca)) : pessoas);

function render() {
  const votos = pessoas.reduce((n, p) => n + p.votantes, 0);
  $('#estatisticas').textContent = `${plural(pessoas.length, 'indivíduo', 'indivíduos')} · ${plural(votos, 'voto', 'votos')}`;
  for (const b of document.querySelectorAll('.aba')) b.classList.toggle('ativa', b.dataset.aba === aba);
  $('#aba-mapa').hidden = aba !== 'mapa';
  $('#aba-ranking').hidden = aba !== 'ranking';
  if (aba === 'mapa') renderMapa();
  else renderRanking();
}

function renderMapa() {
  const tabela = $('#mapa');
  const lista = [...visiveis()];
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
      textContent: `Nome${ordenacao === 'nome' ? ' ↓' : ''}`,
      title: 'Ordenar por nome',
      onclick: () => ((ordenacao = 'nome'), render()),
    }),
    el('th', {
      class: 'ordenavel',
      textContent: `🌡️${ordenacao === 'frio' ? ' ↑' : ordenacao === 'quente' ? ' ↓' : ''}`,
      title: 'Temperatura · toque para inverter a ordem',
      onclick: () => ((ordenacao = ordenacao === 'quente' ? 'frio' : 'quente'), render()),
    }),
    ...CATEGORIAS.map((c) => {
      const p = polos(c);
      return el(
        'th',
        { title: `${c.eixo}: ${p.frio.nome} ↔ ${p.quente.nome}` },
        el('span', { class: 'polos', textContent: `${p.frio.emoji}${p.quente.emoji}` }),
        el('span', { class: 'eixo-nome', textContent: c.eixo }),
      );
    }),
    el('th', { class: 'col-votos', textContent: 'Votos' }),
  );

  const linhas = lista.map((p) => {
    const total = p.votantes
      ? el('td', { class: 'total', textContent: `${fmt(p.t)}°`, title: rotulo(p.t) })
      : el('td', { class: 'total sem-voto', textContent: '—', title: 'Ninguém votou ainda' });
    if (p.votantes) pintar(total, p.t);
    const votei = Object.keys(p.meuVoto).length > 0;
    return el(
      'tr',
      { class: 'linha', onclick: () => abrirVoto(p.id) },
      el('td', { class: 'nome', title: p.nome }, p.nome, votei ? el('span', { class: 'votei', textContent: '●', title: 'Você votou' }) : null),
      total,
      ...CATEGORIAS.map((c) => {
        const v = p.medias[c.id] || 0;
        if (!v) return el('td', { class: 'cel zero', title: `${c.eixo}: neutro` });
        const l = lado(c, v);
        const td = el('td', { class: 'cel', textContent: num(v), title: `${c.eixo}: ${l.emoji} ${l.nome} ${num(v)}` });
        pintar(td, calorDaNota(c, v));
        return td;
      }),
      el('td', { class: 'votos col-votos', textContent: p.votantes }),
    );
  });

  tabela.replaceChildren(el('thead', {}, cab), el('tbody', {}, ...linhas));
}

function renderRanking() {
  const filtros = [
    { id: 'quente', rotulo: '🔥 Mais quente' },
    { id: 'frio', rotulo: '❄️ Mais frio' },
    ...CATEGORIAS.map((c) => {
      const p = polos(c);
      return { id: c.id, rotulo: `${p.frio.emoji}${p.quente.emoji} ${c.eixo}` };
    }),
  ];
  $('#filtros').replaceChildren(
    ...filtros.map((f) =>
      el('button', {
        class: 'filtro' + (f.id === filtroRanking ? ' ativo' : ''),
        textContent: f.rotulo,
        onclick: () => ((filtroRanking = f.id), (ladoRanking = 'quente'), render()),
      }),
    ),
  );

  let itens;
  const cat = CATEGORIAS.find((c) => c.id === filtroRanking);
  $('#lados').hidden = !cat;
  if (cat) {
    const p = polos(cat);
    $('#lados').replaceChildren(
      ...['quente', 'frio'].map((l) =>
        el('button', {
          class: 'filtro' + (l === ladoRanking ? ' ativo' : ''),
          textContent: `Mais ${p[l].nome.toLowerCase()} ${p[l].emoji}`,
          onclick: () => ((ladoRanking = l), render()),
        }),
      ),
    );
    const sinal = ladoRanking === 'quente' ? 1 : -1;
    itens = visiveis()
      .map((pessoa) => ({ pessoa, x: paraQuente(cat, pessoa.medias[cat.id] || 0) }))
      .filter(({ x }) => Math.sign(x) === sinal)
      .sort((a, b) => sinal * (b.x - a.x))
      .map(({ pessoa, x }) => ({
        p: pessoa,
        valor: `${p[ladoRanking].emoji} ${num(x)}`,
        temp: calorDaNota(cat, pessoa.medias[cat.id]),
        posicao: x / MAX,
      }));
  } else {
    const sinal = filtroRanking === 'frio' ? -1 : 1;
    itens = visiveis()
      .filter((p) => p.votantes > 0 && Math.sign(Math.round(p.t)) === sinal)
      .sort((a, b) => sinal * (b.t - a.t))
      .map((p) => ({ p, valor: `${fmt(p.t)}°`, temp: p.t, posicao: p.t / 100 }));
  }

  $('#ranking-vazio').hidden = itens.length > 0;
  const medalhas = ['🥇', '🥈', '🥉'];
  $('#ranking').replaceChildren(
    ...itens.map(({ p, valor, temp, posicao }, i) => {
      // barra divergente: do centro (neutro) para a esquerda (frio) ou direita (quente)
      const barra = el('span', { class: 'rank-barra' });
      const largura = Math.max(2, Math.abs(posicao) * 50);
      barra.style.width = `${largura}%`;
      barra.style.left = posicao >= 0 ? '50%' : `${50 - largura}%`;
      barra.style.background = corDaTemperatura(temp);
      const pill = el('span', { class: 'temp', textContent: valor });
      pintar(pill, temp);
      return el(
        'li',
        { onclick: () => abrirVoto(p.id) },
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
const atualizadores = [];

function abrirVoto(id) {
  votando = pessoas.find((p) => p.id === id);
  if (!votando) return;
  rascunho = { ...votando.meuVoto };
  $('#voto-nome').textContent = votando.nome;
  $('#voto-info').textContent = votando.votantes
    ? `Média de ${plural(votando.votantes, 'voto', 'votos')}: ${fmt(votando.t)}° · ${rotulo(votando.t)}`
    : 'Ninguém votou ainda. Seja o primeiro!';
  $('#btn-remover').hidden = votando.criador !== eu;

  atualizadores.length = 0;
  $('#voto-sliders').replaceChildren(
    ...CATEGORIAS.map((c) => {
      const p = polos(c);
      const forca = Math.abs(c.temp);
      const esquerda = el('span', { textContent: `${p.frio.emoji} ${p.frio.nome}` });
      const direita = el('span', { textContent: `${p.quente.nome} ${p.quente.emoji}` });
      const valor = el('span', { class: 'eixo-valor' });
      const slider = el('input', {
        type: 'range',
        class: 'eixo',
        min: -MAX,
        max: MAX,
        step: 1,
        ariaLabel: `${c.eixo}: ${p.frio.nome} ou ${p.quente.nome}`,
        oninput: () => {
          const v = paraQuente(c, Number(slider.value));
          if (v) rascunho[c.id] = v;
          else delete rascunho[c.id];
          mostrar();
          mostrarResumo();
        },
      });
      slider.style.background = `linear-gradient(90deg, ${corDaTemperatura(-forca)}, ${corDaTemperatura(0)} 50%, ${corDaTemperatura(forca)})`;
      const mostrar = () => {
        const v = rascunho[c.id] || 0;
        const x = paraQuente(c, v);
        slider.value = x;
        esquerda.classList.toggle('ativo', x < 0);
        direita.classList.toggle('ativo', x > 0);
        if (!v) {
          valor.textContent = 'neutro';
          valor.className = 'eixo-valor neutro';
          valor.removeAttribute('style');
        } else {
          const l = lado(c, v);
          valor.textContent = `${l.emoji} ${Math.abs(v)}`;
          valor.className = 'eixo-valor';
          pintar(valor, calorDaNota(c, v));
        }
      };
      atualizadores.push(mostrar);
      mostrar();
      return el(
        'div',
        { class: 'eixo-linha' },
        el('div', { class: 'eixo-cab' }, esquerda, valor, direita),
        el('div', { class: 'eixo-wrap' }, slider),
      );
    }),
  );
  mostrarResumo();
  dialogoVoto.showModal();
}

function mostrarResumo() {
  const t = temperatura(rascunho);
  const span = $('#voto-temp');
  span.textContent = `${fmt(t)}°`;
  span.title = `Seu voto: ${rotulo(t)}`;
  pintar(span, t);
}

async function comBotao(botao, acao) {
  botao.disabled = true;
  try {
    await acao();
  } catch (e) {
    avisar(`Não deu certo: ${e.message}`, true);
  } finally {
    botao.disabled = false;
  }
}

$('#form-voto').addEventListener('submit', (ev) => {
  ev.preventDefault();
  comBotao($('#form-voto .btn'), async () => {
    await pedir({ tipo: 'voto', pessoa: votando.id, notas: { ...rascunho } });
    dialogoVoto.close();
    avisar('Voto salvo ✓');
  });
});

$('#btn-zerar').addEventListener('click', () => {
  rascunho = {};
  for (const f of atualizadores) f();
  mostrarResumo();
});

$('#btn-remover').addEventListener('click', (ev) => {
  comBotao(ev.target, async () => {
    await pedir({ tipo: 'remover', pessoa: votando.id });
    dialogoVoto.close();
    avisar(`${votando.nome} foi removido.`);
  });
});

for (const b of document.querySelectorAll('[data-fechar]')) b.addEventListener('click', () => b.closest('dialog').close());
dialogoVoto.addEventListener('click', (ev) => ev.target === dialogoVoto && dialogoVoto.close());

// ---------- Adicionar ----------

const formPessoas = $('#form-pessoas');
const campoNomes = $('#nomes');

function mostrarAdicionar(mostrar) {
  formPessoas.hidden = !mostrar;
  if (mostrar) campoNomes.focus();
}
$('#btn-adicionar').addEventListener('click', () => mostrarAdicionar(formPessoas.hidden));
$('#btn-cancelar-adicionar').addEventListener('click', () => mostrarAdicionar(false));

formPessoas.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const nomes = campoNomes.value.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
  if (!nomes.length) return campoNomes.focus();
  comBotao($('#form-pessoas .btn'), async () => {
    await pedir({ tipo: 'adicionar', nomes: nomes.slice(0, 100) });
    campoNomes.value = '';
    mostrarAdicionar(false);
    avisar(`${plural(nomes.length, 'nome adicionado', 'nomes adicionados')} ✓`);
  });
});
// Ctrl/Cmd+Enter envia; Enter sozinho quebra linha (para colar listas).
campoNomes.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) formPessoas.requestSubmit();
});

// ---------- Busca, abas e atualização ----------

$('#busca').addEventListener('input', (ev) => {
  busca = normalizar(ev.target.value.trim());
  render();
});

for (const b of document.querySelectorAll('.aba')) {
  b.addEventListener('click', () => {
    aba = b.dataset.aba;
    render();
  });
}

// Busca de novo de tempos em tempos para mostrar os votos dos outros.
setInterval(() => !document.hidden && !dialogoVoto.open && recarregar().catch(() => {}), 15_000);
window.addEventListener('focus', () => !dialogoVoto.open && recarregar().catch(() => {}));

$('#barra').style.background = gradienteCss();
carregarIdentidade()
  .then(recarregar)
  .catch((e) => avisar(e.message, true));
