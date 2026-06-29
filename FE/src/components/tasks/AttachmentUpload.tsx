'use client'

import React, { useEffect, useRef, useState } from "react";
import { Upload, Trash2 } from "lucide-react";
import { FileUploadType } from "@/types/api";

type InternalAttachment = {
    _id: string;
    fileName: string;
    file?: File;
    uuid?: string;
};

type Props = {
    title: string;
    initialAttachments?: FileUploadType[];
    onChangeAction?: (list: InternalAttachment[]) => void;
    error?: string;
    cardClass?: string;
    headerClass?: string;
};

export default function AttachmentUpload({
                                             title,
                                             initialAttachments = [],
                                             onChangeAction,
                                             error,
                                             cardClass,
                                             headerClass,
                                         }: Props) {

    const inputRef = useRef<HTMLInputElement>(null);

    const [attachments, setAttachments] =
        useState<InternalAttachment[]>(() =>
            initialAttachments.map((f) => ({
                _id: f.uuid,
                uuid: f.uuid,
                fileName: f.fileName,
            }))
        );



    // ✅ trả ra ngoài
    useEffect(() => {
        onChangeAction?.(attachments);
    }, [attachments, onChangeAction]);



    // ✅ chọn file mới
    const handleSelect = (files: FileList) => {

        const arr: InternalAttachment[] =
            Array.from(files).map(f => ({
                _id: crypto.randomUUID(),
                fileName: f.name,
                file: f,
            }));

        setAttachments(prev => [...prev, ...arr]);
    };



    // ✅ xoá file
    const handleRemove = (id: string) => {

        setAttachments(prev =>
            prev.filter(a => a._id !== id)
        );
    };



    return (
        <div className={cardClass}>

            <div className={headerClass}>
                {title}
            </div>


            {/* input */}
            <input
                ref={inputRef}
                type="file"
                multiple
                style={{
                    display: 'none'
                }}
                className="hidden"
                onChange={(e) => {
                    if (e.target.files) {
                        handleSelect(e.target.files);
                    }
                }}
            />


            {/* button */}
            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="
                    mt-4 flex w-full flex-col items-center justify-center
                    rounded-xl border border-dashed border-gray-300
                    bg-gray-50 py-8 text-sm text-[#dc2626]
                    hover:bg-gray-100
                    dark:border-gray-700
                    dark:bg-gray-800
                "
            >
                <Upload className="mb-2 h-5 w-5" />

                Kéo thả hoặc bấm để tải file lên
            </button>



            {/* list */}
            {attachments.length > 0 && (

                <div className="mt-3 space-y-2">

                    {attachments.map(a => (

                        <div
                            key={a._id}
                            className="
                                flex items-center justify-between
                                rounded border border-gray-200
                                bg-white p-3
                                dark:border-gray-700
                                dark:bg-gray-800
                            "
                        >

                            <div className="text-sm text-gray-700 dark:text-gray-200">
                                {a.fileName}
                            </div>


                            <button
                                type="button"
                                onClick={() => handleRemove(a._id)}
                                className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                <Trash2 className="h-4 w-4 text-red-600" />
                            </button>

                        </div>

                    ))}

                </div>

            )}



            {error && (
                <p className="mt-2 text-xs text-red-600">
                    {error}
                </p>
            )}

        </div>
    );
}
