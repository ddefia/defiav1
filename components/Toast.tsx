import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
    exiting: boolean;
}

interface ToastContextValue {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_ICON: Record<ToastType, string> = {
    success: 'check_circle',
    error: 'error',
    info: 'info',
};

const TOAST_COLOR: Record<ToastType, string> = {
    success: '#22C55E',
    error: '#EF4444',
    info: '#FF5C00',
};

const AUTO_DISMISS_MS = 5000;
const MAX_VISIBLE = 3;
const EXIT_DURATION_MS = 300;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const idCounter = useRef(0);
    const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

    const dismissToast = useCallback((id: number) => {
        // Mark as exiting for animation
        setToasts(prev => prev.map(t => (t.id === id ? { ...t, exiting: true } : t)));
        // Remove after exit animation completes
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, EXIT_DURATION_MS);
        // Clear the auto-dismiss timer if it exists
        const timer = timersRef.current.get(id);
        if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(id);
        }
    }, []);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = ++idCounter.current;
        setToasts(prev => {
            const next = [...prev, { id, message, type, exiting: false }];
            // If we exceed max visible, dismiss the oldest non-exiting toast
            const visible = next.filter(t => !t.exiting);
            if (visible.length > MAX_VISIBLE) {
                const oldest = visible[0];
                // Trigger dismiss on the oldest
                setTimeout(() => dismissToast(oldest.id), 0);
            }
            return next;
        });
        // Auto-dismiss after timeout
        const timer = setTimeout(() => {
            dismissToast(id);
            timersRef.current.delete(id);
        }, AUTO_DISMISS_MS);
        timersRef.current.set(id, timer);
    }, [dismissToast]);

    // Cleanup all timers on unmount
    useEffect(() => {
        return () => {
            timersRef.current.forEach(timer => clearTimeout(timer));
            timersRef.current.clear();
        };
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {/* Toast container */}
            <div
                style={{
                    position: 'fixed',
                    bottom: 24,
                    right: 24,
                    zIndex: 9999,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    pointerEvents: 'none',
                }}
            >
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            background: '#111113',
                            border: `1px solid #1F1F23`,
                            borderLeft: `3px solid ${TOAST_COLOR[toast.type]}`,
                            borderRadius: 8,
                            padding: '12px 16px',
                            minWidth: 300,
                            maxWidth: 420,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                            pointerEvents: 'auto',
                            animation: toast.exiting
                                ? `toast-slide-out ${EXIT_DURATION_MS}ms ease-in forwards`
                                : 'toast-slide-in 300ms ease-out forwards',
                        }}
                    >
                        <span
                            className="material-symbols-sharp"
                            style={{
                                fontSize: 20,
                                color: TOAST_COLOR[toast.type],
                                flexShrink: 0,
                            }}
                        >
                            {TOAST_ICON[toast.type]}
                        </span>
                        <span
                            style={{
                                flex: 1,
                                fontSize: 13,
                                lineHeight: '18px',
                                color: '#E0E0E0',
                                fontFamily: 'inherit',
                            }}
                        >
                            {toast.message}
                        </span>
                        <button
                            onClick={() => dismissToast(toast.id)}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 2,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                color: '#6B6B6B',
                                transition: 'color 150ms',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#6B6B6B')}
                            aria-label="Dismiss"
                        >
                            <span className="material-symbols-sharp" style={{ fontSize: 18 }}>
                                close
                            </span>
                        </button>
                    </div>
                ))}
            </div>

            {/* Keyframe animations injected once */}
            <style>{`
                @keyframes toast-slide-in {
                    from {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                @keyframes toast-slide-out {
                    from {
                        opacity: 1;
                        transform: translateX(0);
                    }
                    to {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                }
            `}</style>
        </ToastContext.Provider>
    );
};

export const useToast = (): ToastContextValue => {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        throw new Error('useToast must be used within a <ToastProvider>');
    }
    return ctx;
};
