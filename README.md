# 🌡️ Mapa de Calor

Mapa de calor colaborativo de indivíduos: cada um cria uma conta, vota e o mapa mostra
a **média do grupo**, do **❄️ amigável** ao **🔥 fedorento**. Quem não tem nenhuma
classificação fica neutro.

- **Mapa** — tabela pessoas × categorias com a média dos votos e a temperatura geral.
- **Ranking** — mais quente, mais frio e o top de cada categoria.
- **Contas** — usuário e senha. Sem conta dá pra ver; com conta dá pra adicionar
  indivíduos (vários de uma vez, separados por vírgula ou um por linha) e votar.
  Só quem adicionou um indivíduo pode removê-lo.

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

Ficam em `CATEGORIAS` no `server.js`.

## Como a nota é calculada

- Cada pessoa vota de 0 a 10 em quantas categorias quiser.
- A célula do mapa é a média entre quem votou naquele indivíduo.
- A **temperatura** é a média das temperaturas das categorias, ponderada pelas notas e
  escalada pela maior nota (1 de fedor esquenta menos que 10 de fedor).

## Rodando localmente

Precisa do Node 22.13 ou mais novo. Não tem dependências.

```bash
npm start
# http://localhost:8080
```

O banco SQLite fica em `dados/mapa.db`.

## Publicando no Fly.io

O deploy é feito pelo GitHub Actions (`.github/workflows/fly.yml`) a cada push.

1. Crie uma conta em [fly.io](https://fly.io) e gere um token em
   **Account → Access Tokens**.
2. No GitHub, em **Settings → Secrets and variables → Actions**, crie o segredo
   `FLY_API_TOKEN` com esse token.
3. Faça um push (ou rode o workflow em **Actions → Deploy no Fly.io → Run workflow**).

Na primeira vez o workflow cria o app e o volume `dados` (onde fica o banco).
O endereço fica `https://<app>.fly.dev`. Se o nome do app em `fly.toml` já
estiver em uso por outra pessoa no Fly, troque por outro.

### Código de convite (opcional)

Para só quem tem o código conseguir criar conta:

```bash
fly secrets set CODIGO_CONVITE=algum-codigo --app mapa-de-calor-bla
```
