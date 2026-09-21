import { prisma } from '@/lib/prisma'

export async function resolveCollectorUserId(raw: unknown): Promise<number | null> {
  const id = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10)
  if (!Number.isFinite(id) || id <= 0) return null
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true },
  })
  return user ? user.id : null
}
