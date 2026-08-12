import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProctoringLog } from './entities/proctoring-log.entity';
import { LogViolationDto } from './dto/log-violation.dto';

@Injectable()
export class ProctoringService {
  constructor(
    @InjectRepository(ProctoringLog)
    private readonly proctoringRepo: Repository<ProctoringLog>,
  ) {}

  async logViolation(userId: number, dto: LogViolationDto): Promise<ProctoringLog> {
    const log = this.proctoringRepo.create({
      userId,
      examId: dto.examId,
      eventType: dto.eventType,
      metadata: dto.metadata,
    });
    return this.proctoringRepo.save(log);
  }

  async getLogsByExam(examId: number): Promise<ProctoringLog[]> {
    return this.proctoringRepo.find({
      where: { examId },
      order: { createdAt: 'DESC' },
    });
  }

  async getLogsByUser(examId: number, userId: number): Promise<ProctoringLog[]> {
    return this.proctoringRepo.find({
      where: { examId, userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getViolationCountsByExam(examId: number): Promise<Record<number, number>> {
    const logs = await this.proctoringRepo
      .createQueryBuilder('log')
      .select('log.user_id', 'userId')
      .addSelect('COUNT(log.id)', 'count')
      .where('log.exam_id = :examId', { examId })
      .groupBy('log.user_id')
      .getRawMany<{ userId: number; count: string }>();

    const result: Record<number, number> = {};
    for (const item of logs) {
      result[item.userId] = parseInt(item.count, 10);
    }
    return result;
  }
}
