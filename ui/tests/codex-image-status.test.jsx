import { describe, expect, it } from 'vitest';
import { render, screen } from './test-utils.jsx';
import CodexImageStatus from '../src/app/components/CodexImageStatus.jsx';

describe('CodexImageStatus', () => {
  it('stays hidden when the image is ready or unchecked', () => {
    const { rerender } = render(<CodexImageStatus codexImage={null} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    rerender(<CodexImageStatus codexImage={{ status: 'ready', ready: true }} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows the image name while Docker is pulling', () => {
    render(
      <CodexImageStatus
        codexImage={{ status: 'pulling', imageName: 'ghcr.io/example/codex-docker:latest' }}
      />
    );

    expect(screen.getByText('Pulling Codex image')).toBeInTheDocument();
    expect(screen.getByText('ghcr.io/example/codex-docker:latest')).toBeInTheDocument();
  });

  it('shows the Docker error when pulling fails', () => {
    render(<CodexImageStatus codexImage={{ status: 'failed', error: 'denied' }} />);

    expect(screen.getByText('Codex image pull failed')).toBeInTheDocument();
    expect(screen.getByText('denied')).toBeInTheDocument();
  });
});
