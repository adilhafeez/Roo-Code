import OpenAI from "openai"
import { Anthropic } from "@anthropic-ai/sdk" // Keep for type usage only

import { archgwDefaultModelId, archgwDefaultModelInfo } from "@roo-code/types"

import { calculateApiCostOpenAI } from "../../shared/cost"

import { ApiHandlerOptions } from "../../shared/api"

import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { convertToOpenAiMessages } from "../transform/openai-format"

import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { RouterProvider } from "./router-provider"

/**
 * ArchGw provider handler
 *
 * This handler uses the ArchGw API to proxy requests to various LLM providers.
 * It follows the OpenAI API format for compatibility.
 */
export class ArchGwHandler extends RouterProvider implements SingleCompletionHandler {
	preferenceConfig?: string // Declare the property
	archgwUsePreferences: boolean

	constructor(options: ApiHandlerOptions) {
		console.log("ArchGwHandler constructor called with options:", options)
		super({
			options,
			name: "archgw",
			baseURL: options.archgwBaseUrl || "http://localhost:12000/v1",
			apiKey: options.archgwApiKey,
			modelId: options.archgwModelId,
			defaultModelId: options.archgwModelId || archgwDefaultModelId,
			defaultModelInfo: archgwDefaultModelInfo,
		})
		this.preferenceConfig = options.archgwPreferenceConfig // Store the new parameter
		this.archgwUsePreferences = options.archgwUsePreferences || false // Store the preference flag
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { id: modelId, info } = await this.fetchModel()

		const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...convertToOpenAiMessages(messages),
		]

		// Required by some providers; others default to max tokens allowed
		let maxTokens: number | undefined = info.maxTokens ?? undefined

		const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model: modelId,
			max_tokens: maxTokens,
			messages: openAiMessages,
			stream: true,
			stream_options: {
				include_usage: true,
			},
		}

		if (this.archgwUsePreferences && this.preferenceConfig) {
			if (!requestOptions.metadata) {
				requestOptions.metadata = {}
			}
			requestOptions.metadata["archgw_preference_config"] = this.preferenceConfig
		}

		if (this.supportsTemperature(modelId)) {
			requestOptions.temperature = this.options.modelTemperature ?? 0
		}

		try {
			const { data: completion } = await this.client.chat.completions.create(requestOptions).withResponse()

			let lastUsage

			for await (const chunk of completion) {
				const delta = chunk.choices[0]?.delta
				const usage = chunk.usage as ArchgwUsage

				if (delta?.content) {
					yield { type: "text", text: delta.content }
				}

				if (usage) {
					lastUsage = usage
				}
			}

			if (lastUsage) {
				const usageData: ApiStreamUsageChunk = {
					type: "usage",
					inputTokens: lastUsage.prompt_tokens || 0,
					outputTokens: lastUsage.completion_tokens || 0,
					cacheWriteTokens: lastUsage.cache_creation_input_tokens || 0,
					cacheReadTokens: lastUsage.prompt_tokens_details?.cached_tokens || 0,
				}

				usageData.totalCost = calculateApiCostOpenAI(
					info,
					usageData.inputTokens,
					usageData.outputTokens,
					usageData.cacheWriteTokens,
					usageData.cacheReadTokens,
				)

				yield usageData
			}
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`archgw streaming error: ${error.message}`)
			}
			throw error
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		const { id: modelId, info } = await this.fetchModel()

		try {
			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
				model: modelId,
				messages: [{ role: "user", content: prompt }],
			}

			if (this.supportsTemperature(modelId)) {
				requestOptions.temperature = this.options.modelTemperature ?? 0
			}

			requestOptions.max_tokens = info.maxTokens

			if (this.preferenceConfig) {
				if (!requestOptions.metadata) {
					requestOptions.metadata = {}
				}
				requestOptions.metadata["archgw_preference_config"] = this.preferenceConfig
			}

			const response = await this.client.chat.completions.create(requestOptions)
			return response.choices[0]?.message.content || ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`archgw completion error: ${error.message}`)
			}
			throw error
		}
	}
}

// archgw usage may include an extra field for Anthropic use cases.
interface ArchgwUsage extends OpenAI.CompletionUsage {
	cache_creation_input_tokens?: number
}
