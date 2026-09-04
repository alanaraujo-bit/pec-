/**
 * Popula o catálogo de hardware no banco a partir do seed curado em `@pece/core`.
 *
 * Idempotente: roda quantas vezes for preciso. O catálogo é a fonte da verdade do
 * domínio, e o banco é só a materialização dele para consulta.
 */

import { PrismaClient } from '@prisma/client';
import { FULL_CATALOG } from '@pece/core';

const prisma = new PrismaClient();

async function main() {
  console.log(`Sincronizando ${FULL_CATALOG.length} componentes...`);

  const batchSize = 50;
  for (let i = 0; i < FULL_CATALOG.length; i += batchSize) {
    const batch = FULL_CATALOG.slice(i, i + batchSize);
    await prisma.$transaction(
      batch.map((c) =>
        prisma.component.upsert({
          where: { id: c.id },
          create: {
            id: c.id,
            category: c.category,
            brand: c.brand,
            family: c.family,
            model: c.model,
            fullName: c.fullName,
            releaseYear: c.releaseYear,
            releaseQuarter: c.releaseQuarter,
            spec: c.spec as object,
            msrpUsd: c.msrpUsd,
            discontinued: c.discontinued,
            imageUrl: c.imageUrl,
          },
          update: {
            category: c.category,
            brand: c.brand,
            family: c.family,
            model: c.model,
            fullName: c.fullName,
            releaseYear: c.releaseYear,
            releaseQuarter: c.releaseQuarter,
            spec: c.spec as object,
            msrpUsd: c.msrpUsd,
            discontinued: c.discontinued,
          },
        }),
      ),
    );
    process.stdout.write(`  ${Math.min(i + batchSize, FULL_CATALOG.length)}/${FULL_CATALOG.length}\r`);
  }

  const counts = await prisma.component.groupBy({
    by: ['category'],
    _count: true,
    orderBy: { category: 'asc' },
  });

  console.log('\nCatálogo sincronizado:');
  for (const c of counts) console.log(`  ${c.category.padEnd(12)} ${c._count}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
