import AppLayout from './components/AppLayout.jsx';
import useAppState from './hooks/useAppState.js';

function App() {
  const appState = useAppState();
  return <AppLayout {...appState} />;
}

export default App;
