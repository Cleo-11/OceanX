"use client"

import { Component, ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('React Error Boundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-900 to-blue-950 p-4">
          <div className="max-w-md rounded-lg border border-red-800 bg-gray-900/90 p-8 text-center shadow-2xl backdrop-blur">
            <AlertCircle className="mx-auto h-16 w-16 text-red-500" />
            <h2 className="mt-4 text-2xl font-bold text-white">Oops! Something went wrong</h2>
            <p className="mt-3 text-gray-300">
              {this.state.error?.message || 'An unexpected error occurred while loading the game.'}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: undefined })
                }}
                className="flex-1 rounded-lg bg-gray-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-600"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Reload Game
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
