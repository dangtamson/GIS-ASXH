'use client'

import { useEffect } from "react"
import { useSystemConfigStore } from "@/context/systemConfigStore"

export default function DynamicFavicon() {
    const favicon = useSystemConfigStore(s => s.config?.general?.favicon)

    useEffect(() => {
        if (!favicon) return

        const href = favicon + `?v=${Date.now()}`

        // ❗ XÓA TOÀN BỘ favicon do Next inject
        const links = document.querySelectorAll("link[rel*='icon']")
        links.forEach(el => el.remove())

        const link = document.createElement("link")
        link.rel = "icon"
        link.href = href
        document.head.appendChild(link)

        const shortcut = document.createElement("link")
        shortcut.rel = "shortcut icon"
        shortcut.href = href
        document.head.appendChild(shortcut)

    }, [favicon])

    return null
}