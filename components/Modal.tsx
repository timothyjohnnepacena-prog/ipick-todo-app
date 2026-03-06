"use client";
import { useState, useCallback, createContext, useContext, useRef, useEffect } from "react";

interface ModalButton {
    label: string;
    variant?: "primary" | "danger" | "ghost";
    onClick?: () => void;
}

interface AlertOptions {
    title?: string;
    message: string;
    variant?: "success" | "danger" | "info";
    buttonText?: string;
}

interface ConfirmOptions {
    title?: string;
    message: string;
    variant?: "danger" | "warning" | "info" | "success";
    confirmText?: string;
    cancelText?: string;
}

interface PromptOptions {
    title?: string;
    message?: string;
    placeholder?: string;
    defaultValue?: string;
    confirmText?: string;
    cancelText?: string;
}

interface SelectOption {
    value: string;
    label: string;
    description?: string;
    color?: string;
    icon?: string;
}

interface SelectOptions {
    title?: string;
    message?: string;
    options: SelectOption[];
    currentValue?: string;
    cancelText?: string;
}

interface ModalState {
    type: "alert" | "confirm" | "prompt" | "select" | null;
    options: AlertOptions | ConfirmOptions | PromptOptions | SelectOptions;
    resolve: ((value: boolean | string | null) => void) | null;
}

interface ModalContextType {
    showAlert: (options: AlertOptions) => Promise<void>;
    showConfirm: (options: ConfirmOptions) => Promise<boolean>;
    showPrompt: (options: PromptOptions) => Promise<string | null>;
    showSelect: (options: SelectOptions) => Promise<string | null>;
}

const ModalContext = createContext<ModalContextType | null>(null);

export function useModal(): ModalContextType {
    const ctx = useContext(ModalContext);
    if (!ctx) throw new Error("useModal must be used within ModalProvider");
    return ctx;
}

function SuccessIcon() {
    return (
        <div className="h-12 w-12 rounded-2xl bg-[#12A55C]/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[#12A55C]" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
        </div>
    );
}

function DangerIcon() {
    return (
        <div className="h-12 w-12 rounded-2xl bg-[#9E2A2B]/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[#9E2A2B]" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
        </div>
    );
}

function InfoIcon() {
    return (
        <div className="h-12 w-12 rounded-2xl bg-[#F37A22]/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[#F37A22]" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
        </div>
    );
}

const btnBase = "px-5 py-3 rounded-2xl text-sm font-bold transition-all uppercase tracking-wider";
const btnStyles: Record<string, string> = {
    primary: `${btnBase} bg-[#12A55C] text-white hover:bg-[#0e8549] shadow-lg shadow-[#12A55C]/20`,
    danger: `${btnBase} bg-[#9E2A2B] text-white hover:bg-[#7d2122] shadow-lg shadow-[#9E2A2B]/20`,
    ghost: `${btnBase} bg-slate-100 text-slate-500 hover:bg-slate-200`,
};

