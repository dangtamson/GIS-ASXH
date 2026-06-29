'use client';

import React, { ChangeEvent, useEffect, useRef, useState } from "react";
import { Avatar, Modal, notification } from "antd";
import { Upload, Eye, Delete } from "lucide-react";
import { api } from "@/lib/api";

export interface AttachmentType {
    id: string;
    uuid?: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    fileContentBase64: string;
}

interface Props {
    value?: AttachmentType | null;
    onChange?: (file: AttachmentType | null) => void;
    size?: number;
    readOnly?: boolean;
}

const maxSize = 5 * 1024 * 1024; // 5MB

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result || "");
            resolve(result.split(",")[1] || "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

export default function AvatarUploadField({
                                              value,
                                              onChange,
                                              size = 80,
                                              readOnly = false,
                                          }: Props) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [imageSrc, setImageSrc] = useState<string>("");

    // 🔥 FIX: xử lý async ở đây, không làm trong render
    useEffect(() => {
        const loadImage = async () => {
            if (!value) {
                setImageSrc("");
                return;
            }

            // ảnh mới (base64)
            if (value.fileContentBase64) {
                setImageSrc(`data:${value.mimeType};base64,${value.fileContentBase64}`);
                return;
            }

            // ảnh từ server
            if (value.uuid) {
                try {
                    const res = await api.get<{ previewUrl?: string }>(
                        `/content/files/${value.uuid}/preview?expiresIn=300`
                    );
                    setImageSrc(res?.previewUrl || "");
                } catch {
                    notification.error({ title: "Không tải được ảnh" });
                    setImageSrc("");
                }
            }
        };

        loadImage();
    }, [value]);

    const handleSelect = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            notification.error({ message: "Chỉ chọn file ảnh" });
            return;
        }

        if (file.size > maxSize) {
            notification.error({ message: "Ảnh tối đa 5MB" });
            return;
        }

        const base64 = await fileToBase64(file);

        const newFile: AttachmentType = {
            id: `${Date.now()}`,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            fileContentBase64: base64,
        };

        onChange?.(newFile);
        e.target.value = "";
    };

    const handleRemove = () => {
        onChange?.(null);
    };

    return (
        <div className="flex items-center gap-3">
            <div
                className="relative cursor-pointer group"
                style={{ width: size, height: size }}
                onClick={() => !readOnly && inputRef.current?.click()}
            >
                <Avatar
                    src={imageSrc ? imageSrc : undefined}
                    size={size}
                    style={{ backgroundColor: "#f0f0f0" }}
                />

                {!readOnly && (
                    <div className="absolute inset-0 hidden items-center justify-center bg-black/40 text-white group-hover:flex">
                        <Upload size={18} />
                    </div>
                )}
            </div>

            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                style={{ display: "none" }}
                onChange={handleSelect}
            />

            {value && (
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setPreviewOpen(true)}
                        className="p-1 hover:bg-gray-100 rounded"
                    >
                        <Eye size={16} />
                    </button>

                    {!readOnly && (
                        <button
                            type="button"
                            onClick={handleRemove}
                            className="p-1 hover:bg-gray-100 rounded text-red-500"
                        >
                            <Delete size={16} />
                        </button>
                    )}
                </div>
            )}

            <Modal
                open={previewOpen}
                footer={null}
                onCancel={() => setPreviewOpen(false)}
            >
                <img
                    src={imageSrc}
                    alt="preview"
                    style={{ width: "100%" }}
                />
            </Modal>
        </div>
    );
}