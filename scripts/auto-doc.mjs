#!/usr/bin/env node
/**
 * auto-doc.mjs
 * Gera documentação automática na pasta mind/ após cada commit.
 * Chamado pelo hook .git/hooks/post-commit.
 */

import { execSync, spawnSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MIND = join(ROOT, 'mind');

if (!existsSync(MIND)) mkdirSync(MIND, { recursive: true });

// ─── File helpers ────────────────────────────────────────────────────────────

function readMind(file) {
  const p = join(MIND, file);
  return existsSync(p) ? readFileSync(p, 'utf-8') : '';
}

function writeMind(file, content) {
  writeFileSync(join(MIND, file), content, 'utf-8');
}

/**
 * Insere nova entrada logo após o cabeçalho do arquivo (antes das entradas antigas).
 * Mantém entradas existentes abaixo, separadas por ---.
 */
function prependEntry(file, newContent) {
  const p = join(MIND, file);
  const existing = existsSync(p) ? readFileSync(p, 'utf-8') : '';

  if (!existing.trim()) {
    writeFileSync(p, newContent + '\n', 'utf-8');
    return;
  }

  // Encontra o primeiro ## (primeira entrada existente)
  const lines = existing.split('\n');
  let insertAt = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      insertAt = i;
      break;
    }
  }

  const before = lines.slice(0, insertAt).join('\n').trimEnd();
  const after = lines.slice(insertAt).join('\n').trimStart();

  const separator = after ? '\n\n---\n\n' : '\n';
  writeFileSync(p, before + '\n\n' + newContent + separator + after, 'utf-8');
}

// ─── Parse sections from Claude response ─────────────────────────────────────

function parseSection(text, tag) {
  const open = `<<<${tag}>>>`;
  const close = `<<<END_${tag}>>>`;
  const start = text.indexOf(open);
  const end = text.indexOf(close);
  if (start === -1 || end === -1) return null;
  const content = text.slice(start + open.length, end).trim();
  return content.toUpperCase() === 'SKIP' || content === '' ? null : content;
}

// ─── Collect git info ─────────────────────────────────────────────────────────

function git(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf-8' }).trim();
}

let commitMsg, filesChanged, diff, dateStr;

try {
  commitMsg = git('git log -1 --format="%s"');
  const rawDate = git('git log -1 --format="%ai"');
  const d = new Date(rawDate);
  dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  filesChanged = (() => {
    try { return git('git diff HEAD~1 HEAD --name-only'); }
    catch { return git('git show --name-only --format="" HEAD'); }
  })();

  const rawDiff = (() => {
    try {
      return execSync(
        'git diff HEAD~1 HEAD -- . ' +
        '":(exclude)node_modules" ":(exclude)package-lock.json" ":(exclude)*.lock" ' +
        '":(exclude)electron-dist" ":(exclude)dist" ":(exclude)release"',
        { cwd: ROOT, encoding: 'utf-8', maxBuffer: 20 * 1024 * 1024 }
      );
    } catch {
      return execSync('git show --format="" HEAD', { cwd: ROOT, encoding: 'utf-8', maxBuffer: 20 * 1024 * 1024 });
    }
  })();

  diff = rawDiff.length > 14000
    ? rawDiff.slice(0, 14000) + '\n\n[... diff truncado para evitar excesso de tokens ...]'
    : rawDiff;

} catch (err) {
  console.error('[auto-doc] Erro ao coletar informações do git:', err.message);
  process.exit(0); // Nunca bloqueia o commit
}

// ─── Build prompt ─────────────────────────────────────────────────────────────

const existingProjectMap = readMind('project-map.md').slice(0, 3000);
const recentLearning    = readMind('learning-log.md').slice(0, 1200);
const recentArch        = readMind('architecture.md').slice(0, 1200);

