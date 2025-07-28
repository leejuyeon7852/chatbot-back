import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { RedisService } from './infra/redis/redis.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ChatRequestDto } from './openai.dto';
@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  private readonly OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
  private readonly OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  constructor(private readonly redisService: RedisService) {
  }
  async generateText(chatRequestDto: ChatRequestDto): Promise<string> {
    this.logger.log(`Chat request received - Conversation ID: ${chatRequestDto.timestamp}`);
    
    try {
      // 대화 기록 가져오기
      const chatHistory = await this.getChatHistory(chatRequestDto.timestamp);
      this.logger.debug(`Retrieved chat history - Length: ${chatHistory.length}`);
      
      chatHistory.push({ role: 'user', content: chatRequestDto.prompt });

      const chatRequest = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          ...chatHistory
        ]
      };

      this.logger.debug('Sending request to OpenAI API');
      const response = await axios.post(
        this.OPENAI_API_URL,
        chatRequest,
        {
          headers: {
            'Authorization': `Bearer ${this.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = response.data.choices[0].message.content || '응답을 받지 못했습니다.';
      this.logger.debug(`Received response from OpenAI - Length: ${result.length}`);
      
      // AI 응답 저장
      chatHistory.push({ role: 'assistant', content: result });
      await this.saveChatHistory(chatRequestDto.timestamp, chatHistory);
      this.logger.debug(`Chat history saved - Conversation ID: ${chatRequestDto.timestamp}`);

      return result;
    } catch (error) {
      this.logger.error(JSON.stringify({
        event: 'OPENAI_API_ERROR',
        conversationId: chatRequestDto.timestamp,
        error: error.response?.data || error.message,
        timestamp: new Date().toISOString(),
        stack: error.stack
      }));
      throw new Error('텍스트 생성 중 오류가 발생했습니다.');
    }
  }

  async generateTextWithRAG(chatRequestDto: ChatRequestDto): Promise<string> {
    try {
      const questionEmbedding = await this.createEmbedding(chatRequestDto.prompt); // 사용자 질문에 대한 임베딩 생성
      const searchResults = await this.redisService.searchVector('my-tech-chatbot', questionEmbedding); // 벡터 검색 수행하고 나온 결과물이 텍스트 형태로 담긴
      const relevantDocs = searchResults.documents.map(doc => doc.value.text).join('\n'); // 관련 문서 컨텍스트 구성
      
      // 시스템 프롬프트에 관련 문서 정보 추가
      const systemPrompt = `${relevantDocs}\n\nYou are a helpful assistant. Please answer the question based on the information provided.`;
      this.logger.debug(`System prompt: ${systemPrompt}`);

      const chatRequest = {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: chatRequestDto.prompt }
        ]
      };

      this.logger.debug('Sending request to OpenAI API');
      const response = await axios.post(
        this.OPENAI_API_URL,
        chatRequest,
        {
          headers: {
            'Authorization': `Bearer ${this.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = response.data.choices[0].message.content || '응답을 받지 못했습니다.';
      this.logger.debug(`Received response from OpenAI - Length: ${result.length}`);

      return result;
    } catch (error) {
      this.logger.error('RAG 처리 중 오류 발생:', error);
      throw new Error('텍스트 생성 중 오류가 발생했습니다.');
    }
  }

  async initializeRAGIndex(directoryPath: string): Promise<void> {
    try {
      this.logger.log('RAG 인덱스 초기화 시작...');
      // 벡터 인덱스 생성
      await this.redisService.createVectorIndex('my-tech-chatbot');
      this.logger.log('벡터 인덱스 생성 완료');
      
      // 문서 로드 및 인덱싱
      await this.loadAndIndexDocuments(directoryPath);
      this.logger.log('문서 인덱싱 완료');
    } catch (error) {
      this.logger.error('RAG 초기화 중 오류 발생:', error);
      throw new Error('RAG 시스템 초기화 중 오류가 발생했습니다.');
    }
  }
  
  private async loadAndIndexDocuments(directoryPath: string): Promise<void> {
    try {
      // 디렉토리 내의 모든 파일 읽기
      const files = await fs.readdir(directoryPath);
      
      for (const file of files) {
        if (file.endsWith('.txt')) {
          const filePath = path.join(directoryPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          
          // 문서를 적절한 크기로 분할 (예: 1000자)
          const chunks = this.splitDocument(content, 600);
          
          for (const [index, chunk] of chunks.entries()) {
            if (!chunk) {
              this.logger.error(`loadAndIndexDocuments: chunk is undefined (file: ${file}, index: ${index})`);
              continue;
            }
            // 각 청크에 대한 임베딩 생성
            const embedding = await this.createEmbedding(chunk);
            
            // Redis에 저장
            const docKey = `doc:${path.basename(file, '.txt')}:${index}`;
            if (!docKey) {
              this.logger.error('addVectorData: docKey is undefined');
              continue;
            }
            if (!embedding) {
              this.logger.error('addVectorData: embedding is undefined');
              continue;
            }
            await this.redisService.addVectorData(docKey, embedding, chunk);
            
            this.logger.debug(`Indexed chunk ${index + 1}/${chunks.length} of ${file}`);
          }
        }
      }
    } catch (error) {
      this.logger.error('문서 인덱싱 중 오류 발생:', error);
      throw new Error('문서 인덱싱 중 오류가 발생했습니다.');
    }
  }

  private async createEmbedding(text: string): Promise<number[]> {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/embeddings',
        {
          input: text,
          model: 'text-embedding-ada-002'
        },
        {
          headers: {
            'Authorization': `Bearer ${this.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data.data[0].embedding;
    } catch (error) {
      this.logger.error('임베딩 생성 중 오류 발생:', error);
      throw new Error('임베딩 생성 중 오류가 발생했습니다.');
    }
  }

  private async getChatHistory(conversationId: string): Promise<Array<{ role: string; content: string }>> {
    this.logger.debug(`Fetching chat history - Conversation ID: ${conversationId}`);
    const history = await this.redisService.get(conversationId);
    if (!history) {
      this.logger.debug(`No existing chat history found for conversation ID: ${conversationId}`);
      return [];
    }
    const parsedHistory = JSON.parse(history);
    this.logger.debug(`Chat history retrieved - Messages count: ${parsedHistory.length}`);
    return parsedHistory;
  }

  private async saveChatHistory(conversationId: string, chatHistory: Array<{ role: string; content: string }>): Promise<void> {
    if (!conversationId) {
      this.logger.error('saveChatHistory: conversationId is undefined');
      throw new Error('conversationId is undefined');
    }
    if (!chatHistory) {
      this.logger.error('saveChatHistory: chatHistory is undefined');
      throw new Error('chatHistory is undefined');
    }
    await this.redisService.set(conversationId, JSON.stringify(chatHistory));
    this.logger.debug(`Chat history saved successfully - Conversation ID: ${conversationId}`);
  }

  private splitDocument(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    let currentChunk = '';
    
    // 문장 단위로 분할
    const sentences = text.split(/(?<=[.!?])\s+/);
    
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length <= chunkSize) {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        currentChunk = sentence;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }

  async resetRAGSystem(directoryPath: string): Promise<void> {
    try {
      this.logger.log('RAG 시스템 초기화 시작...');
      
      // 벡터 인덱스 초기화
      await this.redisService.resetVectorIndex('my-tech-chatbot');
      
      // 문서 다시 로드 및 인덱싱
      await this.loadAndIndexDocuments(directoryPath);
      
      this.logger.log('RAG 시스템 초기화 완료');
    } catch (error) {
      this.logger.error('RAG 시스템 초기화 중 오류 발생:', error);
      throw new Error('RAG 시스템 초기화 중 오류가 발생했습니다.');
    }
  }
}