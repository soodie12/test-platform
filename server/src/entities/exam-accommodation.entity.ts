import { Entity, Column, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Exam } from './exam.entity';

@Entity('exam_accommodations')
@Unique(['userId', 'examId'])
export class ExamAccommodation extends BaseEntity {
  @Column()
  userId: number;

  @Column()
  examId: number;

  @Column({ type: 'integer', default: 0 })
  extraMinutes: number;

  @Column({ type: 'varchar', nullable: true })
  reason?: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Exam, { onDelete: 'CASCADE' })
  exam: Exam;
}
