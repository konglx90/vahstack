import './monaco-worker';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { TaskProvider } from './TaskContext';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <TaskProvider>
    <App />
  </TaskProvider>,
);
