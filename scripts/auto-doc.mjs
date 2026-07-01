#!/usr/bin/env node
/**
 * auto-doc.mjs
 * Gera documentação automática na pasta mind/ após cada commit.
 * Chamado pelo hook .git/hooks/post-commit.
 */

import { execSync, spawnSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MIND = join(ROOT, 'mind');
const DECISIONS = join(MIND, 'decisions');

if (!existsSync(MIND)) mkdirSync(MIND, { recursive: true });
if (!existsSync(DECISIONS)) mkdirSync(DECISIONS, { recursive: true });

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

// ─── Metrics helpers ──────────────────────────────────────────────────────────

function parseMetrics(content) {
  const metrics = {
    total_commits: 0,
    documentados: 0,
    funcionalidades: 0,
    bugs_corrigidos: 0,
    refatoracoes: 0,
    melhorias_ux: 0,
    melhorias_mobile: 0,
    melhorias_performance: 0,
    melhorias_seguranca: 0,
    decisoes_arquiteturais: 0,
    learning_entries: 0,
    linkedin_ideas: 0,
  };

  const patterns = [
    [/Total de commits no repositório\s*\|\s*(\d+)/, 'total_commits'],
    [/Commits documentados pelo sistema\s*\|\s*(\d+)/, 'documentados'],
    [/Funcionalidades implementadas\s*\|\s*(\d+)/, 'funcionalidades'],
    [/Bugs corrigidos\s*\|\s*(\d+)/, 'bugs_corrigidos'],
    [/Refatorações\s*\|\s*(\d+)/, 'refatoracoes'],
    [/Melhorias de UX\s*\|\s*(\d+)/, 'melhorias_ux'],
    [/Melhorias mobile\s*\|\s*(\d+)/, 'melhorias_mobile'],
    [/Melhorias de performance\s*\|\s*(\d+)/, 'melhorias_performance'],
    [/Melhorias de segurança\s*\|\s*(\d+)/, 'melhorias_seguranca'],
    [/Decisões arquiteturais registradas\s*\|\s*(\d+)/, 'decisoes_arquiteturais'],
    [/Entradas no learning-log\s*\|\s*(\d+)/, 'learning_entries'],
    [/Ideias para LinkedIn geradas\s*\|\s*(\d+)/, 'linkedin_ideas'],
  ];

  for (const [re, key] of patterns) {
    const m = content.match(re);
    if (m) metrics[key] = parseInt(m[1], 10);
  }

  return metrics;
}

function applyMetricsDelta(content, newValues, commitMsg, dateStr) {
  let updated = content;

  const replacements = [
    [/(\| Total de commits no repositório\s*\|\s*)(\d+)(\s*\|)/, newValues.total_commits],
    [/(\| Commits documentados pelo sistema\s*\|\s*)(\d+)(\s*\|)/, newValues.documentados],
    [/(\| Funcionalidades implementadas\s*\|\s*)(\d+)(\s*\|)/, newValues.funcionalidades],
    [/(\| Bugs corrigidos\s*\|\s*)(\d+)(\s*\|)/, newValues.bugs_corrigidos],
    [/(\| Refatorações\s*\|\s*)(\d+)(\s*\|)/, newValues.refatoracoes],
    [/(\| Melhorias de UX\s*\|\s*)(\d+)(\s*\|)/, newValues.melhorias_ux],
    [/(\| Melhorias mobile\s*\|\s*)(\d+)(\s*\|)/, newValues.melhorias_mobile],
    [/(\| Melhorias de performance\s*\|\s*)(\d+)(\s*\|)/, newValues.melhorias_performance],
    [/(\| Melhorias de segurança\s*\|\s*)(\d+)(\s*\|)/, newValues.melhorias_seguranca],
    [/(\| Decisões arquiteturais registradas\s*\|\s*)(\d+)(\s*\|)/, newValues.decisoes_arquiteturais],
    [/(\| Entradas no learning-log\s*\|\s*)(\d+)(\s*\|)/, newValues.learning_entries],
    [/(\| Ideias para LinkedIn geradas\s*\|\s*)(\d+)(\s*\|)/, newValues.linkedin_ideas],
  ];

  for (const [re, newVal] of replacements) {
    updated = updated.replace(re, (_, prefix, _old, suffix) => prefix + newVal + suffix);
  }

  // Append new row to the history table
  const old = parseMetrics(content);
  const historyRow = `| ${dateStr} | ${commitMsg.slice(0, 50)} | ${newValues.funcionalidades - old.funcionalidades} | ${newValues.bugs_corrigidos - old.bugs_corrigidos} | ${newValues.melhorias_ux - old.melhorias_ux} | ${newValues.melhorias_mobile - old.melhorias_mobile} | ${newValues.melhorias_seguranca - old.melhorias_seguranca} |`;

  const historyMarker = '|---|---|---|---|---|---|---|';
  const markerIdx = updated.indexOf(historyMarker);
  if (markerIdx !== -1) {
    const insertIdx = updated.indexOf('\n', markerIdx) + 1;
    updated = updated.slice(0, insertIdx) + historyRow + '\n' + updated.slice(insertIdx);
  }

  return updated;
}

// ─── Decisions helpers ────────────────────────────────────────────────────────

function nextDecisionNumber() {
  if (!existsSync(DECISIONS)) return 1;
  const files = readdirSync(DECISIONS).filter(f => /^\d+-.+\.md$/.test(f));
  if (files.length === 0) return 1;
  const nums = files.map(f => parseInt(f.split('-')[0], 10));
  return Math.max(...nums) + 1;
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

function parseSectionJson(text, tag) {
  const raw = parseSection(text, tag);
  if (!raw) return null;
  try {
    // Remove markdown code fences if present
    const cleaned = raw.replace(/^```[a-z]*\n?/m, '').replace(/\n?```$/m, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
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
  process.exit(0);
}

// ─── Read existing context ────────────────────────────────────────────────────

const existingProjectMap = readMind('project-map.md').slice(0, 3000);
const recentLearning     = readMind('learning-log.md').slice(0, 1500);
const recentArch         = readMind('architecture.md').slice(0, 1500);
const recentJournal      = readMind('dev-journal.md').slice(0, 800);
const currentMetrics     = readMind('metrics.md');
const metricsValues      = parseMetrics(currentMetrics);

// Get current total commits from git
let totalCommits = metricsValues.total_commits;
try {
  totalCommits = parseInt(git('git rev-list --count HEAD'), 10);
} catch {}

// ─── Build prompt ─────────────────────────────────────────────────────────────

const prompt = `Você é um sistema de documentação automática para um projeto PDV (Ponto de Venda) chamado "PDV Lanchonete Luizão". Stack: React + TypeScript + Vite + Electron + Supabase + Baileys (WhatsApp).

Analise o commit abaixo e gere documentação estruturada em português brasileiro.
Seja objetivo e analise o CÓDIGO, não apenas a mensagem do commit.

━━━ COMMIT ━━━
Data: ${dateStr}
Mensagem: ${commitMsg}

━━━ ARQUIVOS ALTERADOS ━━━
${filesChanged}

━━━ DIFF DO CÓDIGO ━━━
\`\`\`diff
${diff}
\`\`\`

━━━ CONTEXTO ATUAL DO PROJETO ━━━
project-map.md (resumido):
${existingProjectMap || '(ainda não existe)'}

Últimos aprendizados registrados:
${recentLearning || '(nenhum ainda)'}

Decisões arquiteturais registradas:
${recentArch || '(nenhuma ainda)'}

Últimas entradas do dev-journal:
${recentJournal || '(nenhum ainda)'}

Métricas atuais (base para incremento):
- Total de commits no repo: ${totalCommits}
- Commits documentados: ${metricsValues.documentados}
- Funcionalidades: ${metricsValues.funcionalidades}
- Bugs corrigidos: ${metricsValues.bugs_corrigidos}
- Refatorações: ${metricsValues.refatoracoes}
- Melhorias UX: ${metricsValues.melhorias_ux}
- Melhorias mobile: ${metricsValues.melhorias_mobile}
- Melhorias performance: ${metricsValues.melhorias_performance}
- Melhorias segurança: ${metricsValues.melhorias_seguranca}
- Decisões arquiteturais: ${metricsValues.decisoes_arquiteturais}
- Entradas learning-log: ${metricsValues.learning_entries}
- Ideias LinkedIn: ${metricsValues.linkedin_ideas}

━━━ INSTRUÇÕES ━━━
Responda EXATAMENTE no formato abaixo. Use SKIP quando a seção não for relevante.
NÃO repita informações já registradas nos contextos acima.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<<<CHANGELOG>>>
## ${dateStr}

**Commit:** ${commitMsg}

**Implementações:**
- [descreva o que foi implementado com base no código — concreto e técnico]

**Arquivos principais:**
- [arquivo] — [o que mudou nele]

**Problema resolvido:** [o problema real que motivou esta implementação]

**Impacto:** [como melhora o sistema ou a experiência do usuário]
<<<END_CHANGELOG>>>

<<<LEARNING>>>
[Escreva se houver aprendizado técnico novo. Para bugfix trivial ou mudança cosmética, use SKIP. NÃO repita aprendizados já no contexto acima.]

## ${dateStr}

**Contexto:** [uma linha sobre o que foi implementado]

**Aprendizados:**
- [aprendizado concreto e reutilizável]

**Armadilhas encontradas:**
- [comportamento inesperado, pegadinha, edge case — ou "Nenhuma neste commit"]

**Boas práticas reforçadas:**
- [padrão confirmado como correto — ou "Nenhuma neste commit"]

**Tecnologias / APIs / Bibliotecas novas usadas neste commit:**
- [lista — ou "Nenhuma neste commit"]
<<<END_LEARNING>>>

<<<ARCHITECTURE>>>
[Somente se houver decisão arquitetural real. Para mudanças pontuais ou já documentadas, use SKIP.]

## [Nome curto da decisão]

**Decisão:** [o que foi decidido]

**Motivação:** [por que esta abordagem]

**Alternativas consideradas:** [outras opções e por que foram descartadas]

**Trade-offs:** [o que esta decisão sacrifica]

**Benefícios:** [ganhos concretos]

**Possíveis limitações:** [quando precisará ser revisitada]
<<<END_ARCHITECTURE>>>

<<<DEV_JOURNAL>>>
[Em primeira pessoa. Para commits mecânicos ou triviais, use SKIP.]

## ${dateStr} — [título descritivo do problema resolvido]

**O problema:** [o que estava quebrado, faltando ou causando fricção]

**Como pensei na solução:** [raciocínio por trás da abordagem]

**Dificuldades encontradas:** [o que foi difícil ou surpreendente]

**Decisões tomadas:** [escolhas e a lógica por trás delas]

**O que faria diferente:** [retrospectiva honesta]

**Próximos passos:** [o que ainda precisa ser feito ou monitorado]
<<<END_DEV_JOURNAL>>>

<<<LINKEDIN>>>
[Post educativo para LinkedIn. Para alterações internas ou muito pequenas, use SKIP.]

## ${dateStr} — [Título direto ao ponto]

**Gancho inicial:** [primeira frase que para o scroll]

**Público-alvo:** [quem vai se identificar]

**O problema:** [situação que devs reconhecem]

**Como resolvi:** [abordagem técnica concreta]

**O aprendizado:** [insight real]

**Dica para outros devs:** [conselho prático]

**Chamada para discussão:** [pergunta que convida comentários]
<<<END_LINKEDIN>>>

<<<METRICS_DELTA>>>
{"total_commits":${totalCommits},"documentados":${metricsValues.documentados + 1},"funcionalidades":${metricsValues.funcionalidades},"bugs_corrigidos":${metricsValues.bugs_corrigidos},"refatoracoes":${metricsValues.refatoracoes},"melhorias_ux":${metricsValues.melhorias_ux},"melhorias_mobile":${metricsValues.melhorias_mobile},"melhorias_performance":${metricsValues.melhorias_performance},"melhorias_seguranca":${metricsValues.melhorias_seguranca},"decisoes_arquiteturais":${metricsValues.decisoes_arquiteturais},"learning_entries":${metricsValues.learning_entries},"linkedin_ideas":${metricsValues.linkedin_ideas}}

[Ajuste os valores acima de acordo com o que este commit realmente implementou. Retorne o JSON COMPLETO com os novos valores absolutos — nunca zere métricas existentes.]
<<<END_METRICS_DELTA>>>

<<<NEW_DECISION>>>
[Novo ADR apenas se este commit justifica uma decisão arquitetural que NÃO está no contexto de arquitetura acima. Caso contrário, use SKIP.]

**Título:** [nome curto]

**Contexto:** [situação que levou à decisão]

**Problema:** [o desafio técnico]

**Solução escolhida:** [o que foi decidido]

**Alternativas consideradas:** [outras opções]

**Consequências:** [impactos positivos e negativos]
<<<END_NEW_DECISION>>>

<<<PROJECT_MAP>>>
[Versão COMPLETA E ATUALIZADA do project-map.md incorporando as mudanças deste commit.]

# Mapa do Projeto — PDV Lanchonete

> Estado atual do projeto, atualizado automaticamente após cada commit.

---

## Front-end

### Área PDV (caixa)
[telas e componentes]

### Área Admin
[telas e componentes administrativos]

## Back-end e Integrações
[Supabase, Baileys, Electron]

## Tecnologias
[stack técnica]

## Funcionalidades Implementadas
[lista com checkboxes]

## Fluxos Importantes
[fluxos críticos do sistema]
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

// ─── Parse all sections ───────────────────────────────────────────────────────

const changelog    = parseSection(response, 'CHANGELOG');
const learning     = parseSection(response, 'LEARNING');
const architecture = parseSection(response, 'ARCHITECTURE');
const devJournal   = parseSection(response, 'DEV_JOURNAL');
const linkedin     = parseSection(response, 'LINKEDIN');
const metricsDelta = parseSectionJson(response, 'METRICS_DELTA');
const newDecision  = parseSection(response, 'NEW_DECISION');
const projectMap   = parseSection(response, 'PROJECT_MAP');

const updated = [];

// ─── Write files ──────────────────────────────────────────────────────────────

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

if (devJournal) {
  prependEntry('dev-journal.md', devJournal);
  updated.push('dev-journal.md');
}

if (linkedin) {
  prependEntry('linkedin-ideas.md', linkedin);
  updated.push('linkedin-ideas.md');
}

if (metricsDelta && currentMetrics) {
  const updatedMetrics = applyMetricsDelta(currentMetrics, metricsDelta, commitMsg, dateStr);
  writeMind('metrics.md', updatedMetrics);
  updated.push('metrics.md');
} else if (metricsDelta && !currentMetrics) {
  console.warn('[auto-doc] metrics.md não encontrado — não foi possível atualizar métricas.');
}

if (newDecision) {
  const num = nextDecisionNumber();
  const paddedNum = String(num).padStart(3, '0');
  const titleMatch = newDecision.match(/\*\*Título:\*\*\s*(.+)/);
  const titleText = titleMatch ? titleMatch[1].trim() : 'decisao-arquitetural';
  const titleSlug = titleText.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
  const filename = `${paddedNum}-${titleSlug}.md`;
  const filepath = join(DECISIONS, filename);
  const adrContent = `# ADR ${paddedNum} — ${titleText}\n\n**Data:** ${dateStr}\n**Status:** Aceita\n\n${newDecision.replace(/^\*\*Título:\*\*[^\n]*\n?/, '').trim()}\n`;
  writeFileSync(filepath, adrContent, 'utf-8');
  updated.push(`decisions/${filename}`);
}

if (projectMap) {
  writeMind('project-map.md', projectMap + '\n');
  updated.push('project-map.md');
}

// ─── Report ───────────────────────────────────────────────────────────────────

if (updated.length > 0) {
  console.log(`[auto-doc] ✅ Atualizado: ${updated.join(', ')}`);
} else {
  console.warn('[auto-doc] ⚠️  Nenhum arquivo atualizado — verifique o parsing da resposta.');
  const debugLog = join(MIND, '.debug-last-response.txt');
  writeFileSync(debugLog, response, 'utf-8');
  console.warn('[auto-doc] Resposta salva em mind/.debug-last-response.txt para diagnóstico.');
}
