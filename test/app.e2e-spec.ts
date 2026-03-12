import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/database/prisma.service';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

type UserRecord = {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
};

type RefreshTokenRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

type ProductRecord = {
  id: string;
  name: string;
  description: string;
  price: Prisma.Decimal;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
};

class PrismaServiceMock {
  users: UserRecord[] = [];
  refreshTokens: RefreshTokenRecord[] = [];
  products: ProductRecord[] = [];

  user = {
    create: jest.fn(({ data }: { data: Omit<UserRecord, 'id' | 'createdAt' | 'updatedAt'> }) => {
      if (this.users.some((user) => user.email === data.email)) {
        const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '7.5.0',
        });
        throw error;
      }

      const user: UserRecord = {
        id: `user-${this.users.length + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      this.users.push(user);
      return Promise.resolve(user);
    }),
    findUnique: jest.fn(({ where }: { where: { id?: string; email?: string } }) => {
      if (where.id) {
        return Promise.resolve(this.users.find((user) => user.id === where.id) ?? null);
      }

      return Promise.resolve(this.users.find((user) => user.email === where.email) ?? null);
    }),
  };

  refreshToken = {
    create: jest.fn(({ data }: { data: Omit<RefreshTokenRecord, 'id' | 'createdAt' | 'updatedAt'> }) => {
      const token: RefreshTokenRecord = {
        id: `refresh-${this.refreshTokens.length + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      this.refreshTokens.push(token);
      return Promise.resolve(token);
    }),
    findFirst: jest.fn(({ where }: { where: { userId: string } }) => {
      const filtered = this.refreshTokens
        .filter((token) => token.userId === where.userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return Promise.resolve(filtered[0] ?? null);
    }),
    findMany: jest.fn(({ where }: { where: { userId: string } }) => {
      return Promise.resolve(this.refreshTokens.filter((token) => token.userId === where.userId));
    }),
    delete: jest.fn(({ where }: { where: { id: string } }) => {
      this.refreshTokens = this.refreshTokens.filter((token) => token.id !== where.id);
      return Promise.resolve(null);
    }),
  };

  product = {
    create: jest.fn(
      ({
        data,
        include,
      }: {
        data: { name: string; description: string; price: Prisma.Decimal; ownerId: string };
        include?: { owner?: { select: { username: true } } };
      }) => {
        const product: ProductRecord = {
          id: `product-${this.products.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        this.products.push(product);
        const owner = this.users.find((user) => user.id === data.ownerId);
        return Promise.resolve({
          ...product,
          ...(include?.owner ? { owner: { username: owner?.username ?? '' } } : {}),
        });
      },
    ),
    findMany: jest.fn(
      ({
        where,
      }: {
        where?: {
          name?: { contains: string; mode: 'insensitive' };
          description?: { contains: string; mode: 'insensitive' };
          price?: { gte?: Prisma.Decimal; lte?: Prisma.Decimal };
        };
      }) => {
        let results = [...this.products];

        if (where?.name) {
          const value = where.name.contains.toLowerCase();
          results = results.filter((product) => product.name.toLowerCase().includes(value));
        }

        if (where?.description) {
          const value = where.description.contains.toLowerCase();
          results = results.filter((product) =>
            product.description.toLowerCase().includes(value),
          );
        }

        if (where?.price?.gte) {
          results = results.filter((product) =>
            product.price.greaterThanOrEqualTo(where.price?.gte as Prisma.Decimal),
          );
        }

        if (where?.price?.lte) {
          results = results.filter((product) =>
            product.price.lessThanOrEqualTo(where.price?.lte as Prisma.Decimal),
          );
        }

        return Promise.resolve(
          results.map((product) => ({
            ...product,
            owner: {
              username:
                this.users.find((user) => user.id === product.ownerId)?.username ?? '',
            },
          })),
        );
      },
    ),
    findUnique: jest.fn(
      ({
        where,
      }: {
        where: { id: string };
      }) => {
        const product = this.products.find((item) => item.id === where.id);
        if (!product) {
          return Promise.resolve(null);
        }

        return Promise.resolve({
          ...product,
          owner: {
            username:
              this.users.find((user) => user.id === product.ownerId)?.username ?? '',
          },
        });
      },
    ),
    update: jest.fn(
      ({
        where,
        data,
      }: {
        where: { id: string };
        data: { name?: string; description?: string; price?: Prisma.Decimal };
      }) => {
        const index = this.products.findIndex((product) => product.id === where.id);
        const current = this.products[index];
        const updated: ProductRecord = {
          ...current,
          ...data,
          updatedAt: new Date(),
        };
        this.products[index] = updated;
        return Promise.resolve({
          ...updated,
          owner: {
            username:
              this.users.find((user) => user.id === updated.ownerId)?.username ?? '',
          },
        });
      },
    ),
    delete: jest.fn(({ where }: { where: { id: string } }) => {
      this.products = this.products.filter((product) => product.id !== where.id);
      return Promise.resolve(null);
    }),
  };
}

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let prismaMock: PrismaServiceMock;

  beforeEach(async () => {
    prismaMock = new PrismaServiceMock();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    jest.clearAllMocks();
  });

  it('registers, authenticates, refreshes and manages products end-to-end', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        username: 'leandro',
        email: 'leandro@example.com',
        password: 'StrongPassword123',
      })
      .expect(201);

    expect(registerResponse.body.user.email).toBe('leandro@example.com');
    expect(registerResponse.body.tokens.accessToken).toBeDefined();
    expect(registerResponse.body.tokens.refreshToken).toBeDefined();

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'leandro@example.com',
        password: 'StrongPassword123',
      })
      .expect(200);

    const accessToken = loginResponse.body.tokens.accessToken;
    const refreshToken = loginResponse.body.tokens.refreshToken;

    const createResponse = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Notebook Dell XPS 13',
        description: 'Notebook ultrafino com 16GB de RAM',
        price: 7999.9,
      })
      .expect(201);

    expect(createResponse.body.ownerUsername).toBe('leandro');

    await request(app.getHttpServer())
      .get('/api/products')
      .query({ name: 'notebook' })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
        expect(body[0].name).toContain('Notebook');
      });

    await request(app.getHttpServer())
      .patch(`/api/products/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        price: 7499.9,
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.price).toBe(7499.9);
      });

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(200)
      .expect(({ body }) => {
        expect(body.tokens.accessToken).toBeDefined();
      });

    await request(app.getHttpServer())
      .delete(`/api/products/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });

  it('rejects unauthorized product creation', async () => {
    await request(app.getHttpServer())
      .post('/api/products')
      .send({
        name: 'Mouse',
        description: 'Mouse sem fio ergonômico',
        price: 99.9,
      })
      .expect(401);
  });

  it('blocks deletion by a non-owner', async () => {
    const passwordHash = await bcrypt.hash('StrongPassword123', 10);
    prismaMock.users.push(
      {
        id: 'user-1',
        username: 'owner',
        email: 'owner@example.com',
        passwordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'user-2',
        username: 'other',
        email: 'other@example.com',
        passwordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );
    prismaMock.products.push({
      id: 'product-1',
      name: 'Teclado',
      description: 'Teclado mecânico',
      price: new Prisma.Decimal(350),
      ownerId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'other@example.com',
        password: 'StrongPassword123',
      })
      .expect(200);

    await request(app.getHttpServer())
      .delete('/api/products/product-1')
      .set('Authorization', `Bearer ${loginResponse.body.tokens.accessToken}`)
      .expect(403);
  });
});
