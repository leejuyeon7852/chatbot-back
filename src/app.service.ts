import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  getHello(): string {
    const logData = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'getHello called',
      service: AppService.name,
    };
    this.logger.log(JSON.stringify(logData));
    return 'Hello World!';
  }
}
