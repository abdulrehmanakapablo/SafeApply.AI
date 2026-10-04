// FILE: src/App.tsx

import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { router } from './router'
import { queryClient } from './lib/queryClient'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster
        position="bottom-right"
        gutter={8}
        toastOptions={{
          duration: 3500,
          style: {
            background: 'var(--c-surface)',
            color: 'var(--c-fg)',
            border: '1px solid var(--c-line)',
            borderRadius: '10px',
            fontSize: '13px',
            padding: '10px 12px',
            maxWidth: '420px',
          },
          success: { iconTheme: { primary: 'var(--c-accent)', secondary: 'var(--c-ink)' } },
          error: { iconTheme: { primary: 'var(--c-danger)', secondary: '#ffffff' }, duration: 5000 },
        }}
      />
    </QueryClientProvider>
  )
}
