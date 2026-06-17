import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SeverityChip } from '../components/SeverityChip';

describe('SeverityChip', () => {
  it('renders severity label', () => {
    render(<SeverityChip severity="CRITICAL" />);
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
  });
});
