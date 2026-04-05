import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PhotoUpload } from '@/components/admin/PhotoUpload';

vi.mock('@/services/api', () => ({
  uploadPhoto: vi.fn(),
}));

import { uploadPhoto } from '@/services/api';

describe('PhotoUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders category selector and file input', () => {
    render(<PhotoUpload eventId="evt1" idToken="tok" />);
    expect(screen.getByLabelText('photo-category')).toBeInTheDocument();
    expect(screen.getByLabelText('photo-file')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /enviar/i }),
    ).toBeInTheDocument();
  });

  it('disables submit when no file selected', () => {
    render(<PhotoUpload eventId="evt1" idToken="tok" />);
    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();
  });

  it('uploads file and calls onUploaded', async () => {
    const onUploaded = vi.fn();
    const fakePhoto = {
      id: 'p1',
      url: 'u',
      category: 'category1' as const,
      uploadedBy: 'admin',
      createdAt: 1,
    };
    (uploadPhoto as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      fakePhoto,
    );

    render(
      <PhotoUpload eventId="evt1" idToken="tok" onUploaded={onUploaded} />,
    );

    const file = new File(['x'], 'x.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText('photo-file') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => {
      expect(uploadPhoto).toHaveBeenCalledWith('evt1', 'category1', file, 'tok');
      expect(onUploaded).toHaveBeenCalledWith(fakePhoto);
    });
  });

  it('changes category via selector', () => {
    render(<PhotoUpload eventId="evt1" idToken="tok" />);
    const select = screen.getByLabelText('photo-category') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'category2' } });
    expect(select.value).toBe('category2');
  });
});
