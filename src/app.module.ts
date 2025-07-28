import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; // 추가
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OpenAIService } from './openai.service';

@Module({
  imports: [ConfigModule.forRoot()], // 추가
  controllers: [AppController],
  providers: [AppService, OpenAIService],
})
export class AppModule {}