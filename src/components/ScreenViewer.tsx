import { ScreenshotDisplay } from './screen-viewer/ScreenshotDisplay';
import { ScreenViewerHeader } from './screen-viewer/ScreenViewerHeader';
import { SourcePicker } from './screen-viewer/SourcePicker';
import { useScreenCapture } from './screen-viewer/useScreenCapture';

export function ScreenViewer() {
  const screen = useScreenCapture();

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-background-dark">
      <ScreenViewerHeader {...screen} />
      <SourcePicker {...screen} />
      <ScreenshotDisplay screenshot={screen.screenshot} capturing={screen.capturing} />
    </div>
  );
}
