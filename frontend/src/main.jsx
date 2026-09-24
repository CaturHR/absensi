import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// import './index.css' // Dinonaktifkan agar tampilan menjadi mentahan (raw HTML tanpa CSS)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)