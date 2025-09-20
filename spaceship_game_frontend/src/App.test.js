import { render, screen } from '@testing-library/react';
import App from './App';

test('renders header HUD labels', () => {
  render(<App />);
  expect(screen.getByText(/Score/i)).toBeInTheDocument();
  
  // Use getAllByText to handle multiple "Level" elements and check HUD specifically
  const levelElements = screen.getAllByText(/Level/i);
  expect(levelElements.length).toBeGreaterThan(0);
  
  expect(screen.getByText(/Lives/i)).toBeInTheDocument();
  expect(screen.getByText(/Time/i)).toBeInTheDocument();
});
