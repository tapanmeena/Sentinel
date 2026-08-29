import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const CAMERA_KEY = 'sentinel.ui.selectedCamera';
const RECORDINGS_VIEW_KEY = 'sentinel.ui.recordingsView';
const LIVE_LAYOUT_KEY = 'sentinel.ui.liveLayout';

export type RecordingsView = 'grid' | 'list';
export type LiveLayout = 'single' | 'grid';

interface UiState {
  selectedCameraId: string | null;
  recordingsView: RecordingsView;
  liveLayout: LiveLayout;
  recordingsFilter: string | null;

  hydrate: () => Promise<void>;
  setSelectedCamera: (cameraId: string) => void;
  setRecordingsView: (view: RecordingsView) => void;
  setLiveLayout: (layout: LiveLayout) => void;
  setRecordingsFilter: (cameraId: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedCameraId: null,
  recordingsView: 'grid',
  liveLayout: 'single',
  recordingsFilter: null,

  hydrate: async () => {
    try {
      const [camera, view, layout] = await Promise.all([
        AsyncStorage.getItem(CAMERA_KEY),
        AsyncStorage.getItem(RECORDINGS_VIEW_KEY),
        AsyncStorage.getItem(LIVE_LAYOUT_KEY),
      ]);
      set({
        selectedCameraId: camera,
        recordingsView: view === 'list' ? 'list' : 'grid',
        liveLayout: layout === 'grid' ? 'grid' : 'single',
      });
    } catch {
      // Defaults already applied.
    }
  },

  setSelectedCamera: (cameraId) => {
    set({ selectedCameraId: cameraId });
    AsyncStorage.setItem(CAMERA_KEY, cameraId).catch(() => {});
  },

  setRecordingsView: (recordingsView) => {
    set({ recordingsView });
    AsyncStorage.setItem(RECORDINGS_VIEW_KEY, recordingsView).catch(() => {});
  },

  setLiveLayout: (liveLayout) => {
    set({ liveLayout });
    AsyncStorage.setItem(LIVE_LAYOUT_KEY, liveLayout).catch(() => {});
  },

  setRecordingsFilter: (recordingsFilter) => set({ recordingsFilter }),
}));
