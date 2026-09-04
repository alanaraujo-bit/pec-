/**
 * Autenticação.
 *
 * Hash com scrypt da biblioteca padrão do Node: é uma KDF adequada para senha
 * (memory-hard, com sal por usuário) e não arrasta dependência nativa, o que mantém
 * o build do container simples e reprodutível.
 */

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

const KEYLEN = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

/** `promisify` não resolve a sobrecarga de 4 argumentos do scrypt; envolvemos à mão. */
function deriveKey(password: string, salt: Buffer, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, SCRYPT_PARAMS, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await deriveKey(password, salt, KEYLEN);
  return `scrypt$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;

  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');
  const derived = await deriveKey(password, salt, expected.length);

  // Comparação em tempo constante: evita vazar informação pelo tempo de resposta.
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export interface AuthUser {
  id: string;
  handle: string;
}

/**
 * `@fastify/jwt` já declara `request.user`; aqui apenas dizemos qual é o formato do
 * nosso payload, em vez de declarar a propriedade de novo (o que colidiria).
 */
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthUser;
    user: AuthUser;
  }
}

/** Exige autenticação. Usado como preHandler nas rotas protegidas. */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({ error: 'unauthorized', message: 'Faça login para continuar.' });
  }
}

/**
 * Autenticação opcional: preenche `request.user` quando há token válido e segue adiante
 * quando não há. É o que permite o mesmo endpoint servir conteúdo público e
 * personalizado sem duplicar rota.
 */
export async function optionalAuth(request: FastifyRequest): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    // Sem token válido o visitante segue como anônimo — não é um erro.
  }
}
