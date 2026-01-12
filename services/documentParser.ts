
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';

// Initialize PDF worker
if (typeof window !== 'undefined') {
    // Explicitly set worker source for the browser
    // Handle potential export structure differences (ESM vs CJS default)
    // @ts-ignore
    const lib = (pdfjsLib as any).default || pdfjsLib;
    if (lib && lib.GlobalWorkerOptions) {
        // Use unpkg for the worker to ensure we get the classic script format compatible with standard Workers
        // The ESM version from esm.sh often fails with importScripts in the worker context
        lib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;
    }
}

export const parseDocumentFile = async (file: File): Promise<string> => {
    const MAX_SIZE = 30 * 1024 * 1024; // 30MB Limit
    if (file.size > MAX_SIZE) {
        throw new Error(`File is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Please upload documents under 30MB.`);
    }

    let text = "";

    if (file.type === "application/pdf") {
        const arrayBuffer = await file.arrayBuffer();

        // Use the resolved lib reference
        // @ts-ignore
        const lib = (pdfjsLib as any).default || pdfjsLib;
        const loadingTask = lib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        let fullText = [];
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText.push(pageText);
        }
        text = `[SOURCE: ${file.name}]\n` + fullText.join('\n\n');
    } else {
        // Assume text/markdown/json
        text = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => resolve(ev.target?.result as string);
            reader.readAsText(file);
        });
        text = `[SOURCE: ${file.name}]\n` + text;
    }

    return text;
};
