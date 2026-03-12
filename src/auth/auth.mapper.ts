import { Product, User } from '@prisma/client';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { ProductResponseDto } from '../products/dto/product-response.dto';

export function toUserResponseDto(user: User): UserResponseDto {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function toProductResponseDto(
  product: Product & { owner?: { username: string } | null },
): ProductResponseDto {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: Number(product.price),
    ownerId: product.ownerId,
    ownerUsername: product.owner?.username,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}
