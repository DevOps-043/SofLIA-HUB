/**
 * AutoDev Strategic Memory — Sistema de "conciencia" persistente.
 *
 * Mantiene un modelo mental del proyecto que persiste entre runs:
 * - Roadmap estratégico con objetivos a corto/mediano plazo
 * - Inventario de capacidades (qué puede y qué NO puede hacer SofLIA)
 * - Retrospectivas de cada run (qué salió bien, qué falló, qué aprendió)
 * - Historial de decisiones para no repetir errores
 * - Análisis de gaps (qué falta por implementar)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';

// ─── Types ────────────────────────────────────────────────────────────

export type RunStrategy =
  | 'innovation'        // Crear capacidades completamente nuevas
  | 'deep-improvement'  // Mejorar significativamente features existentes
  | 'user-driven'       // Enfocarse en lo que el usuario ha pedido
  | 'gap-filling'       // Llenar huecos detectados en el sistema
  | 'integration'       // Conectar componentes desconectados
  | 'resilience';       // Mejorar estabilidad y manejo de errores

export interface StrategicGoal {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'abandoned';
  createdAt: string;
  completedAt?: string;
  /** IDs de runs que trabajaron en este objetivo */
  relatedRuns: string[];
  /** Categoría de la mejora */
  area: 'whatsapp' | 'automation' | 'computer-use' | 'integrations' | 'infrastructure' | 'ux' | 'security' | 'autodev';
}

export interface CapabilityEntry {
  name: string;
  description: string;
  status: 'functional' | 'partial' | 'broken' | 'missing';
  /** Archivos principales que implementan esta capacidad */
  files: string[];
  lastVerified: string;
  gaps?: string[];
}

export interface RunRetrospective {
  runId: string;
  date: string;
  strategy: RunStrategy;
  /** Qué se intentó hacer */
  intent: string;
  /** Qué se logró realmente */
  outcome: string;
  /** Calificación de impacto: ¿el usuario puede hacer algo nuevo? */
  impactScore: 1 | 2 | 3 | 4 | 5;
  /** Lecciones aprendidas */
  lessons: string[];
  /** Errores cometidos */
  mistakes: string[];
  /** Archivos que se crearon pero no se integraron */
  orphanedFiles: string[];
  /** Mejoras reales aplicadas */
  realImprovementsCount: number;
  /** Duración en minutos */
  durationMinutes: number;
}

export interface UserPattern {
  pattern: string;
  frequency: number;
  lastSeen: string;
  category: 'complaint' | 'request' | 'suggestion' | 'praise';
  addressed: boolean;
}

export interface StrategicMemory {
  version: number;
  lastUpdated: string;

  /** Objetivos estratégicos del roadmap */
  roadmap: StrategicGoal[];

  /** Inventario de capacidades del sistema */
  capabilities: CapabilityEntry[];

  /** Retrospectivas de runs pasados */
  retrospectives: RunRetrospective[];

  /** Patrones de comportamiento del usuario */
  userPatterns: UserPattern[];

  /** Ideas investigadas que fueron descartadas (para no repetir) */
  rejectedIdeas: Array<{
    idea: string;
    reason: string;
    date: string;
  }>;

  /** Estrategia seleccionada para el próximo run */
  nextRunStrategy?: {
    strategy: RunStrategy;
    focus: string;
    reason: string;
  };

  /** Áreas del codebase que AutoDev ha tocado más */
  hotspots: Record<string, number>;
}

// ─── Service ──────────────────────────────────────────────────────────

export class StrategicMemoryService {
  private memory: StrategicMemory;
  private filePath: string;

  constructor(dataDir?: string) {
    const dir = dataDir || (typeof app !== 'undefined' ? app.getPath('userData') : process.cwd());
    this.filePath = path.join(dir, 'autodev-strategic-memory.json');
    this.memory = this.load();
  }

  // ─── Persistence ──────────────────────────────────────────────────

  private load(): StrategicMemory {
    try {
      if (fs.existsSync(this.filePath)) {
        return JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
      }
    } catch (err: any) {
      console.warn(`[AutoDev Memory] Error cargando memoria estratégica: ${err.message}`);
    }
    return this.createEmpty();
  }

