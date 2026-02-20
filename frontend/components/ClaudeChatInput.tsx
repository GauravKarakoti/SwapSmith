import React, { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { Plus, ChevronDown, ArrowUp, X, FileText, Loader2, Check, Archive } from "lucide-react";

/* --- ICONS --- */
export const Icons = {
    Logo: (props: React.SVGProps<SVGSVGElement>) => (
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="presentation" {...props}>
            <defs>
                <ellipse id="petal-pair" cx="100" cy="100" rx="90" ry="22" />
            </defs>
            <g fill="#D46B4F" fillRule="evenodd">
                <use href="#petal-pair" transform="rotate(0 100 100)" />
                <use href="#petal-pair" transform="rotate(45 100 100)" />
                <use href="#petal-pair" transform="rotate(90 100 100)" />
                <use href="#petal-pair" transform="rotate(135 100 100)" />
            </g>
        </svg>
    ),
    Plus: Plus,
    Thinking: (props: React.SVGProps<SVGSVGElement>) => <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...props}><path d="M10.3857 2.50977C14.3486 2.71054 17.5 5.98724 17.5 10C17.5 14.1421 14.1421 17.5 10 17.5C5.85786 17.5 2.5 14.1421 2.5 10C2.5 9.72386 2.72386 9.5 3 9.5C3.27614 9.5 3.5 9.72386 3.5 10C3.5 13.5899 6.41015 16.5 10 16.5C13.5899 16.5 16.5 13.5899 16.5 10C16.5 6.5225 13.7691 3.68312 10.335 3.50879L10 3.5L9.89941 3.49023C9.67145 3.44371 9.5 3.24171 9.5 3C9.5 2.72386 9.72386 2.5 10 2.5L10.3857 2.50977ZM10 5.5C10.2761 5.5 10.5 5.72386 10.5 6V9.69043L13.2236 11.0527C13.4706 11.1762 13.5708 11.4766 13.4473 11.7236C13.3392 11.9397 13.0957 12.0435 12.8711 11.9834L12.7764 11.9473L9.77637 10.4473C9.60698 10.3626 9.5 10.1894 9.5 10V6C9.5 5.72386 9.72386 5.5 10 5.5ZM3.66211 6.94141C4.0273 6.94159 4.32303 7.23735 4.32324 7.60254C4.32324 7.96791 4.02743 8.26446 3.66211 8.26465C3.29663 8.26465 3 7.96802 3 7.60254C3.00021 7.23723 3.29676 6.94141 3.66211 6.94141ZM4.95605 4.29395C5.32146 4.29404 5.61719 4.59063 5.61719 4.95605C5.6171 5.3214 5.3214 5.61709 4.95605 5.61719C4.59063 5.61719 4.29403 5.32146 4.29395 4.95605C4.29395 4.59057 4.59057 4.29395 4.95605 4.29395ZM7.60254 3C7.96802 3 8.26465 3.29663 8.26465 3.66211C8.26446 4.02743 7.96791 4.32324 7.60254 4.32324C7.23736 4.32302 6.94159 4.0273 6.94141 3.66211C6.94141 3.29676 7.23724 3.00022 7.60254 3Z"></path></svg>,
    SelectArrow: ChevronDown,
    ArrowUp: ArrowUp,
    X: X,
    FileText: FileText,
    Loader2: Loader2,
    Check: Check,
    Archive: Archive,
    Clock: (props: React.SVGProps<SVGSVGElement>) => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor" {...props}><path d="M10.3857 2.50977C14.3486 2.71054 17.5 5.98724 17.5 10C17.5 14.1421 14.1421 17.5 10 17.5C5.85786 17.5 2.5 14.1421 2.5 10C2.5 9.72386 2.72386 9.5 3 9.5C3.27614 9.5 3.5 9.72386 3.5 10C3.5 13.5899 6.41015 16.5 10 16.5C13.5899 16.5 16.5 13.5899 16.5 10C16.5 6.5225 13.7691 3.68312 10.335 3.50879L10 3.5L9.89941 3.49023C9.67145 3.44371 9.5 3.24171 9.5 3C9.5 2.72386 9.72386 2.5 10 2.5L10.3857 2.50977ZM10 5.5C10.2761 5.5 10.5 5.72386 10.5 6V9.69043L13.2236 11.0527C13.4706 11.1762 13.5708 11.4766 13.4473 11.7236C13.3392 11.9397 13.0957 12.0435 12.8711 11.9834L12.7764 11.9473L9.77637 10.4473C9.60698 10.3626 9.5 10.1894 9.5 10V6C9.5 5.72386 9.72386 5.5 10 5.5ZM3.66211 6.94141C4.0273 6.94159 4.32303 7.23735 4.32324 7.60254C4.32324 7.96791 4.02743 8.26446 3.66211 8.26465C3.29663 8.26465 3 7.96802 3 7.60254C3.00021 7.23723 3.29676 6.94141 3.66211 6.94141ZM4.95605 4.29395C5.32146 4.29404 5.61719 4.59063 5.61719 4.95605C5.6171 5.3214 5.61719 4.95605 5.61719C4.59063 5.61719 4.29403 5.32146 4.29395 4.95605C4.29395 4.59057 4.59057 4.29395 4.95605 4.29395ZM7.60254 3C7.96802 3 8.26465 3.29663 8.26465 3.66211C8.26446 4.02743 7.96791 4.32324 7.60254 4.32324C7.23736 4.32302 6.94159 4.0273 6.94141 3.66211C6.94141 3.29676 7.23724 3.00022 7.60254 3Z"></path></svg>,
};

