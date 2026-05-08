import { UpdateNotification } from './components/UpdateNotification';
import { AuthProvider } from './contexts/AuthContext';
import { AppContent } from './app/AppContent';

function App() {
  return (
    <AuthProvider>
      <AppContent />
      <UpdateNotification />
    </AuthProvider>
  );
}

export default App;