const prompt = `Você é um sistema de documentação automática para um projeto PDV (Ponto de Venda) para uma lanchonete, chamado "PDV Lanchonete Luizão". O projeto usa React + TypeScript + Vite + Electron + Supabase + Baileys (WhatsApp).

Analise o commit abaixo e gere documentação estruturada em português brasileiro.
Seja objetivo. Analise o CÓDIGO, não apenas a mensagem do commit.

━━━ COMMIT ━━━
Data: ${dateStr}
Mensagem: ${commitMsg}

━━━ ARQUIVOS ALTERADOS ━━━
${filesChanged}

━━━ DIFF DO CÓDIGO ━━━
\`\`\`diff
${diff}
\`\`\`

━━━ CONTEXTO ATUAL ━━━
Estado atual do project-map.md:
${existingProjectMap || '(ainda não existe)'}

Últimos aprendizados registrados:
${recentLearning || '(nenhum ainda)'}

Decisões arquiteturais registradas:
${recentArch || '(nenhuma ainda)'}

━━━ INSTRUÇÃO ━━━
Responda EXATAMENTE no formato abaixo, com as tags delimitadoras. Use SKIP quando a seção não for relevante para este commit específico.

<<<CHANGELOG>>>
## ${dateStr}

**Commit:** ${commitMsg}

**Implementações:**
- [descreva o que foi implementado com base no código, não na mensagem]

**Arquivos principais:**
- [liste os arquivos mais relevantes alterados]
<<<END_CHANGELOG>>>

<<<LEARNING>>>
[Se este commit introduz conceito técnico interessante, nova API, padrão de código, ou descoberta relevante: escreva a entrada. Se for bugfix trivial ou mudança menor, escreva SKIP]

## ${dateStr}

**Contexto:** [uma linha sobre o que foi implementado]

**Aprendizados:**
- [aprendizado concreto e reutilizável]
- [outro aprendizado, se houver]
<<<END_LEARNING>>>

<<<ARCHITECTURE>>>
[Somente se este commit toma decisão arquitetural real: nova biblioteca, mudança de padrão, novo fluxo, nova estrutura de dados. Se não houver impacto arquitetural, escreva SKIP]

## [Nome curto da decisão]

**Decisão:** [o que foi decidido]

**Motivo:** [por que esta abordagem]

**Alternativas:** [outras opções que existiam]

**Impacto:** [como afeta o projeto a longo prazo]
<<<END_ARCHITECTURE>>>

<<<LINKEDIN>>>
[Gere uma ideia de post educativo para LinkedIn baseado nesta implementação. Texto natural, sem marketing. Se a alteração for muito pequena para gerar conteúdo relevante, escreva SKIP]

## ${dateStr} — [Título do Post]

**O problema:** [situação que devs reconhecem]

**Como resolvi:** [abordagem técnica concreta]

**O aprendizado:** [insight real tirado da implementação]

**Dica para outros devs:** [conselho prático]
<<<END_LINKEDIN>>>

<<<PROJECT_MAP>>>
[Escreva a versão COMPLETA ATUALIZADA do project-map.md, incorporando as mudanças deste commit. Baseie-se no estado atual fornecido acima e atualize o que foi alterado]

# Mapa do Projeto — PDV Lanchonete

## Front-end
[telas e componentes]

## Back-end
[serviços e lógica]

## Tecnologias
[stack técnica]

## Funcionalidades
[features implementadas com checkboxes]

## Integrações
[APIs e serviços externos]
<<<END_PROJECT_MAP>>>`;

// ─── Call Claude CLI ──────────────────────────────────────────────────────────

console.log('[auto-doc] Analisando commit com Claude AI...');

const result = spawnSync('claude', ['-p', prompt], {
  encoding: 'utf-8',
  timeout: 180000,
  maxBuffer: 10 * 1024 * 1024,
  env: { ...process.env },
  cwd: ROOT,
});

if (result.error) {
  console.error('[auto-doc] Falha ao executar claude:', result.error.message);
  process.exit(0);
}

if (result.status !== 0) {
  console.error('[auto-doc] claude retornou status', result.status);
  if (result.stderr) console.error(result.stderr.slice(0, 500));
  process.exit(0);
}

const response = result.stdout;

// ─── Parse and write files ────────────────────────────────────────────────────

const changelog   = parseSection(response, 'CHANGELOG');
const learning    = parseSection(response, 'LEARNING');
const architecture = parseSection(response, 'ARCHITECTURE');
const linkedin    = parseSection(response, 'LINKEDIN');
const projectMap  = parseSection(response, 'PROJECT_MAP');

const updated = [];

if (changelog) {
  prependEntry('CHANGELOG.md', changelog);
  updated.push('CHANGELOG.md');
}

if (learning) {
  prependEntry('learning-log.md', learning);
  updated.push('learning-log.md');
}

if (architecture) {
  prependEntry('architecture.md', architecture);
  updated.push('architecture.md');
}

if (linkedin) {
  prependEntry('linkedin-ideas.md', linkedin);
  updated.push('linkedin-ideas.md');
}

if (projectMap) {
  writeMind('project-map.md', projectMap + '\n');
  updated.push('project-map.md');
}

if (updated.length > 0) {
  console.log(`[auto-doc] ✅ Atualizado: ${updated.join(', ')}`);
} else {
  console.warn('[auto-doc] ⚠️  Nenhum arquivo atualizado — verifique o parsing da resposta.');
  // Log raw response for debugging
  const debugLog = join(MIND, '.debug-last-response.txt');
  writeFileSync(debugLog, response, 'utf-8');
  console.warn(`[auto-doc] Resposta salva em mind/.debug-last-response.txt para diagnóstico.`);
}
