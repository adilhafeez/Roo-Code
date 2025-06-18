import { useCallback, useState, useEffect, useRef } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { Checkbox } from "vscrui"

import {
	type ProviderSettings,
	type OrganizationAllowList,
	litellmDefaultModelId,
	archgwDefaultModelId,
} from "@roo-code/types"

import { RouterName } from "@roo/api"
import { ExtensionMessage } from "@roo/ExtensionMessage"

import { vscode } from "@src/utils/vscode"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/components/ui"

import { inputEventTransform } from "../transforms"
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
	const [refreshError, setRefreshError] = useState<string | undefined>()
	const archgwErrorJustReceived = useRef(false)

	const [archgwBaseUrlSelected, setArchgwBaseUrlSelected] = useState(!!apiConfiguration?.archgwBaseUrl)

	useEffect(() => {
		const handleMessage = (event: MessageEvent<ExtensionMessage>) => {
			const message = event.data
			if (message.type === "singleRouterModelFetchResponse" && !message.success) {
				const providerName = message.values?.provider as RouterName
				if (providerName === "archgw") {
					archgwErrorJustReceived.current = true
					setRefreshStatus("error")
					setRefreshError(message.error)
				}
			} else if (message.type === "routerModels") {
				// If we were loading and no specific error for archgw was just received, mark as success.
				// The ModelPicker will show available models or "no models found".
				if (refreshStatus === "loading") {
					if (!archgwErrorJustReceived.current) {
						setRefreshStatus("success")
					}
					// If archgwErrorJustReceived.current is true, status is already (or will be) "error".
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
		archgwErrorJustReceived.current = false // Reset flag on new refresh action
		setRefreshStatus("loading")
		setRefreshError(undefined)

		const url = apiConfiguration.archgwBaseUrl

		if (!url) {
			setRefreshStatus("error")
			setRefreshError(t("settings:providers.refreshModels.missingConfig"))
			return
		}
		vscode.postMessage({ type: "requestRouterModels", values: { archgwBaseUrl: url } })
	}, [apiConfiguration, setRefreshStatus, setRefreshError, t])

	return (
		<>
			<Checkbox
				checked={archgwBaseUrlSelected}
				onChange={(checked: boolean) => {
					setArchgwBaseUrlSelected(checked)

					if (!checked) {
						setApiConfigurationField("archgwBaseUrl", "")
					}
				}}>
				{t("settings:providers.useCustomBaseUrl")}
			</Checkbox>
			{archgwBaseUrlSelected && (
				<>
					<VSCodeTextField
						value={apiConfiguration?.archgwBaseUrl || ""}
						type="url"
						onInput={handleInputChange("archgwBaseUrl")}
						placeholder="http://localhost:12000/v1"
						className="w-full mt-1"
					/>
				</>
			)}

			<Button
				variant="outline"
				onClick={handleRefreshModels}
				disabled={refreshStatus === "loading" || !apiConfiguration.archgwBaseUrl}
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
			<ModelPicker
				apiConfiguration={apiConfiguration}
				defaultModelId={archgwDefaultModelId}
				models={routerModels?.archgw ?? {}}
				modelIdKey="archgwModelId"
				serviceName="Archgw"
				serviceUrl="https://archgw.com/"
				setApiConfigurationField={setApiConfigurationField}
				organizationAllowList={organizationAllowList}
			/>
		</>
	)
}
