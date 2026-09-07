// Minimal Prisma Client wrapper for the services module
import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var __services_prisma: PrismaClient | undefined
}

export const prisma = global.__services_prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') global.__services_prisma = prisma
