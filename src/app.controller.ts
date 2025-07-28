import { Controller, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { ChatRequestDto, ChatResponseDto } from './openai.dto';

@Controller('openai')
export class AppController {
  constructor(private readonly appService: AppService) {}

  async onModuleInit() {
    const ragDirectory = 'src/rag';
    await this.appService.initializeRAGIndex(ragDirectory);
  }

  @Post('chat')
  async chat(@Body() chatRequest: ChatRequestDto): Promise<ChatResponseDto> {
    try {
      const response = await this.appService.generateText(chatRequest);
      return { success: true, message: response };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  @Post('rag')
  async generateTextWithRAG(@Body() chatRequestBody: ChatRequestDto): Promise<ChatResponseDto> {
    const answer = await this.appService.generateTextWithRAG(chatRequestBody);
    const response: ChatResponseDto = { success: true, message: answer };
    return response;
  }

  @Post('reset-rag')
  async resetRAG() {
    const ragDirectory = 'src/rag';
    await this.appService.resetRAGSystem(ragDirectory);
    return { message: 'RAG 시스템이 성공적으로 초기화되었습니다.' };
  }
}