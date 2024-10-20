// src/components/UploadVideo.js

import React, { useState } from 'react';
import { Form, Button, Alert, Card, Row, Col } from 'react-bootstrap';

const UploadVideo = ({ onUpload }) => {
  const [file, setFile] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleAnalyze = () => {
    if (file) {
      onUpload(file);
    } else {
      alert('Please select a video file first.');
    }
  };

  return (
    <Card className="p-4 shadow-sm">
      <h2 className="text-center mb-4">Upload Video</h2>
      <Form>
        <Form.Group controlId="formFile" className="mb-3">
          <Form.Label>Select a video file:</Form.Label>
          <Form.Control type="file" accept="video/*" onChange={handleFileChange} />
        </Form.Group>
        {file && <Alert variant="info">Selected file: {file.name}</Alert>}
        <Row className="mt-4">
          <Col className="text-center">
            <Button variant="primary" size="lg" onClick={handleAnalyze}>
              Analyze Video
            </Button>
          </Col>
        </Row>
      </Form>
    </Card>
  );
};

export default UploadVideo;
