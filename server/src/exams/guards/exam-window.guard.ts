import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { ExamsService } from '../exams.service';
import { Exam } from '../../entities/exam.entity';
import { User } from '../../entities/user.entity';

// JwtAuthGuard (which always runs before this guard via the @Auth() decorator)
// populates request.user from the JWT strategy's validate() return value.
interface RequestWithExam extends Request {
  user: User;
  exam?: Exam;
}

@Injectable()
export class ExamWindowGuard implements CanActivate {
  constructor(private readonly examsService: ExamsService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const request = ctx.switchToHttp().getRequest<RequestWithExam>();

    const paramExamId = request.params['examId'];
    if (!paramExamId) {
      throw new ForbiddenException('examId is required in the route');
    }

    const exam = await this.examsService.getById(
      parseInt(paramExamId as string, 10),
    );
    if (!exam.isActive) throw new ForbiddenException('Exam is not active');

    const now = new Date();
    if (exam.startTime && now < exam.startTime) {
      throw new ForbiddenException('Exam has not started yet');
    }

    const { user } = request;
    const enrollment = await this.examsService.getEnrollment(user.id, exam.id);
    if (!enrollment) {
      throw new ForbiddenException('You are not enrolled in this exam');
    }

    if (enrollment.hasExited) {
      throw new ForbiddenException(
        'Candidate has exited this exam and cannot re-enter unless granted by an administrator.',
      );
    }

    // Evaluate individual candidate allocated time (startedAt + durationMinutes + extraMinutes)
    const status = await this.examsService.getStatus(exam.id, user.id);
    if (status.examEndTime && now.getTime() > new Date(status.examEndTime).getTime()) {
      throw new ForbiddenException('Your allocated exam time has expired');
    }

    request.exam = exam;
    return true;
  }
}
