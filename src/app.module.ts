import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { LessonsModule } from './modules/lessons/lessons.module';
import { TopicsModule } from './modules/topics/topics.module';
import { StreaksModule } from './modules/streaks/streaks.module';
import { BookmarksModule } from './modules/bookmarks/bookmarks.module';
import { FlashcardsModule } from './modules/flashcards/flashcards.module';
import { AiPipelineModule } from './modules/ai-pipeline/ai-pipeline.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ConversionModule } from './modules/conversion/conversion.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const nodeEnv = process.env.NODE_ENV ?? 'development';
        const isProd = nodeEnv === 'production';
        const isTest = nodeEnv === 'test';
        // synchronize + Postgres enums often breaks (e.g. skill_level_enum_old still referenced).
        // E2e and CI should use an existing schema from migrations, not live sync.
        return {
          type: 'postgres',
          url: process.env.DATABASE_URL,
          autoLoadEntities: true,
          synchronize: !isProd && !isTest,
          migrations: [join(__dirname, 'migrations', '*.js')],
          migrationsRun: isProd,
        };
      },
    }),
    BullModule.forRootAsync({
      useFactory: () => ({
        redis: process.env.REDIS_URL,
      }),
    }),
    AuthModule,
    UsersModule,
    LessonsModule,
    TopicsModule,
    StreaksModule,
    BookmarksModule,
    FlashcardsModule,
    AiPipelineModule,
    NotificationsModule,
    ConversionModule,
  ],
})
export class AppModule {}
