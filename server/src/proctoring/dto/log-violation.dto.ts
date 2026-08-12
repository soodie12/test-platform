import { IsEnum, IsNumber, IsOptional, IsObject } from 'class-validator';
import { ProctoringEventType } from '../entities/proctoring-log.entity';

export class LogViolationDto {
  @IsNumber()
  examId!: number;

  @IsEnum(ProctoringEventType)
  eventType!: ProctoringEventType;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
