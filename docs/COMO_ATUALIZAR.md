# Como publicar uma atualização do PDV

## Primeira vez (versão inicial)

1. Testar o `.exe` no cliente
2. Quando aprovado, mudar a versão no `package.json`:
   ```json
   "version": "1.0.1"
   ```
3. Commitar e fazer merge para `main`:
   ```bash
   git add .
   git commit -m "chore: versão 1.0.1"
   git push origin wpp-api

   git checkout main
   git merge wpp-api
   git push origin main
   ```
4. Publicar o release:
   ```bash
   export $(grep GH_TOKEN .env | xargs) && npm run electron:publish
   ```

O cliente recebe a atualização automaticamente na próxima vez que abrir o app.

---

## Atualizações seguintes (fluxo padrão)

### 1. Fazer as alterações no código (na branch de desenvolvimento)

```bash
git checkout wpp-api   # ou outra branch
# ... faz as alterações ...
git add .
git commit -m "feat: descrição do que mudou"
git push origin wpp-api
```

### 2. Mudar a versão no `package.json`

Sempre incrementar antes de publicar. Seguir o padrão:

| Tipo de mudança | Exemplo |
|---|---|
| Correção de bug pequeno | `1.0.1` → `1.0.2` |
| Nova funcionalidade | `1.0.2` → `1.1.0` |
| Mudança grande | `1.1.0` → `2.0.0` |

```json
"version": "1.0.2"
```

### 3. Merge para main

```bash
git checkout main
git merge wpp-api
git push origin main
```

A Vercel redeploya a versão web automaticamente.

### 4. Publicar o executável

```bash
export $(grep GH_TOKEN .env | xargs) && npm run electron:publish
```

> **Importante:** o `GH_TOKEN` está no `.env` mas não é exportado automaticamente pro shell.
> O comando acima lê o token do arquivo e exporta antes de rodar o publish.

Isso faz tudo automaticamente:
- Builda o React e o Electron
- Gera o `.exe`
- Cria o release no GitHub
- Sobe os arquivos

### 5. Resultado

O cliente abre o app → recebe notificação de atualização → clica "Reiniciar agora" → atualizado.

---

## Regras importantes

- **Nunca publicar com a mesma versão** — o cliente não vai receber a atualização
- **Sempre fazer merge para main antes** de rodar `electron:publish`
- O `GH_TOKEN` está no `.env`, mas precisa ser exportado pro shell antes do publish (o comando acima já faz isso)
- A versão web (Vercel) atualiza sozinha no push para `main`

---

## Comandos de referência rápida

```bash
# Desenvolvimento no Linux
npm run electron:dev

# Gerar .exe para teste (sem publicar)
npm run electron:pack:win

# Publicar atualização (clientes recebem automaticamente)
export $(grep GH_TOKEN .env | xargs) && npm run electron:publish
```
