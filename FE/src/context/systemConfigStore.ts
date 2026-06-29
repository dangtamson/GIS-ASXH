import { create } from "zustand"
import type { SystemConfig } from "@/types/systemConfig"
import { api } from "@/lib/api"
import { ApiResponse } from "@/types/api"
import { endpoints } from "@/lib/endpoints"
import { notification } from "antd"

type State = {
    config: SystemConfig | null
    loading: boolean
    error: string | null

    fetchConfig: () => Promise<void>
    clear: () => void
}

export const useSystemConfigStore = create<State>((set, get) => ({
    config: null,
    loading: false,
    error: null,

    fetchConfig: async () => {
        const { config, loading } = get()

        if (config || loading) return

        try {
            set({ loading: true, error: null })

            const res = await api.get<ApiResponse<SystemConfig>>(endpoints.admin.systemConfig)

            if (!res.item) {
                set({
                    error: "Không có dữ liệu cấu hình",
                    loading: false,
                })
                return
            }

            const item = res.item

            let favicon: string | null = null

            const rawFavicon = item.general.favicon

            if (typeof rawFavicon === "string") {
                favicon = rawFavicon
            }
            else if (rawFavicon?.uuid) {
                try {
                    const resPreview = await api.get<{ previewUrl?: string }>(
                        `/content/files/${rawFavicon.uuid}/preview`,
                    )

                    favicon = resPreview?.previewUrl || null
                } catch {
                    notification.error({ title: "Không tải được favicon" })
                    favicon = "/favicon.ico" // ✅
                }
            }
            set({
                config: {
                    ...item,
                    general: {
                        ...item.general,
                        favicon, // ✅ luôn là string | null
                    },
                },
                loading: false,
            })
        } catch (err) {
            set({
                error: "Lấy cấu hình thất bại",
                loading: false,
            })
        }
    },

    clear: () =>
        set({
            config: null,
            loading: false,
            error: null,
        }),
}))