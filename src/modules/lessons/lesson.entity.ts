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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
