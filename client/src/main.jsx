import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { init } from '@noriginmedia/norigin-spatial-navigation';
import './index.css'
import App from './App.jsx'

init({
  debug: false,
  visualDebug: false
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
