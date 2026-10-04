// FILE: src/main.tsx
// React.StrictMode stays off: CVBuilder fires a long AI call on mount and
// StrictMode's double-mount in dev would fire it twice against Groq.

import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
