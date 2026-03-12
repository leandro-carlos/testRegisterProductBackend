import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({
    example: ['email must be an email'],
    required: false,
    type: [String],
  })
  errors?: string[];

  @ApiProperty({ example: 'Bad Request' })
  error!: string;

  @ApiProperty({ example: '2026-03-12T13:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: '/api/auth/register' })
  path!: string;
}
