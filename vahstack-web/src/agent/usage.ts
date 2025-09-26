export class Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;

  constructor(init?: Partial<Usage>) {
    this.promptTokens = init?.promptTokens ?? 0;
    this.completionTokens = init?.completionTokens ?? 0;
    this.totalTokens = init?.totalTokens ?? 0;
  }

  static empty(): Usage {
    return new Usage();
  }

  static fromApiResponse(usage: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  }): Usage {
    const promptTokens = Number.isNaN(usage?.prompt_tokens)
      ? 0
      : (usage?.prompt_tokens ?? 0);
    const completionTokens = Number.isNaN(usage?.completion_tokens)
      ? 0
      : (usage?.completion_tokens ?? 0);
    const totalTokens = usage?.total_tokens ?? promptTokens + completionTokens;

    return new Usage({
      promptTokens,
      completionTokens,
      totalTokens,
    });
  }

  add(other: Usage): void {
    this.promptTokens += other.promptTokens;
    this.completionTokens += other.completionTokens;
    this.totalTokens += other.totalTokens;
  }

  reset(): void {
    this.promptTokens = 0;
    this.completionTokens = 0;
    this.totalTokens = 0;
  }

  clone(): Usage {
    return new Usage({
      promptTokens: this.promptTokens,
      completionTokens: this.completionTokens,
      totalTokens: this.totalTokens,
    });
  }

  isValid(): boolean {
    return (
      this.promptTokens >= 0 &&
      this.completionTokens >= 0 &&
      this.totalTokens >= 0
    );
  }
}
