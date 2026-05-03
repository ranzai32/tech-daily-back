import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let usersRepo: jest.Mocked<Pick<Repository<User>, 'find' | 'update'>>;

  beforeEach(async () => {
    usersRepo = {
      find: jest.fn(),
      update: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(User), useValue: usersRepo },
      ],
    }).compile();
    service = module.get(NotificationsService);
  });

  it('daily frequency selects users every day at matching time', async () => {
    usersRepo.find.mockResolvedValue([
      {
        id: 'u1',
        fcmToken: 't1',
        notificationFrequency: 'daily',
      } as User,
    ]);
    const out = await service.getUsersForNotificationTick(
      new Date(Date.UTC(2026, 4, 5, 9, 0)),
    );
    expect(out).toEqual([{ userId: 'u1', fcmToken: 't1' }]);
  });

  it('3x_week selects only Mon/Wed/Fri', async () => {
    usersRepo.find.mockResolvedValue([
      {
        id: 'u2',
        fcmToken: 't2',
        notificationFrequency: '3x_week',
      } as User,
    ]);
    const wed = new Date(Date.UTC(2026, 4, 6, 9, 0)); // Wednesday
    const tue = new Date(Date.UTC(2026, 4, 5, 9, 0)); // Tuesday
    expect(await service.getUsersForNotificationTick(wed)).toHaveLength(1);
    expect(await service.getUsersForNotificationTick(tue)).toHaveLength(0);
  });

  it('weekly selects only on Monday', async () => {
    usersRepo.find.mockResolvedValue([
      {
        id: 'u3',
        fcmToken: 't3',
        notificationFrequency: 'weekly',
      } as User,
    ]);
    const mon = new Date(Date.UTC(2026, 4, 4, 9, 0));
    const sun = new Date(Date.UTC(2026, 4, 10, 9, 0));
    expect(await service.getUsersForNotificationTick(mon)).toHaveLength(1);
    expect(await service.getUsersForNotificationTick(sun)).toHaveLength(0);
  });

  it('filters out users with empty token or off frequency', async () => {
    usersRepo.find.mockResolvedValue([
      { id: 'u4', fcmToken: null, notificationFrequency: 'daily' } as User,
      { id: 'u5', fcmToken: 'x', notificationFrequency: 'off' } as User,
      { id: 'u6', fcmToken: 'ok', notificationFrequency: 'daily' } as User,
    ]);
    const out = await service.getUsersForNotificationTick(
      new Date(Date.UTC(2026, 4, 5, 9, 0)),
    );
    expect(out).toEqual([{ userId: 'u6', fcmToken: 'ok' }]);
  });
});
