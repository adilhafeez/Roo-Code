import { useCallback, useState, useEffect, useRef } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import { archgwDefaultModelId, type OrganizationAllowList, type ProviderSettings } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"
import { RouterName } from "@roo/api"
import { ExtensionMessage } from "@roo/ExtensionMessage"

import { inputEventTransform } from "../transforms"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { Button } from "@src/components/ui"
import { vscode } from "@src/utils/vscode"
import { ModelPicker } from "../ModelPicker"

type ArchGwProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	organizationAllowList: OrganizationAllowList
}

export const ArchGw = ({ apiConfiguration, setApiConfigurationField, organizationAllowList }: ArchGwProps) => {
	const { t } = useAppTranslation()
	const { routerModels } = useExtensionState()
	const [refreshStatus, setRefreshStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
	const archGwErrorJustReceived = useRef(false)
	const [refreshError, setRefreshError] = useState<string | undefined>()

	useEffect(() => {
		const handleMessage = (event: MessageEvent<ExtensionMessage>) => {
			const message = event.data
			if (message.type === "singleRouterModelFetchResponse" && !message.success) {
				const providerName = message.values?.provider as RouterName
				if (providerName === "archgw") {
					archGwErrorJustReceived.current = true
					setRefreshStatus("error")
					setRefreshError(message.error)
				}
			} else if (message.type === "routerModels") {
				// If we were loading and no specific error for litellm was just received, mark as success.
				// The ModelPicker will show available models or "no models found".
				if (refreshStatus === "loading") {
					if (!archGwErrorJustReceived.current) {
						setRefreshStatus("success")
					}
					// If litellmErrorJustReceived.current is true, status is already (or will be) "error".
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [refreshStatus, refreshError, setRefreshStatus, setRefreshError])

	const handleInputChange = useCallback(
		<K extends keyof ProviderSettings, E>(
			field: K,
			transform: (event: E) => ProviderSettings[K] = inputEventTransform,
		) =>
			(event: E | Event) => {
				setApiConfigurationField(field, transform(event as E))
			},
		[setApiConfigurationField],
	)

	const handleRefreshModels = useCallback(() => {
		archGwErrorJustReceived.current = false // Reset flag on new refresh action
		setRefreshStatus("loading")
		setRefreshError(undefined)

		const key = apiConfiguration.archgwApiKey
		const url = apiConfiguration.archgwBaseUrl

		if (!key || !url) {
			setRefreshStatus("error")
			setRefreshError(t("settings:providers.refreshModels.missingConfig"))
			return
		}

		vscode.postMessage({ type: "requestRouterModels", values: { archgwApiKey: key, archgwBaseUrl: url } })
	}, [apiConfiguration, setRefreshStatus, setRefreshError, t])

	return (
		<>
			<VSCodeTextField
				value={apiConfiguration?.archgwBaseUrl || ""}
				onInput={handleInputChange("archgwBaseUrl")}
				placeholder={t("settings:placeholders.baseUrl")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.archgwBaseUrl")}</label>
			</VSCodeTextField>

			<VSCodeTextField
				value={apiConfiguration?.archgwApiKey || ""}
				type="password"
				onInput={handleInputChange("archgwApiKey")}
				placeholder={t("settings:placeholders.apiKey")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.archgwApiKey")}</label>
			</VSCodeTextField>

			<Button
				variant="outline"
				onClick={handleRefreshModels}
				disabled={
					refreshStatus === "loading" || !apiConfiguration.archgwApiKey || !apiConfiguration.archgwBaseUrl
				}
				className="w-full">
				<div className="flex items-center gap-2">
					{refreshStatus === "loading" ? (
						<span className="codicon codicon-loading codicon-modifier-spin" />
					) : (
						<span className="codicon codicon-refresh" />
					)}
					{t("settings:providers.refreshModels.label")}
				</div>
			</Button>
			{refreshStatus === "loading" && (
				<div className="text-sm text-vscode-descriptionForeground">
					{t("settings:providers.refreshModels.loading")}
				</div>
			)}
			{refreshStatus === "success" && (
				<div className="text-sm text-vscode-foreground">{t("settings:providers.refreshModels.success")}</div>
			)}
			{refreshStatus === "error" && (
				<div className="text-sm text-vscode-errorForeground">
					{refreshError || t("settings:providers.refreshModels.error")}
				</div>
			)}

			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>

			<ModelPicker
				apiConfiguration={apiConfiguration}
				defaultModelId={archgwDefaultModelId}
				models={routerModels?.archgw ?? {}}
				modelIdKey="archgwModelId"
				serviceName="ArchgwLLM"
				serviceUrl="https://archgw.com/"
				setApiConfigurationField={setApiConfigurationField}
				organizationAllowList={organizationAllowList}
			/>
		</>
	)
}
