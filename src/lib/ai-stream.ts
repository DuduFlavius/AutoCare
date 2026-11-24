/** Decode complete lines, even when a network packet splits a Unicode character. */
export async function* streamLines(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      const lines = (pending + decoder.decode(value, { stream: !done })).split('\n');
      pending = lines.pop() ?? '';
      if (pending.length > 1024 * 1024) throw Error('Stream frame too large');
      for (const line of lines) yield line.trimEnd();
      if (done) break;
    }
    if (pending.trim()) yield pending.trimEnd();
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
