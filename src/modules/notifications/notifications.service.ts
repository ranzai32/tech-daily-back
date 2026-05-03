import { Injectable } from '@nestjs/common';

export interface Notification {
  userId: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: Date;
}

@Injectable()
export class NotificationsService {
  private readonly store: Notification[] = [];

  async send(userId: string, message: string, type: string): Promise<void> {
    this.store.push({ userId, message, type, read: false, createdAt: new Date() });
  }

  async getByUser(userId: string): Promise<Notification[]> {
    return this.store.filter((n) => n.userId === userId);
  }

  async markRead(userId: string): Promise<void> {
    this.store
      .filter((n) => n.userId === userId)
      .forEach((n) => {
        n.read = true;
      });
  }
}
