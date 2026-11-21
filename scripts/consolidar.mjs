// Lê os pedidos novos do ntfy e grava o resultado em dados.json (roda no GitHub Actions).
import { readFile, writeFile } from 'node:fs/promises';
import { NTFY, TOPICO } from '../config.js';
import { buscarMensagens, aplicarMensagens } from '../logica.js';

const arquivo = new URL('../dados.json', import.meta.url);
const dados = JSON.parse(await readFile(arquivo, 'utf8'));
const mensagens = await buscarMensagens(NTFY, TOPICO, dados.ultimo);
await aplicarMensagens(dados, mensagens);
await writeFile(arquivo, JSON.stringify(dados, null, 2) + '\n');
console.log(`${mensagens.length} pedido(s) novo(s).`);
