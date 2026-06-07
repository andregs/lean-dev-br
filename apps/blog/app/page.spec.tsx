import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Index from './page';

describe('Index page', () => {
  it('renders the welcome heading', () => {
    render(<Index />);
    expect(screen.getByText(/Welcome blog/i)).toBeTruthy();
  });
});
