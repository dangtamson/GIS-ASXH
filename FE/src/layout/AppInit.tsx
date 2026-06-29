'use client'

import {useEffect} from "react"
import {useSystemConfigStore} from "@/context/systemConfigStore";


export function AppInit() {
    const fetchConfig = useSystemConfigStore(s => s.fetchConfig)

    useEffect(() => {
        fetchConfig()
    }, [])

    return null
}