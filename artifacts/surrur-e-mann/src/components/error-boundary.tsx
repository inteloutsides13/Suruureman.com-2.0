import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMessage: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: "" });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-full border border-destructive/30 flex items-center justify-center mx-auto mb-8 bg-destructive/5">
              <svg className="w-7 h-7 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h2 className="font-urdu text-3xl text-destructive mb-3">کچھ غلط ہو گیا</h2>
            <p className="font-heading text-xs text-muted-foreground tracking-widest uppercase mb-8">
              Something went wrong
            </p>
            <button
              onClick={() => { this.handleReset(); window.location.reload(); }}
              className="px-6 py-2.5 rounded-lg border border-accent/20 text-accent hover:bg-accent/10 font-heading text-xs tracking-widest uppercase transition-all duration-200"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
