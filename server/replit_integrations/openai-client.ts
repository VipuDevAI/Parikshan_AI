import OpenAI from "openai";
import { decrypt, isEncrypted } from "../utils/encryption";

let globalClient: OpenAI | null = null;

export function getGlobalOpenAIClient(): OpenAI | null {
  if (globalClient) return globalClient;
  
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }
  
  globalClient = new OpenAI({
    apiKey,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
  
  return globalClient;
}

export function createOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1",
  });
}

export function getSchoolOpenAIClient(schoolApiKey: string | null | undefined): OpenAI | null {
  if (schoolApiKey) {
    let decryptedKey = schoolApiKey;
    if (isEncrypted(schoolApiKey)) {
      try {
        decryptedKey = decrypt(schoolApiKey);
      } catch {
        console.error("Failed to decrypt school API key");
        return getGlobalOpenAIClient();
      }
    }
    return createOpenAIClient(decryptedKey);
  }
  return getGlobalOpenAIClient();
}

export class AINotConfiguredError extends Error {
  constructor() {
    super("AI features are not configured. Please add your OpenAI API key in Settings.");
    this.name = "AINotConfiguredError";
  }
}
