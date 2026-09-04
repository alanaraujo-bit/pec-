/**
 * Compatibilidade física e elétrica.
 *
 * Duas funções distintas:
 *  1. auditar uma máquina já montada (o usuário pode ter cadastrado algo impossível,
 *     ou ter uma limitação real que ele não sabe que tem);
 *  2. validar um upgrade ANTES de recomendá-lo — recomendar uma peça que não encaixa
 *     é a forma mais rápida de destruir a confiança no produto.
 */

import type { CatalogComponent } from '../catalog/types.ts';
import { asCpu, asGpu, asRam } from '../catalog/types.ts';
import type { RigParts } from '../rig/types.ts';
import { finding, type Finding } from './findings.ts';
import { computePowerBudget, recommendPsuWattage } from './subsystems.ts';

export type CompatibilityLevel = 'ok' | 'warning' | 'blocked';

export interface CompatibilityIssue {
  level: CompatibilityLevel;
  /** Frase curta, para o usuário. */
  message: string;
  /** Detalhe técnico do porquê. */
  detail: string;
}

export interface CompatibilityReport {
  level: CompatibilityLevel;
  issues: CompatibilityIssue[];
}

function worst(issues: CompatibilityIssue[]): CompatibilityLevel {
  if (issues.some((i) => i.level === 'blocked')) return 'blocked';
  if (issues.some((i) => i.level === 'warning')) return 'warning';
  return 'ok';
}

// ---------------------------------------------------------------------------
// Auditoria da máquina montada
// ---------------------------------------------------------------------------

