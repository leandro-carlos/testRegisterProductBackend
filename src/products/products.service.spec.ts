import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ProductsService } from './products.service';
import { createProductEntity } from '../../test/helpers';

describe('ProductsService', () => {
  let service: ProductsService;
  let prismaService: {
    product: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(() => {
    prismaService = {
      product: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    service = new ProductsService(prismaService as unknown as PrismaService);
  });

  it('creates a product with owner relation', async () => {
    const product = createProductEntity();
    prismaService.product.create.mockResolvedValue(product);

    const result = await service.create('user-1', {
      name: 'Notebook Dell XPS 13',
      description: 'Notebook ultrafino com 16GB de RAM',
      price: 7999.9,
    });

    expect(prismaService.product.create).toHaveBeenCalled();
    expect(result.owner.username).toBe('leandro');
  });

  it('throws when product is not found', async () => {
    prismaService.product.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('prevents updating product from another owner', async () => {
    prismaService.product.findUnique.mockResolvedValue(createProductEntity());

    await expect(
      service.update('product-1', 'user-2', { name: 'Outro nome' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('removes a product owned by the authenticated user', async () => {
    prismaService.product.findUnique.mockResolvedValue(createProductEntity());
    prismaService.product.delete.mockResolvedValue(createProductEntity());

    await service.remove('product-1', 'user-1');

    expect(prismaService.product.delete).toHaveBeenCalledWith({
      where: { id: 'product-1' },
    });
  });
});
