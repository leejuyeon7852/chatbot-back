export interface ChatRequestDto {
  prompt: string;
}

export interface ChatResponseDto {
  success: boolean;
  message?: string;
  error?: string;
} 