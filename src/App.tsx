import { UpdateNotification } from './components/UpdateNotification';
import { AuthProvider } from './contexts/AuthContext';
import { PresentationWorkspaceProvider } from './contexts/PresentationWorkspaceContext';
import { AppContent } from './app/AppContent';

function App() {
  return (
    <AuthProvider>
      <PresentationWorkspaceProvider>
        <AppContent />
        <UpdateNotification />
      </PresentationWorkspaceProvider>
    </AuthProvider>
  );
}

export default App;
