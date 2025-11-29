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
    _current_recording_file = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._initialize_camera()
        return cls._instance
    
    @classmethod
    def _initialize_camera(cls):
        """Initialize the Picamera2 instance."""
        cls._camera = Picamera2()
        cls._camera.configure(cls._camera.create_video_configuration())
        cls._camera.start()
        
        # Create recordings directory if it doesn't exist
        if not os.path.exists(cls._recordings_dir):
            os.makedirs(cls._recordings_dir)
    
    @classmethod
    def get_frame(cls):
        """Capture a frame from the camera and encode it as JPEG."""
        if cls._camera is None:
            cls._initialize_camera()
        
        frame = cls._camera.capture_array()
        
        # Write frame to video if recording
        with cls._lock:
            if cls._is_recording and cls._video_writer is not None:
                # Convert RGB to BGR for OpenCV
                bgr_frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
                cls._video_writer.write(bgr_frame)
        
        ret, jpeg = cv2.imencode('.jpg', frame)
        
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
            filename = f"recording_{timestamp}.avi"
            cls._current_recording_file = os.path.join(cls._recordings_dir, filename)
            
            # Get frame dimensions from camera
            if cls._camera is None:
                cls._initialize_camera()
            
            # Initialize video writer
            fourcc = cv2.VideoWriter_fourcc(*'XVID')
            cls._video_writer = cv2.VideoWriter(
                cls._current_recording_file,
                fourcc,
                20.0,  # FPS
                (640, 480)  # Resolution - adjust as needed
            )
            
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
                "duration": duration
            }
            
            cls._recording_start_time = None
            cls._current_recording_file = None
            
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
                if filename.endswith(('.avi', '.mp4')):
                    filepath = os.path.join(cls._recordings_dir, filename)
                    stat = os.stat(filepath)
                    recordings.append({
                        "filename": filename,
                        "size": stat.st_size,
                        "created": datetime.fromtimestamp(stat.st_ctime).isoformat()
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
