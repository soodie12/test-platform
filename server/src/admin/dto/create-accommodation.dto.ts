import { IsInt, Min, IsString, IsOptional } from 'class-validator';

export class CreateAccommodationDto {
  @IsInt()
  userId: number;

  @IsInt()
  @Min(1)
  extraMinutes: number;

  @IsString()
  @IsOptional()
  reason?: string;
}
