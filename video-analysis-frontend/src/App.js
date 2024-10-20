// src/App.js

import React, { useState } from 'react';
import UploadVideo from './components/UploadVideo';
import AnalysisResult from './components/AnalysisResult';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Navbar, Container, Alert, Spinner } from 'react-bootstrap';
import './App.css';

function App() {
  const [analysisData, setAnalysisData] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleUpload = (file) => {
    const formData = new FormData();
    formData.append('file', file);

    setStatusMessage('Uploading video...');
    setIsLoading(true);

    axios
      .post('http://127.0.0.1:5000/analyze', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      .then((response) => {
        setStatusMessage('Analysis complete.');
        setAnalysisData(response.data);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('Error analyzing video:', error);
        setStatusMessage('Error analyzing video. Please try again.');
        setIsLoading(false);
      });
  };

  return (
    <>
      <Navbar bg="dark" variant="dark" className="py-3">
        <Container>
          <Navbar.Brand href="#">Video Analysis Tool</Navbar.Brand>
        </Container>
      </Navbar>
      <div className="content">
        <Container className="mt-4 mb-5">
          {statusMessage && (
            <div className="mb-3">
              <Alert variant="info">{statusMessage}</Alert>
            </div>
          )}
          {isLoading && (
            <div className="text-center my-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-3">Processing... Please wait.</p>
            </div>
          )}
          {!analysisData ? (
            <UploadVideo onUpload={handleUpload} />
          ) : (
            <AnalysisResult analysisData={analysisData} />
          )}
        </Container>
      </div>
      <footer className="footer">
        <Container className="text-center">
          <p>&copy; {new Date().getFullYear()} Video Analysis Tool</p>
        </Container>
      </footer>
    </>
  );
}

export default App;
