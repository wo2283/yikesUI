// src/components/LabelInput.js

import React, { useState } from 'react';
import axios from 'axios';
import { Form, Button, ListGroup, Row, Col } from 'react-bootstrap';

const LabelInput = ({ numClips, videoId, onLabelsSaved }) => {
  const [labels, setLabels] = useState(Array(numClips).fill(''));
  const [categories, setCategories] = useState([]);
  const tiktokCategories = [
    'Beauty',
    'Fashion',
    'Dance',
    'Humor',
    'Advice',
    'News',
    'Education',
    'Gaming',
    'Sports',
    'Music',
  ];

  const handleLabelChange = (index, value) => {
    const newLabels = [...labels];
    newLabels[index] = value;
    setLabels(newLabels);
  };

  const handleCategoryChange = (category) => {
    if (categories.includes(category)) {
      setCategories(categories.filter((c) => c !== category));
    } else {
      setCategories([...categories, category]);
    }
  };

  const handleSubmit = () => {
    // Ensure all labels are filled
    if (labels.some((label) => label.trim() === '')) {
      alert('Please fill in all labels before submitting.');
      return;
    }
    // Send labels and categories to the backend
    axios
      .post('http://127.0.0.1:5000/save_labels', {
        video_id: videoId,
        labels: labels,
        categories: categories,
      })
      .then((response) => {
        onLabelsSaved(response.data.analysis_data);
      })
      .catch((error) => {
        console.error('Error saving labels:', error);
      });
  };

  return (
    <div className="mt-5">
      <h3 className="text-center mb-4">Label the Clips</h3>
      <Form>
        <Form.Group className="mb-4">
          <Form.Label>
            <strong>Select Categories for the Trend:</strong>
          </Form.Label>
          <Row>
            {tiktokCategories.map((category) => (
              <Col xs={6} md={4} key={category}>
                <Form.Check
                  type="checkbox"
                  label={category}
                  value={category}
                  checked={categories.includes(category)}
                  onChange={() => handleCategoryChange(category)}
                />
              </Col>
            ))}
          </Row>
        </Form.Group>
        {labels.map((label, idx) => (
          <Form.Group key={idx} controlId={`label${idx}`} className="mb-3">
            <Form.Label>
              <strong>Clip {idx + 1} Label:</strong>
            </Form.Label>
            <Form.Control
              type="text"
              value={label}
              onChange={(e) => handleLabelChange(idx, e.target.value)}
              placeholder="Enter label"
            />
          </Form.Group>
        ))}
        <div className="text-center mt-4">
          <Button variant="primary" size="lg" onClick={handleSubmit}>
            Submit Labels
          </Button>
        </div>
      </Form>
    </div>
  );
};

export default LabelInput;
