import { prisma } from '@penyzen/database';
import { ConflictError, ForbiddenError, NotFoundError } from '@penyzen/shared';
import type { CreateOrgInput, UpdateOrgInput, AddMemberInput } from '../schemas/org.schema';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base);
  let attempt = 0;
  while (true) {
    const candidate = attempt === 0 ? slug : `${slug}-${attempt}`;
    const existing = await prisma.organization.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
    attempt++;
  }
}

export async function createOrg(cognitoId: string, input: CreateOrgInput) {
  const user = await prisma.user.findUnique({ where: { cognitoId } });
  if (!user) throw new NotFoundError('User');

  if (input.ein) {
    const einExists = await prisma.organization.findFirst({ where: { ein: input.ein } });
    if (einExists) throw new ConflictError('An organization with this EIN already exists');
  }

  const slug = await uniqueSlug(input.name);

  return prisma.organization.create({
    data: {
      name: input.name,
      slug,
      description: input.description,
      websiteUrl: input.websiteUrl,
      ein: input.ein,
      members: {
        create: { userId: user.id, role: 'OWNER' },
      },
    },
    include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
  });
}

export async function getOrg(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      },
    },
  });
  if (!org) throw new NotFoundError('Organization', orgId);
  return org;
}

export async function updateOrg(cognitoId: string, orgId: string, input: UpdateOrgInput) {
  await requireOrgRole(cognitoId, orgId, ['OWNER', 'ADMIN']);
  return prisma.organization.update({
    where: { id: orgId },
    data: input,
  });
}

export async function addMember(cognitoId: string, orgId: string, input: AddMemberInput) {
  await requireOrgRole(cognitoId, orgId, ['OWNER', 'ADMIN']);

  const targetUser = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!targetUser) throw new NotFoundError('User', input.userId);

  const existing = await prisma.orgMember.findUnique({
    where: { userId_organizationId: { userId: input.userId, organizationId: orgId } },
  });
  if (existing) throw new ConflictError('User is already a member of this organization');

  return prisma.orgMember.create({
    data: { userId: input.userId, organizationId: orgId, role: input.role },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}

export async function removeMember(cognitoId: string, orgId: string, targetUserId: string) {
  const caller = await prisma.user.findUnique({ where: { cognitoId } });
  if (!caller) throw new NotFoundError('User');

  const callerMember = await prisma.orgMember.findUnique({
    where: { userId_organizationId: { userId: caller.id, organizationId: orgId } },
  });

  const targetMember = await prisma.orgMember.findUnique({
    where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
  });

  if (!targetMember) throw new NotFoundError('Member', targetUserId);

  // OWNER can remove anyone; ADMIN can remove MEMBERs only; others cannot remove
  const canRemove =
    callerMember?.role === 'OWNER' ||
    (callerMember?.role === 'ADMIN' && targetMember.role === 'MEMBER') ||
    caller.id === targetUserId; // users can always remove themselves

  if (!canRemove) throw new ForbiddenError('You cannot remove this member');
  if (targetMember.role === 'OWNER' && caller.id !== targetUserId) {
    throw new ForbiddenError('Cannot remove the organization owner');
  }

  await prisma.orgMember.delete({
    where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
  });

  return { removed: true };
}

export async function listMyOrgs(cognitoId: string) {
  const user = await prisma.user.findUnique({ where: { cognitoId } });
  if (!user) throw new NotFoundError('User');

  return prisma.orgMember.findMany({
    where: { userId: user.id },
    include: {
      organization: {
        select: { id: true, name: true, slug: true, logoUrl: true, isVerified: true },
      },
    },
  });
}

async function requireOrgRole(
  cognitoId: string,
  orgId: string,
  roles: string[],
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { cognitoId } });
  if (!user) throw new NotFoundError('User');

  const membership = await prisma.orgMember.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
  });

  if (!membership || !roles.includes(membership.role)) {
    throw new ForbiddenError('Insufficient organization permissions');
  }
}
