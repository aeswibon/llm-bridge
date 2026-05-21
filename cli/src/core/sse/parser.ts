export interface SSEEvent {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

export async function* parseSSE(
  stream: ReadableStream<Uint8Array>,
): AsyncIterable<SSEEvent> {
  const decoder = new TextDecoder();
  const reader = stream.getReader();

  let buffer = '';
  let eventId: string | undefined;
  let eventType: string | undefined;
  let eventData = '';
  let retryMs: number | undefined;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let lineEnd = buffer.indexOf('\n');
      while (lineEnd !== -1) {
        const line = buffer.slice(0, lineEnd).trimEnd();
        buffer = buffer.slice(lineEnd + 1);

        if (line.startsWith(':')) {
          // Comment line, skip
        } else if (line === '') {
          // Empty line = event boundary
          if (eventData || eventType || eventId) {
            yield {
              id: eventId,
              event: eventType,
              data: eventData,
              retry: retryMs,
            };
            eventId = undefined;
            eventType = undefined;
            eventData = '';
          }
        } else {
          const colonIndex = line.indexOf(':');
          const field = colonIndex === -1 ? line : line.slice(0, colonIndex);
          const value = colonIndex === -1 ? '' : line.slice(colonIndex + 1).trimStart();

          switch (field) {
            case 'id':
              eventId = value;
              break;
            case 'event':
              eventType = value;
              break;
            case 'data':
              eventData = eventData ? eventData + '\n' + value : value;
              break;
            case 'retry': {
              const parsed = parseInt(value, 10);
              if (!isNaN(parsed)) retryMs = parsed;
              break;
            }
          }
        }

        lineEnd = buffer.indexOf('\n');
      }
    }

    // Flush remaining buffer
    if (buffer.trim()) {
      const line = buffer.trim();
      if (line.startsWith(':')) {
        // Comment, skip
      } else if (line === '') {
        if (eventData || eventType || eventId) {
          yield { id: eventId, event: eventType, data: eventData, retry: retryMs };
        }
      } else {
        const colonIndex = line.indexOf(':');
        const field = colonIndex === -1 ? line : line.slice(0, colonIndex);
        const value = colonIndex === -1 ? '' : line.slice(colonIndex + 1).trimStart();
        switch (field) {
          case 'id': eventId = value; break;
          case 'event': eventType = value; break;
          case 'data': eventData = eventData ? eventData + '\n' + value : value; break;
          case 'retry': {
            const parsed = parseInt(value, 10);
            if (!isNaN(parsed)) retryMs = parsed;
            break;
          }
        }
        if (eventData || eventType || eventId) {
          yield { id: eventId, event: eventType, data: eventData, retry: retryMs };
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
