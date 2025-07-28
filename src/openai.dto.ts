export interface ChatRequestDto {
  prompt: string;
  timestamp: string;
}

export interface ChatResponseDto {
  success: boolean;
  message?: string;
  error?: string;
} 