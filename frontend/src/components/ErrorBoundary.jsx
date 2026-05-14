import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Full error to console for devs; never shown to users.
    // eslint-disable-next-line no-console
    console.error('[LAMAZI ErrorBoundary]', error, info?.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.assign('/');
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-lamazi-neutral px-6">
        <div className="cream-card text-center max-w-md w-full">
          <p className="font-script text-3xl text-lamazi-secondary-deep -mb-1">Oh sugar</p>
          <h1 className="font-display text-3xl text-lamazi-primary font-bold mb-2">Something went wrong</h1>
          <p className="text-sm text-lamazi-muted mb-6">
            We've been notified. Please refresh the page or head back to the home page — your bag is safe.
          </p>
          <button onClick={this.handleReload} className="btn-primary w-full" data-testid="error-boundary-home">
            Take me home
          </button>
          <button onClick={() => window.location.reload()} className="btn-outline w-full mt-2" data-testid="error-boundary-reload">
            Try refreshing
          </button>
        </div>
      </div>
    );
  }
}
