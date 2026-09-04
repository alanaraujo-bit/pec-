/**
 * Catálogo de hardware.
 *
 * A navegação é em três níveis — marca → família → modelo — justamente para eliminar
 * o campo de texto livre. O usuário nunca digita "rtx3070" e o sistema nunca precisa
 * adivinhar o que ele quis dizer.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { compareComponents, DEFAULT_PROFILE, HARDWARE_CATEGORIES } from '@pece/core';
import { prisma } from '../db.ts';
import { toCatalogComponent, toUsageProfile } from '../mappers.ts';
import { optionalAuth } from '../auth.ts';

const categorySchema = z.enum(HARDWARE_CATEGORIES);

export async function catalogRoutes(app: FastifyInstance) {
  /** Categorias disponíveis, com contagem. */
  app.get('/catalog/categories', async () => {
    const counts = await prisma.component.groupBy({ by: ['category'], _count: true });
    const byCategory = new Map(counts.map((c) => [c.category, c._count]));

    return {
      categories: HARDWARE_CATEGORIES.map((category) => ({
        category,
        count: byCategory.get(category) ?? 0,
      })),
    };
  });

  /** Passo 1: marcas da categoria. */
  app.get('/catalog/:category/brands', async (request, reply) => {
    const parsed = categorySchema.safeParse((request.params as { category: string }).category);
    if (!parsed.success) return reply.code(404).send({ error: 'not_found' });

    const rows = await prisma.component.groupBy({
      by: ['brand'],
      where: { category: parsed.data },
      _count: true,
      orderBy: { brand: 'asc' },
    });

    return { brands: rows.map((r) => ({ brand: r.brand, count: r._count })) };
  });

  /** Passo 2: famílias da marca. */
  app.get('/catalog/:category/brands/:brand/families', async (request, reply) => {
    const params = request.params as { category: string; brand: string };
    const parsed = categorySchema.safeParse(params.category);
    if (!parsed.success) return reply.code(404).send({ error: 'not_found' });

    const rows = await prisma.component.groupBy({
      by: ['family'],
      where: { category: parsed.data, brand: params.brand },
      _count: true,
      orderBy: { family: 'asc' },
    });

    return { families: rows.map((r) => ({ family: r.family, count: r._count })) };
  });

  /** Passo 3: modelos exatos. Mais recentes primeiro. */
  app.get('/catalog/:category/brands/:brand/families/:family/models', async (request, reply) => {
    const params = request.params as { category: string; brand: string; family: string };
    const parsed = categorySchema.safeParse(params.category);
    if (!parsed.success) return reply.code(404).send({ error: 'not_found' });

    const rows = await prisma.component.findMany({
      where: {
        category: parsed.data,
        brand: params.brand,
        family: decodeURIComponent(params.family),
      },
      orderBy: [{ releaseYear: 'desc' }, { model: 'asc' }],
    });

    return { models: rows.map(toCatalogComponent) };
  });

  /** Busca textual — atalho para quem já sabe o nome da peça. */
  app.get('/catalog/search', async (request) => {
    const query = request.query as { q?: string; category?: string; limit?: string };
    const term = (query.q ?? '').trim();
    if (term.length < 2) return { results: [] };

    const category = categorySchema.safeParse(query.category);
    const limit = Math.min(Number(query.limit) || 20, 50);

    const rows = await prisma.component.findMany({
      where: {
        ...(category.success ? { category: category.data } : {}),
        OR: [
          { fullName: { contains: term, mode: 'insensitive' } },
          { model: { contains: term, mode: 'insensitive' } },
          { family: { contains: term, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ releaseYear: 'desc' }],
      take: limit,
    });

    return { results: rows.map(toCatalogComponent) };
  });

  /**
   * Comparação entre duas peças.
   *
   * Contextual de propósito: o vencedor depende do perfil de quem pergunta. Um 9800X3D
   * ganha de um 285K para quem joga e perde para quem renderiza — e as duas respostas
   * estão certas. Sem login, cai no perfil padrão.
   */
  app.get('/catalog/compare', { preHandler: optionalAuth }, async (request, reply) => {
    const { a, b } = request.query as { a?: string; b?: string };
    if (!a || !b) {
      return reply.code(400).send({ error: 'validation', message: 'Informe as duas peças.' });
    }

    const [left, right] = await Promise.all([
      prisma.component.findUnique({ where: { id: a } }),
      prisma.component.findUnique({ where: { id: b } }),
    ]);
    if (!left || !right) return reply.code(404).send({ error: 'not_found' });
    if (left.category !== right.category) {
      return reply
        .code(400)
        .send({ error: 'validation', message: 'Só dá para comparar peças do mesmo tipo.' });
    }

    const profile = request.user
      ? toUsageProfile(
          await prisma.profile.findUnique({ where: { userId: request.user.id } }),
          DEFAULT_PROFILE.region,
        )
      : DEFAULT_PROFILE;

    return {
      comparison: compareComponents(toCatalogComponent(left), toCatalogComponent(right), profile),
    };
  });

  app.get('/catalog/components/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = await prisma.component.findUnique({ where: { id } });
    if (!row) return reply.code(404).send({ error: 'not_found' });
    return { component: toCatalogComponent(row) };
  });
}
