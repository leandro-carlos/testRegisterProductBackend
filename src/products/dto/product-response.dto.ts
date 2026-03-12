import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProductResponseDto {
  @ApiProperty({ example: 'f577f0d8-b54e-4543-bdda-9e5b1f0b98a9' })
  id!: string;

  @ApiProperty({ example: 'Notebook Dell XPS 13' })
  name!: string;

  @ApiProperty({ example: 'Notebook ultrafino com 16GB RAM e SSD de 512GB' })
  description!: string;

  @ApiProperty({ example: 7999.9 })
  price!: number;

  @ApiProperty({ example: 'bf1d9f20-8f33-4a3e-93f7-7bfdcb0a5817' })
  ownerId!: string;

  @ApiPropertyOptional({ example: 'leandro' })
  ownerUsername?: string;

  @ApiProperty({ example: '2026-03-12T13:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-03-12T13:00:00.000Z' })
  updatedAt!: Date;
}
