# 🌡️ Mapa de Calor

Mapa de calor colaborativo de indivíduos, do **❄️ amigável** ao **🔥 fedorento**.
Quem não tem nenhuma classificação fica neutro.

- **Mapa**: tabela pessoas × categorias com a média dos votos e a temperatura geral.
- **Ranking**: mais quente, mais frio e o top de cada categoria.
- **Votação anônima**: quem abre o site já pode adicionar indivíduos (vários de uma vez)
  e votar. Não precisa de conta, e ninguém vê quem votou o quê. O resultado é a média de
  quem votou.

## Como funciona

- O site fica no GitHub Pages.
- Cada navegador gera uma **chave anônima** (guardada só nele) e assina seus pedidos
  (adicionar, votar, remover). Assim cada pessoa tem um voto por indivíduo, pode mudar
  o próprio voto, e ninguém consegue alterar o voto de outra pessoa.
- Os pedidos vão para um tópico público do [ntfy.sh](https://ntfy.sh), um serviço gratuito
  de mensagens que não pede cadastro (veja `config.js`). O site junta esses pedidos aos
  dados salvos e mostra o voto na hora.
- A cada ~10 minutos o GitHub Actions (`.github/workflows/site.yml`) roda
  `scripts/consolidar.mjs`, que grava os pedidos novos em `dados.json` (o ntfy só guarda
  12 horas) e republica o site.
- As regras ficam em `logica.js`, usadas tanto pelo site quanto pelo Actions.
- Só quem adicionou um indivíduo (no mesmo navegador) pode removê-lo.

Limite da votação sem conta: quem limpar os dados do navegador ou usar outro aparelho
vota como uma pessoa nova.

## Categorias

| Categoria | Temperatura |
|---|---|
| 😊 Amigável | −100 |
| 🎩 Civilizado | −65 |
| 🤝 Mercador (negociador) | −15 |
| 😐 Neutro | 0 |
| 🏆 Competitivo | +25 |
| 🙄 Chatice | +55 |
| ☢️ Toxicidade | +80 |
| 🦨 Fedor | +100 |

Ficam em `categorias.js`.

A célula do mapa é a média entre quem votou naquele indivíduo. A **temperatura** é a
média das temperaturas das categorias, ponderada pelas notas e escalada pela maior nota
(1 de fedor esquenta menos que 10 de fedor).

## Configuração (uma vez só)

1. Repositório público e **Settings → Pages** publicando o `master` (pela raiz ou pelo
   GitHub Actions, os dois modos funcionam).
2. Pronto. O workflow roda sozinho a cada push e a cada 10 minutos.

O site fica em `https://<usuário>.github.io/<repositório>/`.

## Rodando localmente

```bash
npm run dev
# http://localhost:8000
```
