import { useCallback, useRef, useState } from 'react';
import type { ChangeEvent, RefObject } from 'react';

export interface FileInputController {
  /** The file the user picked, or null. Use this for rendering (name, size…). */
  file: File | null;
  /** Attach to the `<input type="file">` element. */
  inputRef: RefObject<HTMLInputElement | null>;
  /** `onChange` handler for the `<input type="file">` element. */
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  /**
   * The file that should be uploaded *right now*. Prefers React state and
   * falls back to whatever the native input currently holds, so a file that is
   * visibly selected in the browser is never left out of the FormData.
   * Call it from submit handlers, not during render.
   */
  getFile: () => File | null;
  /** Clear both the React state and the native input (e.g. after a successful upload). */
  reset: () => void;
}

/**
 * State for a single `<input type="file">` that stays in sync with the DOM.
 *
 * A file input is uncontrolled — React cannot write its value — so resetting
 * only the React state after an upload leaves the previous file name visible
 * in the input (and keeps its `required` check satisfied) while the state
 * that builds the FormData is empty. The next submit then fails with
 * "no image selected" even though a file is clearly shown. Chrome additionally
 * skips the `change` event when the very same file is picked again, so the
 * state never gets refilled. This hook fixes both:
 *
 * - `reset()` empties the native input together with the state, so the UI
 *   never shows a file that will not be uploaded and re-picking the same file
 *   fires `change` again.
 * - `getFile()` falls back to the input's own `FileList`, so whatever the
 *   browser has selected is what gets appended to the FormData.
 */
export function useFileInput(): FileInputController {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  const onChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    // Read the entry synchronously: `files` is a live list that is emptied the
    // moment the input is reset, so never defer this into a state updater.
    setFile(event.target.files?.[0] ?? null);
  }, []);

  const getFile = useCallback((): File | null => {
    if (file) return file;
    const fromInput = inputRef.current?.files?.[0] ?? null;
    // A missed `change` event (browser quirk) leaves the DOM ahead of React;
    // adopt the DOM's file so the rendered state matches what is uploaded.
    if (fromInput) setFile(fromInput);
    return fromInput;
  }, [file]);

  const reset = useCallback(() => {
    setFile(null);
    // Setting an empty string is the only value a file input accepts; it
    // clears the selection so the same file can be chosen again.
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  return { file, inputRef, onChange, getFile, reset };
}
