import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SkillLevel } from '../../common/enums/skill-level.enum';
import { Topic } from '../topics/topic.entity';
import { LessonInteractivePayload } from './lesson-interactive.types';

@Entity('lessons')
export class Lesson {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'title', length: 512 })
  title: string;

  @Column({ name: 'content', type: 'text' })
  content: string;

  @Column({ name: 'why_it_matters', type: 'text', nullable: true })
  whyItMatters: string | null;

  @Column({ name: 'topic_id', type: 'uuid' })
  topicId: string;

  @ManyToOne(() => Topic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'topic_id' })
  topic: Topic;

  @Column({ name: 'source_url', length: 2048, nullable: true })
  sourceUrl: string | null;

  @Column({ name: 'source_urls', type: 'jsonb', nullable: true })
  sourceUrls: string[] | null;

  @Column({
    name: 'difficulty',
    type: 'enum',
    enum: SkillLevel,
    default: SkillLevel.Intermediate,
  })
  difficulty: SkillLevel;

  @Column({ name: 'estimated_minutes', default: 5 })
  estimatedMinutes: number;

  @Column({ name: 'is_published', default: false })
  isPublished: boolean;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ name: 'curated_for_user_id', type: 'uuid', nullable: true })
  curatedForUserId: string | null;

  @Column({ name: 'flashcards_payload', type: 'jsonb', nullable: true })
  flashcardsPayload: { question: string; answer: string }[] | null;

  @Column({ name: 'interactive_payload', type: 'jsonb', nullable: true })
  interactivePayload: LessonInteractivePayload | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
