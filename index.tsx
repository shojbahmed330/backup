
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// FIX: Augment the global Window interface to include BanubaSDK.
// This informs TypeScript that BanubaSDK is available on the window object, resolving the type error.
declare global {
  interface Window {
    BanubaSDK: any;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// Function to render the React app
const renderApp = () => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

// Defer rendering until Banuba SDK is initialized to prevent race conditions.
// The SDK needs to set up its WebGL context before any component can use it.
if (window.BanubaSDK && typeof window.BanubaSDK.init === 'function') {
  // FIX: Use window.BanubaSDK consistently.
  window.BanubaSDK.init()
    .then(() => {
      console.log('Banuba SDK initialized successfully.');
      renderApp();
    })
    .catch((error: Error) => {
      console.error('Banuba SDK failed to initialize:', error);
      // Render the app anyway so it's not completely broken,
      // but filters will not work.
      renderApp();
    });
} else {
  console.warn('BanubaSDK not found. Video filters will be unavailable.');
  // If the SDK script fails to load, render the app immediately after a short delay
  // to allow other scripts to potentially load.
  setTimeout(renderApp, 0);
}
