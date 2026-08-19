import { IsInt, IsString, IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateTestCaseStandaloneDto {
  @IsInt()
  problemId: number;

  @IsString()
  input: string;

  @IsString()
  expectedOutput: string;

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
