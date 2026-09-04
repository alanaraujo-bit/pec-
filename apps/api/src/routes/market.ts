/**
 * Marketplace.
 *
 * Esta camada é transporte, não domínio: a faixa de preço vem de `suggestSellingPrice`, a
 * leitura do preço pedido vem de `assessAskingPrice` e as transições de estado vêm de
 * `canTransition` — todos do `@pece/core`. Nenhum número é calculado aqui.
 *
 * Duas regras do produto que aparecem em código nestas rotas:
 *
 * - **Anunciar não publica nada sozinho.** O evento social de venda só nasce se o corpo
 *   trouxer `publishEvent: true`. O padrão é não publicar, igual à troca de peça.
 *
 * - **Anunciar não expõe o valor do PC.** O anúncio revela o preço daquela peça, porque o
 *   dono escolheu revelá-lo. Ele não vaza o total da máquina nem liga `showValue`.
 */

import type { FastifyInstance } from 'fastify';
import { Prisma, ListingStatus as DbListingStatus, EventKind, Visibility } from '@prisma/client';
import { z } from 'zod';
import {
  assessAskingPrice,
  buildListingDraft,
  canTransition,
  priceBands,
  quickSaleFrom,
  transitionError,
  type ListingStatus,
} from '@pece/core';

import { prisma } from '../db.ts';
import { optionalAuth, requireAuth } from '../auth.ts';
import { toRigComponent } from '../mappers.ts';
import { recordSnapshot } from '../snapshots.ts';

const TO_DOMAIN: Record<DbListingStatus, ListingStatus> = {
  ACTIVE: 'active',
  RESERVED: 'reserved',
  SOLD: 'sold',
  WITHDRAWN: 'withdrawn',
};

const TO_DB: Record<ListingStatus, DbListingStatus> = {
  active: 'ACTIVE',
  reserved: 'RESERVED',
  sold: 'SOLD',
  withdrawn: 'WITHDRAWN',
};

const LISTING_INCLUDE = {
  component: true,
  seller: { select: { id: true, handle: true, displayName: true, avatarUrl: true, region: true } },
  rigComponent: { select: { id: true, condition: true, acquiredAt: true, rigId: true } },
};

type ListingRow = Prisma.ListingGetPayload<{ include: typeof LISTING_INCLUDE }>;

/**
 * Serializa o anúncio já com a leitura de preço do engine.
 *
 * A faixa usada é a congelada no momento do anúncio — é o que o vendedor viu quando
 * definiu o preço, e é o que o comprador precisa ver para julgar a mesma coisa.
 */
function serializeListing(row: ListingRow) {
  const assessment =
    row.suggestedLow !== null && row.suggestedHigh !== null
      ? assessAskingPrice(row.askingPrice, {
          suggestedLow: row.suggestedLow,
          suggestedHigh: row.suggestedHigh,
          quickSale: quickSaleFrom(row.suggestedLow),
          currency: row.currency,
          note: '',
        })
      : null;

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    askingPrice: row.askingPrice,
    currency: row.currency,
    condition: row.condition,
    region: row.region,
    status: TO_DOMAIN[row.status],
    createdAt: row.createdAt,
    soldAt: row.soldAt,
    component: {
      id: row.component.id,
      category: row.component.category,
      brand: row.component.brand,
      model: row.component.model,
      fullName: row.component.fullName,
      releaseYear: row.component.releaseYear,
      spec: row.component.spec,
    },
    seller: row.seller,
    /** A leitura honesta do preço. `null` quando a peça não tinha referência no catálogo. */
    priceAssessment: assessment,
  };
}

const createListingBody = z.object({
  rigComponentId: z.string(),
  askingPrice: z.number().positive().max(1_000_000),
  title: z.string().min(3).max(80).nullable().default(null),
  description: z.string().max(600).nullable().default(null),
  /** Consentimento explícito. Sem isso, anunciar não aparece para ninguém do feed. */
  publishEvent: z.boolean().default(false),
});

const updateListingBody = z.object({
  askingPrice: z.number().positive().max(1_000_000).optional(),
  title: z.string().min(3).max(80).optional(),
  description: z.string().max(600).nullable().optional(),
  status: z.enum(['active', 'reserved', 'sold', 'withdrawn']).optional(),
  /**
   * Ao marcar como vendida: tirar a peça da máquina. O padrão é `true` porque vender é
   * exatamente isso — mas quem vendeu uma peça reserva pode dizer que não.
   */
  removeFromRig: z.boolean().default(true),
  publishEvent: z.boolean().default(false),
});

