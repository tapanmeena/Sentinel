"""Camera module for handling Picamera2 operations."""
import cv2
import json
import os
import threading
import time
from collections import deque
from datetime import datetime
from picamera2 import Picamera2


class Camera:
    """Singleton camera class for managing the Picamera2 instance."""
    
    _instance = None
    _camera = None
    _is_recording = False
    _is_motion_recording = False  # Track if recording was triggered by motion
    _video_writer = None
    _recording_thread = None
    _recording_start_time = None
    _recordings_dir = "recordings"
    _thumbnails_dir = "thumbnails"
    _current_recording_file = None
    _lock = threading.Lock()
    _frame_width = 1280
    _frame_height = 720
    _last_frame = None  # Store last frame for thumbnail
    
    # Motion detection settings
    _motion_enabled = False
    _motion_sensitivity = 30  # 1-100, lower = more sensitive
    _motion_cooldown = 10  # Seconds to continue recording after motion stops
    _motion_buffer_seconds = 5  # Seconds of pre-motion buffer
    _motion_detected = False
    _last_motion_time = 0
    _previous_frame = None
    _frame_buffer = None  # Will be initialized as deque
    _motion_config_file = "motion_config.json"
    _fps = 20.0
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._initialize_camera()
        return cls._instance
    
    @classmethod
    def _initialize_camera(cls):
        """Initialize the Picamera2 instance."""
        cls._camera = Picamera2()
        config = cls._camera.create_video_configuration(main={"size": (1280, 720)})
        cls._camera.configure(config)
        cls._camera.start()
        
        # Get actual frame dimensions
        cls._frame_width = 1280
        cls._frame_height = 720
        
        # Initialize frame buffer for motion detection (5 seconds at 20fps = 100 frames)
        buffer_size = int(cls._motion_buffer_seconds * cls._fps)
        cls._frame_buffer = deque(maxlen=buffer_size)
        
        # Load motion config
        cls._load_motion_config()
        
        # Create directories if they don't exist
        if not os.path.exists(cls._recordings_dir):
            os.makedirs(cls._recordings_dir)
        if not os.path.exists(cls._thumbnails_dir):
            os.makedirs(cls._thumbnails_dir)
    
    @classmethod
    def get_frame(cls):
        """Capture a frame from the camera and encode it as JPEG."""
        if cls._camera is None:
            cls._initialize_camera()
        
        frame = cls._camera.capture_array()
        
        # Convert RGB to BGR for OpenCV
        bgr_frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
        current_time = time.time()
        
        # Add frame to buffer for motion detection pre-recording
        if cls._frame_buffer is not None:
            cls._frame_buffer.append((current_time, bgr_frame.copy()))
        
        # Motion detection
        motion_now = False
        if cls._motion_enabled:
            motion_now = cls._detect_motion(bgr_frame)
            if motion_now:
                cls._last_motion_time = current_time
                cls._motion_detected = True
            
            # Handle motion-triggered recording
            cls._handle_motion_recording(current_time)
        
        # Write frame to video if recording
        with cls._lock:
            if cls._is_recording and cls._video_writer is not None:
                try:
                    cls._video_writer.write(bgr_frame)
                    # Store last frame for thumbnail
                    cls._last_frame = bgr_frame.copy()
                except Exception as e:
                    print(f"Error writing frame: {e}")
        
        ret, jpeg = cv2.imencode('.jpg', bgr_frame)
        
        if ret:
            return jpeg.tobytes()
        return None
    
    @classmethod
    def _detect_motion(cls, frame):
        """Detect motion by comparing with previous frame."""
        # Convert to grayscale for comparison
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (21, 21), 0)
        
        if cls._previous_frame is None:
            cls._previous_frame = gray
            return False
        
        # Compute absolute difference between frames
        frame_delta = cv2.absdiff(cls._previous_frame, gray)
        
        # Threshold based on sensitivity (lower sensitivity value = more sensitive)
        threshold_value = cls._motion_sensitivity
        thresh = cv2.threshold(frame_delta, threshold_value, 255, cv2.THRESH_BINARY)[1]
        
        # Dilate to fill gaps
        thresh = cv2.dilate(thresh, None, iterations=2)
        
        # Find contours (motion regions)
        contours, _ = cv2.findContours(thresh.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Update previous frame
        cls._previous_frame = gray
        
        # Check if any significant motion detected
        min_area = 500  # Minimum contour area to consider as motion
        for contour in contours:
            if cv2.contourArea(contour) > min_area:
                return True
        
        return False
    
    @classmethod
    def _handle_motion_recording(cls, current_time):
        """Handle automatic recording based on motion detection."""
        time_since_motion = current_time - cls._last_motion_time
        
        with cls._lock:
            # Start recording if motion detected and not already recording
            if cls._motion_detected and not cls._is_recording:
                cls._start_motion_recording()
            
            # Stop recording if cooldown period has passed
            elif cls._is_motion_recording and cls._is_recording:
                if time_since_motion > cls._motion_cooldown:
                    cls._motion_detected = False
                    # Release lock before calling stop_recording
                    cls._lock.release()
                    try:
                        cls.stop_recording()
                    finally:
                        cls._lock.acquire()
    
    @classmethod
    def _start_motion_recording(cls):
        """Start a motion-triggered recording with buffer dump."""
        # Generate filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"motion_{timestamp}.mp4"
        cls._current_recording_file = os.path.join(cls._recordings_dir, filename)
        
        # Initialize video writer
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        cls._video_writer = cv2.VideoWriter(
            cls._current_recording_file,
            fourcc,
            cls._fps,
            (cls._frame_width, cls._frame_height)
        )
        
        if not cls._video_writer.isOpened():
            cls._video_writer = None
            print("Failed to start motion recording")
            return
        
        # Write buffered frames (pre-motion footage)
        if cls._frame_buffer:
            for _, buffered_frame in cls._frame_buffer:
                cls._video_writer.write(buffered_frame)
        
        cls._is_recording = True
        cls._is_motion_recording = True
        cls._recording_start_time = datetime.now()
        print(f"Motion recording started: {filename}")
    
    @classmethod
    def generate_frames(cls):
        """Generator function for streaming video frames."""
        while True:
            frame = cls.get_frame()
            if frame:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
    
    @classmethod
    def start_recording(cls, manual=True):
        """Start recording video to file."""
        with cls._lock:
            if cls._is_recording:
                return {"success": False, "message": "Already recording"}
            
            # Generate filename with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            prefix = "recording" if manual else "motion"
            filename = f"{prefix}_{timestamp}.mp4"
            cls._current_recording_file = os.path.join(cls._recordings_dir, filename)
            
            # Get frame dimensions from camera
            if cls._camera is None:
                cls._initialize_camera()
            
            # Initialize video writer with MP4 format (browser compatible)
            # Use mp4v codec which is widely supported
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            cls._video_writer = cv2.VideoWriter(
                cls._current_recording_file,
                fourcc,
                cls._fps,
                (cls._frame_width, cls._frame_height)
            )
            
            # Verify VideoWriter opened successfully
            if not cls._video_writer.isOpened():
                cls._video_writer = None
                return {"success": False, "message": "Failed to initialize video writer"}
            
            cls._is_recording = True
            cls._is_motion_recording = not manual
            cls._recording_start_time = datetime.now()
            
            return {
                "success": True,
                "message": "Recording started",
                "filename": filename,
                "start_time": cls._recording_start_time.isoformat()
            }
    
    @classmethod
    def stop_recording(cls):
        """Stop recording video."""
        with cls._lock:
            if not cls._is_recording:
                return {"success": False, "message": "Not recording"}
            
            cls._is_recording = False
            was_motion_recording = cls._is_motion_recording
            cls._is_motion_recording = False
            
            # Generate thumbnail from last frame
            thumbnail_name = None
            if cls._last_frame is not None and cls._current_recording_file:
                try:
                    # Get base name without extension
                    base_name = os.path.splitext(os.path.basename(cls._current_recording_file))[0]
                    thumbnail_name = f"{base_name}.jpg"
                    thumbnail_path = os.path.join(cls._thumbnails_dir, thumbnail_name)
                    
                    # Resize for thumbnail (320x180 for 16:9)
                    thumbnail = cv2.resize(cls._last_frame, (320, 180))
                    cv2.imwrite(thumbnail_path, thumbnail)
                except Exception as e:
                    print(f"Error creating thumbnail: {e}")
                    thumbnail_name = None
            
            if cls._video_writer is not None:
                cls._video_writer.release()
                cls._video_writer = None
            
            duration = None
            if cls._recording_start_time:
                duration = (datetime.now() - cls._recording_start_time).total_seconds()
            
            recording_type = "motion" if was_motion_recording else "manual"
            result = {
                "success": True,
                "message": f"Recording stopped ({recording_type})",
                "filename": cls._current_recording_file,
                "thumbnail": thumbnail_name,
                "duration": duration,
                "type": recording_type
            }
            
            if was_motion_recording:
                print(f"Motion recording stopped: {cls._current_recording_file}")
            
            cls._recording_start_time = None
            cls._current_recording_file = None
            cls._last_frame = None
            
            return result
    
    @classmethod
    def get_recording_status(cls):
        """Get current recording status."""
        with cls._lock:
            duration = None
            if cls._is_recording and cls._recording_start_time:
                duration = (datetime.now() - cls._recording_start_time).total_seconds()
            
            return {
                "is_recording": cls._is_recording,
                "filename": cls._current_recording_file,
                "duration": duration,
                "start_time": cls._recording_start_time.isoformat() if cls._recording_start_time else None
            }
    
    @classmethod
    def get_recordings_list(cls):
        """Get list of all recordings."""
        recordings = []
        if os.path.exists(cls._recordings_dir):
            for filename in os.listdir(cls._recordings_dir):
                if filename.endswith('.mp4'):
                    filepath = os.path.join(cls._recordings_dir, filename)
                    stat = os.stat(filepath)
                    
                    # Check for thumbnail
                    base_name = os.path.splitext(filename)[0]
                    thumbnail_name = f"{base_name}.jpg"
                    thumbnail_path = os.path.join(cls._thumbnails_dir, thumbnail_name)
                    has_thumbnail = os.path.exists(thumbnail_path)
                    
                    recordings.append({
                        "filename": filename,
                        "size": stat.st_size,
                        "created": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                        "thumbnail": thumbnail_name if has_thumbnail else None
                    })
        
        # Sort by creation time, newest first
        recordings.sort(key=lambda x: x['created'], reverse=True)
        return recordings
    
    @classmethod
    def delete_recording(cls, filename):
        """Delete a recording file."""
        # Security: prevent path traversal
        if '..' in filename or '/' in filename:
            return {"success": False, "message": "Invalid filename"}
        
        filepath = os.path.join(cls._recordings_dir, filename)
        
        if not os.path.exists(filepath):
            return {"success": False, "message": "Recording not found"}
        
        try:
            os.remove(filepath)
            
            # Also delete thumbnail if exists
            base_name = os.path.splitext(filename)[0]
            thumbnail_path = os.path.join(cls._thumbnails_dir, f"{base_name}.jpg")
            if os.path.exists(thumbnail_path):
                os.remove(thumbnail_path)
            
            return {"success": True, "message": "Recording deleted"}
        except Exception as e:
            return {"success": False, "message": str(e)}
    
    @classmethod
    def capture_snapshot(cls):
        """Capture a snapshot image."""
        if cls._camera is None:
            cls._initialize_camera()
        
        # Create snapshots directory if it doesn't exist
        snapshots_dir = "snapshots"
        if not os.path.exists(snapshots_dir):
            os.makedirs(snapshots_dir)
        
        # Generate filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"snapshot_{timestamp}.jpg"
        filepath = os.path.join(snapshots_dir, filename)
        
        # Capture and save frame
        frame = cls._camera.capture_array()
        bgr_frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
        cv2.imwrite(filepath, bgr_frame)
        
        return {
            "success": True,
            "filename": filename,
            "filepath": filepath
        }
    
    @classmethod
    def release(cls):
        """Release the camera resource."""
        # Stop recording if active
        if cls._is_recording:
            cls.stop_recording()
        
        if cls._camera:
            cls._camera.stop()
            cls._camera = None
            cls._instance = None
    
    # ========== Motion Detection Methods ==========
    
    @classmethod
    def _load_motion_config(cls):
        """Load motion detection settings from config file."""
        try:
            if os.path.exists(cls._motion_config_file):
                with open(cls._motion_config_file, 'r') as f:
                    config = json.load(f)
                    cls._motion_enabled = config.get('enabled', False)
                    cls._motion_sensitivity = config.get('sensitivity', 30)
                    cls._motion_cooldown = config.get('cooldown', 10)
                    cls._motion_buffer_seconds = config.get('buffer_seconds', 5)
                    print(f"Motion config loaded: enabled={cls._motion_enabled}, sensitivity={cls._motion_sensitivity}")
        except Exception as e:
            print(f"Error loading motion config: {e}")
    
    @classmethod
    def _save_motion_config(cls):
        """Save motion detection settings to config file."""
        try:
            config = {
                'enabled': cls._motion_enabled,
                'sensitivity': cls._motion_sensitivity,
                'cooldown': cls._motion_cooldown,
                'buffer_seconds': cls._motion_buffer_seconds
            }
            with open(cls._motion_config_file, 'w') as f:
                json.dump(config, f, indent=2)
        except Exception as e:
            print(f"Error saving motion config: {e}")
    
    @classmethod
    def get_motion_status(cls):
        """Get current motion detection status."""
        return {
            "enabled": cls._motion_enabled,
            "motion_detected": cls._motion_detected,
            "is_motion_recording": cls._is_motion_recording,
            "sensitivity": cls._motion_sensitivity,
            "cooldown": cls._motion_cooldown,
            "buffer_seconds": cls._motion_buffer_seconds,
            "time_since_motion": time.time() - cls._last_motion_time if cls._last_motion_time > 0 else None
        }
    
    @classmethod
    def enable_motion_detection(cls):
        """Enable motion detection."""
        cls._motion_enabled = True
        cls._motion_detected = False
        cls._last_motion_time = 0
        cls._previous_frame = None
        cls._save_motion_config()
        return {"success": True, "message": "Motion detection enabled"}
    
    @classmethod
    def disable_motion_detection(cls):
        """Disable motion detection."""
        cls._motion_enabled = False
        cls._motion_detected = False
        cls._save_motion_config()
        
        # Stop any ongoing motion recording
        if cls._is_motion_recording:
            cls.stop_recording()
        
        return {"success": True, "message": "Motion detection disabled"}
    
    @classmethod
    def set_motion_settings(cls, sensitivity=None, cooldown=None, buffer_seconds=None):
        """Update motion detection settings."""
        if sensitivity is not None:
            # Clamp to valid range (1-100)
            cls._motion_sensitivity = max(1, min(100, int(sensitivity)))
        
        if cooldown is not None:
            # Clamp to valid range (3-60 seconds)
            cls._motion_cooldown = max(3, min(60, int(cooldown)))
        
        if buffer_seconds is not None:
            # Clamp to valid range (1-10 seconds)
            cls._motion_buffer_seconds = max(1, min(10, int(buffer_seconds)))
            # Resize buffer
            buffer_size = int(cls._motion_buffer_seconds * cls._fps)
            old_buffer = list(cls._frame_buffer) if cls._frame_buffer else []
            cls._frame_buffer = deque(old_buffer[-buffer_size:], maxlen=buffer_size)
        
        cls._save_motion_config()
        
        return {
            "success": True,
            "message": "Motion settings updated",
            "settings": {
                "sensitivity": cls._motion_sensitivity,
                "cooldown": cls._motion_cooldown,
                "buffer_seconds": cls._motion_buffer_seconds
            }
        }
