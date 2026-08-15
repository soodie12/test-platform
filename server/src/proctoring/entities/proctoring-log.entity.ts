import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../entities/user.entity';

export enum ProctoringEventType {
  FULLSCREEN_EXIT = 'FULLSCREEN_EXIT',
  TAB_SWITCH = 'TAB_SWITCH',
  WINDOW_BLUR = 'WINDOW_BLUR',
}

@Entity('proctoring_logs')
@Index(['examId', 'userId'])
export class ProctoringLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id' })
  userId!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'exam_id' })
  examId!: number;

  @Column({
    type: 'enum',
    enum: ProctoringEventType,
    name: 'event_type',
  })
  eventType!: ProctoringEventType;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
