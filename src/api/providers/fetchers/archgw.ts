import axios from "axios"

import type { ModelInfo } from "@roo-code/types"

import { parseApiPrice } from "../../../shared/cost"

export async function getArchGwModels(apiKey: string, baseUrl: string): Promise<Record<string, ModelInfo>> {
	const models: Record<string, ModelInfo> = {}

	console.log("Fetching archgw models...")

	try {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		}

		if (apiKey) {
			headers["Authorization"] = `Bearer ${apiKey}`
		}

		const url = new URL("/v1/models", baseUrl).href
		const response = await axios.get(url, { headers, timeout: 5000 })
		const rawModels = response.data

		for (const rawModel of rawModels.data) {
			const modelInfo: ModelInfo = {
				maxTokens: rawModel.maxTokensOutput,
				contextWindow: rawModel.maxTokensInput,
				supportsImages: rawModel.capabilities?.includes("input:image"),
				supportsComputerUse: rawModel.capabilities?.includes("computer_use"),
				supportsPromptCache: rawModel.capabilities?.includes("caching"),
				inputPrice: parseApiPrice(rawModel.pricePerToken?.input),
				outputPrice: parseApiPrice(rawModel.pricePerToken?.output),
				description: undefined,
				cacheWritesPrice: parseApiPrice(rawModel.pricePerToken?.cacheWrite),
				cacheReadsPrice: parseApiPrice(rawModel.pricePerToken?.cacheRead),
			}

			switch (rawModel.id) {
				case rawModel.id.startsWith("anthropic/"):
					modelInfo.maxTokens = 8192
					break
				default:
					break
			}

			models[rawModel.id] = modelInfo
		}
	} catch (error) {
		console.error(`Error fetching archgw models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)
	}

	console.log("Fetched archgw models:", models)

	return models
}
