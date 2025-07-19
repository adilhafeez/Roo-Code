// npx vitest run src/api/providers/__tests__/archgw.spec.ts

import { Anthropic } from "@anthropic-ai/sdk"
import { ArchGwHandler } from "../archgw"
import { ApiHandlerOptions } from "../../../shared/api"

const mockCreate = vitest.fn()

vitest.mock("openai", () => {
	return {
		__esModule: true,
		default: vitest.fn().mockImplementation(() => ({
			chat: {
				completions: {
					create: mockCreate.mockImplementation((options) => {
						if (!options.stream) {
							return Promise.resolve({
								id: "test-completion",
								choices: [
									{
										message: { role: "assistant", content: "ArchGW response" },
										finish_reason: "stop",
										index: 0,
									},
								],
								usage: {
									prompt_tokens: 10,
									completion_tokens: 5,
									total_tokens: 15,
								},
							})
						}

						// Streaming: return an object with withResponse() method
						return {
							withResponse: () => ({
								data: {
									[Symbol.asyncIterator]: async function* () {
										yield {
											choices: [
												{
													delta: { content: "ArchGW stream" },
													index: 0,
												},
											],
											usage: null,
										}
										yield {
											choices: [
												{
													delta: {},
													index: 0,
												},
											],
											usage: {
												prompt_tokens: 10,
												completion_tokens: 5,
												total_tokens: 15,
											},
										}
									},
								},
							}),
						}
					}),
				},
			},
		})),
	}
})

describe("ArchGwHandler", () => {
	let handler: ArchGwHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		mockOptions = {
			archgwModelId: "arch-model",
			archgwBaseUrl: "http://localhost:12000/v1",
			archgwApiKey: "test-key",
			archgwPreferenceConfig: "test-pref",
		}
		handler = new ArchGwHandler(mockOptions)
		mockCreate.mockClear()
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(ArchGwHandler)
			expect(handler.preferenceConfig).toBe("test-pref")
		})

		it("should use default base URL if not provided", () => {
			const handlerWithoutUrl = new ArchGwHandler({
				archgwModelId: "arch-model",
				archgwApiKey: "test-key",
			})
			expect(handlerWithoutUrl).toBeInstanceOf(ArchGwHandler)
		})

		it("should not set preferenceConfig if not provided", () => {
			const handlerNoPref = new ArchGwHandler({
				archgwModelId: "arch-model",
				archgwApiKey: "test-key",
			})
			expect(handlerNoPref.preferenceConfig).toBeUndefined()
		})

		it("should set preferenceConfig to empty string if provided as empty", () => {
			const handlerEmptyPref = new ArchGwHandler({
				archgwModelId: "arch-model",
				archgwApiKey: "test-key",
				archgwPreferenceConfig: "",
			})
			expect(handlerEmptyPref.preferenceConfig).toBe("")
		})
	})

	describe("createMessage", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: "Hello!",
			},
		]

		it("should handle streaming responses", async () => {
			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.length).toBeGreaterThan(0)
			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toBe("ArchGW stream")
		})

		it("should handle API errors", async () => {
			mockCreate.mockImplementationOnce(() => ({
				withResponse: () => {
					throw new Error("API Error")
				},
			}))

			const stream = handler.createMessage(systemPrompt, messages)

			await expect(async () => {
				for await (const _chunk of stream) {
					// Should not reach here
				}
			}).rejects.toThrow("archgw streaming error: API Error")
		})
	})

	describe("completePrompt", () => {
		it("should complete prompt successfully", async () => {
			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("ArchGW response")
			expect(mockCreate).toHaveBeenCalledWith({
				model: mockOptions.archgwModelId,
				messages: [{ role: "user", content: "Test prompt" }],
				temperature: 0,
				max_tokens: 32768,
				metadata: { archgw_preference_config: "test-pref" },
			})
		})

		it("should not include archgw_preference_config in metadata if preferenceConfig is not set", async () => {
			const handlerNoPref = new ArchGwHandler({
				archgwModelId: "arch-model",
				archgwApiKey: "test-key",
			})
			mockCreate.mockClear()
			await handlerNoPref.completePrompt("Test prompt")
			const call = mockCreate.mock.calls[0][0]
			expect(call.metadata).toBeUndefined()
		})

		it("should include archgw_preference_config in metadata if preferenceConfig is empty string", async () => {
			const preferenceConfig = `- name: code generation
  model: gpt-4o-mini
  usage: generating new code snippets
- name: code understanding
  model: gpt-4.1
  usage: understand and explain existing code snippets
`
			const handlerEmptyPref = new ArchGwHandler({
				archgwModelId: "arch-modael",
				archgwApiKey: "test-key",
				archgwPreferenceConfig: preferenceConfig,
			})
			mockCreate.mockClear()
			await handlerEmptyPref.completePrompt("Test prompt")
			const call = mockCreate.mock.calls[0][0]
			expect(call.metadata).toEqual({ archgw_preference_config: preferenceConfig })
		})

		it("should handle API errors", async () => {
			mockCreate.mockRejectedValueOnce(new Error("API Error"))
			await expect(handler.completePrompt("Test prompt")).rejects.toThrow("archgw completion error: API Error")
		})

		it("should handle empty response", async () => {
			mockCreate.mockResolvedValueOnce({
				choices: [{ message: { content: "" } }],
			})
			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("")
		})
	})
})
