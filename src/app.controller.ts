import { Controller, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { OpenAIService } from './openai.service';

class ChatRequestDto {
  prompt: string;
}

@Controller('openai')
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly openAIService: OpenAIService,
  ) {}

  @Post('/chat')
  async chat(@Body() body: ChatRequestDto) {
    const prompt = body.prompt;
    if (!prompt) {
      return { success: false, message: 'prompt 값이 필요합니다.' };
    }
    const result = await this.openAIService.createChatCompletion(prompt);
    const message = result.choices?.[0]?.message?.content || '';
    return { success: true, prompt: message };
  }
}
