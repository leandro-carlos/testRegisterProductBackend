import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { FilterProductsDto } from './dto/filter-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        name: dto.name,
        description: dto.description,
        price: new Prisma.Decimal(dto.price),
        ownerId,
      },
      include: {
        owner: {
          select: {
            username: true,
          },
        },
      },
    });
  }

  async findAll(filters: FilterProductsDto) {
    return this.prisma.product.findMany({
      where: {
        ...(filters.name
          ? {
              name: {
                contains: filters.name,
                mode: 'insensitive',
              },
            }
          : {}),
        ...(filters.description
          ? {
              description: {
                contains: filters.description,
                mode: 'insensitive',
              },
            }
          : {}),
        ...(filters.minPrice !== undefined || filters.maxPrice !== undefined
          ? {
              price: {
                ...(filters.minPrice !== undefined
                  ? { gte: new Prisma.Decimal(filters.minPrice) }
                  : {}),
                ...(filters.maxPrice !== undefined
                  ? { lte: new Prisma.Decimal(filters.maxPrice) }
                  : {}),
              },
            }
          : {}),
      },
      include: {
        owner: {
          select: {
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            username: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async update(id: string, ownerId: string, dto: UpdateProductDto) {
    const product = await this.findOne(id);

    if (product.ownerId !== ownerId) {
      throw new ForbiddenException('You can only update your own products');
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.price !== undefined
          ? { price: new Prisma.Decimal(dto.price) }
          : {}),
      },
      include: {
        owner: {
          select: {
            username: true,
          },
        },
      },
    });
  }

  async remove(id: string, ownerId: string) {
    const product = await this.findOne(id);

    if (product.ownerId !== ownerId) {
      throw new ForbiddenException('You can only delete your own products');
    }

    await this.prisma.product.delete({
      where: { id },
    });
  }
}
