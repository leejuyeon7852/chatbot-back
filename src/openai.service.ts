import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);

  async createChatCompletion(prompt: string): Promise<any> {
    const requestLog = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'OpenAI API 요청',
      service: OpenAIService.name,
      prompt,
    };
    this.logger.log(JSON.stringify(requestLog));

    const apiKey = process.env.OPENAI_API_KEY;
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const responseLog = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'OpenAI API 응답',
      service: OpenAIService.name,
      data: response.data,
    };
    this.logger.log(JSON.stringify(responseLog));

    return response.data;
  }
} 