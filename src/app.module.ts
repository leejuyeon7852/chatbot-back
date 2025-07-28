import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; // 추가
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { redisConfig } from './infra/redis/redis.config';
import { RedisModule } from './infra/redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [() => redisConfig] }),
    RedisModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}