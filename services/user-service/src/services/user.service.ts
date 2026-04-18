import { prisma } from '@penyzen/database';
import { NotFoundError } from '@penyzen/shared';
import type { UpdateUserInput } from '../schemas/user.schema';

export async function getUserByCognitoId(cognitoId: string) {
  const user = await prisma.user.findUnique({
    where: { cognitoId },
    select: {
      id: true,
      cognitoId: true,
      email: true,
      name: true,
      avatarUrl: true,
      bio: true,
      role: true,
      kycStatus: true,
      stripeAccountId: true,
      createdAt: true,
    },
  });
  if (!user) throw new NotFoundError('User');
  return user;
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      bio: true,
      role: true,
      kycStatus: true,
      createdAt: true,
      // Public profile — deliberately excludes email, cognitoId, stripe IDs
    },
  });
  if (!user) throw new NotFoundError('User', id);
  return user;
}

export async function updateUser(cognitoId: string, input: UpdateUserInput) {
  const user = await prisma.user.findUnique({ where: { cognitoId } });
  if (!user) throw new NotFoundError('User');

  return prisma.user.update({
    where: { cognitoId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.bio !== undefined && { bio: input.bio }),
      ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
    },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      bio: true,
      role: true,
      kycStatus: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}
