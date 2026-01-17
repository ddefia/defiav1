import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen flex items-center justify-center bg-red-50 p-6 font-sans text-red-900">
                    <div className="max-w-3xl w-full bg-white border border-red-200 rounded-xl shadow-xl p-8">
                        <h1 className="text-3xl font-bold mb-4 flex items-center gap-3">
                            <span className="text-4xl">💥</span> Application Crash
                        </h1>
                        <p className="text-lg text-red-800 mb-6 border-b border-red-100 pb-4">
                            Something went wrong in the application. Please reload or contact support.
                        </p>

                        <div className="bg-red-950 text-red-200 p-6 rounded-lg overflow-auto font-mono text-xs max-h-[400px]">
                            <p className="text-red-400 font-bold text-sm mb-2">{this.state.error?.toString()}</p>
                            <pre>{this.state.errorInfo?.componentStack}</pre>
                        </div>

                        <div className="mt-8 flex justify-end">
                            <button
                                onClick={() => window.location.reload()}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-lg"
                            >
                                Reload Application
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