/* --- UTILS --- */
const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

/* --- COMPONENTS --- */

// 1. File Preview Card
interface AttachedFile {
    id: string;
    file: File;
    type: string;
    preview: string | null;
    uploadStatus: string;
    content?: string;
}

interface FilePreviewCardProps {
    file: AttachedFile;
    onRemove: (id: string) => void;
}

const FilePreviewCard: React.FC<FilePreviewCardProps> = ({ file, onRemove }) => {
    const isImage = file.type.startsWith("image/") && file.preview;

    return (
        <div className={`relative group flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-zinc-700 bg-zinc-800 animate-fade-in transition-all hover:border-zinc-600`}>
            {isImage ? (
                <div className="w-full h-full relative">
                    <Image src={file.preview!} alt={file.file.name} fill className="object-cover" unoptimized />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
                </div>
            ) : (
                <div className="w-full h-full p-3 flex flex-col justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-zinc-700 rounded">
                            <Icons.FileText className="w-4 h-4 text-zinc-400" />
                        </div>
                        <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider truncate">
                            {file.file.name.split('.').pop()}
                        </span>
                    </div>
                    <div className="space-y-0.5">
                        <p className="text-xs font-medium text-zinc-200 truncate" title={file.file.name}>
                            {file.file.name}
                        </p>
                        <p className="text-[10px] text-zinc-500">
                            {formatFileSize(file.file.size)}
                        </p>
                    </div>
                </div>
            )}

            {/* Remove Button Overlay */}
            <button
                onClick={() => onRemove(file.id)}
                className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-black/70 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
                <Icons.X className="w-3 h-3" />
            </button>

            {/* Upload Status */}
            {file.uploadStatus === 'uploading' && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Icons.Loader2 className="w-5 h-5 text-white animate-spin" />
                </div>
            )}
        </div>
    );
};

// 2. Pasted Content Card
interface PastedContentCardProps {
    content: AttachedFile;
    onRemove: (id: string) => void;
}

const PastedContentCard: React.FC<PastedContentCardProps> = ({ content, onRemove }) => {
    return (
        <div className="relative group flex-shrink-0 w-28 h-28 rounded-2xl overflow-hidden border border-zinc-700 bg-zinc-800 animate-fade-in p-3 flex flex-col justify-between shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <div className="overflow-hidden w-full">
                <p className="text-[10px] text-zinc-400 leading-[1.4] font-mono break-words whitespace-pre-wrap line-clamp-4 select-none">
                    {content.content || ''}
                </p>
            </div>

            <div className="flex items-center justify-between w-full mt-2">
                <div className="inline-flex items-center justify-center px-1.5 py-[2px] rounded border border-zinc-700 bg-transparent">
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider font-sans">PASTED</span>
                </div>
            </div>

            <button
                onClick={() => onRemove(content.id)}
                className="absolute top-2 right-2 p-[3px] bg-zinc-700 border border-zinc-600 rounded-full text-zinc-400 hover:text-white transition-colors shadow-sm opacity-0 group-hover:opacity-100"
            >
                <Icons.X className="w-2 h-2" />
            </button>
        </div>
    );
};