export async function marketRoutes(app: FastifyInstance) {
  // -------------------------------------------------------------------------
  // Antes de anunciar: quanto vale esta peça
  // -------------------------------------------------------------------------

  /**
   * Rascunho de anúncio de uma peça da máquina. Só o dono vê — é o valor do PC dele.
   * Devolve `draft: null` quando não existe preço de referência, em vez de inventar um.
   */
  app.get(
    '/rigs/:id/components/:rigComponentId/listing-draft',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id, rigComponentId } = request.params as { id: string; rigComponentId: string };

      const rig = await prisma.rig.findUnique({
        where: { id },
        include: { owner: { select: { region: true } } },
      });
      if (!rig) return reply.code(404).send({ error: 'not_found' });
      if (rig.ownerId !== request.user!.id) return reply.code(403).send({ error: 'forbidden' });

      const row = await prisma.rigComponent.findFirst({
        where: { id: rigComponentId, rigId: id, removedAt: null },
        include: { component: true },
      });
      if (!row) return reply.code(404).send({ error: 'not_found', message: 'Peça não está nesta máquina.' });

      const openListing = await prisma.listing.findFirst({
        where: { rigComponentId, status: { in: ['ACTIVE', 'RESERVED'] } },
      });

      const draft = buildListingDraft(toRigComponent(row), rig.owner.region);

      return {
        draft,
        /**
         * As faixas com rótulo e explicação, para a tela dar retorno enquanto a pessoa
         * digita o preço sem reimplementar a regra. Quem julga continua sendo o engine.
         */
        bands: draft ? priceBands(draft.guidance) : [],
        alreadyListed: openListing ? { id: openListing.id, status: TO_DOMAIN[openListing.status] } : null,
        /** O produto precisa dizer por que não tem faixa, em vez de mostrar R$ 0. */
        unpricedReason: draft ? null : 'Não temos preço de referência para esta peça no catálogo.',
      };
    },
  );

  // -------------------------------------------------------------------------
  // Vitrine
  // -------------------------------------------------------------------------

  app.get('/market', { preHandler: optionalAuth }, async (request) => {
    const q = request.query as Record<string, string | undefined>;
    const limit = Math.min(Number(q.limit) || 20, 50);
    /**
     * `status=all` inclui vendidos e retirados, e por isso só vale para os próprios
     * anúncios: o histórico de quem vendeu o quê é dele, não da vitrine.
     */
    const wantsAll = q.status === 'all' && request.user;
    const statuses: DbListingStatus[] = wantsAll
      ? ['ACTIVE', 'RESERVED', 'SOLD', 'WITHDRAWN']
      : ['ACTIVE', 'RESERVED'];

    /**
     * Os filtros de peça precisam virar **um** objeto `component`.
     *
     * Montados como spreads separados, o último sobrescreveria os anteriores e
     * `?category=GPU&brand=NVIDIA` deixaria de filtrar por categoria — silenciosamente.
     */
    const componentWhere = {
      ...(q.category ? { category: q.category } : {}),
      ...(q.brand ? { brand: q.brand } : {}),
      ...(q.search ? { fullName: { contains: q.search, mode: 'insensitive' as const } } : {}),
    };

    const rows = await prisma.listing.findMany({
      where: {
        status: { in: statuses },
        ...(wantsAll ? { sellerId: request.user!.id } : {}),
        ...(Object.keys(componentWhere).length > 0 ? { component: componentWhere } : {}),
        ...(q.seller ? { seller: { handle: q.seller } } : {}),
        ...(q.region ? { region: q.region } : {}),
        ...(q.maxPrice ? { askingPrice: { lte: Number(q.maxPrice) } } : {}),
      },
      include: LISTING_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return {
      listings: page.map(serializeListing),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    };
  });

  app.get('/market/:id', { preHandler: optionalAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = await prisma.listing.findUnique({ where: { id }, include: LISTING_INCLUDE });
    if (!row) return reply.code(404).send({ error: 'not_found' });

    return {
      listing: serializeListing(row),
      isSeller: row.sellerId === request.user?.id,
    };
  });

  // -------------------------------------------------------------------------
  // Anunciar
  // -------------------------------------------------------------------------

  app.post('/market', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = createListingBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'validation', message: parsed.error.issues[0]?.message });
    }
    const { rigComponentId, askingPrice, title, description, publishEvent } = parsed.data;

    const item = await prisma.rigComponent.findUnique({
      where: { id: rigComponentId },
      include: { component: true, rig: { include: { owner: { select: { region: true } } } } },
    });
    if (!item) return reply.code(404).send({ error: 'not_found' });
    if (item.rig.ownerId !== request.user!.id) {
      return reply.code(403).send({ error: 'forbidden', message: 'Essa peça não é sua.' });
    }
    if (item.removedAt !== null) {
      return reply
        .code(400)
        .send({ error: 'validation', message: 'Esta peça já saiu da máquina — não dá para anunciá-la.' });
    }

    const open = await prisma.listing.findFirst({
      where: { rigComponentId, status: { in: ['ACTIVE', 'RESERVED'] } },
    });
    if (open) {
      return reply
        .code(409)
        .send({ error: 'conflict', message: 'Esta peça já tem um anúncio aberto.' });
    }

    const region = item.rig.owner.region;
    const draft = buildListingDraft(toRigComponent(item), region);

    const listing = await prisma.listing.create({
      data: {
        sellerId: request.user!.id,
        rigComponentId,
        componentId: item.componentId,
        title: title ?? draft?.title ?? item.component.fullName,
        description,
        askingPrice,
        currency: draft?.guidance.currency ?? 'BRL',
        condition: item.condition,
        region,
        // Congela a faixa que gerou este preço. Sem MSRP, fica null e a tela dirá isso.
        suggestedLow: draft?.guidance.suggestedLow ?? null,
        suggestedHigh: draft?.guidance.suggestedHigh ?? null,
      },
      include: LISTING_INCLUDE,
    });

    /**
     * Consentimento. Anunciar é uma decisão sobre a máquina; contar para o feed é outra
     * decisão, separada, e o padrão é não contar.
     */
    if (publishEvent) {
      await prisma.event.create({
        data: {
          authorId: request.user!.id,
          rigId: item.rigId,
          kind: EventKind.SALE,
          title: `Anunciou ${item.component.fullName}`,
          body: description,
          visibility: Visibility.PUBLIC,
          automatic: false,
          payload: {
            listingId: listing.id,
            componentId: item.componentId,
            askingPrice,
            currency: listing.currency,
          } as Prisma.InputJsonValue,
        },
      });
    }

    return reply.code(201).send({ listing: serializeListing(listing) });
  });

  // -------------------------------------------------------------------------
  // Manter o anúncio
  // -------------------------------------------------------------------------

  app.patch('/market/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateListingBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'validation', message: parsed.error.issues[0]?.message });
    }

    const row = await prisma.listing.findUnique({
      where: { id },
      include: { rigComponent: true, component: true },
    });
    if (!row) return reply.code(404).send({ error: 'not_found' });
    if (row.sellerId !== request.user!.id) {
      return reply.code(403).send({ error: 'forbidden', message: 'Esse anúncio não é seu.' });
    }

    const { status, removeFromRig, publishEvent, ...fields } = parsed.data;
    const current = TO_DOMAIN[row.status];

    if (status && !canTransition(current, status)) {
      return reply.code(409).send({ error: 'conflict', message: transitionError(current, status)! });
    }

    const becameSold = status === 'sold' && current !== 'sold';

    const updated = await prisma.$transaction(async (tx) => {
      const listing = await tx.listing.update({
        where: { id },
        data: {
          ...fields,
          ...(status ? { status: TO_DB[status] } : {}),
          ...(becameSold ? { soldAt: new Date() } : {}),
        },
        include: LISTING_INCLUDE,
      });

      /**
       * Vendida e removida da máquina: `removedAt`, nunca DELETE. A peça sai da análise e
       * continua na história — é a mesma mecânica da troca de peça.
       */
      if (becameSold && removeFromRig && row.rigComponent.removedAt === null) {
        await tx.rigComponent.update({ where: { id: row.rigComponentId }, data: { removedAt: new Date() } });
      }

      return listing;
    });

    if (becameSold && removeFromRig && row.rigComponent.removedAt === null) {
      await recordSnapshot(row.rigComponent.rigId, 'component-sold');
    }

    if (becameSold && publishEvent) {
      await prisma.event.create({
        data: {
          authorId: request.user!.id,
          rigId: row.rigComponent.rigId,
          kind: EventKind.SALE,
          title: `Vendeu ${row.component.fullName}`,
          visibility: Visibility.PUBLIC,
          automatic: false,
          payload: {
            listingId: row.id,
            componentId: row.componentId,
            soldPrice: updated.askingPrice,
            currency: updated.currency,
          } as Prisma.InputJsonValue,
        },
      });
    }

    return { listing: serializeListing(updated) };
  });

  /** Retirar do ar. Não apaga: o anúncio pode voltar, e o histórico é do usuário. */
  app.delete('/market/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = await prisma.listing.findUnique({ where: { id } });
    if (!row) return reply.code(404).send({ error: 'not_found' });
    if (row.sellerId !== request.user!.id) return reply.code(403).send({ error: 'forbidden' });

    const current = TO_DOMAIN[row.status];
    if (!canTransition(current, 'withdrawn')) {
      return reply.code(409).send({ error: 'conflict', message: transitionError(current, 'withdrawn')! });
    }

    await prisma.listing.update({ where: { id }, data: { status: 'WITHDRAWN' } });
    return reply.code(204).send();
  });
}
