/**
 * Vocabulário compartilhado dos achados do engine.
 *
 * Um "finding" é qualquer coisa que o sistema descobriu sobre a máquina. Todos os módulos
 * de análise produzem findings no mesmo formato, e o orquestrador em `recommendations.ts`
 * ordena e apresenta.
 *
 * A estrutura força o produto a ser honesto:
 *  - `severity` obriga a classificar a urgência em vez de gritar em tudo;
 *  - `what` / `why` / `how` obriga o progressive disclosure exigido pelo produto;
 *  - `confidence` obriga a assumir incerteza quando os dados não bastam.
 */

import type { HardwareCategory } from '../catalog/types.ts';
import type { Confidence } from './performance.ts';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'none';

/** Ordem de exibição. `none` é um resultado legítimo, não a ausência de resultado. */
export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Crítico',
  high: 'Alta prioridade',
  medium: 'Média prioridade',
  low: 'Baixa prioridade',
  none: 'Nenhuma ação necessária',
};

export type FindingKind =
  | 'bottleneck'
  | 'compatibility'
  | 'power'
  | 'thermal'
  | 'memory'
  | 'storage'
  | 'display'
  | 'target-miss'
  | 'healthy';

export interface Finding {
  id: string;
  kind: FindingKind;
  severity: Severity;
  /** Categoria à qual a ação se refere. `null` quando o achado é do conjunto. */
  category: HardwareCategory | null;

  /** O QUE fazer. Uma frase, sem jargão, imperativa. */
  what: string;
  /** POR QUE. Explicação em linguagem simples. */
  why: string;
  /** COMO resolver. Direção concreta. `null` quando não há ação a tomar. */
  how: string | null;

  /**
   * Camada técnica, revelada só quando o usuário pede. É aqui que mora o número —
   * o iniciante não precisa vê-lo, o entusiasta não aceita um app que o esconda.
   */
  technical: string[];

  confidence: Confidence;
  /** Ganho estimado, quando quantificável. Ex.: "+38% de FPS em 1080p". */
  expectedGain: string | null;
  /** Ordena achados de mesma severidade: quanto maior, mais impacto real. */
  impactScore: number;
}

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (bySeverity !== 0) return bySeverity;
    return b.impactScore - a.impactScore;
  });
}

/** Helper para os módulos de análise não repetirem os defaults. */
export function finding(input: Partial<Finding> & Pick<Finding, 'id' | 'kind' | 'severity' | 'what' | 'why'>): Finding {
  return {
    category: null,
    how: null,
    technical: [],
    confidence: 'medium',
    expectedGain: null,
    impactScore: 0,
    ...input,
  };
}
