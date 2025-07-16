import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { ArchGw } from "../ArchGw"

describe("ArchGw - archgwPreferenceConfig YAML validation", () => {
	const baseProps = {
		apiConfiguration: {
			archgwPreferenceConfig: "",
			archgwUsePreferences: true,
			archgwBaseUrl: "",
		},
		setApiConfigurationField: vi.fn(),
		organizationAllowList: {
			allowAll: true,
			providers: {},
		},
	}

	function setup(props = {}) {
		return render(<ArchGw {...baseProps} {...props} />)
	}

	it("accepts valid YAML and calls setApiConfigurationField", () => {
		const setApiConfigurationField = vi.fn()
		setup({ setApiConfigurationField })

		// Enable the preferences checkbox if not already enabled
		const checkbox = screen.getByLabelText(/usePreferenceModel1/i) as HTMLInputElement
		if (!checkbox.checked) {
			fireEvent.click(checkbox)
		}

		const textarea = screen.getByRole("textbox")
		fireEvent.input(textarea, { target: { value: "foo: bar\nbaz: 1" } })

		expect(setApiConfigurationField).toHaveBeenCalledWith("archgwPreferenceConfig", "foo: bar\nbaz: 1")
		expect(screen.queryByText(/yaml/i)).not.toBeInTheDocument()
	})

	it("shows error and does not call setApiConfigurationField for invalid YAML", () => {
		const setApiConfigurationField = vi.fn()
		setup({ setApiConfigurationField })

		// Enable the preferences checkbox if not already enabled
		const checkbox = screen.getByLabelText(/usePreferenceModel1/i) as HTMLInputElement
		if (!checkbox.checked) {
			fireEvent.click(checkbox)
		}

		const textarea = screen.getByRole("textbox")
		fireEvent.input(textarea, { target: { value: "foo: [bar" } })

		expect(screen.getByText(/yaml/i)).toBeInTheDocument()
		// Should not call with the invalid value
		expect(setApiConfigurationField).not.toHaveBeenCalledWith("archgwPreferenceConfig", "foo: [bar")
	})

	it("shows schema error for non-array YAML", () => {
		const setApiConfigurationField = vi.fn()
		setup({ setApiConfigurationField })

		const checkbox = screen.getByLabelText(/usePreferenceModel1/i) as HTMLInputElement
		if (!checkbox.checked) {
			fireEvent.click(checkbox)
		}

		const textarea = screen.getByRole("textbox")
		fireEvent.input(textarea, { target: { value: "foo: bar" } })

		expect(screen.getByText(/YAML must be a list of objects/i)).toBeInTheDocument()
		expect(setApiConfigurationField).not.toHaveBeenCalledWith("archgwPreferenceConfig", "foo: bar")
	})

	it("shows schema error for array items missing model or usage", () => {
		const setApiConfigurationField = vi.fn()
		setup({ setApiConfigurationField })

		const checkbox = screen.getByLabelText(/usePreferenceModel1/i) as HTMLInputElement
		if (!checkbox.checked) {
			fireEvent.click(checkbox)
		}

		const textarea = screen.getByRole("textbox")
		// Missing 'usage'
		fireEvent.input(textarea, { target: { value: "- model: openai/gpt-4o" } })

		expect(screen.getByText(/Each item must have 'model' and 'usage'/i)).toBeInTheDocument()
		expect(setApiConfigurationField).not.toHaveBeenCalledWith("archgwPreferenceConfig", "- model: openai/gpt-4o")
	})
})
