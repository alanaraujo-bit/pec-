import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';

import { prisma } from './db.ts';
import { authRoutes } from './routes/auth.ts';
import { catalogRoutes } from './routes/catalog.ts';
import { marketRoutes } from './routes/market.ts';
import { rigRoutes } from './routes/rigs.ts';
import { socialRoutes } from './routes/social.ts';
import { userRoutes } from './routes/users.ts';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('JWT_SECRET não definido. A API não sobe sem ele.');
  process.exit(1);
}
const jwtSecret: string = JWT_SECRET;

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      // Nunca logamos corpo de requisição: senhas e dados pessoais passam por aqui.
      redact: ['req.headers.authorization'],
    },
    trustProxy: true,
  });

  /**
   * Ações sem corpo (seguir, deixar de seguir, remover) chegam com content-type JSON e
   * corpo vazio — é o comportamento normal de qualquer cliente HTTP. O parser padrão do
   * Fastify devolve 400 nesse caso, o que quebraria a rota antes de ela ser executada.
   */
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    const raw = (body as string).trim();
    if (raw.length === 0) return done(null, undefined);
    try {
      done(null, JSON.parse(raw));
    } catch {
      done(Object.assign(new Error('JSON inválido.'), { statusCode: 400 }), undefined);
    }
  });

  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: jwtSecret, sign: { expiresIn: '30d' } });
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });

  app.get('/health', async () => {
    await prisma.$queryRaw`SELECT 1`;
    const components = await prisma.component.count();
    return { status: 'ok', components };
  });

  await app.register(authRoutes);
  await app.register(catalogRoutes);
  await app.register(rigRoutes);
  await app.register(marketRoutes);
  await app.register(socialRoutes);
  await app.register(userRoutes);

  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    request.log.error(error);
    const status = error.statusCode ?? 500;
    reply.code(status).send({
      error: status >= 500 ? 'internal' : 'request_error',
      // Erro interno nunca vaza detalhe para o cliente.
      message: status >= 500 ? 'Algo deu errado do nosso lado.' : error.message,
    });
  });

  return app;
}

const isMain = process.argv[1]?.endsWith('server.ts');

if (isMain) {
  const port = Number(process.env.PORT) || 3333;
  const app = await buildServer();

  try {
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`Pecê API ouvindo na porta ${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, async () => {
      await app.close();
      await prisma.$disconnect();
      process.exit(0);
    });
  }
}
