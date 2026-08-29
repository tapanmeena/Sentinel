"""Camera module for handling multiple camera types (Pi Camera & RTSP)."""
import cv2
import json
import os
import re
import threading
import time
from abc import ABC, abstractmethod
from collections import deque
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Tuple, Any


class CameraState(Enum):
    """Camera connection states."""
    CONNECTED = "connected"
    CONNECTING = "connecting"
    RECONNECTING = "reconnecting"
    OFFLINE = "offline"
    DISABLED = "disabled"


class BaseCamera(ABC):
    """Abstract base class for all camera types."""
    
    def __init__(self, camera_id: str, config: dict):
        self.camera_id = camera_id
        self.config = config
        self.name = config.get('name', camera_id)
        self.resolution = tuple(config.get('resolution', (1920, 1080)))
        self.framerate = config.get('framerate', 30)
        self.enabled = config.get('enabled', True)
        
        # State management
        self._state = CameraState.CONNECTING if self.enabled else CameraState.DISABLED
        self._last_error: Optional[str] = None
        self._lock = threading.Lock()
        
        # Frame management
        self._last_frame: Optional[bytes] = None
        self._last_frame_time: float = 0
        self._frame_width = self.resolution[0]
        self._frame_height = self.resolution[1]
        
        # Recording state
        self._is_recording = False
        self._is_motion_recording = False
        self._video_writer: Optional[cv2.VideoWriter] = None
        self._recording_start_time: Optional[datetime] = None
        self._current_recording_file: Optional[str] = None
        self._last_raw_frame: Optional[Any] = None  # For thumbnail generation
        
        # Motion detection state
        self._motion_enabled = False
        self._motion_sensitivity = 30
        self._motion_cooldown = 10
        self._motion_buffer_seconds = 5
        self._motion_detected = False
        self._last_motion_time: float = 0
        self._previous_frame: Optional[Any] = None
        self._frame_buffer: Optional[deque] = None
        
        # Directories (will be set by CameraManager)
        self._recordings_dir = "recordings"
        self._thumbnails_dir = "thumbnails"
        self._snapshots_dir = "snapshots"
    
    @property
    def state(self) -> CameraState:
        return self._state
    
    @property
    def last_error(self) -> Optional[str]:
        return self._last_error
    
    @abstractmethod
    def initialize(self) -> bool:
        """Initialize the camera connection."""
        pass
    
    @abstractmethod
    def _capture_raw_frame(self) -> Optional[Any]:
        """Capture a raw frame from the camera. Returns BGR numpy array or None."""
        pass
    
    @abstractmethod
    def release(self) -> None:
        """Release camera resources."""
        pass
    
    def get_frame(self) -> Optional[bytes]:
        """Capture a frame and encode it as JPEG."""
        if self._state not in (CameraState.CONNECTED, CameraState.RECONNECTING):
            return self._last_frame  # Return cached frame if available
        
        bgr_frame = self._capture_raw_frame()
        if bgr_frame is None:
            return self._last_frame
        
        current_time = time.time()
        
        # Add frame to buffer for motion detection pre-recording
        if self._frame_buffer is not None:
            self._frame_buffer.append((current_time, bgr_frame.copy()))
        
        # Motion detection
        if self._motion_enabled:
            motion_now = self._detect_motion(bgr_frame)
            if motion_now:
                self._last_motion_time = current_time
                self._motion_detected = True
            self._handle_motion_recording(current_time)
        
        # Write frame to video if recording
        with self._lock:
            if self._is_recording and self._video_writer is not None:
                try:
                    self._video_writer.write(bgr_frame)
                    self._last_raw_frame = bgr_frame.copy()
                except Exception as e:
                    print(f"[{self.camera_id}] Error writing frame: {e}")
        
        ret, jpeg = cv2.imencode('.jpg', bgr_frame)
        if ret:
            self._last_frame = jpeg.tobytes()
            self._last_frame_time = current_time
            return self._last_frame
        return self._last_frame
    
    def generate_frames(self):
        """Generator function for streaming video frames."""
        while True:
            frame = self.get_frame()
            if frame:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
            else:
                time.sleep(0.1)  # Prevent tight loop if no frame
    
    def _detect_motion(self, frame) -> bool:
        """Detect motion by comparing with previous frame."""
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (21, 21), 0)
        
        if self._previous_frame is None:
            self._previous_frame = gray
            return False
        
        frame_delta = cv2.absdiff(self._previous_frame, gray)
        threshold_value = self._motion_sensitivity
        thresh = cv2.threshold(frame_delta, threshold_value, 255, cv2.THRESH_BINARY)[1]
        thresh = cv2.dilate(thresh, None, iterations=2)
        contours, _ = cv2.findContours(thresh.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        self._previous_frame = gray
        
        min_area = 500
        for contour in contours:
            if cv2.contourArea(contour) > min_area:
                return True
        return False
    
    def _handle_motion_recording(self, current_time: float) -> None:
        """Handle automatic recording based on motion detection."""
        time_since_motion = current_time - self._last_motion_time
        
        with self._lock:
            if self._motion_detected and not self._is_recording:
                self._start_motion_recording()
            elif self._is_motion_recording and self._is_recording:
                if time_since_motion > self._motion_cooldown:
                    self._motion_detected = False
                    self._lock.release()
                    try:
                        self.stop_recording()
                    finally:
                        self._lock.acquire()
    
    def _start_motion_recording(self) -> None:
        """Start a motion-triggered recording with buffer dump."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"motion_{timestamp}.mp4"
        self._current_recording_file = os.path.join(self._recordings_dir, filename)
        
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        self._video_writer = cv2.VideoWriter(
            self._current_recording_file,
            fourcc,
            float(self.framerate),
            (self._frame_width, self._frame_height)
        )
        
        if not self._video_writer.isOpened():
            self._video_writer = None
            print(f"[{self.camera_id}] Failed to start motion recording")
            return
        
        if self._frame_buffer:
            for _, buffered_frame in self._frame_buffer:
                self._video_writer.write(buffered_frame)
        
        self._is_recording = True
        self._is_motion_recording = True
        self._recording_start_time = datetime.now()
        print(f"[{self.camera_id}] Motion recording started: {filename}")
    
    def start_recording(self, manual: bool = True) -> dict:
        """Start recording video to file."""
        with self._lock:
            if self._is_recording:
                return {"success": False, "message": "Already recording"}
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            prefix = "recording" if manual else "motion"
            filename = f"{prefix}_{timestamp}.mp4"
            self._current_recording_file = os.path.join(self._recordings_dir, filename)
            
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            self._video_writer = cv2.VideoWriter(
                self._current_recording_file,
                fourcc,
                float(self.framerate),
                (self._frame_width, self._frame_height)
            )
            
            if not self._video_writer.isOpened():
                self._video_writer = None
                return {"success": False, "message": "Failed to initialize video writer"}
            
            self._is_recording = True
            self._is_motion_recording = not manual
            self._recording_start_time = datetime.now()
            
            return {
                "success": True,
                "message": "Recording started",
                "filename": filename,
                "camera_id": self.camera_id,
                "start_time": self._recording_start_time.isoformat()
            }
    
    def stop_recording(self) -> dict:
        """Stop recording video."""
        with self._lock:
            if not self._is_recording:
                return {"success": False, "message": "Not recording"}
            
            self._is_recording = False
            was_motion_recording = self._is_motion_recording
            self._is_motion_recording = False
            
            thumbnail_name = None
            if self._last_raw_frame is not None and self._current_recording_file:
                try:
                    base_name = os.path.splitext(os.path.basename(self._current_recording_file))[0]
                    thumbnail_name = f"{base_name}.jpg"
                    thumbnail_path = os.path.join(self._thumbnails_dir, thumbnail_name)
                    thumbnail = cv2.resize(self._last_raw_frame, (320, 180))
                    cv2.imwrite(thumbnail_path, thumbnail)
                except Exception as e:
                    print(f"[{self.camera_id}] Error creating thumbnail: {e}")
                    thumbnail_name = None
            
            if self._video_writer is not None:
                self._video_writer.release()
                self._video_writer = None
            
            duration = None
            if self._recording_start_time:
                duration = (datetime.now() - self._recording_start_time).total_seconds()
            
            recording_type = "motion" if was_motion_recording else "manual"
            result = {
                "success": True,
                "message": f"Recording stopped ({recording_type})",
                "filename": self._current_recording_file,
                "thumbnail": thumbnail_name,
                "duration": duration,
                "type": recording_type,
                "camera_id": self.camera_id
            }
            
            if was_motion_recording:
                print(f"[{self.camera_id}] Motion recording stopped: {self._current_recording_file}")
            
            self._recording_start_time = None
            self._current_recording_file = None
            self._last_raw_frame = None
            
            return result
    
    def get_recording_status(self) -> dict:
        """Get current recording status."""
        with self._lock:
            duration = None
            if self._is_recording and self._recording_start_time:
                duration = (datetime.now() - self._recording_start_time).total_seconds()
            
            return {
                "is_recording": self._is_recording,
                "is_motion_recording": self._is_motion_recording,
                "filename": self._current_recording_file,
                "duration": duration,
                "start_time": self._recording_start_time.isoformat() if self._recording_start_time else None,
                "camera_id": self.camera_id
            }
    
    def capture_snapshot(self) -> dict:
        """Capture a snapshot image."""
        os.makedirs(self._snapshots_dir, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"snapshot_{timestamp}.jpg"
        filepath = os.path.join(self._snapshots_dir, filename)
        
        bgr_frame = self._capture_raw_frame()
        if bgr_frame is None:
            return {"success": False, "message": "Failed to capture frame"}
        
        cv2.imwrite(filepath, bgr_frame)
        
        return {
            "success": True,
            "filename": filename,
            "filepath": filepath,
            "camera_id": self.camera_id
        }
    
    def get_status(self) -> dict:
        """Get camera status including connection state."""
        return {
            "camera_id": self.camera_id,
            "name": self.name,
            "type": self.__class__.__name__,
            "state": self._state.value,
            "enabled": self.enabled,
            "last_error": self._last_error,
            "resolution": list(self.resolution),
            "framerate": self.framerate,
            "is_recording": self._is_recording,
            "motion_enabled": self._motion_enabled,
            "motion_detected": self._motion_detected
        }
    
    def get_camera_info(self) -> dict:
        """Get camera configuration info for display."""
        width, height = self.resolution
        
        if height >= 2160:
            res_label = "4K"
        elif height >= 1440:
            res_label = "1440p"
        elif height >= 1080:
            res_label = "1080p"
        elif height >= 720:
            res_label = "720p"
        elif height >= 480:
            res_label = "480p"
        else:
            res_label = f"{height}p"
        
        return {
            "camera_id": self.camera_id,
            "name": self.name,
            "width": width,
            "height": height,
            "resolution_label": res_label,
            "resolution_full": f"{width} × {height} ({res_label})",
            "fps": self.framerate,
            "codec": "MP4",
            "codec_full": "MP4 (H.264 compatible)"
        }
    
    # Motion detection methods
    def init_motion_detection(self, config: dict) -> None:
        """Initialize motion detection with config."""
        self._motion_enabled = config.get('enabled', False)
        self._motion_sensitivity = config.get('sensitivity', 30)
        self._motion_cooldown = config.get('cooldown', 10)
        self._motion_buffer_seconds = config.get('buffer_seconds', 5)
        
        buffer_size = int(self._motion_buffer_seconds * self.framerate)
        self._frame_buffer = deque(maxlen=buffer_size)
    
    def get_motion_status(self) -> dict:
        """Get current motion detection status."""
        return {
            "camera_id": self.camera_id,
            "enabled": self._motion_enabled,
            "motion_detected": self._motion_detected,
            "is_motion_recording": self._is_motion_recording,
            "sensitivity": self._motion_sensitivity,
            "cooldown": self._motion_cooldown,
            "buffer_seconds": self._motion_buffer_seconds,
            "time_since_motion": time.time() - self._last_motion_time if self._last_motion_time > 0 else None
        }
    
    def enable_motion_detection(self) -> dict:
        """Enable motion detection."""
        self._motion_enabled = True
        self._motion_detected = False
        self._last_motion_time = 0
        self._previous_frame = None
        return {"success": True, "message": "Motion detection enabled", "camera_id": self.camera_id}
    
    def disable_motion_detection(self) -> dict:
        """Disable motion detection."""
        self._motion_enabled = False
        self._motion_detected = False
        
        if self._is_motion_recording:
            self.stop_recording()
        
        return {"success": True, "message": "Motion detection disabled", "camera_id": self.camera_id}
    
    def set_motion_settings(self, sensitivity: int = None, cooldown: int = None, buffer_seconds: int = None) -> dict:
        """Update motion detection settings."""
        if sensitivity is not None:
            self._motion_sensitivity = max(1, min(100, int(sensitivity)))
        
        if cooldown is not None:
            self._motion_cooldown = max(3, min(60, int(cooldown)))
        
        if buffer_seconds is not None:
            self._motion_buffer_seconds = max(1, min(10, int(buffer_seconds)))
            buffer_size = int(self._motion_buffer_seconds * self.framerate)
            old_buffer = list(self._frame_buffer) if self._frame_buffer else []
            self._frame_buffer = deque(old_buffer[-buffer_size:], maxlen=buffer_size)
        
        return {
            "success": True,
            "message": "Motion settings updated",
            "camera_id": self.camera_id,
            "settings": {
                "sensitivity": self._motion_sensitivity,
                "cooldown": self._motion_cooldown,
                "buffer_seconds": self._motion_buffer_seconds
            }
        }


class PiCamera(BaseCamera):
    """Raspberry Pi Camera implementation using Picamera2."""
    
    def __init__(self, camera_id: str, config: dict):
        super().__init__(camera_id, config)
        self.camera_index = config.get('index', 0)
        self._picamera = None
    
    def initialize(self) -> bool:
        """Initialize the Picamera2 instance."""
        try:
            from picamera2 import Picamera2
            
            self._state = CameraState.CONNECTING
            self._picamera = Picamera2(camera_num=self.camera_index)
            
            video_config = self._picamera.create_video_configuration(
                main={"size": self.resolution}
            )
            self._picamera.configure(video_config)
            self._picamera.start()
            
            self._state = CameraState.CONNECTED
            self._last_error = None
            print(f"[{self.camera_id}] Pi Camera initialized (index={self.camera_index})")
            return True
            
        except Exception as e:
            self._state = CameraState.OFFLINE
            self._last_error = str(e)
            print(f"[{self.camera_id}] Failed to initialize Pi Camera: {e}")
            return False
    
    def _capture_raw_frame(self) -> Optional[Any]:
        """Capture a raw frame from Pi Camera."""
        if self._picamera is None:
            return None
        
        try:
            frame = self._picamera.capture_array()
            # Convert RGB to BGR for OpenCV
            bgr_frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
            return bgr_frame
        except Exception as e:
            self._last_error = str(e)
            return None
    
    def release(self) -> None:
        """Release Pi Camera resources."""
        if self._is_recording:
            self.stop_recording()
        
        if self._picamera:
            try:
                self._picamera.stop()
            except Exception as e:
                print(f"[{self.camera_id}] Error stopping Pi Camera: {e}")
            self._picamera = None
        
        self._state = CameraState.OFFLINE


class RTSPCamera(BaseCamera):
    """RTSP/Network camera implementation using OpenCV."""
    
    # Reconnection settings
    INITIAL_RETRY_DELAY = 1.0  # seconds
    MAX_RETRY_DELAY = 30.0  # seconds
    BACKOFF_MULTIPLIER = 2.0
    CONNECTION_TIMEOUT = 5000  # milliseconds
    READ_TIMEOUT = 5000  # milliseconds
    
    def __init__(self, camera_id: str, config: dict):
        super().__init__(camera_id, config)
        self._rtsp_url = self._resolve_rtsp_url(config.get('url', ''))
        self._capture: Optional[cv2.VideoCapture] = None
        
        # Reconnection state
        self._retry_count = 0
        self._next_retry_time: float = 0
        self._current_retry_delay = self.INITIAL_RETRY_DELAY
        
        # Dedicated capture thread for non-blocking frame capture
        self._capture_thread: Optional[threading.Thread] = None
        self._running = False
        self._frame_lock = threading.Lock()
        self._current_bgr_frame: Optional[Any] = None
    
    def _resolve_rtsp_url(self, url_template: str) -> str:
        """Resolve environment variables in RTSP URL.
        
        Supports formats like:
        - rtsp://{RTSP_USER}:{RTSP_PASS}@192.168.1.100:554/stream
        - rtsp://user:pass@192.168.1.100:554/stream (direct)
        """
        def replace_env_var(match):
            var_name = match.group(1)
            return os.environ.get(var_name, '')
        
        # Replace {VAR_NAME} patterns with environment variables
        resolved = re.sub(r'\{([A-Z_][A-Z0-9_]*)\}', replace_env_var, url_template)
        return resolved
    
    def initialize(self) -> bool:
        """Initialize RTSP connection."""
        self._state = CameraState.CONNECTING
        self._running = True
        
        success = self._connect()
        
        if success:
            # Start capture thread
            self._capture_thread = threading.Thread(target=self._capture_loop, daemon=True)
            self._capture_thread.start()
        
        return success
    
    def _connect(self) -> bool:
        """Establish connection to RTSP stream."""
        try:
            if self._capture is not None:
                self._capture.release()
            
            self._capture = cv2.VideoCapture(self._rtsp_url)
            
            # Set timeouts for faster failure detection
            self._capture.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, self.CONNECTION_TIMEOUT)
            self._capture.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, self.READ_TIMEOUT)
            self._capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Reduce latency
            
            if self._capture.isOpened():
                # Try to read a test frame
                ret, frame = self._capture.read()
                if ret and frame is not None:
                    self._state = CameraState.CONNECTED
                    self._last_error = None
                    self._retry_count = 0
                    self._current_retry_delay = self.INITIAL_RETRY_DELAY
                    
                    # Update actual resolution from stream if different
                    actual_width = int(self._capture.get(cv2.CAP_PROP_FRAME_WIDTH))
                    actual_height = int(self._capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
                    if actual_width > 0 and actual_height > 0:
                        self._frame_width = actual_width
                        self._frame_height = actual_height
                    
                    print(f"[{self.camera_id}] RTSP connected: {actual_width}x{actual_height}")
                    return True
            
            raise Exception("Failed to read frame from stream")
            
        except Exception as e:
            self._state = CameraState.OFFLINE
            self._last_error = str(e)
            print(f"[{self.camera_id}] RTSP connection failed: {e}")
            return False
    
    def _capture_loop(self) -> None:
        """Background thread for continuous frame capture."""
        while self._running:
            if self._state == CameraState.CONNECTED:
                try:
                    if self._capture is not None and self._capture.isOpened():
                        ret, frame = self._capture.read()
                        if ret and frame is not None:
                            with self._frame_lock:
                                self._current_bgr_frame = frame
                        else:
                            self._handle_connection_lost()
                    else:
                        self._handle_connection_lost()
                except Exception as e:
                    self._last_error = str(e)
                    self._handle_connection_lost()
            
            elif self._state == CameraState.RECONNECTING:
                current_time = time.time()
                if current_time >= self._next_retry_time:
                    self._attempt_reconnect()
            
            else:
                time.sleep(0.1)
            
            time.sleep(0.01)  # Small delay to prevent CPU spinning
    
    def _handle_connection_lost(self) -> None:
        """Handle lost connection, initiate reconnection."""
        if self._state != CameraState.RECONNECTING:
            self._state = CameraState.RECONNECTING
            self._retry_count = 0
            self._current_retry_delay = self.INITIAL_RETRY_DELAY
            self._next_retry_time = time.time() + self._current_retry_delay
            print(f"[{self.camera_id}] Connection lost, will retry in {self._current_retry_delay}s")
    
    def _attempt_reconnect(self) -> None:
        """Attempt to reconnect with exponential backoff."""
        self._retry_count += 1
        print(f"[{self.camera_id}] Reconnection attempt #{self._retry_count}")
        
        if self._connect():
            print(f"[{self.camera_id}] Reconnected successfully")
        else:
            # Exponential backoff
            self._current_retry_delay = min(
                self._current_retry_delay * self.BACKOFF_MULTIPLIER,
                self.MAX_RETRY_DELAY
            )
            self._next_retry_time = time.time() + self._current_retry_delay
            print(f"[{self.camera_id}] Retry failed, next attempt in {self._current_retry_delay}s")
    
    def _capture_raw_frame(self) -> Optional[Any]:
        """Get the latest captured frame."""
        with self._frame_lock:
            return self._current_bgr_frame.copy() if self._current_bgr_frame is not None else None
    
    def release(self) -> None:
        """Release RTSP camera resources."""
        self._running = False
        
        if self._is_recording:
            self.stop_recording()
        
        if self._capture_thread is not None:
            self._capture_thread.join(timeout=2.0)
            self._capture_thread = None
        
        if self._capture is not None:
            self._capture.release()
            self._capture = None
        
        self._state = CameraState.OFFLINE
    
    def get_status(self) -> dict:
        """Get RTSP camera status including reconnection info."""
        status = super().get_status()
        
        # Add RTSP-specific status
        status['retry_count'] = self._retry_count
        
        if self._state == CameraState.RECONNECTING:
            time_until_retry = max(0, self._next_retry_time - time.time())
            status['next_retry_in'] = round(time_until_retry, 1)
        else:
            status['next_retry_in'] = None
        
        return status


class CameraManager:
    """Manager for handling multiple cameras."""
    
    _instance = None
    _cameras: Dict[str, BaseCamera] = {}
    _config_file = "motion_config.json"
    _initialized = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    @classmethod
    def initialize(cls, cameras_config: dict) -> None:
        """Initialize all cameras from configuration."""
        if cls._initialized:
            return
        
        cls._cameras = {}
        motion_configs = cls._load_motion_configs()
        
        for camera_id, config in cameras_config.items():
            camera = cls._create_camera(camera_id, config)
            if camera:
                # Set up per-camera directories
                cls._setup_camera_directories(camera)
                
                # Load motion config for this camera
                cam_motion_config = motion_configs.get(camera_id, {
                    'enabled': False,
                    'sensitivity': 30,
                    'cooldown': 10,
                    'buffer_seconds': 5
                })
                camera.init_motion_detection(cam_motion_config)
                
                # Initialize camera
                if camera.enabled:
                    camera.initialize()
                
                cls._cameras[camera_id] = camera
                print(f"[CameraManager] Registered camera: {camera_id} ({camera.__class__.__name__})")
        
        cls._initialized = True
    
    @classmethod
    def _create_camera(cls, camera_id: str, config: dict) -> Optional[BaseCamera]:
        """Factory method to create camera instance based on type."""
        camera_type = config.get('type', 'picamera').lower()
        
        if camera_type == 'picamera':
            return PiCamera(camera_id, config)
        elif camera_type == 'rtsp':
            return RTSPCamera(camera_id, config)
        else:
            print(f"[CameraManager] Unknown camera type: {camera_type}")
            return None
    
    @classmethod
    def _setup_camera_directories(cls, camera: BaseCamera) -> None:
        """Set up per-camera recording/thumbnail/snapshot directories."""
        base_recordings = "recordings"
        base_thumbnails = "thumbnails"
        base_snapshots = "snapshots"
        
        camera._recordings_dir = os.path.join(base_recordings, camera.camera_id)
        camera._thumbnails_dir = os.path.join(base_thumbnails, camera.camera_id)
        camera._snapshots_dir = os.path.join(base_snapshots, camera.camera_id)
        
        os.makedirs(camera._recordings_dir, exist_ok=True)
        os.makedirs(camera._thumbnails_dir, exist_ok=True)
        os.makedirs(camera._snapshots_dir, exist_ok=True)
    
    @classmethod
    def _load_motion_configs(cls) -> dict:
        """Load motion detection configs for all cameras."""
        try:
            if os.path.exists(cls._config_file):
                with open(cls._config_file, 'r') as f:
                    data = json.load(f)
                    # Support both old single-camera format and new multi-camera format
                    if 'cameras' in data:
                        return data['cameras']
                    else:
                        # Old format - apply to default camera
                        return {'cam1': data}
        except Exception as e:
            print(f"[CameraManager] Error loading motion config: {e}")
        return {}
    
    @classmethod
    def save_motion_configs(cls) -> None:
        """Save motion detection configs for all cameras."""
        try:
            configs = {}
            for camera_id, camera in cls._cameras.items():
                configs[camera_id] = {
                    'enabled': camera._motion_enabled,
                    'sensitivity': camera._motion_sensitivity,
                    'cooldown': camera._motion_cooldown,
                    'buffer_seconds': camera._motion_buffer_seconds
                }
            
            with open(cls._config_file, 'w') as f:
                json.dump({'cameras': configs}, f, indent=2)
        except Exception as e:
            print(f"[CameraManager] Error saving motion config: {e}")
    
    @classmethod
    def get(cls, camera_id: str) -> Optional[BaseCamera]:
        """Get a camera by ID."""
        return cls._cameras.get(camera_id)
    
    @classmethod
    def get_default(cls) -> Optional[BaseCamera]:
        """Get the first/default camera."""
        if cls._cameras:
            return next(iter(cls._cameras.values()))
        return None
    
    @classmethod
    def list_all(cls) -> List[str]:
        """Get list of all camera IDs."""
        return list(cls._cameras.keys())
    
    @classmethod
    def get_all_status(cls) -> List[dict]:
        """Get status of all cameras."""
        return [camera.get_status() for camera in cls._cameras.values()]
    
    @classmethod
    def get_cameras_dict(cls) -> Dict[str, dict]:
        """Get cameras as dict for templates (camera_id -> config)."""
        result = {}
        for camera_id, camera in cls._cameras.items():
            result[camera_id] = {
                'id': camera_id,
                'name': camera.name,
                'type': camera.config.get('type', 'unknown'),
                'enabled': camera.enabled,
                'state': camera._state.value,
            }
        return result
    
    @classmethod
    def get_all_cameras(cls) -> Dict[str, BaseCamera]:
        """Get all camera instances."""
        return cls._cameras
    
    @classmethod
    def get_recordings_list(cls, camera_id: str = None) -> List[dict]:
        """Get list of recordings, optionally filtered by camera."""
        recordings = []
        
        cameras_to_check = [camera_id] if camera_id else cls.list_all()
        
        for cam_id in cameras_to_check:
            camera = cls.get(cam_id)
            if not camera:
                continue
            
            recordings_dir = camera._recordings_dir
            thumbnails_dir = camera._thumbnails_dir
            
            if os.path.exists(recordings_dir):
                for filename in os.listdir(recordings_dir):
                    if filename.endswith('.mp4'):
                        filepath = os.path.join(recordings_dir, filename)
                        stat = os.stat(filepath)
                        
                        base_name = os.path.splitext(filename)[0]
                        thumbnail_name = f"{base_name}.jpg"
                        thumbnail_path = os.path.join(thumbnails_dir, thumbnail_name)
                        has_thumbnail = os.path.exists(thumbnail_path)
                        
                        recordings.append({
                            "filename": filename,
                            "camera_id": cam_id,
                            "camera_name": camera.name,
                            "size": stat.st_size,
                            "created": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                            "thumbnail": thumbnail_name if has_thumbnail else None
                        })
        
        recordings.sort(key=lambda x: x['created'], reverse=True)
        return recordings
    
    @classmethod
    def delete_recording(cls, camera_id: str, filename: str) -> dict:
        """Delete a recording file."""
        if '..' in filename or '/' in filename:
            return {"success": False, "message": "Invalid filename"}
        
        camera = cls.get(camera_id)
        if not camera:
            return {"success": False, "message": "Camera not found"}
        
        filepath = os.path.join(camera._recordings_dir, filename)
        
        if not os.path.exists(filepath):
            return {"success": False, "message": "Recording not found"}
        
        try:
            os.remove(filepath)
            
            base_name = os.path.splitext(filename)[0]
            thumbnail_path = os.path.join(camera._thumbnails_dir, f"{base_name}.jpg")
            if os.path.exists(thumbnail_path):
                os.remove(thumbnail_path)
            
            return {"success": True, "message": "Recording deleted"}
        except Exception as e:
            return {"success": False, "message": str(e)}
    
    @classmethod
    def get_storage_stats(cls) -> dict:
        """Aggregate recording counts and sizes without listing every file."""
        per_camera = []
        total_count = 0
        total_size = 0
        
        for cam_id in cls.list_all():
            camera = cls.get(cam_id)
            if not camera:
                continue
            
            count = 0
            size = 0
            recordings_dir = camera._recordings_dir
            
            if os.path.exists(recordings_dir):
                for filename in os.listdir(recordings_dir):
                    if filename.endswith('.mp4'):
                        try:
                            size += os.path.getsize(os.path.join(recordings_dir, filename))
                            count += 1
                        except OSError:
                            continue
            
            per_camera.append({
                "camera_id": cam_id,
                "camera_name": camera.name,
                "count": count,
                "size": size
            })
            total_count += count
            total_size += size
        
        return {
            "recordings_count": total_count,
            "total_size_bytes": total_size,
            "per_camera": per_camera
        }
    
    @classmethod
    def release_all(cls) -> None:
        """Release all cameras."""
        for camera in cls._cameras.values():
            camera.release()
        cls._cameras = {}
        cls._initialized = False


# Backwards compatibility - create a Camera class that proxies to CameraManager
class Camera:
    """Backwards compatible Camera class that proxies to CameraManager."""
    
    @classmethod
    def get_frame(cls):
        camera = CameraManager.get_default()
        return camera.get_frame() if camera else None
    
    @classmethod
    def generate_frames(cls):
        camera = CameraManager.get_default()
        if camera:
            yield from camera.generate_frames()
    
    @classmethod
    def start_recording(cls, manual=True):
        camera = CameraManager.get_default()
        return camera.start_recording(manual) if camera else {"success": False, "message": "No camera"}
    
    @classmethod
    def stop_recording(cls):
        camera = CameraManager.get_default()
        return camera.stop_recording() if camera else {"success": False, "message": "No camera"}
    
    @classmethod
    def get_recording_status(cls):
        camera = CameraManager.get_default()
        return camera.get_recording_status() if camera else {}
    
    @classmethod
    def get_recordings_list(cls):
        return CameraManager.get_recordings_list()
    
    @classmethod
    def delete_recording(cls, filename):
        # Try to find the recording in any camera
        for camera_id in CameraManager.list_all():
            result = CameraManager.delete_recording(camera_id, filename)
            if result.get('success'):
                return result
        return {"success": False, "message": "Recording not found"}
    
    @classmethod
    def capture_snapshot(cls):
        camera = CameraManager.get_default()
        return camera.capture_snapshot() if camera else {"success": False, "message": "No camera"}
    
    @classmethod
    def release(cls):
        CameraManager.release_all()
    
    @classmethod
    def get_motion_status(cls):
        camera = CameraManager.get_default()
        return camera.get_motion_status() if camera else {}
    
    @classmethod
    def enable_motion_detection(cls):
        camera = CameraManager.get_default()
        result = camera.enable_motion_detection() if camera else {"success": False}
        CameraManager.save_motion_configs()
        return result
    
    @classmethod
    def disable_motion_detection(cls):
        camera = CameraManager.get_default()
        result = camera.disable_motion_detection() if camera else {"success": False}
        CameraManager.save_motion_configs()
        return result
    
    @classmethod
    def set_motion_settings(cls, sensitivity=None, cooldown=None, buffer_seconds=None):
        camera = CameraManager.get_default()
        result = camera.set_motion_settings(sensitivity, cooldown, buffer_seconds) if camera else {"success": False}
        CameraManager.save_motion_configs()
        return result
    
    @classmethod
    def get_camera_info(cls):
        camera = CameraManager.get_default()
        return camera.get_camera_info() if camera else {}
