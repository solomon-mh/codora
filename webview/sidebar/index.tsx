import { createRoot } from 'react-dom/client';
import '../styles/tokens.css';
import './sidebar.css';
import { App } from './App';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
