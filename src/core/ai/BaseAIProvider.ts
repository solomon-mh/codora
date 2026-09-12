/**
 * Shared "remember the last raw response" behavior for AIProvider
 * implementations, so a validation failure can be diagnosed (what did the
 * model actually say?) instead of just reported as "invalid response".
 */
export abstract class BaseAIProvider {
  private lastRawResponse: string | undefined;

  protected recordRawResponse(text: string | undefined): void {
    this.lastRawResponse = text;
  }

  getLastRawResponsePreview(): string | undefined {
    if (!this.lastRawResponse) return undefined;
    const trimmed = this.lastRawResponse.trim();
    if (!trimmed) return undefined;
    return trimmed.length > 200 ? `${trimmed.slice(0, 200)}…` : trimmed;
  }
}
