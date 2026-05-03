import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConversionService } from './conversion.service';
import { ConversionSignal } from './conversion-signal.entity';
import { User } from '../users/user.entity';
import { UserStreak } from '../streaks/streak.entity';
import { UserLesson } from '../lessons/user-lesson.entity';
import { Bookmark } from '../bookmarks/bookmark.entity';

describe('ConversionService.predictConversion', () => {
  let service: ConversionService;

  const repoMock = () => ({
    create: jest.fn((x) => x),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversionService,
        { provide: getRepositoryToken(ConversionSignal), useValue: repoMock() },
        { provide: getRepositoryToken(User), useValue: repoMock() },
        { provide: getRepositoryToken(UserStreak), useValue: repoMock() },
        { provide: getRepositoryToken(UserLesson), useValue: repoMock() },
        { provide: getRepositoryToken(Bookmark), useValue: repoMock() },
      ],
    }).compile();
    service = module.get(ConversionService);
  });

  it('Lab4 precision sample: TP=8 FP=4 FN=6 TN=12 => precision 0.667', () => {
    const precision = service.calculatePrecision(8, 4);
    expect(precision).toBeCloseTo(0.667, 3);
  });

  it('triggers prompt when score >= 0.65 and no prompt in 14d', async () => {
    jest.spyOn(service, 'updateSignals').mockResolvedValue({
      streak_score: 4,
      overload_score: 3,
      session_freq: 4,
      bookmarks_count: 4,
    });
    jest.spyOn(service as any, 'getLastPromptedAt').mockResolvedValue(null);
    jest.spyOn(service, 'track').mockResolvedValue();

    const out = await service.predictConversion('u-1');
    expect(out.score).toBeCloseTo(0.8, 2);
    expect(out.trigger_prompt).toBe(true);
  });
});
