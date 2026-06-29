'use client'

import {ConfigProvider, Empty} from 'antd'
import {AppSpinner} from '@/components/app/AppSpinner'

export default function AppProvider({ children }: { children: React.ReactNode }) {
    return (
        <ConfigProvider
            spin={{
                indicator: <AppSpinner />
            }}
            renderEmpty={() => (
                <div className="flex items-center justify-center h-full w-full">
                <Empty
                    image="/images/icons/empty.png"
                    description="Không có dữ liệu"
                    className={'w-24 opacity-70'}
                />
                </div>
            )}
            theme={{
                token: {
                  colorPrimary: '#dc2626'
                },
                components: {
                    Form: {
                        itemMarginBottom: 0
                    },
                    Checkbox:{
                        colorPrimary: '#dc2626',
                        colorPrimaryHover: '#dc2626',
                    }
                }
            }}
        >
                {children}
        </ConfigProvider>
    )
}