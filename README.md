# Anotacao HC SP

App PWA para tecnicas de enfermagem do Hospital das Clinicas de Sao Paulo.
Gera anotacao inicial no padrao MAR para copiar ao Google Docs.

## Funciona 100% offline apos primeira visita.

## Deploy no GitHub Pages

1. Crie um repositorio no GitHub (ex: `anotacao-hc`)
2. Suba os arquivos:
   ```bash
   git init
   git add .
   git commit -m "PWA anotacao HC"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/anotacao-hc.git
   git push -u origin main
   ```
3. Va em **Settings > Pages** no repositorio
4. Em **Source**, selecione `main` branch e `/root`
5. Clique **Save**
6. Acesse: `https://SEU_USUARIO.github.io/anotacao-hc/`

## Deploy na Vercel

1. Instale a CLI: `npm i -g vercel`
2. Na pasta do projeto: `vercel`
3. Siga os prompts (projeto estatico, sem framework)
4. Acesse a URL fornecida pela Vercel

## Instalar no celular (Android)

1. Abra a URL do app no Chrome
2. Toque no menu (3 pontos) > **Adicionar a tela inicial**
3. Confirme o nome e toque **Adicionar**
4. O app aparece como icone na tela inicial
5. Apos a primeira visita, funciona offline

## Estrutura

```
index.html      - Pagina unica (SPA)
style.css       - Tema escuro, responsivo
app.js          - Logica de blocos, geracao de texto, historico
manifest.json   - Configuracao PWA
sw.js           - Service Worker para cache offline
```

## Servidor local para testes

```bash
npx serve .
# ou
python -m http.server 8080
```

Abra `http://localhost:8080` no navegador.
