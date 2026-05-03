import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConversionSignal } from './conversion-signal.entity';

@Injectable()
export class ConversionService {
  constructor(
    @InjectRepository(ConversionSignal)
    private readonly signalRepository: Repository<ConversionSignal>,
  ) {}

  async track(
    userId: string,
    event: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const signal = this.signalRepository.create({ userId, event, metadata });
    await this.signalRepository.save(signal);
  }

  async getByUser(userId: string): Promise<ConversionSignal[]> {
    return this.signalRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
}
