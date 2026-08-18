import { IsInt, Min, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAccommodationDto {
  @Type(() => Number)
  @IsInt()
  userId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  extraMinutes: number;

  @IsString()
  @IsOptional()
  reason?: string;
}
