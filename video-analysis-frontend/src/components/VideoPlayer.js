// src/components/VideoPlayer.js

import React, { useRef, useState } from 'react';
import ReactPlayer from 'react-player';
import { Spinner } from 'react-bootstrap'; // Added Spinner import
import './VideoPlayer.css';

const VideoPlayer = ({ analysisData, onTimeUpdate }) => {
  const playerRef = useRef(null);
  const [duration, setDuration] = useState(0);

  if (!analysisData || !analysisData.video_url) {
    return (
      <div className="text-center my-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-3">Loading video...</p>
      </div>
    );
  }

  const handleProgress = (state) => {
    if (onTimeUpdate) {
      onTimeUpdate(state.playedSeconds);
    }
  };

  const renderMarkers = () => {
    return analysisData.significant_frames.map((frame, idx) => {
      const fraction = frame.timestamp / duration;
      return (
        <div
          key={idx}
          className="marker"
          style={{
            left: `${fraction * 100}%`,
          }}
        />
      );
    });
  };

  return (
    <div className="video-player-container">
      <div className="player-wrapper">
        <ReactPlayer
          ref={playerRef}
          url={`http://127.0.0.1:5000${analysisData.video_url}`}
          controls
          width="100%"
          height="100%"
          onDuration={(dur) => setDuration(dur)}
          onProgress={handleProgress}
        />
        {duration > 0 && <div className="progress-bar-container">{renderMarkers()}</div>}
      </div>
    </div>
  );
};

export default VideoPlayer;
