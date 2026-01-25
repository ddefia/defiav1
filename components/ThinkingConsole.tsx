/**
 * ThinkingConsole Event Bus
 * 
 * Simple utility to dispatch global events when the AI is "thinking" or processing background tasks.
 * Listeners (like the Copilot or a global LoadingIndicator) can subscribe to 'defia-thinking-update'.
 */

export const dispatchThinking = (message: string, context?: any) => {
    // Log for debugging
    console.log("🧠 AI Thinking:", message, context);

    // Dispatch a custom window event
    const event = new CustomEvent('defia-thinking-update', {
        detail: {
            message,
            context,
            timestamp: Date.now()
        }
    });

    window.dispatchEvent(event);
};

// Optional: You could export a React component here if you wanted to centralize the UI later.
// export const ThinkingConsoleListener = () => { ... }
