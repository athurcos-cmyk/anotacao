# Projeto: Anotação HC

PWA de anotações de enfermagem. Gerador de texto clínico estruturado em 5 blocos.

## Arquivos principais
- `index.html` — estrutura dos 5 blocos do formulário + modais
- `app.js` — toda a lógica (estado, validação, geração de texto, histórico, dispositivos)
- `style.css` — tema escuro, responsivo mobile-first
- `sw.js` — service worker para PWA offline (bumpar versão `anotacao-vN` a cada deploy)

## Workflow Git
Após cada conjunto de mudanças, faça `git add`, `commit` e `git push` direto sem pedir confirmação.
Sempre bumpar o cache no `sw.js` antes do commit.

## Convenções do projeto
- Sem frameworks — vanilla JS/HTML/CSS puro
- Mobile-first, tema escuro
- `$$()` = `querySelectorAll`, `$()` = `querySelector`
- `getRadioValue(name)` para ler radios
- Cache do SW: incrementar `anotacao-vN` a cada deploy para forçar atualização nos dispositivos

## Preferências do usuário
- Respostas curtas e diretas
- Sem emojis
- Sem pedido de confirmação para commit/push
