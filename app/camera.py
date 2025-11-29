"""Camera module for handling Picamera2 operations."""
import cv2
import os
import threading
from datetime import datetime
from picamera2 import Picamera2


class Camera:
    """Singleton camera class for managing the Picamera2 instance."""
    
    _instance = None
    _camera = None
    _is_recording = False
    _video_writer = None
    _recording_thread = None
    _recording_start_time = None
    _recordings_dir = "recordings"
    _thumbnails_dir = "thumbnails"
    _current_recording_file = None
    _lock = threading.Lock()
    _frame_width = None
    _frame_height = None
    _last_frame = None  # Store last frame for thumbnail
    
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
    def generate_frames(cls):
        """Generator function for streaming video frames."""
        while True:
            frame = cls.get_frame()
            if frame:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
    
    @classmethod
    def start_recording(cls):
        """Start recording video to file."""
        with cls._lock:
            if cls._is_recording:
                return {"success": False, "message": "Already recording"}
            
            # Generate filename with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"recording_{timestamp}.mp4"
            cls._current_recording_file = os.path.join(cls._recordings_dir, filename)
            
            # Get frame dimensions from camera
            if cls._camera is None:
                cls._initialize_camera()
            
            # Get actual frame size from a test capture
            if cls._frame_width is None or cls._frame_height is None:
                test_frame = cls._camera.capture_array()
                cls._frame_height, cls._frame_width = test_frame.shape[:2]
            
            # Initialize video writer with MP4 format (browser compatible)
            # Use mp4v codec which is widely supported
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            cls._video_writer = cv2.VideoWriter(
                cls._current_recording_file,
                fourcc,
                20.0,  # FPS
                (cls._frame_width, cls._frame_height)
            )
            
            # Verify VideoWriter opened successfully
            if not cls._video_writer.isOpened():
                cls._video_writer = None
                return {"success": False, "message": "Failed to initialize video writer"}
            
            cls._is_recording = True
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
            
            result = {
                "success": True,
                "message": "Recording stopped",
                "filename": cls._current_recording_file,
                "thumbnail": thumbnail_name,
                "duration": duration
            }
            
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
