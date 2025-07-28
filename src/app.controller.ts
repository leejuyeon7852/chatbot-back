import { Controller, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { ChatRequestDto } from './openai.dto';

@Controller('openai')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('/chat')
  async chat(@Body() body: ChatRequestDto) {
    const { prompt, timestamp } = body;
    if (!prompt || !timestamp) {
      return { success: false, message: 'prompt와 timestamp 값이 필요합니다.' };
    }
    const result = await this.appService.generateText(body);
    return { success: true, message: result };
  }

  @Post('/chat-rag')
  async chatRAG(@Body() body: ChatRequestDto) {
    const { prompt, timestamp } = body;
    if (!prompt || !timestamp) {
      return { success: false, message: 'prompt와 timestamp 값이 필요합니다.' };
    }
    const result = await this.appService.generateTextWithRAG(body);
    return { success: true, message: result };
  }

  @Post('/rag/init')
  async initializeRAG(@Body('directoryPath') directoryPath: string) {
    if (!directoryPath) {
      return { success: false, message: 'directoryPath 값이 필요합니다.' };
    }
    await this.appService.initializeRAGIndex(directoryPath);
    return { success: true, message: 'RAG 인덱스 초기화 완료' };
  }

  @Post('/rag/reset')
  async resetRAG(@Body('directoryPath') directoryPath: string) {
    if (!directoryPath) {
      return { success: false, message: 'directoryPath 값이 필요합니다.' };
    }
    await this.appService.resetRAGSystem(directoryPath);
    return { success: true, message: 'RAG 시스템 초기화 완료' };
  }
}
