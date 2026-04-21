import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from './test-utils.jsx';
import ConfigFileEditor from '../src/app/tabs/settings/ConfigFileEditor.jsx';

describe('ConfigFileEditor', () => {
  it('shows a loading state while fetching the config file', async () => {
    const user = userEvent.setup();
    let resolveFetch;
    global.fetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    render(<ConfigFileEditor />);

    await user.click(screen.getByRole('button', { name: 'Open editor' }));
    expect(screen.getByText('Loading config...')).toBeInTheDocument();

    resolveFetch({
      ok: true,
      status: 200,
      json: async () => ({ content: 'model = "gpt-5.2"' })
    });

    expect(await screen.findByDisplayValue('model = "gpt-5.2"')).toBeInTheDocument();
  });

  it('loads and saves the config file', async () => {
    const user = userEvent.setup();
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ content: 'model = "gpt-5.2"' })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true })
      });

    render(<ConfigFileEditor />);

    await user.click(screen.getByRole('button', { name: 'Open editor' }));
    expect(await screen.findByDisplayValue('model = "gpt-5.2"')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('config.toml'));
    await user.type(screen.getByLabelText('config.toml'), 'model = "gpt-5.4"');
    await user.click(screen.getByRole('button', { name: 'Save config' }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenLastCalledWith(
        '/api/settings/config',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ content: 'model = "gpt-5.4"' })
        })
      )
    );
    expect(screen.getByText('config.toml saved.')).toBeInTheDocument();
  });

  it('surfaces load failures', async () => {
    const user = userEvent.setup();
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Unable to load config.'
    });

    render(<ConfigFileEditor />);

    await user.click(screen.getByRole('button', { name: 'Open editor' }));
    expect(await screen.findByText('Unable to load config.')).toBeInTheDocument();
  });

  it('surfaces save failures after loading the config', async () => {
    const user = userEvent.setup();
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ content: 'model = "gpt-5.2"' })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Unable to save config.'
      });

    render(<ConfigFileEditor />);

    await user.click(screen.getByRole('button', { name: 'Open editor' }));
    expect(await screen.findByDisplayValue('model = "gpt-5.2"')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save config' }));

    expect(await screen.findByText('Unable to save config.')).toBeInTheDocument();
  });
});
