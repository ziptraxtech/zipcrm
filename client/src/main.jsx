import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { store } from './app/store.js'
import { Provider } from 'react-redux'
import { ClerkProvider } from '@clerk/clerk-react'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  console.warn('Missing Clerk Publishable Key - using placeholder')
}

const key = PUBLISHABLE_KEY || 'pk_test_placeholder'

createRoot(document.getElementById('root')).render(
    <BrowserRouter>
     <ClerkProvider publishableKey={key}>
         <Provider store={store}>
                <App />
            </Provider>
      </ClerkProvider>
            
    </BrowserRouter>,
)