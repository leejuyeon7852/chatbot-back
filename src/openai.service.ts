import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosError } from 'axios';

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

    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new HttpException('OpenAI API 키가 설정되지 않았습니다.', HttpStatus.INTERNAL_SERVER_ERROR);
      }

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
          timeout: 30000, // 30초 타임아웃
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
    } catch (error) {
      const errorLog = {
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'OpenAI API 에러',
        service: OpenAIService.name,
        prompt,
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
      };
      this.logger.error(JSON.stringify(errorLog));

      if (error instanceof AxiosError) {
        // 네트워크 에러 처리
        if (error.code === 'ECONNABORTED') {
          throw new HttpException('요청 시간이 초과되었습니다.', HttpStatus.REQUEST_TIMEOUT);
        }
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
          throw new HttpException('OpenAI 서버에 연결할 수 없습니다.', HttpStatus.SERVICE_UNAVAILABLE);
        }
        if (error.response?.status === 401) {
          throw new HttpException('OpenAI API 키가 유효하지 않습니다.', HttpStatus.UNAUTHORIZED);
        }
        if (error.response?.status === 429) {
          throw new HttpException('OpenAI API 요청 한도를 초과했습니다.', HttpStatus.TOO_MANY_REQUESTS);
        }
        if (error.response?.status && error.response.status >= 500) {
          throw new HttpException('OpenAI 서버 오류가 발생했습니다.', HttpStatus.BAD_GATEWAY);
        }
        throw new HttpException(
          `OpenAI API 오류: ${error.response?.data?.error?.message || error.message}`,
          error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      // 기타 에러
      throw new HttpException(
        `서버 내부 오류: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
} 