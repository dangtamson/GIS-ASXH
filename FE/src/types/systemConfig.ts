// types/systemConfig.ts

export type SystemConfig = {
    workspaceId: string

    general: {
        locale: string
        address: string
        hotline: string
        website: string
        timezone: string
        shortName: string
        systemName: string
        supportEmail: string
        defaultFeatureId?: string | null
        favicon: {
            "uuid": string,
            "entityId": string,
            "fileName": string,
            "filePath": string,
            "fileSize": number,
            "mimeType": string,
            "createdAt": string,
            "deletedAt": null | string,
            "entityType": string,
            "uploadedBy": null | string
        } | string  | undefined | null
    }
    sso?: {
        enabled: boolean
        loginUrl: string
        loginParams: string
        redirectUri: string
        userInfoUrl: string
        accessTokenUrl: string
        emailExtension: string
        accessTokenParams: string
    } | undefined

    email?: {
        useSsl: boolean
        useTls: boolean
        replyTo: string
        password: string
        smtpHost: string
        smtpPort: string
        username: string
        senderName: string
        senderEmail: string
        allowInvalidCert: boolean
    } | undefined

    openaiConfig?: {
        enabled: boolean
        apiKey: string
        model: string
        baseUrl: string
        organizationId: string
        projectId: string
    } | undefined

    securityPolicy: {
        requireNumber: boolean
        requireLowercase: boolean
        requireUppercase: boolean
        requireSpecialChar: boolean

        minPasswordLength: number
        maxPasswordLength: number

        allowLoginAttempts: number
        warningLoginAttempts: number

        enableSecurityMode: boolean
        lockoutOnViolation: boolean

        passwordChangeDays: number
        passwordValidityDays: number

        sessionTimeoutMinutes: number
        sessionMaxTimeoutMinutes: number

        preventReuseOldPassword: boolean
        forceChangePasswordOnFirstLogin: boolean

        passwordImportDefault: string
    }
}
