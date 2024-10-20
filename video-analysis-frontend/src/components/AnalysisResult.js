// src/components/AnalysisResult.js

import React, { useState, useEffect } from 'react';
import VideoPlayer from './VideoPlayer';
import LabelInput from './LabelInput';
import {
  Button,
  Row,
  Col,
  Card,
  ListGroup,
  Alert,
  Modal,
  Image,
  Spinner,
} from 'react-bootstrap';
import axios from 'axios';
import './AnalysisResult.css';

const AnalysisResult = ({ analysisData }) => {
  const [data, setData] = useState(null);
  const [isLabelsSubmitted, setIsLabelsSubmitted] = useState(false);
  const [adjustedFrames, setAdjustedFrames] = useState([]);
  const [isAddingFrames, setIsAddingFrames] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFinalized, setIsFinalized] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showGraphModal, setShowGraphModal] = useState(false);
  const [isUpdatingFrames, setIsUpdatingFrames] = useState(false);

  useEffect(() => {
    if (analysisData) {
      setData(analysisData);
      setAdjustedFrames(analysisData.significant_frames);
    }
  }, [analysisData]);

  if (!data) {
    return (
      <div className="text-center my-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-3">Loading analysis data...</p>
      </div>
    );
  }

  const handleTimeUpdate = (time) => {
    setCurrentTime(time);
  };

  const handleAddSignificantFrame = () => {
    // Check if a frame at this timestamp already exists
    const existingFrame = adjustedFrames.find(
      (frame) => Math.abs(frame.timestamp - currentTime) < 0.5
    );
    if (existingFrame) {
      alert('A significant frame already exists near this timestamp.');
      return;
    }
    // Create a new significant frame
    const newFrame = {
      id: adjustedFrames.length + 1,
      timestamp: currentTime,
      segment_type: 'unknown',
      frame_url: '', // Will be updated in backend
      label: '',
    };
    const newFrames = [...adjustedFrames, newFrame];
    updateSignificantFrames(newFrames);
  };

  const handleRemoveSignificantFrame = (index) => {
    const newFrames = adjustedFrames.filter((_, idx) => idx !== index);
    updateSignificantFrames(newFrames);
  };

  const updateSignificantFrames = (frames) => {
    setIsUpdatingFrames(true);
    // Sort the frames by timestamp
    const sortedFrames = frames.sort((a, b) => a.timestamp - b.timestamp);

    // Send updated frames to the backend
    axios
      .post('http://127.0.0.1:5000/update_timestamps', {
        video_id: data.video_id,
        significant_frames: sortedFrames,
      })
      .then((response) => {
        setData(response.data.analysis_data);
        setAdjustedFrames(response.data.analysis_data.significant_frames);
        setIsUpdatingFrames(false);
      })
      .catch((error) => {
        console.error('Error updating significant frames:', error);
        setIsUpdatingFrames(false);
      });
  };

  const handleFinalizeFrames = () => {
    setIsAddingFrames(false);
    setIsFinalized(true);
  };

  const handleLabelsSaved = (updatedData) => {
    setData(updatedData);
    setIsLabelsSubmitted(true);
    setShowConfirmation(true);
  };

  const handleCloseConfirmation = () => {
    setShowConfirmation(false);
  };

  const handleShowGraphModal = () => {
    setShowGraphModal(true);
  };

  const handleCloseGraphModal = () => {
    setShowGraphModal(false);
  };

  return (
    <>
      <h2 className="text-center mt-4 mb-4">Analysis Result</h2>
      <VideoPlayer
        analysisData={{ ...data, significant_frames: adjustedFrames }}
        onTimeUpdate={handleTimeUpdate}
      />
      <Row className="mt-4 align-items-center">
        <Col md={6}>
          <h5>
            <strong>Trend Complexity:</strong> {data.ease}
          </h5>
        </Col>
        <Col md={6} className="text-md-end mt-3 mt-md-0">
          {data.plot_url && (
            <Button variant="info" className="me-2" onClick={handleShowGraphModal}>
              View Analysis Graph
            </Button>
          )}
          {!isFinalized && (
            <Button variant="primary" onClick={handleFinalizeFrames}>
              Finalize Significant Frames
            </Button>
          )}
        </Col>
      </Row>
      {isAddingFrames && (
        <div className="mt-3 text-center">
          <Button variant="success" size="lg" onClick={handleAddSignificantFrame}>
            Add Significant Frame at {currentTime.toFixed(2)}s
          </Button>
        </div>
      )}
      {isUpdatingFrames && (
        <div className="text-center my-3">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2">Updating significant frames...</p>
        </div>
      )}
      {!isFinalized || !isLabelsSubmitted ? (
        <>
          <h3 className="mt-5 mb-4">Significant Frames and Timestamps</h3>
          <Row xs={1} sm={2} md={3} lg={4} className="g-4">
            {adjustedFrames.map((frame, idx) => (
              <Col key={idx}>
                <Card className="h-100 shadow-sm">
                  {frame.frame_url ? (
                    <Card.Img
                      variant="top"
                      src={`http://127.0.0.1:5000${frame.frame_url}`}
                      alt={`Frame ${frame.id}`}
                      className="significant-frame-img"
                    />
                  ) : (
                    <div style={{ height: '250px', backgroundColor: '#f0f0f0' }}></div>
                  )}
                  <Card.Body>
                    <Card.Title className="frame-title">Clip {idx + 1}</Card.Title>
                    <Card.Text className="frame-text">
                      <strong>Timestamp:</strong> {frame.timestamp.toFixed(2)}s
                      <br />
                      <strong>Type:</strong> {frame.segment_type}
                      <br />
                      <strong>Label:</strong> {frame.label || 'N/A'}
                    </Card.Text>
                  </Card.Body>
                  {isAddingFrames && (
                    <Card.Footer className="text-center">
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => handleRemoveSignificantFrame(idx)}
                      >
                        Remove Frame
                      </Button>
                    </Card.Footer>
                  )}
                </Card>
              </Col>
            ))}
          </Row>
          {isAddingFrames && (
            <Alert variant="info" className="mt-4">
              You can add or remove significant frames as needed. Click "Finalize Significant
              Frames" when done.
            </Alert>
          )}
        </>
      ) : null}
      {isFinalized && !isLabelsSubmitted && (
        <>
          <h3 className="mt-5 mb-4">Significant Frames and Timestamps</h3>
          <Row xs={1} sm={2} md={3} lg={4} className="g-4">
            {adjustedFrames.map((frame, idx) => (
              <Col key={idx}>
                <Card className="h-100 shadow-sm">
                  {frame.frame_url ? (
                    <Card.Img
                      variant="top"
                      src={`http://127.0.0.1:5000${frame.frame_url}`}
                      alt={`Frame ${frame.id}`}
                      className="significant-frame-img"
                    />
                  ) : (
                    <div style={{ height: '250px', backgroundColor: '#f0f0f0' }}></div>
                  )}
                  <Card.Body>
                    <Card.Title className="frame-title">Clip {idx + 1}</Card.Title>
                    <Card.Text className="frame-text">
                      <strong>Timestamp:</strong> {frame.timestamp.toFixed(2)}s
                      <br />
                      <strong>Label:</strong> {frame.label || 'N/A'}
                    </Card.Text>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
          <LabelInput
            numClips={adjustedFrames.length}
            videoId={data.video_id}
            onLabelsSaved={handleLabelsSaved}
          />
        </>
      )}
      {isLabelsSubmitted && (
        <div className="mt-5">
          {data.categories && data.categories.length > 0 && (
            <div className="text-center mb-4">
              <h4>Categories</h4>
              <ListGroup horizontal className="justify-content-center">
                {data.categories.map((category, idx) => (
                  <ListGroup.Item key={idx} className="px-4 py-2">
                    {category}
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </div>
          )}
          <h3 className="text-center mb-4">Finalized Significant Frames</h3>
          <Row xs={1} sm={2} md={3} lg={4} className="g-4">
            {adjustedFrames.map((frame, idx) => (
              <Col key={idx}>
                <Card className="h-100 shadow-sm">
                  {frame.frame_url ? (
                    <Card.Img
                      variant="top"
                      src={`http://127.0.0.1:5000${frame.frame_url}`}
                      alt={`Frame ${frame.id}`}
                      className="significant-frame-img"
                    />
                  ) : (
                    <div style={{ height: '250px', backgroundColor: '#f0f0f0' }}></div>
                  )}
                  <Card.Body>
                    <Card.Title className="frame-title">Clip {idx + 1}</Card.Title>
                    <Card.Text className="frame-text">
                      <strong>Timestamp:</strong> {frame.timestamp.toFixed(2)}s
                      <br />
                      <strong>Label:</strong> {frame.label}
                    </Card.Text>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
          <h4 className="mt-5">Final Analysis Data</h4>
          <pre className="json-output">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
      {/* Confirmation Modal */}
      <Modal
        show={showConfirmation}
        onHide={handleCloseConfirmation}
        centered
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header closeButton>
          <Modal.Title>Submission Successful</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          <Image
            src="https://i.imgur.com/4M7CH8J.png"
            alt="Success"
            width="100"
            className="mb-4"
          />
          <h5>Your labels have been submitted successfully!</h5>
        </Modal.Body>
        <Modal.Footer className="justify-content-center">
          <Button variant="success" onClick={handleCloseConfirmation}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
      {/* Graph Modal */}
      <Modal
        show={showGraphModal}
        onHide={handleCloseGraphModal}
        centered
        size="lg"
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header closeButton>
          <Modal.Title>Analysis Graph</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {data.plot_url && (
            <Image
              src={`http://127.0.0.1:5000${data.plot_url}`}
              alt="Analysis Graph"
              fluid
            />
          )}
        </Modal.Body>
        <Modal.Footer className="justify-content-center">
          <Button variant="secondary" onClick={handleCloseGraphModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default AnalysisResult;
