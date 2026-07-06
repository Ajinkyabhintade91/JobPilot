import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@fontsource-variable/inter/index.css'
import '@mantine/core/styles.css'
import '@mantine/charts/styles.css'
import '@mantine/dropzone/styles.css'
import 'mantine-datatable/styles.css'
import './theme.css'
import { cssVariablesResolver, theme } from './theme'
import App from './App.tsx'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* DESIGN.md: dark-only system — no light mode ships */}
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} forceColorScheme="dark">
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </MantineProvider>
  </StrictMode>,
)
