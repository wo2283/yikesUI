# get_vid_analysis.py

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import subprocess
import os
from PIL import Image
import imagehash
import re
import numpy as np
import cv2
import json
import ast
import shutil

def extract_frame_number(filename):
    # get frame numbers from the file name
    match = re.match(r"output_frame_(\d+)\.png", filename)
    return int(match.group(1)) if match else None

def extract_frames(video_path, fps, frame_output_path, frames_folder, buffer):
    # Get the total duration of the video
    command = f'ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "{video_path}"'
    process = subprocess.run(command, shell=True, text=True, capture_output=True)
    duration_in_seconds = float(process.stdout.strip())

    ffmpeg_extract_command = f'ffmpeg -y -ss {round(buffer / fps, 2)} -i "{video_path}" -vf "fps={fps}" -start_number 0 "{frame_output_path}"'
    subprocess.run(ffmpeg_extract_command, shell=True)

    frame_files = [f for f in os.listdir(frames_folder) if f.startswith('output_frame_') and f.endswith('.png')]
    frame_paths = [os.path.join(frames_folder, frame) for frame in sorted(frame_files, key=extract_frame_number)]

    return frame_paths, duration_in_seconds

def get_transitions(min_threshold, hashes):
    diffs = []
    sigs = []
    for i in range(1, len(hashes)):
        diff = hashes[i] - hashes[i-1]
        diffs.append(diff)

    average_diff = np.mean(diffs)
    std_dev_diff = np.std(diffs)
    dynamic_threshold = average_diff + std_dev_diff * 2.5

    if dynamic_threshold < min_threshold or np.isnan(dynamic_threshold):
        return 0, [], dynamic_threshold  # high threshold with no significant changes

    for i, diff in enumerate(diffs):
        if diff > dynamic_threshold:
            sigs.append(i+1)

    return sigs, diffs, dynamic_threshold

def get_hashes(frame_paths, min_threshold):
    hashes = []
    for path in frame_paths:
        img = Image.open(path)
        hash = imagehash.dhash(img)
        hashes.append(hash)

    if not hashes:
        return 0, [], min_threshold

    significant_changes, differences, dynamic_threshold = get_transitions(min_threshold, hashes)

    # removing the last pop up and re-calculating   
    if significant_changes:
        last_significant = significant_changes[-1]
        hashes = hashes[:last_significant]
        differences = differences[:last_significant - 1]  # Since differences are between frames

        significant_changes, differences, dynamic_threshold = get_transitions(min_threshold, hashes)

    return significant_changes, differences, dynamic_threshold

def get_timestamps(fps, significant_changes, duration_in_seconds):
    return [0.0] + [index / fps for index in significant_changes] + [duration_in_seconds]

def get_formatted_timestamps(timestamps):
    formatted = []
    for t in timestamps:
        t_float = float(t)
        minutes = int(t_float // 60)
        seconds = int(t_float % 60)
        tenths = int((t_float * 10) % 10)
        formatted.append(f"{minutes}:{seconds:02}.{tenths}")
    return formatted

def classify_ease(photo_count, video_count):
    if video_count == 0:
        return 'Easy'
    elif video_count > photo_count:
        return 'Hard'
    else:
        return 'Medium'

def get_vid_or_pic(differences, significant_changes, photo_threshold, fps):
    segments = []
    photo_count = 0
    video_count = 0

    changes = [0] + significant_changes + [len(differences)]

    for i in range(len(changes) - 1):
        # takes the segment between the differences
        segment_start = changes[i]
        segment_end = changes[i + 1] - 1
        segment_differences = differences[segment_start:segment_end]

        # gets rid of frame shift and significant changes
        edited_sig = [x - 1 for x in significant_changes]
        non_significant_differences = [diff for i, diff in enumerate(differences) if i not in edited_sig]
        small_change_threshold = round(np.std(non_significant_differences), 4)

        # use the variance in each segment to categorize
        var_diff = round(np.var(segment_differences), 4)
        if var_diff < photo_threshold:
            segment_type = 'photo'
            photo_count += 1
        elif var_diff < small_change_threshold:
            segment_type = "still shot / text change"
            photo_count += 1
        else:
            segment_type = 'video'
            video_count += 1

        segments.append(segment_type)

    ease = classify_ease(photo_count, video_count)
    print(f"Trend complexity: {ease}")
    
    return segments, ease

def make_graph(directory_path, dynamic_threshold, differences, photo_threshold, significant_changes=None):
    plt.figure(figsize=(10, 5))
    plt.plot(differences, label='Difference')
    if significant_changes:
        plt.scatter(significant_changes, [differences[i-1] for i in significant_changes], color='red', label='Significant Change')
        # Making the small change threshold excluding the significant changes
        edited_sig = [x - 1 for x in significant_changes]
        non_significant_differences = [diff for i, diff in enumerate(differences) if i not in edited_sig]
        small_change_threshold = round(np.std(non_significant_differences), 4)
        plt.axhline(y=small_change_threshold, color='orange', linestyle='--', label='Small Change Threshold')
    else:
        plt.axhline(y=photo_threshold, color='blue', linestyle='--', label='Photo Threshold')
    plt.axhline(y=dynamic_threshold, color='green', linestyle='--', label='Dynamic Threshold')
    plt.title('Perceptual Hash Differences Between Consecutive Frames')
    plt.xlabel('Frame')
    plt.ylabel('Difference')
    plt.legend()

    # Save plot to the specified directory
    if directory_path:
        plot_path = os.path.join(directory_path, 'plot.png')
        plt.savefig(plot_path)
        print(f"Plot saved to {plot_path}")
    else:
        plot_path = 'plot.png'
        plt.savefig(plot_path)
        print(f"Plot saved to {plot_path}")
        
    plt.close()  # Close the figure to free memory

def make_signature_frames(significant_changes, frames_folder):
    significant_changes.insert(0, 0)
    count = 0
    for frame_index in significant_changes:
        img = 'output_frame_' + str(frame_index) + '.png'
        full_path = os.path.join(frames_folder, img)
        
        # Check if it's a file and has a valid image extension
        if os.path.isfile(full_path) and os.path.splitext(img)[1].lower() in '.png':
            new_name = f"significant_frame_{count}.png"
            new_path = os.path.join(frames_folder, new_name)
            
            shutil.copy2(full_path, new_path)
            count += 1
