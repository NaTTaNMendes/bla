# 🌡️ Mapa de Calor dos Indivíduos

Classifique indivíduos em categorias e veja todo mundo num mapa de calor que vai do
**❄️ gelado (amigável, civilizado)** ao **🔥 fervendo (tóxico, fedorento)**.
O que não é classificado é **neutro**.

## Categorias iniciais

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

Dá pra mudar a temperatura de qualquer categoria, criar novas e remover.

## Como funciona

- Adicione **vários indivíduos de uma vez**: separe os nomes por vírgula ou cole uma lista (um por linha). Nomes repetidos são ignorados.
- Cada indivíduo recebe uma intensidade de **0 a 10** em quantas categorias quiser.
- A **temperatura geral** é a média das temperaturas das categorias, ponderada pela
  intensidade e escalada pela maior nota (1 de fedor esquenta menos que 10 de fedor).
- O gradiente é divergente (azul → cinza → vermelho), interpolado em OKLab pra ficar suave.

## Rodando

É só HTML/CSS/JS puro, sem build. Sirva a pasta com qualquer servidor estático:

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

Os dados ficam salvos no `localStorage` do navegador. Use **Exportar/Importar** (no rodapé)
pra compartilhar o mapa em JSON. As categorias podem ser editadas em **Categorias**, também no rodapé.

## Atalhos no mapa

- **Clique** numa célula: +1
- **Botão direito**: −1
- **Shift + clique**: zera
- **Clique no nome**: abre o editor com sliders
- **Clique em "Temperatura"** ou no total de indivíduos para mudar a ordenação