export function analyzeCompatibility(parts: RigParts): Finding[] {
  const out: Finding[] = [];
  const { cpu, gpu, motherboard, pcCase } = parts;

  if (cpu && motherboard && cpu.spec.socket !== motherboard.spec.socket) {
    out.push(
      finding({
        id: 'compat-socket-mismatch',
        kind: 'compatibility',
        severity: 'critical',
        category: 'MOTHERBOARD',
        what: 'O processador e a placa-mãe cadastrados não são compatíveis.',
        why: `O processador usa soquete ${cpu.spec.socket} e a placa-mãe é ${motherboard.spec.socket}. Essas peças não encaixam fisicamente — provavelmente houve um engano no cadastro.`,
        how: 'Revise qual é o modelo exato da sua placa-mãe ou do seu processador.',
        technical: [
          `Soquete do processador: ${cpu.spec.socket}`,
          `Soquete da placa-mãe: ${motherboard.spec.socket}`,
        ],
        confidence: 'high',
        impactScore: 95,
      }),
    );
  }

  const ram = parts.ramModules[0];
  if (ram && motherboard && ram.spec.spec.memoryType !== motherboard.spec.memoryType) {
    out.push(
      finding({
        id: 'compat-memory-type',
        kind: 'compatibility',
        severity: 'critical',
        category: 'RAM',
        what: 'A memória e a placa-mãe cadastradas não são compatíveis.',
        why: `A memória é ${ram.spec.spec.memoryType} e a placa-mãe aceita ${motherboard.spec.memoryType}. Os pentes não encaixam no slot.`,
        how: 'Confira o modelo exato da memória que está instalada.',
        technical: [
          `Tipo da memória: ${ram.spec.spec.memoryType}`,
          `Tipo aceito pela placa: ${motherboard.spec.memoryType}`,
        ],
        confidence: 'high',
        impactScore: 95,
      }),
    );
  }

  if (gpu && pcCase && gpu.spec.lengthMm > pcCase.spec.maxGpuLengthMm) {
    out.push(
      finding({
        id: 'compat-gpu-length',
        kind: 'compatibility',
        severity: 'high',
        category: 'CASE',
        what: 'A placa de vídeo parece maior do que o gabinete comporta.',
        why: `A placa tem ${gpu.spec.lengthMm}mm e o gabinete aceita até ${pcCase.spec.maxGpuLengthMm}mm. Se ela está instalada e funcionando, provavelmente alguma medida do cadastro está imprecisa.`,
        how: 'Vale conferir o modelo exato do gabinete — versões diferentes têm limites diferentes.',
        technical: [
          `Comprimento da GPU: ${gpu.spec.lengthMm}mm`,
          `Limite do gabinete: ${pcCase.spec.maxGpuLengthMm}mm`,
        ],
        impactScore: 60,
      }),
    );
  }

  // Memória rodando abaixo do que a placa suporta: performance deixada na mesa de graça.
  if (ram && motherboard) {
    const ramSpeed = ram.spec.spec.speedMhz;
    if (ramSpeed > motherboard.spec.maxMemoryMhz) {
      out.push(
        finding({
          id: 'compat-memory-speed-capped',
          kind: 'compatibility',
          severity: 'low',
          category: 'RAM',
          what: 'Sua memória é mais rápida do que a placa-mãe aproveita.',
          why: `A memória é de ${ramSpeed}MHz, mas a placa-mãe suporta oficialmente até ${motherboard.spec.maxMemoryMhz}MHz. Ela funciona, só não na velocidade máxima que poderia.`,
          how: 'Não há o que corrigir sem trocar a placa-mãe. Verifique se o perfil XMP/EXPO está ativado na BIOS para pelo menos chegar ao limite da placa.',
          technical: [
            `Velocidade da memória: ${ramSpeed}MHz`,
            `Suporte oficial da placa: ${motherboard.spec.maxMemoryMhz}MHz`,
          ],
          impactScore: 12,
        }),
      );
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Validação de um upgrade proposto
// ---------------------------------------------------------------------------

/**
 * Checa se um candidato encaixa na máquina atual. Chamado pelo gerador de cenários
 * antes de qualquer peça virar recomendação.
 */
export function checkUpgradeFit(parts: RigParts, candidate: CatalogComponent): CompatibilityReport {
  const issues: CompatibilityIssue[] = [];

  const newCpu = asCpu(candidate);
  if (newCpu && parts.motherboard) {
    const board = parts.motherboard.spec;
    if (newCpu.spec.socket !== board.socket) {
      issues.push({
        level: 'blocked',
        message: 'Não encaixa na sua placa-mãe.',
        detail: `Este processador usa soquete ${newCpu.spec.socket} e a sua placa é ${board.socket}. Trocar exigiria também trocar a placa-mãe e, possivelmente, a memória.`,
      });
    } else if (!newCpu.spec.memoryTypes.includes(board.memoryType)) {
      issues.push({
        level: 'warning',
        message: 'Pode exigir troca de memória.',
        detail: `O processador trabalha com ${newCpu.spec.memoryTypes.join('/')} e a sua placa usa ${board.memoryType}.`,
      });
    }

    if (board.vrmQuality === 'basic' && newCpu.spec.peakPowerWatts > 150) {
      issues.push({
        level: 'warning',
        message: 'Sua placa-mãe pode não sustentar esse processador no máximo.',
        detail: `O sistema de energia da sua placa é de entrada e este processador pede até ${newCpu.spec.peakPowerWatts}W. Ele vai funcionar, mas pode não manter a frequência máxima sob carga longa.`,
      });
    }
  }

  if (newCpu && parts.cooler) {
    const cooler = parts.cooler.spec;
    if (!cooler.sockets.includes(newCpu.spec.socket)) {
      issues.push({
        level: 'warning',
        message: 'Seu cooler atual pode precisar de outro suporte.',
        detail: `O cooler lista suporte para ${cooler.sockets.join(', ')}. Muitos fabricantes vendem o kit de adaptação separado.`,
      });
    }
    if (cooler.tdpCapacityWatts < newCpu.spec.peakPowerWatts * 0.85) {
      issues.push({
        level: 'warning',
        message: 'Seu cooler ficaria no limite.',
        detail: `O cooler dissipa ${cooler.tdpCapacityWatts}W e este processador pode pedir ${newCpu.spec.peakPowerWatts}W.`,
      });
    }
  }

  const newGpu = asGpu(candidate);
  if (newGpu) {
    if (parts.pcCase && newGpu.spec.lengthMm > parts.pcCase.spec.maxGpuLengthMm) {
      issues.push({
        level: 'blocked',
        message: 'Não cabe no seu gabinete.',
        detail: `A placa tem ${newGpu.spec.lengthMm}mm e o seu gabinete aceita até ${parts.pcCase.spec.maxGpuLengthMm}mm.`,
      });
    }

    if (parts.psu) {
      // Recalcula o consumo trocando a GPU atual pela candidata.
      const budget = computePowerBudget(parts);
      const currentGpuDraw = parts.gpu?.spec.peakPowerWatts ?? 0;
      const projected = budget.estimatedLoadWatts - currentGpuDraw + newGpu.spec.peakPowerWatts;
      const psuWatts = parts.psu.spec.wattage;

      if (projected > psuWatts) {
        issues.push({
          level: 'blocked',
          message: 'Sua fonte não aguenta essa placa.',
          detail: `Com ela o PC pediria cerca de ${projected}W e a sua fonte entrega ${psuWatts}W. Seria necessário trocar também a fonte, por uma de ${recommendPsuWattage(projected)}W.`,
        });
      } else if (projected > psuWatts * 0.88) {
        issues.push({
          level: 'warning',
          message: 'Sua fonte ficaria no limite.',
          detail: `O consumo iria para cerca de ${projected}W, contra ${psuWatts}W da fonte. Funciona, mas sem folga — o ideal seria uma de ${recommendPsuWattage(projected)}W.`,
        });
      }
    }

    if (parts.motherboard && newGpu.spec.pcieVersion > parts.motherboard.spec.pcieVersion) {
      issues.push({
        level: 'ok',
        message: 'A placa funciona, com perda mínima.',
        detail: `A GPU é PCIe ${newGpu.spec.pcieVersion} e a sua placa-mãe é PCIe ${parts.motherboard.spec.pcieVersion}. O padrão é retrocompatível e a perda real fica normalmente abaixo de 3%.`,
      });
    }
  }

  const newRam = asRam(candidate);
  if (newRam && parts.motherboard) {
    if (newRam.spec.memoryType !== parts.motherboard.spec.memoryType) {
      issues.push({
        level: 'blocked',
        message: 'Não é o tipo de memória da sua placa.',
        detail: `Esta memória é ${newRam.spec.memoryType} e a sua placa usa ${parts.motherboard.spec.memoryType}.`,
      });
    }
    if (parts.ramStickCount >= parts.motherboard.spec.memorySlots) {
      issues.push({
        level: 'warning',
        message: 'Seus slots de memória já estão ocupados.',
        detail: `A placa tem ${parts.motherboard.spec.memorySlots} slots e todos já estão em uso. Para aumentar a memória seria preciso substituir os pentes atuais, não somar.`,
      });
    }
  }

  return { level: worst(issues), issues };
}
