import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Lesson } from '../lessons/lesson.entity';

@Entity('flashcards')
export class Flashcard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'lesson_id', type: 'uuid' })
  lessonId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Lesson, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id' })
  lesson: Lesson;

  @Column({ name: 'question', type: 'text' })
  question: string;

  @Column({ name: 'answer', type: 'text' })
  answer: string;

  @Column({ name: 'next_review_at', type: 'timestamptz', nullable: true })
  nextReviewAt: Date | null;

  @Column({ name: 'interval', default: 1 })
  interval: number;

  @Column({ name: 'ease_factor', type: 'float', default: 2.5 })
  easeFactor: number;

  @Column({ name: 'repetitions', default: 0 })
  repetitions: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
