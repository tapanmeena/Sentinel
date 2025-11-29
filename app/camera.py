"""Camera module for handling Picamera2 operations."""
import cv2
from picamera2 import Picamera2


class Camera:
    """Singleton camera class for managing the Picamera2 instance."""
    
    _instance = None
    _camera = None
    
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
    
    @classmethod
    def get_frame(cls):
        """Capture a frame from the camera and encode it as JPEG."""
        if cls._camera is None:
            cls._initialize_camera()
        
        frame = cls._camera.capture_array()
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
    def release(cls):
        """Release the camera resource."""
        if cls._camera:
            cls._camera.stop()
            cls._camera = None
            cls._instance = None
