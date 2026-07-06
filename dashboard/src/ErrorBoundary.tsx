import { Component, type ReactNode } from 'react'
import { Alert, Button, Stack } from '@mantine/core'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

// a crash in one page must not blank the whole app — the header and
// navigation stay usable so the user can switch away or retry
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <Stack maw={560} py="xl" role="alert">
          <Alert color="red" title="Something went wrong on this page">
            {this.state.error.message}
          </Alert>
          <div>
            <Button variant="default" onClick={() => this.setState({ error: null })}>
              Try again
            </Button>
          </div>
        </Stack>
      )
    }
    return this.props.children
  }
}
