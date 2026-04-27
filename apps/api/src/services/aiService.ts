import { decrypt } from './encryptionService.js';

interface ChatMessage {
  role: string;
  content: string;
}

interface LodgeSettings {
  groqApiKey?: string;
  anthropicApiKey?: string;
}

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';

function resolveGroqKey(lodgeSettings?: LodgeSettings): string | undefined {
  if (lodgeSettings?.groqApiKey) {
    try {
      return decrypt(lodgeSettings.groqApiKey);
    } catch {
      return lodgeSettings.groqApiKey;
    }
  }
  return process.env.GROQ_API_KEY;
}

function resolveAnthropicKey(lodgeSettings?: LodgeSettings): string | undefined {
  if (lodgeSettings?.anthropicApiKey) {
    try {
      return decrypt(lodgeSettings.anthropicApiKey);
    } catch {
      return lodgeSettings.anthropicApiKey;
    }
  }
  return process.env.ANTHROPIC_API_KEY;
}

async function chatWithGroq(
  messages: ChatMessage[],
  apiKey: string,
): Promise<string> {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error (${response.status}): ${error}`);
  }

  const data = (await response.json()) as any;
  return data.choices?.[0]?.message?.content ?? '';
}

async function chatWithAnthropic(
  messages: ChatMessage[],
  apiKey: string,
): Promise<string> {
  const systemMessage = messages.find((m) => m.role === 'system');
  const nonSystemMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      ...(systemMessage && { system: systemMessage.content }),
      messages: nonSystemMessages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${error}`);
  }

  const data = (await response.json()) as any;
  return data.content?.[0]?.text ?? '';
}

export async function chat(
  messages: ChatMessage[],
  lodgeSettings?: LodgeSettings,
): Promise<string> {
  const groqKey = resolveGroqKey(lodgeSettings);
  if (groqKey) {
    try {
      return await chatWithGroq(messages, groqKey);
    } catch (error) {
      // Fall through to Anthropic
    }
  }

  const anthropicKey = resolveAnthropicKey(lodgeSettings);
  if (anthropicKey) {
    return await chatWithAnthropic(messages, anthropicKey);
  }

  throw new Error('No AI provider configured. Set GROQ_API_KEY or ANTHROPIC_API_KEY.');
}

export function streamChat(
  messages: ChatMessage[],
  lodgeSettings?: LodgeSettings,
): ReadableStream {
  const groqKey = resolveGroqKey(lodgeSettings);
  const anthropicKey = resolveAnthropicKey(lodgeSettings);

  return new ReadableStream({
    async start(controller) {
      try {
        if (groqKey) {
          const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${groqKey}`,
            },
            body: JSON.stringify({
              model: GROQ_MODEL,
              messages,
              temperature: 0.7,
              max_tokens: 4096,
              stream: true,
            }),
          });

          if (!response.ok) {
            throw new Error(`Groq streaming error (${response.status})`);
          }

          const reader = response.body?.getReader();
          if (!reader) throw new Error('No response body');

          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter((line) => line.startsWith('data: '));

            for (const line of lines) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data) as any;
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`));
                }
              } catch {
                // Skip malformed chunks
              }
            }
          }
        } else if (anthropicKey) {
          const systemMessage = messages.find((m) => m.role === 'system');
          const nonSystemMessages = messages
            .filter((m) => m.role !== 'system')
            .map((m) => ({
              role: m.role === 'assistant' ? 'assistant' : 'user',
              content: m.content,
            }));

          const response = await fetch(ANTHROPIC_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': anthropicKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: ANTHROPIC_MODEL,
              max_tokens: 4096,
              stream: true,
              ...(systemMessage && { system: systemMessage.content }),
              messages: nonSystemMessages,
            }),
          });

          if (!response.ok) {
            throw new Error(`Anthropic streaming error (${response.status})`);
          }

          const reader = response.body?.getReader();
          if (!reader) throw new Error('No response body');

          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter((line) => line.startsWith('data: '));

            for (const line of lines) {
              const data = line.slice(6);
              try {
                const parsed = JSON.parse(data) as any;
                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                  controller.enqueue(
                    new TextEncoder().encode(`data: ${JSON.stringify({ content: parsed.delta.text })}\n\n`),
                  );
                }
              } catch {
                // Skip malformed chunks
              }
            }
          }
        } else {
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ error: 'No AI provider configured' })}\n\n`,
            ),
          );
        }

        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify({ error: message })}\n\n`),
        );
        controller.close();
      }
    },
  });
}
