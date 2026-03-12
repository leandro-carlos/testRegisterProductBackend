import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'Notebook Dell XPS 13' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'Notebook ultrafino com 16GB RAM e SSD de 512GB' })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  description!: string;

  @ApiProperty({ example: 7999.9 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price!: number;
}