export function ModalProvider({ children }: { children: React.ReactNode }) {
    const [modal, setModal] = useState<ModalState>({ type: null, options: { message: "" }, resolve: null });
    const [inputValue, setInputValue] = useState("");
    const [isClosing, setIsClosing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (modal.type === "prompt" && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [modal.type]);

    const close = useCallback((value: boolean | string | null) => {
        setIsClosing(true);
        setTimeout(() => {
            modal.resolve?.(value);
            setModal({ type: null, options: { message: "" }, resolve: null });
            setInputValue("");
            setIsClosing(false);
        }, 150);
    }, [modal]);

    const showAlert = useCallback((options: AlertOptions): Promise<void> => {
        return new Promise((resolve) => {
            setModal({ type: "alert", options, resolve: () => resolve() });
        });
    }, []);

    const showConfirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setModal({ type: "confirm", options, resolve: (v) => resolve(v as boolean) });
        });
    }, []);

    const showPrompt = useCallback((options: PromptOptions): Promise<string | null> => {
        return new Promise((resolve) => {
            setInputValue(options.defaultValue || "");
            setModal({ type: "prompt", options, resolve: (v) => resolve(v as string | null) });
        });
    }, []);

    const showSelect = useCallback((options: SelectOptions): Promise<string | null> => {
        return new Promise((resolve) => {
            setModal({ type: "select", options, resolve: (v) => resolve(v as string | null) });
        });
    }, []);

    const renderContent = () => {
        if (!modal.type) return null;

        if (modal.type === "alert") {
            const opts = modal.options as AlertOptions;
            return (
                <>
                    {opts.variant === "success" && <SuccessIcon />}
                    {opts.variant === "danger" && <DangerIcon />}
                    {(!opts.variant || opts.variant === "info") && <InfoIcon />}
                    {opts.title && <h3 className="text-lg font-black text-slate-800 mb-2 text-center">{opts.title}</h3>}
                    <p className="text-sm text-slate-500 text-center leading-relaxed mb-6">{opts.message}</p>
                    <button onClick={() => close(true)} className={`w-full ${opts.variant === "danger" ? btnStyles.danger : btnStyles.primary}`}>
                        {opts.buttonText || "Got it"}
                    </button>
                </>
            );
        }

        if (modal.type === "confirm") {
            const opts = modal.options as ConfirmOptions;
            return (
                <>
                    {(opts.variant === "danger" || opts.variant === "warning") && <DangerIcon />}
                    {opts.variant === "success" && <SuccessIcon />}
                    {(!opts.variant || opts.variant === "info") && <InfoIcon />}
                    {opts.title && <h3 className="text-lg font-black text-slate-800 mb-2 text-center">{opts.title}</h3>}
                    <p className="text-sm text-slate-500 text-center leading-relaxed mb-6">{opts.message}</p>
                    <div className="flex gap-3">
                        <button onClick={() => close(false)} className={`flex-1 ${btnStyles.ghost}`}>
                            {opts.cancelText || "Cancel"}
                        </button>
                        <button onClick={() => close(true)} className={`flex-1 ${opts.variant === "danger" ? btnStyles.danger : opts.variant === "success" ? btnStyles.primary : btnStyles.primary}`}>
                            {opts.confirmText || "Confirm"}
                        </button>
                    </div>
                </>
            );
        }

        if (modal.type === "prompt") {
            const opts = modal.options as PromptOptions;
            return (
                <>
                    <InfoIcon />
                    {opts.title && <h3 className="text-lg font-black text-slate-800 mb-2 text-center">{opts.title}</h3>}
                    {opts.message && <p className="text-sm text-slate-500 text-center leading-relaxed mb-4">{opts.message}</p>}
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && inputValue.trim()) close(inputValue.trim()); if (e.key === "Escape") close(null); }}
                        placeholder={opts.placeholder || "Type here..."}
                        className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:border-[#12A55C] border-2 border-transparent transition-colors text-sm font-medium mb-4"
                    />
                    <div className="flex gap-3">
                        <button onClick={() => close(null)} className={`flex-1 ${btnStyles.ghost}`}>
                            {opts.cancelText || "Cancel"}
                        </button>
                        <button
                            onClick={() => { if (inputValue.trim()) close(inputValue.trim()); }}
                            disabled={!inputValue.trim()}
                            className={`flex-1 ${btnStyles.primary} disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                            {opts.confirmText || "Submit"}
                        </button>
                    </div>
                </>
            );
        }

        if (modal.type === "select") {
            const opts = modal.options as SelectOptions;
            return (
                <>
                    <InfoIcon />
                    {opts.title && <h3 className="text-lg font-black text-slate-800 mb-2 text-center">{opts.title}</h3>}
                    {opts.message && <p className="text-sm text-slate-500 text-center leading-relaxed mb-5">{opts.message}</p>}
                    <div className="space-y-2.5 mb-5">
                        {opts.options.map((opt) => {
                            const isActive = opt.value === opts.currentValue;
                            return (
                                <button
                                    key={opt.value}
                                    onClick={() => close(opt.value)}
                                    className={`w-full flex items-center gap-3.5 p-4 rounded-2xl border-2 transition-all text-left group/opt ${isActive
                                            ? 'border-[#12A55C] bg-[#12A55C]/5 shadow-md shadow-[#12A55C]/10'
                                            : 'border-slate-100 bg-slate-50/50 hover:border-slate-200 hover:bg-white hover:shadow-sm'
                                        }`}
                                >
                                    <div
                                        className={`h-10 w-10 rounded-xl flex items-center justify-center text-lg shrink-0 transition-colors`}
                                        style={{ backgroundColor: opt.color ? `${opt.color}15` : '#f1f5f9', color: opt.color || '#64748b' }}
                                    >
                                        {opt.icon || '●'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-bold ${isActive ? 'text-[#12A55C]' : 'text-slate-700'}`}>{opt.label}</p>
                                        {opt.description && <p className="text-[11px] text-slate-400 mt-0.5">{opt.description}</p>}
                                    </div>
                                    {isActive && (
                                        <div className="h-6 w-6 rounded-full bg-[#12A55C] flex items-center justify-center shrink-0">
                                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    <button onClick={() => close(null)} className={`w-full ${btnStyles.ghost}`}>
                        {opts.cancelText || "Cancel"}
                    </button>
                </>
            );
        }
    };

    return (
        <ModalContext.Provider value={{ showAlert, showConfirm, showPrompt, showSelect }}>
            {children}
            {modal.type && (
                <div className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 ${isClosing ? 'animate-fadeOut' : 'animate-fadeIn'}`}>
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => close(modal.type === "prompt" ? null : false)} />
                    <div className={`relative bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl border border-white ${isClosing ? 'animate-scaleOut' : 'animate-scaleIn'}`}>
                        {renderContent()}
                    </div>
                </div>
            )}
        </ModalContext.Provider>
    );
}
