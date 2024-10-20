# app.py

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import uuid
import shutil
from werkzeug.utils import secure_filename
from get_vid_analysis import extract_frames, get_hashes, get_timestamps, get_formatted_timestamps, get_vid_or_pic, make_graph, make_signature_frames
import json
import subprocess

app = Flask(__name__)
CORS(app)

# Configure upload folder
UPLOAD_FOLDER = 'uploads'
RESULTS_FOLDER = 'results'
ALLOWED_EXTENSIONS = {'mp4', 'mov', 'avi'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['RESULTS_FOLDER'] = RESULTS_FOLDER

# Ensure the upload and results folders exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/analyze', methods=['POST'])
def analyze_video():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file and allowed_file(file.filename):
        # Save the uploaded video
        filename = secure_filename(file.filename)
        video_id = str(uuid.uuid4())
        video_folder = os.path.join(app.config['UPLOAD_FOLDER'], video_id)
        os.makedirs(video_folder, exist_ok=True)
        video_path = os.path.join(video_folder, filename)
        file.save(video_path)

        # Run the analysis
        try:
            results = run_analysis(video_path, video_id)
            return jsonify(results)
        except Exception as e:
            return jsonify({'error': str(e)}), 500
        finally:
            # Clean up if necessary
            pass
    else:
        return jsonify({'error': 'Invalid file type'}), 400

def run_analysis(video_path, video_id):
    # Define parameters
    fps = 12
    min_threshold = 12
    photo_threshold = 0.3
    buffer = 2

    # Set up directories
    frames_folder = os.path.join(app.config['UPLOAD_FOLDER'], video_id, 'frames')
    os.makedirs(frames_folder, exist_ok=True)
    frame_output_path = os.path.join(frames_folder, 'output_frame_%d.png')
    directory_path = frames_folder  # Use frames folder for temp files

    # Extract frames
    frame_paths, duration_in_seconds = extract_frames(
        video_path, fps, frame_output_path, frames_folder, buffer)

    if not frame_paths:
        raise Exception("No frames were extracted from the video.")

    # Analyze frames
    significant_changes, differences, dynamic_threshold = get_hashes(
        frame_paths, min_threshold)

    if significant_changes == 0 or not differences:
        raise Exception("No significant changes detected in the video.")

    timestamps_raw = get_timestamps(
        fps, significant_changes, duration_in_seconds)
    timestamps = get_formatted_timestamps(timestamps_raw)
    segments, ease = get_vid_or_pic(
        differences, significant_changes, photo_threshold, fps)

    # Generate graph
    make_graph(
        directory_path, dynamic_threshold, differences, photo_threshold, significant_changes)

    # Generate significant frames
    make_signature_frames(significant_changes, frames_folder)

    # Prepare results
    significant_frames = []
    for idx in range(len(segments)):
        frame_filename = f"significant_frame_{idx}.png"
        frame_path = os.path.join(frames_folder, frame_filename)
        if os.path.isfile(frame_path):
            # Move the frame to the results folder
            result_frame_folder = os.path.join(app.config['RESULTS_FOLDER'], video_id)
            os.makedirs(result_frame_folder, exist_ok=True)
            shutil.copy(frame_path, result_frame_folder)
            # Prepare the frame URL to send to the frontend
            frame_url = f"/results/{video_id}/{frame_filename}"
            significant_frames.append({
                'id': idx + 1,
                'timestamp': timestamps_raw[idx],
                'segment_type': segments[idx],
                'frame_url': frame_url,
                'label': ""  # Placeholder for label
            })

    # Copy the plot to the results folder
    plot_path = os.path.join(directory_path, 'plot.png')
    if os.path.isfile(plot_path):
        result_plot_folder = os.path.join(app.config['RESULTS_FOLDER'], video_id)
        os.makedirs(result_plot_folder, exist_ok=True)
        shutil.copy(plot_path, result_plot_folder)
        plot_url = f"/results/{video_id}/plot.png"
    else:
        plot_url = None

    # Copy the video to the results folder
    result_video_folder = os.path.join(app.config['RESULTS_FOLDER'], video_id)
    os.makedirs(result_video_folder, exist_ok=True)
    shutil.copy(video_path, result_video_folder)
    video_filename = os.path.basename(video_path)
    video_url = f"/results/{video_id}/{video_filename}"

    # Prepare final data
    results = {
        'video_id': video_id,
        'ease': ease,
        'duration': duration_in_seconds,
        'timestamps': timestamps_raw,
        'significant_frames': significant_frames,
        'plot_url': plot_url,
        'video_url': video_url
    }

    # Save initial results to JSON file
    analysis_json_path = os.path.join(app.config['RESULTS_FOLDER'], video_id, 'analysis.json')
    with open(analysis_json_path, 'w') as f:
        json.dump(results, f, indent=4)

    return results

@app.route('/update_timestamps', methods=['POST'])
def update_timestamps():
    data = request.get_json()
    video_id = data.get('video_id')
    significant_frames = data.get('significant_frames')

    if not video_id or significant_frames is None:
        return jsonify({'error': 'Missing video_id or significant_frames'}), 400

    # Load existing analysis data
    analysis_json_path = os.path.join(app.config['RESULTS_FOLDER'], video_id, 'analysis.json')
    if not os.path.isfile(analysis_json_path):
        return jsonify({'error': 'Analysis data not found'}), 404

    with open(analysis_json_path, 'r') as f:
        analysis_data = json.load(f)

    # Get existing frame files
    result_frame_folder = os.path.join(app.config['RESULTS_FOLDER'], video_id)
    existing_frame_files = set()
    for frame in analysis_data['significant_frames']:
        frame_filename = os.path.basename(frame['frame_url'])
        existing_frame_files.add(frame_filename)

    # Update significant frames
    analysis_data['significant_frames'] = significant_frames

    # Generate or update frame images
    video_path = os.path.join(app.config['RESULTS_FOLDER'], video_id, os.path.basename(analysis_data['video_url']))
    updated_frame_files = set()
    for idx, frame in enumerate(analysis_data['significant_frames']):
        frame_filename = f"significant_frame_{idx}.png"
        frame_path = os.path.join(result_frame_folder, frame_filename)
        timestamp = frame['timestamp']

        # Extract frame image at the specified timestamp
        extract_frame_command = f'ffmpeg -y -ss {timestamp} -i "{video_path}" -frames:v 1 "{frame_path}"'
        subprocess.run(extract_frame_command, shell=True)

        frame['frame_url'] = f"/results/{video_id}/{frame_filename}"
        frame['id'] = idx + 1  # Update ID based on index

        updated_frame_files.add(frame_filename)

    # Delete frame images that are no longer needed
    frames_to_delete = existing_frame_files - updated_frame_files
    for frame_file in frames_to_delete:
        frame_path = os.path.join(result_frame_folder, frame_file)
        if os.path.isfile(frame_path):
            os.remove(frame_path)

    # Save updated analysis data
    with open(analysis_json_path, 'w') as f:
        json.dump(analysis_data, f, indent=4)

    return jsonify({'message': 'Significant frames updated successfully', 'analysis_data': analysis_data})

@app.route('/save_labels', methods=['POST'])
def save_labels():
    data = request.get_json()
    video_id = data.get('video_id')
    labels = data.get('labels')
    categories = data.get('categories')

    if not video_id or labels is None:
        return jsonify({'error': 'Missing video_id or labels'}), 400

    # Load existing analysis data
    analysis_json_path = os.path.join(app.config['RESULTS_FOLDER'], video_id, 'analysis.json')
    if not os.path.isfile(analysis_json_path):
        return jsonify({'error': 'Analysis data not found'}), 404

    with open(analysis_json_path, 'r') as f:
        analysis_data = json.load(f)

    # Update labels and categories
    for idx, label in enumerate(labels):
        if idx < len(analysis_data['significant_frames']):
            analysis_data['significant_frames'][idx]['label'] = label

    analysis_data['categories'] = categories

    # Save updated analysis data
    with open(analysis_json_path, 'w') as f:
        json.dump(analysis_data, f, indent=4)

    return jsonify({'message': 'Labels saved successfully', 'analysis_data': analysis_data})

@app.route('/results/<video_id>/<filename>')
def serve_results(video_id, filename):
    return send_from_directory(os.path.join(app.config['RESULTS_FOLDER'], video_id), filename)

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
