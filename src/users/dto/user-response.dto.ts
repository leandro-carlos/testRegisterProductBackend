import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ example: 'bf1d9f20-8f33-4a3e-93f7-7bfdcb0a5817' })
  id!: string;

  @ApiProperty({ example: 'leandro' })
  username!: string;

  @ApiProperty({ example: 'leandro@example.com' })
  email!: string;

  @ApiProperty({ example: '2026-03-12T13:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-03-12T13:00:00.000Z' })
  updatedAt!: Date;
}
