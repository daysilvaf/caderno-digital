# Caderno Digital · Química dos Produtos Naturais

Caderno digital no estilo Noteful, feito em React + TypeScript + Vite.

## Rodar no computador

```bash
npm install
npm run dev
```

Abra o endereço que aparecer (normalmente http://localhost:5173).

O site é publicado automaticamente no GitHub Pages a cada push na branch `main`: https://daysilvaf.github.io/caderno-digital/

## Status

- [x] Passo 1: capa, índice das aulas, páginas, fundos, miniaturas, zoom, salvamento automático (IndexedDB)
- [x] Passo 2: editor de escrita e desenho (caneta, lápis, marca-texto, borracha, formas, texto, laço, seleção, mover, redimensionar, girar, copiar, colar, desfazer)
- [x] Passo 3: PDFs anotáveis, imagens (colar, arrastar, recortar), stickers, links, documentos, tags, busca, biblioteca, revisão
- [x] Letra de mão no texto digitado: estilos Título e Subtítulo (cursiva bordô com marca-texto rosa) e Escrita (letra de caneta), destaque atrás do texto e botão "Página toda à mão"
- [x] Passo 4: sincronização entre aparelhos (Supabase), exportação em PDF/PNG, impressão, backup e acabamento visual

Para ligar a sincronização, siga [docs/SUPABASE.md](docs/SUPABASE.md).
