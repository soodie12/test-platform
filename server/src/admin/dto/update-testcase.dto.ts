import { IsString, IsBoolean, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateTestCaseStandaloneDto {
  @IsString()
  @IsOptional()
  input?: string;

  @IsString()
  @IsOptional()
  expectedOutput?: string;

  @IsBoolean()
  @IsOptional()
  isVisible?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  score?: number;

  @IsInt()
  @IsOptional()
  displayOrder?: number;
}