// 3. Main Chat Input Component
interface ClaudeChatInputProps {
    onSendMessage: (data: {
        message: string;
        files: AttachedFile[];
        pastedContent: AttachedFile[];
        model: string;
        isThinkingEnabled: boolean
    }) => void;
    isRecording?: boolean;
    isAudioSupported?: boolean;
    onStartRecording?: () => void;
    onStopRecording?: () => void;
    isConnected?: boolean;
}

export const ClaudeChatInput: React.FC<ClaudeChatInputProps> = ({ 
    onSendMessage, 
    isRecording = false, 
    isAudioSupported = false, 
    onStartRecording, 
    onStopRecording,
    isConnected = false 
}) => {
    const [message, setMessage] = useState("");
    const [files, setFiles] = useState<AttachedFile[]>([]);
    const [pastedContent, setPastedContent] = useState<AttachedFile[]>([]);
    const [isDragging, setIsDragging] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 384) + "px"; // 96 * 4 = 384px (max-h-96)
        }
    }, [message]);

    // File Handling
    const handleFiles = useCallback((newFilesList: FileList | File[]) => {
        const newFiles = Array.from(newFilesList).map(file => {
            const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);
            return {
                id: Math.random().toString(36).substr(2, 9),
                file,
                type: isImage ? 'image/unknown' : (file.type || 'application/octet-stream'),
                preview: isImage ? URL.createObjectURL(file) : null,
                uploadStatus: 'pending'
            };
        });

        // Simulate Upload
        setFiles(prev => [...prev, ...newFiles]);

        // Dynamic Feedback Message
        setMessage(prev => {
            if (prev) return prev;
            if (newFiles.length === 1) {
                const f = newFiles[0];
                if (f.type.startsWith('image/')) return "Analyzed image...";
                return "Analyzed document...";
            }
            return `Analyzed ${newFiles.length} files...`;
        });

        newFiles.forEach(f => {
            setTimeout(() => {
                setFiles(prev => prev.map(p => p.id === f.id ? { ...p, uploadStatus: 'complete' } : p));
            }, 800 + Math.random() * 1000);
        });
    }, []);

    // Drag & Drop
    const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
    };

    // Paste Handling
    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        const pastedFiles: File[] = [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].kind === 'file') {
                const file = items[i].getAsFile();
                if (file) pastedFiles.push(file);
            }
        }

        if (pastedFiles.length > 0) {
            e.preventDefault();
            handleFiles(pastedFiles);
            return;
        }

        // Handle large text paste
        const text = e.clipboardData.getData('text');
        if (text.length > 300) {
            e.preventDefault();
            const snippet: AttachedFile = {
                id: Math.random().toString(36).substr(2, 9),
                file: new File([text], 'pasted-content.txt', { type: 'text/plain' }),
                type: 'text/plain',
                preview: null,
                uploadStatus: 'complete',
                content: text
            };
            setPastedContent(prev => [...prev, snippet]);

            if (!message) {
                setMessage("Analyzed pasted text...");
            }
        }
    };

    const handleSend = () => {
        if (!message.trim() && files.length === 0 && pastedContent.length === 0) return;
        onSendMessage({ message, files, pastedContent, model: 'sonnet-4.5', isThinkingEnabled: false });
        setMessage("");
        setFiles([]);
        setPastedContent([]);
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const hasContent = message.trim() || files.length > 0 || pastedContent.length > 0;

    return (
        <div
            className={`relative w-full max-w-3xl mx-auto transition-all duration-300 font-sans`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            {/* Main Container */}
            <div className={`
                !box-content flex flex-col mx-2 md:mx-0 items-stretch transition-all duration-200 relative z-10 rounded-2xl cursor-text border border-zinc-700
                shadow-[0_0_15px_rgba(0,0,0,0.3)] hover:shadow-[0_0_20px_rgba(0,0,0,0.4)]
                focus-within:shadow-[0_0_25px_rgba(0,0,0,0.5)]
             dark:bg-zinc-700/50 font-sans antialiased
            `}>

                <div className="flex flex-col px-3 pt-3 pb-2 gap-2">

                    {/* 1. Artifacts (Files & Pastes) - Rendered ABOVE text input */}
                    {(files.length > 0 || pastedContent.length > 0) && (
                        <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2 px-1">
                            {pastedContent.map(content => (
                                <PastedContentCard
                                    key={content.id}
                                    content={content}
                                    onRemove={id => setPastedContent(prev => prev.filter(c => c.id !== id))}
                                />
                            ))}
                            {files.map(file => (
                                <FilePreviewCard
                                    key={file.id}
                                    file={file}
                                    onRemove={id => setFiles(prev => prev.filter(f => f.id !== id))}
                                />
                            ))}
                        </div>
                    )}

                    {/* 2. Input Area */}
                    <div className="relative mb-1">
                        <div className="max-h-96 w-full overflow-y-auto custom-scrollbar font-sans break-words transition-opacity duration-200 min-h-[2.5rem] pl-1">
                            <textarea
                                ref={textareaRef}
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onPaste={handlePaste}
                                onKeyDown={handleKeyDown}
                                placeholder="Type or speak...'Swap ETH for BTC' or 'Recieve 10 USDC'    "
                                className="w-full bg-transparent border-0 outline-none text-zinc-100 text-[16px] placeholder:text-zinc-500 resize-none overflow-hidden py-0 leading-relaxed block font-normal antialiased"
                                rows={1}
                                autoFocus
                                style={{ minHeight: '1.5em' }}
                            />
                        </div>
                    </div>

                    {/* 3. Action Bar */}
                    <div className="flex gap-2 w-full items-center">
                        {/* Left: Voice & Wallet Status */}
                        <div className="flex items-center gap-2 flex-1">
                            {/* Voice Button */}
                            {onStartRecording && onStopRecording && (
                                <button
                                    onClick={isRecording ? onStopRecording : onStartRecording}
                                    className={`p-2 rounded-lg transition-all ${
                                        !isAudioSupported 
                                            ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' 
                                            : isRecording 
                                                ? 'bg-red-500 text-white animate-pulse' 
                                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                                    }`}
                                    disabled={!isAudioSupported}
                                    title={isRecording ? 'Stop Recording' : !isAudioSupported ? 'Voice input not supported' : 'Start Voice Input'}
                                >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        {isRecording ? (
                                            <path d="M10 2a2 2 0 00-2 2v6a2 2 0 104 0V4a2 2 0 00-2-2zM3.5 9.5a.5.5 0 01.5.5 6 6 0 0012 0 .5.5 0 011 0 7 7 0 01-6.5 6.975V18h3a.5.5 0 010 1h-7a.5.5 0 010-1h3v-1.025A7 7 0 013 10a.5.5 0 01.5-.5z"/>
                                        ) : (
                                            <circle cx="10" cy="10" r="6"/>
                                        )}
                                    </svg>
                                </button>
                            )}
                            
                            {/* Wallet Status Indicator */}
                            {!isConnected && (
                                <div className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                    <p className="text-[9px] text-amber-500 font-bold uppercase tracking-wider">Wallet Not Connected</p>
                                </div>
                            )}
                        </div>

                        {/* Right: Send Button */}
                        <button
                            onClick={handleSend}
                            disabled={!hasContent}
                            className={`
                                inline-flex items-center justify-center relative shrink-0 transition-colors h-8 w-8 rounded-xl active:scale-95
                                ${hasContent
                                    ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-md'
                                    : 'bg-blue-600/30 text-white/60 cursor-default'}
                            `}
                            type="button"
                            aria-label="Send message"
                        >
                            <Icons.ArrowUp className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Fallback Message */}
            {!isAudioSupported && (
                <div className="text-red-500 text-xs mt-2 px-1 text-center font-medium">
                    🎤 Voice input is not supported in your browser. Please use Chrome or type your command.
                </div>
            )}

            {/* Drag Overlay */}
            {isDragging && (
                <div className="absolute inset-0 bg-zinc-800/90 border-2 border-dashed border-blue-500 rounded-2xl z-50 flex flex-col items-center justify-center backdrop-blur-sm pointer-events-none">
                    <Icons.Archive className="w-10 h-10 text-blue-500 mb-2 animate-bounce" />
                    <p className="text-blue-500 font-medium">Drop files to upload</p>
                </div>
            )}

            {/* Hidden Input */}
            <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={(e) => {
                    if (e.target.files) handleFiles(e.target.files);
                    e.target.value = '';
                }}
                className="hidden"
            />

            <div className="text-center mt-4">
                <p className="text-xs text-zinc-600">
                    AI can make mistakes. Please check important information.
                </p>
            </div>
        </div>
    );
};

export default ClaudeChatInput;
