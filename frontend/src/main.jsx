import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
window.onerror = function (message, source, lineno, colno, error) {
  document.body.innerHTML = '<div style="color:red; font-weight:bold; padding:20px; border:2px solid red;"><h1>App Crashed!</h1><pre>' + message + '\n' + source + ':' + lineno + '</pre></div>';
};
import '@fontsource/geist-sans'
import '@fontsource/geist-mono'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './AuthContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
