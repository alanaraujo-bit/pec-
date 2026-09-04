import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.ts';
import { hashPassword, requireAuth, verifyPassword } from '../auth.ts';
import { toUsageProfile } from '../mappers.ts';

const handleRule = z
  .string()
  .min(3, 'O @ precisa ter pelo menos 3 caracteres.')
  .max(20, 'O @ pode ter no máximo 20 caracteres.')
  .regex(/^[a-z0-9_]+$/, 'Use apenas letras minúsculas, números e underline.');

const registerBody = z.object({
  email: z.email('E-mail inválido.'),
  password: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.'),
  handle: handleRule,
  displayName: z.string().min(1).max(50),
  region: z.string().length(2).default('BR'),
});

const loginBody = z.object({
  email: z.email(),
  password: z.string(),
});

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register', async (request, reply) => {
    const parsed = registerBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'validation',
        message: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
      });
    }
    const { email, password, handle, displayName, region } = parsed.data;

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: email.toLowerCase() }, { handle }] },
      select: { email: true, handle: true },
    });
    if (existing) {
      return reply.code(409).send({
        error: 'conflict',
        message:
          existing.email === email.toLowerCase()
            ? 'Já existe uma conta com esse e-mail.'
            : 'Esse @ já está em uso.',
      });
    }

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash: await hashPassword(password),
        handle,
        displayName,
        region,
      },
    });

    const token = app.jwt.sign({ id: user.id, handle: user.handle });
    return reply.code(201).send({
      token,
      user: { id: user.id, handle: user.handle, displayName: user.displayName, region: user.region },
      /// Sem perfil ainda: o app leva direto para o onboarding.
      needsOnboarding: true,
    });
  });

  app.post('/auth/login', async (request, reply) => {
    const parsed = loginBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'validation', message: 'E-mail ou senha inválidos.' });
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
      include: { profile: true },
    });

    // Mensagem idêntica nos dois casos: não revelamos se o e-mail existe.
    const invalid = { error: 'unauthorized', message: 'E-mail ou senha incorretos.' };
    if (!user) {
      // Gasta o mesmo tempo de um hash real para não vazar existência pelo tempo.
      await hashPassword(parsed.data.password);
      return reply.code(401).send(invalid);
    }
    if (!(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return reply.code(401).send(invalid);
    }

    return reply.send({
      token: app.jwt.sign({ id: user.id, handle: user.handle }),
      user: { id: user.id, handle: user.handle, displayName: user.displayName, region: user.region },
      needsOnboarding: user.profile === null,
    });
  });

  app.get('/auth/me', { preHandler: requireAuth }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user!.id },
      include: { profile: true, _count: { select: { rigs: true, followers: true, following: true } } },
    });
    if (!user) return reply.code(404).send({ error: 'not_found' });

    return reply.send({
      id: user.id,
      handle: user.handle,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      region: user.region,
      profile: toUsageProfile(user.profile, user.region),
      needsOnboarding: user.profile === null,
      counts: user._count,
    });
  });
}
