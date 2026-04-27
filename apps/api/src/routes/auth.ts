import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import type { JWTPayload } from '../middleware/auth.js';
import { authenticate } from '../middleware/auth.js';

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '8h';
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

function generateRefreshToken(): string {
  return randomBytes(40).toString('hex');
}

export async function authRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  // POST /auth — Login
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password } = request.body as { email: string; password: string };

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        lodgeAccess: { take: 1 },
      },
    });

    if (!user || !user.isActive) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const lodgeId = user.lodgeAccess[0]?.lodgeId;

    const tokenPayload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      lodgeId,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return reply.send({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        lodgeId,
        memberId: user.memberId,
      },
    });
  });

  // POST /auth/register — Register
  fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password, firstName, lastName, lodgeId } = request.body as {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      lodgeId?: string;
    };

    if (!email || !password || !firstName || !lastName) {
      return reply.status(400).send({ error: 'Email, password, firstName and lastName are required' });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return reply.status(409).send({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const result = await prisma.$transaction(async (tx) => {
      // Create member record if lodgeId provided
      let member = null;
      if (lodgeId) {
        // Verify lodge exists
        const lodge = await tx.lodge.findUnique({ where: { id: lodgeId } });
        if (!lodge) {
          throw new Error('Lodge not found');
        }

        member = await tx.member.create({
          data: {
            firstName,
            lastName,
            email: email.toLowerCase(),
            lodgeId,
          },
        });
      }

      const user = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          password: hashedPassword,
          role: 'MEMBER',
          memberId: member?.id,
        },
      });

      // Grant lodge access
      if (lodgeId) {
        await tx.userLodgeAccess.create({
          data: {
            userId: user.id,
            lodgeId,
            role: 'MEMBER',
          },
        });
      }

      return user;
    });

    return reply.status(201).send({
      id: result.id,
      email: result.email,
      role: result.role,
    });
  });

  // POST /auth/refresh — Refresh token
  fastify.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const { refreshToken } = request.body as { refreshToken: string };

    if (!refreshToken) {
      return reply.status(400).send({ error: 'Refresh token is required' });
    }

    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: {
        user: {
          include: { lodgeAccess: { take: 1 } },
        },
      },
    });

    if (!stored) {
      return reply.status(401).send({ error: 'Invalid refresh token' });
    }

    if (stored.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { id: stored.id } });
      return reply.status(401).send({ error: 'Refresh token expired' });
    }

    if (!stored.user.isActive) {
      return reply.status(401).send({ error: 'User account is disabled' });
    }

    // Revoke old token
    await prisma.refreshToken.delete({ where: { id: stored.id } });

    const lodgeId = stored.user.lodgeAccess[0]?.lodgeId;

    const tokenPayload: JWTPayload = {
      userId: stored.user.id,
      email: stored.user.email,
      role: stored.user.role,
      lodgeId,
    };

    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: stored.user.id,
        expiresAt,
      },
    });

    return reply.send({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  });

  // POST /auth/logout — Logout
  fastify.post('/logout', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { refreshToken } = request.body as { refreshToken?: string };

    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken, userId: request.user.userId },
      });
    } else {
      // Revoke all refresh tokens for this user
      await prisma.refreshToken.deleteMany({
        where: { userId: request.user.userId },
      });
    }

    return reply.send({ message: 'Logged out successfully' });
  });
}
