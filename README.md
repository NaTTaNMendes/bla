# 🌡️ Mapa de Calor

Mapa de calor colaborativo de indivíduos, do **❄️ amigável** ao **🔥 fedorento**.
Quem não tem nenhuma classificação fica neutro. Roda 100% no GitHub: site no
GitHub Pages, contas do GitHub e o GitHub Actions como "servidor".

- **Mapa**: tabela pessoas × categorias com a média dos votos e a temperatura geral.
- **Ranking**: mais quente, mais frio e o top de cada categoria.
- **Contribuir**: qualquer pessoa com conta no GitHub adiciona indivíduos (vários de uma
  vez) e vota. Só quem adicionou, ou o dono do repositório, pode remover.

## Como funciona

1. No site, os botões **Adicionar** e **Votar pelo GitHub** abrem uma issue já preenchida.
2. A pessoa confirma criando a issue (logada no GitHub, que é a conta dela).
3. O workflow `.github/workflows/site.yml` roda `scripts/processar.mjs`, que valida o
   pedido e grava em `public/dados.json`. Depois ele comenta, fecha a issue e republica o site.
4. Em cerca de 1 minuto o mapa atualiza.

Cada pessoa tem um voto por indivíduo. Votar de novo substitui o voto anterior, e votar
tudo em 0 apaga o voto. Os votos ficam públicos nas issues e no `dados.json`.

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

Ficam em `public/categorias.js`.

A célula do mapa é a média entre quem votou naquele indivíduo. A **temperatura** é a
média das temperaturas das categorias, ponderada pelas notas e escalada pela maior nota
(1 de fedor esquenta menos que 10 de fedor).

## Configuração (uma vez só)

1. O repositório precisa ser **público**. O GitHub Pages em repositório privado exige plano
   pago, e só quem tem acesso ao repositório consegue abrir issues.
2. Em **Settings → Pages → Build and deployment → Source**, escolha **GitHub Actions**.
3. Faça um push no `master` (ou rode **Actions → Mapa de Calor → Run workflow**).

O site fica em `https://<usuário>.github.io/<repositório>/`.

## Rodando localmente

```bash
npm run dev
# http://localhost:8000
```
