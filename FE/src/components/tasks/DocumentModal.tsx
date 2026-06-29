'use client'

import React, {  useState } from "react";
import {DocumentSchema} from "@/types/documents";
import DocumentInfoComponent from "@/components/tasks/DocumentComponent";
import {ViewModal} from "@/components/controller";

type Props = {
    open: boolean;
    onClose: () => void;
    documentId?: string | null;
    title?: string;
};


export default function DocumentInfoModal({
                                              open,
                                              onClose,
                                              documentId,
                                              title,
                                          }: Props) {

    const [documentView, setDocumentView] = useState<DocumentSchema | undefined>(undefined);


    return <ViewModal width={1000} open={open} onCancel={onClose} title={documentView?.title || title}>
        <DocumentInfoComponent setDocument={setDocumentView} documentId={documentId}/>
    </ViewModal>
}
