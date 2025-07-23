import type { ModelInfo } from "../model.js"

export const archgwDefaultModelId = "openai/gpt-4.1"

export const archgwDefaultModelInfo: ModelInfo = {
	maxTokens: 32_768,
	contextWindow: 1_047_576,
	supportsImages: true,
	supportsPromptCache: true,
	inputPrice: 2,
	outputPrice: 8,
	cacheReadsPrice: 0.5,
}
