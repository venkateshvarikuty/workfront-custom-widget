import React from 'react';
import ErrorBoundary from 'react-error-boundary';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import ExtensionRegistration from './ExtensionRegistration';
import Customwidget from './CustomwidgetMainMenuItem';
import DigitalScreensBriefForm from './DigitalScreensBriefForm';

function App() {
  return (
    <Router>
      <ErrorBoundary onError={onError} FallbackComponent={FallbackComponent}>
        <Routes>
          <Route index element={<ExtensionRegistration />} />
          <Route exact path="index.html" element={<ExtensionRegistration />} />
          <Route exact path="custom-widget" element={<Customwidget />} />
          <Route exact path="digital-screens-brief" element={<DigitalScreensBriefForm />} />
        </Routes>
      </ErrorBoundary>
    </Router>
  );

  function onError(e, componentStack) {
    console.error('Rendering error:', e, componentStack);
  }

  function FallbackComponent({ componentStack, error }) {
    return (
      <React.Fragment>
        <h1 style={{ textAlign: 'center', marginTop: '20px' }}>
          Something went wrong.
        </h1>
        <pre>{componentStack + '\n' + error.message}</pre>
      </React.Fragment>
    );
  }
}

export default App;
