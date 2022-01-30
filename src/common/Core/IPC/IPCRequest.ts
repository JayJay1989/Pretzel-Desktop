export const WRITE_TRACK_INFO = 'write_track_info';
export const PICK_FILE = 'pick_file';
export const GLOBAL_SHORTCUT_EXECUTED = 'execute_global_shortcut';
export const GLOBAL_SHORTCUT_REGISTRATION = 'register_global_shortcut';
export const GLOBAL_SHORTCUT_REMOVAL = 'remove_global_shortcut';
export const CLEAR_ACCOUNT_DATA = 'clear_account_data';

type IpcRequestParams = WriteTrackInfoParams | PickFileParams | GlobalShortcutParams | RemoveGlobalShortcutParams | AccountDataParams;

export interface IpcRequest {
  responseChannel?: string;

  params?: IpcRequestParams;
}

export interface WriteTrackInfoParams {
  type: 'write_track_info';
  filename?: string;
  contents?: string;
  coverFilename?: string;
  coverURL?: string;
  jsonFilename?: string;
  jsonString?: string;
}

interface PickerFilter {
  name: string;
  extensions: string[];
}

export interface PickFileParams {
  type: 'pick_file';
  title: string;
  message: string;
  filters: PickerFilter[];
  defaultPath?: string;
}

export interface GlobalShortcutPayload {
  action: string;
  value?: number | string;
}

export interface GlobalShortcutParams {
  type: 'register_global_shortcut';
  accelerator: string;
  payload: GlobalShortcutPayload;
  error?: boolean;
}

export interface RemoveGlobalShortcutParams {
  type: 'remove_global_shortcut';
  accelerator: string;
}

export interface AccountDataParams {
  type: 'clear_account_data';
}