  private save(): void {
    this.memory.lastUpdated = new Date().toISOString();
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.memory, null, 2), 'utf-8');
    } catch (err: any) {
      console.error(`[AutoDev Memory] Error guardando memoria: ${err.message}`);
    }
  }

  private createEmpty(): StrategicMemory {
    return {
      version: 1,
      lastUpdated: new Date().toISOString(),
      roadmap: [],
      capabilities: [],
      retrospectives: [],
      userPatterns: [],
      rejectedIdeas: [],
      hotspots: {},
    };
  }

  // ─── Strategy Selection ───────────────────────────────────────────

  /**
   * Analiza el contexto actual y selecciona la mejor estrategia para el próximo run.
   * Considera: historial de runs, patrones del usuario, gaps conocidos, y diversidad.
   */
  selectStrategy(): { strategy: RunStrategy; focus: string; reason: string } {
    const retros = this.memory.retrospectives;
    const recentRetros = retros.slice(-5);
    const pendingGoals = this.memory.roadmap.filter(g => g.status === 'pending' || g.status === 'in_progress');
    const unaddressedPatterns = this.memory.userPatterns.filter(p => !p.addressed && p.frequency >= 2);
    const missingCapabilities = this.memory.capabilities.filter(c => c.status === 'missing' || c.status === 'partial');

    // 1. Si hay quejas/pedidos del usuario sin atender → user-driven
    if (unaddressedPatterns.length > 0) {
      const topPattern = unaddressedPatterns.sort((a, b) => b.frequency - a.frequency)[0];
      return {
        strategy: 'user-driven',
        focus: topPattern.pattern,
        reason: `El usuario ha mencionado "${topPattern.pattern}" ${topPattern.frequency} veces sin resolver.`,
      };
    }

    // 2. Si hay capacidades faltantes/rotas → gap-filling
    if (missingCapabilities.length > 0) {
      const topGap = missingCapabilities[0];
      return {
        strategy: 'gap-filling',
        focus: topGap.name,
        reason: `Capacidad "${topGap.name}" está ${topGap.status}: ${topGap.gaps?.join(', ') || 'necesita implementación'}.`,
      };
    }

    // 3. Si los últimos runs tuvieron bajo impacto → cambiar estrategia
    if (recentRetros.length >= 3) {
      const avgImpact = recentRetros.reduce((s, r) => s + r.impactScore, 0) / recentRetros.length;
      if (avgImpact < 2.5) {
        // Los runs recientes no han sido impactantes — cambiar de enfoque
        const recentStrategies = recentRetros.map(r => r.strategy);
        const unusedStrategies: RunStrategy[] = ['innovation', 'deep-improvement', 'integration', 'resilience'];
        const fresh = unusedStrategies.find(s => !recentStrategies.includes(s)) || 'innovation';
        return {
          strategy: fresh,
          focus: 'Cambio de enfoque necesario',
          reason: `Los últimos ${recentRetros.length} runs tuvieron impacto promedio de ${avgImpact.toFixed(1)}/5. Cambiando a estrategia "${fresh}" para romper el ciclo.`,
        };
      }
    }

    // 4. Si hay objetivos pendientes de alta prioridad → seguirlos
    const criticalGoals = pendingGoals.filter(g => g.priority === 'critical' || g.priority === 'high');
    if (criticalGoals.length > 0) {
      const goal = criticalGoals[0];
      return {
        strategy: 'deep-improvement',
        focus: goal.title,
        reason: `Objetivo estratégico pendiente: "${goal.title}" (${goal.priority}).`,
      };
    }

    // 5. Diversificar — evitar repetir la misma estrategia
    const lastStrategy = recentRetros[recentRetros.length - 1]?.strategy;
    const strategies: RunStrategy[] = ['innovation', 'deep-improvement', 'gap-filling', 'integration'];
    const nextIdx = lastStrategy ? (strategies.indexOf(lastStrategy) + 1) % strategies.length : 0;
    return {
      strategy: strategies[nextIdx],
      focus: 'Exploración general',
      reason: `Rotación de estrategia para mantener diversidad. Última: "${lastStrategy || 'ninguna'}".`,
    };
  }

  // ─── Retrospective ───────────────────────────────────────────────

  /**
   * Genera el prompt para que Gemini evalúe el run y produzca una retrospectiva.
   */
  getRetrospectivePrompt(runData: {
    id: string;
    strategy: RunStrategy;
    improvements: Array<{ file: string; category: string; description: string; applied: boolean }>;
    errors: string[];
    warnings: string[];
    durationMinutes: number;
  }): string {
    const pastRetros = this.memory.retrospectives.slice(-3)
      .map(r => `- Run ${r.runId} (${r.strategy}): impacto ${r.impactScore}/5 — ${r.outcome}`)
      .join('\n');

    return `Eres el módulo de auto-evaluación de AutoDev. Analiza el run que acaba de completar y genera una retrospectiva HONESTA.

## Run actual
- ID: ${runData.id}
- Estrategia elegida: ${runData.strategy}
- Duración: ${runData.durationMinutes} minutos
- Mejoras aplicadas: ${runData.improvements.filter(i => i.applied).length}
- Mejoras fallidas: ${runData.improvements.filter(i => !i.applied).length}
- Errores durante el run: ${runData.errors.length}

## Mejoras implementadas
${runData.improvements.filter(i => i.applied).map(i => `- [${i.category}] ${i.file}: ${i.description}`).join('\n') || 'Ninguna'}

## Errores y warnings
${runData.errors.join('\n') || 'Ninguno'}
${runData.warnings.join('\n') || ''}

## Retrospectivas anteriores
${pastRetros || 'No hay retrospectivas anteriores'}

## Evalúa HONESTAMENTE:
1. **impactScore** (1-5): ¿El usuario puede hacer algo NUEVO que antes no podía?
   - 1 = No cambió nada útil / solo cosmético
   - 2 = Mejora menor, el usuario casi no lo nota
   - 3 = Mejora funcional visible
   - 4 = Feature nueva útil
   - 5 = Capacidad transformadora
2. **outcome**: Resumen de qué se logró realmente (1 oración honesta)
3. **lessons**: Array de lecciones aprendidas (qué hacer diferente la próxima vez)
4. **mistakes**: Array de errores cometidos (archivos huérfanos, builds rotos, etc.)
5. **suggestedGoals**: Array de objetivos estratégicos nuevos para el roadmap (basado en lo que viste del código)
6. **suggestedCapabilities**: Array de capacidades detectadas en el sistema { name, status, files, gaps }
7. **nextStrategy**: Qué estrategia debería usar el SIGUIENTE run y por qué

## JSON esperado:
{
  "impactScore": 3,
  "outcome": "Se implementó X pero no se integró Y",
  "lessons": ["No crear archivos sin importarlos", "Validar ToolSchema antes de crear tools"],
  "mistakes": ["Se creó file.ts sin conectarlo al sistema"],
  "suggestedGoals": [
    { "title": "Implementar X", "description": "...", "priority": "high", "area": "whatsapp" }
  ],
  "suggestedCapabilities": [
    { "name": "WhatsApp Agent", "status": "functional", "files": ["electron/whatsapp-agent.ts"], "gaps": ["no tiene herramienta de X"] }
  ],
  "nextStrategy": { "strategy": "innovation", "focus": "...", "reason": "..." }
}`;
  }

  /**
   * Registra la retrospectiva de un run completado.
   */
  recordRetrospective(retro: RunRetrospective): void {
    this.memory.retrospectives.push(retro);

    // Mantener solo las últimas 30 retrospectivas
    if (this.memory.retrospectives.length > 30) {
      this.memory.retrospectives = this.memory.retrospectives.slice(-30);
    }

    this.save();
    console.log(`[AutoDev Memory] Retrospectiva registrada: run ${retro.runId}, impacto: ${retro.impactScore}/5`);
  }

  /**
   * Procesa la respuesta de Gemini con la retrospectiva y actualiza la memoria.
   */
  processRetrospectiveResponse(runId: string, strategy: RunStrategy, durationMinutes: number, response: any): void {
    // Registrar retrospectiva
    const retro: RunRetrospective = {
      runId,
      date: new Date().toISOString(),
      strategy,
      intent: `Estrategia: ${strategy}`,
      outcome: response.outcome || 'Sin evaluación',
      impactScore: Math.min(5, Math.max(1, response.impactScore || 2)) as 1 | 2 | 3 | 4 | 5,
      lessons: response.lessons || [],
      mistakes: response.mistakes || [],
      orphanedFiles: response.orphanedFiles || [],
      realImprovementsCount: response.realImprovementsCount || 0,
      durationMinutes,
    };
    this.recordRetrospective(retro);

    // Actualizar roadmap con objetivos sugeridos
    if (Array.isArray(response.suggestedGoals)) {
      for (const goal of response.suggestedGoals) {
        if (!goal.title) continue;
        // No duplicar objetivos similares
        const exists = this.memory.roadmap.some(g =>
          g.title.toLowerCase().includes(goal.title.toLowerCase().slice(0, 20)) ||
          goal.title.toLowerCase().includes(g.title.toLowerCase().slice(0, 20))
        );
        if (!exists) {
          this.memory.roadmap.push({
            id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            title: goal.title,
            description: goal.description || '',
            priority: goal.priority || 'medium',
            status: 'pending',
            createdAt: new Date().toISOString(),
            relatedRuns: [runId],
            area: goal.area || 'infrastructure',
          });
        }
      }
    }

    // Actualizar inventario de capacidades
    if (Array.isArray(response.suggestedCapabilities)) {
      for (const cap of response.suggestedCapabilities) {
        if (!cap.name) continue;
        const existing = this.memory.capabilities.find(c => c.name === cap.name);
        if (existing) {
          existing.status = cap.status || existing.status;
          existing.lastVerified = new Date().toISOString();
          if (cap.gaps) existing.gaps = cap.gaps;
        } else {
          this.memory.capabilities.push({
            name: cap.name,
            description: cap.description || '',
            status: cap.status || 'functional',
            files: cap.files || [],
            lastVerified: new Date().toISOString(),
            gaps: cap.gaps,
          });
        }
      }
    }

    // Guardar estrategia sugerida para el próximo run
    if (response.nextStrategy) {
      this.memory.nextRunStrategy = response.nextStrategy;
    }

    this.save();
  }

  // ─── Capability Gap Analysis ──────────────────────────────────────

  /**
   * Genera un prompt para que Gemini analice el codebase y detecte gaps.
   */
  getCapabilityAnalysisPrompt(sourceFiles: Array<{ path: string; content: string }>): string {
    const currentCaps = this.memory.capabilities
      .map(c => `- ${c.name}: ${c.status} (${c.gaps?.join(', ') || 'sin gaps'})`)
      .join('\n');

    const fileList = sourceFiles.map(f => f.path).join('\n');

    return `Eres un analista de arquitectura de software. Analiza el codebase de SofLIA Hub e identifica:

## Archivos del proyecto
${fileList}

## Capacidades ya registradas
${currentCaps || 'Ninguna registrada aún'}

## Tu trabajo:
1. **Capacidades existentes**: Identifica qué puede hacer el sistema actualmente (servicios, herramientas, integraciones)
2. **Gaps críticos**: ¿Qué funcionalidades están incompletas o desconectadas?
3. **Oportunidades**: ¿Qué funcionalidades nuevas serían de ALTO IMPACTO?
4. **Código muerto**: ¿Hay servicios/archivos que existen pero no están conectados?
5. **Integraciones rotas**: ¿Hay imports/handlers que referencian cosas inexistentes?

## JSON esperado:
{
  "capabilities": [
    { "name": "WhatsApp Agent", "status": "functional|partial|broken|missing", "files": ["..."], "description": "...", "gaps": ["falta X", "Y no funciona"] }
  ],
  "criticalGaps": [
    { "gap": "...", "impact": "high|medium|low", "suggestedSolution": "..." }
  ],
  "opportunities": [
    { "feature": "...", "impact": "high|medium|low", "complexity": "low|medium|high", "description": "..." }
  ],
  "deadCode": ["archivo1.ts", "archivo2.ts"],
  "brokenIntegrations": [
    { "file": "...", "issue": "..." }
  ]
}`;
  }

  // ─── Context Generation for Prompts ───────────────────────────────

  /**
   * Genera contexto estratégico para inyectar en los prompts de investigación/análisis.
   * Le da al AutoDev "conciencia" de su historia y dirección.
   */
  getStrategicContext(): string {
    const parts: string[] = [];

    // Estrategia seleccionada
    const strategy = this.memory.nextRunStrategy || this.selectStrategy();
    parts.push(`## 🧠 ESTRATEGIA PARA ESTE RUN: ${strategy.strategy.toUpperCase()}`);
    parts.push(`**Enfoque:** ${strategy.focus}`);
    parts.push(`**Razón:** ${strategy.reason}`);
    parts.push('');

    // Roadmap activo
    const activeGoals = this.memory.roadmap
      .filter(g => g.status === 'pending' || g.status === 'in_progress')
      .sort((a, b) => {
        const prio = { critical: 0, high: 1, medium: 2, low: 3 };
        return prio[a.priority] - prio[b.priority];
      })
      .slice(0, 10);
    if (activeGoals.length) {
      parts.push('## 📋 ROADMAP ACTIVO (objetivos pendientes)');
      parts.push('Estos son los objetivos estratégicos que AutoDev debería perseguir:');
      for (const g of activeGoals) {
        parts.push(`- [${g.priority.toUpperCase()}] **${g.title}** (${g.area}): ${g.description}`);
      }
      parts.push('');
    }

    // Gaps conocidos
    const gaps = this.memory.capabilities.filter(c => c.status === 'missing' || c.status === 'partial');
    if (gaps.length) {
      parts.push('## 🕳️ GAPS CONOCIDOS (capacidades faltantes o incompletas)');
      for (const g of gaps.slice(0, 8)) {
        parts.push(`- **${g.name}** [${g.status}]: ${g.gaps?.join(', ') || g.description}`);
      }
      parts.push('');
    }

    // Lecciones de runs recientes
    const recentLessons = this.memory.retrospectives.slice(-3).flatMap(r => r.lessons);
    if (recentLessons.length) {
      parts.push('## 📖 LECCIONES APRENDIDAS (de runs recientes)');
      const uniqueLessons = [...new Set(recentLessons)].slice(0, 8);
      for (const l of uniqueLessons) {
        parts.push(`- ${l}`);
      }
      parts.push('');
    }

    // Ideas rechazadas (para no repetir)
    if (this.memory.rejectedIdeas.length) {
      parts.push('## ⛔ IDEAS YA RECHAZADAS (NO repetir)');
      for (const idea of this.memory.rejectedIdeas.slice(-10)) {
        parts.push(`- "${idea.idea}" — Razón: ${idea.reason}`);
      }
      parts.push('');
    }

    // Patrones del usuario sin resolver
    const unresolved = this.memory.userPatterns.filter(p => !p.addressed);
    if (unresolved.length) {
      parts.push('## 👤 PETICIONES DEL USUARIO SIN RESOLVER');
      for (const p of unresolved.slice(0, 5)) {
        parts.push(`- [${p.category}] "${p.pattern}" (mencionado ${p.frequency}x, último: ${p.lastSeen})`);
      }
      parts.push('');
    }

    // Score de impacto reciente
    const recentRetros = this.memory.retrospectives.slice(-5);
    if (recentRetros.length) {
      const avgImpact = recentRetros.reduce((s, r) => s + r.impactScore, 0) / recentRetros.length;
      parts.push(`## 📊 IMPACTO RECIENTE: ${avgImpact.toFixed(1)}/5 (promedio de últimos ${recentRetros.length} runs)`);
      if (avgImpact < 3) {
        parts.push('⚠️ El impacto ha sido bajo. Este run DEBE producir algo que el usuario NOTE y pueda USAR.');
      }
      parts.push('');
    }

    return parts.join('\n');
  }

  /**
   * Genera contexto estratégico corto para inyectar en prompts de codificación.
   */
  getStrategyDirective(): string {
    const strategy = this.memory.nextRunStrategy || this.selectStrategy();
    const directives: Record<RunStrategy, string> = {
      'innovation': 'PRIORIZA crear funcionalidades COMPLETAMENTE NUEVAS. Piensa en qué puede hacer un competidor que SofLIA no puede. Sé creativo y ambicioso.',
      'deep-improvement': 'PRIORIZA mejorar features EXISTENTES de forma significativa. Haz que algo que ya funciona sea 10x mejor. Más inteligente, más rápido, más útil.',
      'user-driven': 'PRIORIZA lo que el USUARIO ha pedido explícitamente. Revisa las quejas y sugerencias pendientes y resuélvelas PRIMERO.',
      'gap-filling': 'PRIORIZA llenar HUECOS en el sistema. Busca servicios incompletos, features a medias, y código que existe pero no está conectado.',
      'integration': 'PRIORIZA CONECTAR componentes existentes entre sí. Haz que los servicios se comuniquen mejor. Elimina silos.',
      'resilience': 'PRIORIZA la ESTABILIDAD. Corrige errores silenciosos, agrega manejo de errores donde falta, haz el sistema más robusto.',
    };
    return `🎯 DIRECTIVA ESTRATÉGICA: ${directives[strategy.strategy]}`;
  }

  // ─── User Pattern Tracking ───────────────────────────────────────

  /**
   * Registra un patrón de comportamiento del usuario (queja, sugerencia, etc.)
   */
  trackUserPattern(pattern: string, category: UserPattern['category']): void {
    const existing = this.memory.userPatterns.find(p =>
      p.pattern.toLowerCase() === pattern.toLowerCase() && p.category === category
    );
    if (existing) {
      existing.frequency++;
      existing.lastSeen = new Date().toISOString();
    } else {
      this.memory.userPatterns.push({
        pattern,
        frequency: 1,
        lastSeen: new Date().toISOString(),
        category,
        addressed: false,
      });
    }
    this.save();
  }

  /**
   * Marca un patrón del usuario como atendido.
   */
  markPatternAddressed(pattern: string): void {
    const p = this.memory.userPatterns.find(up => up.pattern.toLowerCase().includes(pattern.toLowerCase()));
    if (p) {
      p.addressed = true;
      this.save();
    }
  }

  // ─── Roadmap Management ──────────────────────────────────────────

  addGoal(goal: Omit<StrategicGoal, 'id' | 'createdAt' | 'relatedRuns'>): void {
    this.memory.roadmap.push({
      ...goal,
      id: `goal_${Date.now()}`,
      createdAt: new Date().toISOString(),
      relatedRuns: [],
    });
    this.save();
  }

  completeGoal(goalId: string, runId: string): void {
    const goal = this.memory.roadmap.find(g => g.id === goalId);
    if (goal) {
      goal.status = 'completed';
      goal.completedAt = new Date().toISOString();
      goal.relatedRuns.push(runId);
      this.save();
    }
  }

  // ─── Rejected Ideas ──────────────────────────────────────────────

  rejectIdea(idea: string, reason: string): void {
    this.memory.rejectedIdeas.push({
      idea,
      reason,
      date: new Date().toISOString(),
    });
    // Mantener solo las últimas 50
    if (this.memory.rejectedIdeas.length > 50) {
      this.memory.rejectedIdeas = this.memory.rejectedIdeas.slice(-50);
    }
    this.save();
  }

  // ─── Hotspot Tracking ────────────────────────────────────────────

  trackHotspot(file: string): void {
    this.memory.hotspots[file] = (this.memory.hotspots[file] || 0) + 1;
  }

  getOverworkedFiles(threshold = 5): string[] {
    return Object.entries(this.memory.hotspots)
      .filter(([, count]) => count >= threshold)
      .sort(([, a], [, b]) => b - a)
      .map(([file]) => file);
  }

  // ─── Getters ─────────────────────────────────────────────────────

  getMemory(): StrategicMemory { return this.memory; }

  getCurrentStrategy(): RunStrategy {
    return (this.memory.nextRunStrategy?.strategy || this.selectStrategy().strategy);
  }

  getActiveGoals(): StrategicGoal[] {
    return this.memory.roadmap.filter(g => g.status === 'pending' || g.status === 'in_progress');
  }

  getRecentRetrospectives(count = 5): RunRetrospective[] {
    return this.memory.retrospectives.slice(-count);
  }

  getAverageImpact(lastN = 5): number {
    const recent = this.memory.retrospectives.slice(-lastN);
    if (!recent.length) return 0;
    return recent.reduce((s, r) => s + r.impactScore, 0) / recent.length;
  }

  /** Limpia la estrategia programada para el próximo run (después de usarla) */
  clearNextStrategy(): void {
    this.memory.nextRunStrategy = undefined;
    this.save();
  }
}
