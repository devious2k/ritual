import type { PrismaClient } from '@prisma/client';

interface CreateAuditLogParams {
  action: string;
  entity: string;
  entityId?: string;
  details?: any;
  userId: string;
  lodgeId?: string;
  ipAddress?: string;
}

export async function createAuditLog(
  prisma: PrismaClient,
  params: CreateAuditLogParams,
) {
  return prisma.auditLog.create({
    data: {
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      details: params.details ?? undefined,
      userId: params.userId,
      lodgeId: params.lodgeId,
      ipAddress: params.ipAddress,
    },
  });
}
