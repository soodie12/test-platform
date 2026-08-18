import { Entity, Column, ManyToOne, Unique, CreateDateColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Exam } from './exam.entity';

@Entity('exam_enrollments')
@Unique(['userId', 'examId'])
export class ExamEnrollment extends BaseEntity {
  @Column()
  userId: number;

  @Column()
  examId: number;

  @CreateDateColumn({ type: 'timestamptz' })
  enrolledAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt?: Date | null;

  @Column({ type: 'boolean', default: false })
  hasExited: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  exitReason?: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Exam, { onDelete: 'CASCADE' })
  exam: Exam;
}
