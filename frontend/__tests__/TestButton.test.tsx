import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Simple test component
const TestButton: React.FC = () => {
  const [count, setCount] = React.useState(0);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
};

describe('TestButton Component', () => {
  it('should render with initial count', () => {
    render(<TestButton />);
    const paragraph = screen.getByText('Count: 0');
    expect(paragraph).toBeInTheDocument();
  });

  it('should increment count when button is clicked', () => {
    render(<TestButton />);
    const button = screen.getByRole('button', { name: /increment/i });
    
    fireEvent.click(button);
    expect(screen.getByText('Count: 1')).toBeInTheDocument();
  });

  it('should increment multiple times', () => {
    render(<TestButton />);
    const button = screen.getByRole('button');
    
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    
    expect(screen.getByText('Count: 3')).toBeInTheDocument();
  });
});
