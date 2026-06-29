"use client"

import { useEffect } from "react"
import { useSystemConfigStore } from "@/context/systemConfigStore"

export function useSystemConfig() {
    const store = useSystemConfigStore()

    useEffect(() => {
        void store.fetchConfig()
    }, [])

    return store
}