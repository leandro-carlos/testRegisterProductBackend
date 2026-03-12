import { Prisma } from '@prisma/client';

export function createProductEntity(overrides: Record<string, unknown> = {}) {
  return {
    id: 'product-1',
    name: 'Notebook Dell XPS 13',
    description: 'Notebook ultrafino com 16GB de RAM',
    price: new Prisma.Decimal(7999.9),
    ownerId: 'user-1',
    owner: {
      username: 'leandro',
    },
    createdAt: new Date('2026-03-12T13:00:00.000Z'),
    updatedAt: new Date('2026-03-12T13:00:00.000Z'),
    ...overrides,
  };
}

export function createUserEntity(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    username: 'leandro',
    email: 'leandro@example.com',
    passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
    createdAt: new Date('2026-03-12T13:00:00.000Z'),
    updatedAt: new Date('2026-03-12T13:00:00.000Z'),
    ...overrides,
  };
}
