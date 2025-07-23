// Mocks must come first, before imports
vi.mock("axios")

import type { Mock } from "vitest"
import axios from "axios"
import { getArchGwModels } from "../archgw"
import { parseApiPrice } from "../../../../shared/cost"

const mockedAxios = axios as typeof axios & {
	get: Mock
	isAxiosError: Mock
}

describe("getArchGwModels", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("fetches and formats archgw models with all capabilities and prices", async () => {
		const mockResponse = {
			data: {
				data: [
					{
						id: "test-model-1",
						maxTokensOutput: 4096,
						maxTokensInput: 200000,
						capabilities: ["input:image", "computer_use", "caching"],
						pricePerToken: {
							input: "0.00001",
							output: "0.00002",
							cacheWrite: "0.00003",
							cacheRead: "0.00004",
						},
					},
					{
						id: "test-model-2",
						maxTokensOutput: 8192,
						maxTokensInput: 128000,
						capabilities: [],
						pricePerToken: {},
					},
				],
			},
		}

		mockedAxios.get.mockResolvedValue(mockResponse)

		const result = await getArchGwModels("http://localhost:5000")

		expect(mockedAxios.get).toHaveBeenCalledWith(
			"http://localhost:5000/v1/models",
			expect.objectContaining({
				headers: expect.objectContaining({
					"Content-Type": "application/json",
				}),
				timeout: 5000,
			}),
		)

		expect(result).toEqual({
			"test-model-1": {
				maxTokens: 4096,
				contextWindow: 200000,
				supportsImages: true,
				supportsComputerUse: true,
				supportsPromptCache: true,
				inputPrice: parseApiPrice("0.00001"),
				outputPrice: parseApiPrice("0.00002"),
				description: undefined,
				cacheWritesPrice: parseApiPrice("0.00003"),
				cacheReadsPrice: parseApiPrice("0.00004"),
			},
			"test-model-2": {
				maxTokens: 8192,
				contextWindow: 128000,
				supportsImages: false,
				supportsComputerUse: false,
				supportsPromptCache: false,
				inputPrice: parseApiPrice(undefined),
				outputPrice: parseApiPrice(undefined),
				description: undefined,
				cacheWritesPrice: parseApiPrice(undefined),
				cacheReadsPrice: parseApiPrice(undefined),
			},
		})
	})

	it("handles base URLs with trailing slashes", async () => {
		const mockResponse = { data: { data: [] } }
		mockedAxios.get.mockResolvedValue(mockResponse)

		await getArchGwModels("http://localhost:5000/")

		expect(mockedAxios.get).toHaveBeenCalledWith("http://localhost:5000/v1/models", expect.anything())
	})

	it("returns empty object when data array is empty", async () => {
		const mockResponse = { data: { data: [] } }
		mockedAxios.get.mockResolvedValue(mockResponse)

		const result = await getArchGwModels("http://localhost:5000")
		expect(result).toEqual({})
	})

	it("returns empty object and logs error for axios/network error", async () => {
		const axiosError = new Error("Network error")
		mockedAxios.get.mockRejectedValue(axiosError)

		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
		const result = await getArchGwModels("http://localhost:5000")
		expect(result).toEqual({})
		expect(consoleSpy).toHaveBeenCalled()
		consoleSpy.mockRestore()
	})

	it("uses timeout parameter in axios request", async () => {
		const mockResponse = { data: { data: [] } }
		mockedAxios.get.mockResolvedValue(mockResponse)

		await getArchGwModels("http://localhost:5000")

		expect(mockedAxios.get).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ timeout: 5000 }))
	})
})
