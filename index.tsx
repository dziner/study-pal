

import React from 'react';
import ReactDOM from 'react-dom/client';
// FIX: Added './' to ensure it's treated as a module path. The underlying issue of App.tsx being empty will be resolved by providing its content.
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);