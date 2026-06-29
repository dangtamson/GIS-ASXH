'use client'

import { Empty } from 'antd'

export default function AppEmpty() {
    return (
        <div className="flex items-center justify-center h-full w-full">
            <Empty
                image="/images/icons/empty.png"
                description="Không có dữ liệu"
                className={'w-30 opacity-70'}
            />
        </div>
    )
}