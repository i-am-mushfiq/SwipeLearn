// @vitest-environment jsdom
/**
 * Behavioral integration tests — AI Generate flow (src/App.jsx + api/generate.js)
 *
 * MSW intercepts the real fetch("/api/generate", ...) call so these tests
 * exercise the complete pipeline:
 *
 *   PromptContent component
 *     → fetch("/api/generate", { method: "POST", body: { prompt } })
 *       → MSW handler (deterministic response)
 *         → state update (genResult)
 *           → preview rendered
 *             → "Add to Library" → library state + localStorage updated
 *
 * Key: `openPromptPanel` returns a `within(panel)` scope so all queries target
 * the inline panel, not the separate "Generate with AI ✦" CTA button that
 * always appears at the bottom of the home screen.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import App from '../../App.jsx';
import { server } from '../../test/server.js';
import { GENERATED_TOPIC } from '../../test/handlers.js';
import { TINY_LIBRARY } from '../fixtures.js';

vi.mock('../../supabase.js', () => ({ supabase: null }));

// ── Helpers ───────────────────────────────────────────────────────────────────

const setup = (library = null) => {
  if (library) localStorage.setItem('sl-lib', JSON.stringify(library));
  const user = userEvent.setup();
  render(<App />);
  return user;
};

/**
 * Open the inline AI Prompt panel and return a `within(panel)` scope.
 *
 * Scoping is critical: the home screen always shows a second
 * "Generate with AI ✦" button in the CTA section at the bottom.
 * Targeting the panel by `data-testid="prompt-panel"` avoids false-matches.
 */
const openPromptPanel = async (user) => {
  await user.click(await screen.findByRole('button', { name: /ai generator/i }));
  const panelEl = await screen.findByTestId('prompt-panel');
  return within(panelEl);
};

// ── Input validation ──────────────────────────────────────────────────────────

describe('AI Prompt — input validation', () => {
  it('shows an error when Generate is clicked with no topic entered', async () => {
    const user = setup();
    const panel = await openPromptPanel(user);
    await user.click(panel.getByRole('button', { name: /generate with ai/i }));
    expect(await panel.findByText(/enter a topic first/i)).toBeInTheDocument();
  });

  it('does not show the error when topic is filled before clicking Generate', async () => {
    const user = setup();
    const panel = await openPromptPanel(user);
    await user.type(panel.getByPlaceholderText(/how transformers work/i), 'Stoicism');
    await user.click(panel.getByRole('button', { name: /generate with ai/i }));
    // No error — request goes to MSW and returns successfully
    await waitFor(() => {
      expect(panel.queryByText(/enter a topic first/i)).not.toBeInTheDocument();
    });
    await screen.findByText('Stoicism'); // wait for result to avoid act warnings
  });
});

// ── Loading state ─────────────────────────────────────────────────────────────

describe('AI Prompt — loading state', () => {
  it('shows "Generating cards…" while the request is in-flight', async () => {
    server.use(
      http.post('http://localhost:3000/api/generate', async () => {
        await new Promise(r => setTimeout(r, 150));
        return HttpResponse.json(GENERATED_TOPIC);
      })
    );

    const user = setup();
    const panel = await openPromptPanel(user);
    await user.type(panel.getByPlaceholderText(/how transformers work/i), 'Stoicism');
    await user.click(panel.getByRole('button', { name: /generate with ai/i }));
    expect(await panel.findByText(/generating cards/i)).toBeInTheDocument();
    await screen.findByText('Stoicism'); // wait for completion
  });

  it('hides the panel Generate button while generating (spinner replaces it)', async () => {
    server.use(
      http.post('http://localhost:3000/api/generate', async () => {
        await new Promise(r => setTimeout(r, 150));
        return HttpResponse.json(GENERATED_TOPIC);
      })
    );

    const user = setup();
    const panel = await openPromptPanel(user);
    await user.type(panel.getByPlaceholderText(/how transformers work/i), 'Stoicism');
    await user.click(panel.getByRole('button', { name: /generate with ai/i }));
    await panel.findByText(/generating cards/i);
    // The panel's "Generate" button is hidden during loading; the CTA button outside is unrelated
    expect(panel.queryByRole('button', { name: /generate with ai/i })).not.toBeInTheDocument();
    await screen.findByText('Stoicism');
  });
});

// ── Successful generation ─────────────────────────────────────────────────────

describe('AI Prompt — successful generation', () => {
  it('shows the generated topic title in the preview', async () => {
    const user = setup();
    const panel = await openPromptPanel(user);
    await user.type(panel.getByPlaceholderText(/how transformers work/i), 'Stoicism');
    await user.click(panel.getByRole('button', { name: /generate with ai/i }));
    expect(await panel.findByText('Stoicism')).toBeInTheDocument();
  });

  it('shows the correct card count in the preview', async () => {
    const user = setup();
    const panel = await openPromptPanel(user);
    await user.type(panel.getByPlaceholderText(/how transformers work/i), 'Stoicism');
    await user.click(panel.getByRole('button', { name: /generate with ai/i }));
    // GENERATED_TOPIC has 2 cards
    expect(await panel.findByText(/2 cards/i)).toBeInTheDocument();
  });

  it('lists the first generated card title in the preview', async () => {
    const user = setup();
    const panel = await openPromptPanel(user);
    await user.type(panel.getByPlaceholderText(/how transformers work/i), 'Stoicism');
    await user.click(panel.getByRole('button', { name: /generate with ai/i }));
    expect(await panel.findByText(/What Is Stoicism\?/)).toBeInTheDocument();
  });

  it('shows the "Add to Library" button after successful generation', async () => {
    const user = setup();
    const panel = await openPromptPanel(user);
    await user.type(panel.getByPlaceholderText(/how transformers work/i), 'Stoicism');
    await user.click(panel.getByRole('button', { name: /generate with ai/i }));
    expect(await panel.findByRole('button', { name: /add to library/i })).toBeInTheDocument();
  });

  it('adds the generated topic to the home screen after "Add to Library"', async () => {
    const user = setup(TINY_LIBRARY);
    const panel = await openPromptPanel(user);
    await user.type(panel.getByPlaceholderText(/how transformers work/i), 'Stoicism');
    await user.click(panel.getByRole('button', { name: /generate with ai/i }));
    await user.click(await panel.findByRole('button', { name: /add to library/i }));
    // After import the library list on home screen shows the new topic
    expect(await screen.findByText('Stoicism')).toBeInTheDocument();
  });

  it('persists the generated topic to localStorage after "Add to Library"', async () => {
    const user = setup(TINY_LIBRARY);
    const panel = await openPromptPanel(user);
    await user.type(panel.getByPlaceholderText(/how transformers work/i), 'Stoicism');
    await user.click(panel.getByRole('button', { name: /generate with ai/i }));
    await user.click(await panel.findByRole('button', { name: /add to library/i }));
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('sl-lib') || 'null');
      expect(JSON.stringify(saved)).toContain('Stoicism');
    });
  });

  it('the new topic is immediately studyable after adding to the library', async () => {
    const user = setup(TINY_LIBRARY);
    const panel = await openPromptPanel(user);
    await user.type(panel.getByPlaceholderText(/how transformers work/i), 'Stoicism');
    await user.click(panel.getByRole('button', { name: /generate with ai/i }));
    await user.click(await panel.findByRole('button', { name: /add to library/i }));
    // Click the Stoicism topic row in the library list to start a session
    const matches = await screen.findAllByText('Stoicism');
    await user.click(matches[0]);
    expect(await screen.findByText('What Is Stoicism?')).toBeInTheDocument();
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe('AI Prompt — error handling', () => {
  it('shows the server error message when the API returns 429', async () => {
    server.use(
      http.post('http://localhost:3000/api/generate', () =>
        HttpResponse.json({ error: 'Rate limit exceeded — please wait 30s' }, { status: 429 })
      )
    );

    const user = setup();
    const panel = await openPromptPanel(user);
    await user.type(panel.getByPlaceholderText(/how transformers work/i), 'Stoicism');
    await user.click(panel.getByRole('button', { name: /generate with ai/i }));
    expect(await panel.findByText(/rate limit exceeded/i)).toBeInTheDocument();
  });

  it('shows the error message when the API returns 500', async () => {
    server.use(
      http.post('http://localhost:3000/api/generate', () =>
        HttpResponse.json({ error: 'Internal server error' }, { status: 500 })
      )
    );

    const user = setup();
    const panel = await openPromptPanel(user);
    await user.type(panel.getByPlaceholderText(/how transformers work/i), 'Stoicism');
    await user.click(panel.getByRole('button', { name: /generate with ai/i }));
    expect(await panel.findByText(/internal server error/i)).toBeInTheDocument();
  });

  it('does NOT modify the library when generation fails', async () => {
    server.use(
      http.post('http://localhost:3000/api/generate', () =>
        HttpResponse.json({ error: 'Server error' }, { status: 500 })
      )
    );

    const user = setup(TINY_LIBRARY);
    const panel = await openPromptPanel(user);
    await user.type(panel.getByPlaceholderText(/how transformers work/i), 'Stoicism');
    await user.click(panel.getByRole('button', { name: /generate with ai/i }));
    await panel.findByText(/server error/i);
    // Library should still only have Tiny Topic — Stoicism was never added
    const saved = JSON.parse(localStorage.getItem('sl-lib') || 'null');
    expect(JSON.stringify(saved)).not.toContain('Stoicism');
  });

  it('shows the Generate button again after an error so the user can retry', async () => {
    server.use(
      http.post('http://localhost:3000/api/generate', () =>
        HttpResponse.json({ error: 'Server error' }, { status: 500 })
      )
    );

    const user = setup();
    const panel = await openPromptPanel(user);
    await user.type(panel.getByPlaceholderText(/how transformers work/i), 'Stoicism');
    await user.click(panel.getByRole('button', { name: /generate with ai/i }));
    await panel.findByText(/server error/i);
    expect(panel.getByRole('button', { name: /generate with ai/i })).toBeInTheDocument();
  });

  it('shows an error message when the network is completely unavailable', async () => {
    server.use(
      http.post('http://localhost:3000/api/generate', () => {
        throw new Error('ECONNREFUSED');
      })
    );

    const user = setup();
    const panel = await openPromptPanel(user);
    await user.type(panel.getByPlaceholderText(/how transformers work/i), 'Stoicism');
    await user.click(panel.getByRole('button', { name: /generate with ai/i }));
    // Any non-empty error text is shown in the panel's error section
    await waitFor(() => {
      // The error div appears in the panel — look for any non-empty text in the danger-colored section
      const panelEl = screen.getByTestId('prompt-panel');
      expect(panelEl.textContent).toMatch(/failed|error|network|econnrefused/i);
    });
  });
});

// ── Prompt content verification ───────────────────────────────────────────────

describe('AI Prompt — prompt content sent to the server', () => {
  it('includes the topic text in the request body', async () => {
    let capturedBody = null;
    server.use(
      http.post('http://localhost:3000/api/generate', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(GENERATED_TOPIC);
      })
    );

    const user = setup();
    const panel = await openPromptPanel(user);
    await user.type(panel.getByPlaceholderText(/how transformers work/i), 'Quantum mechanics');
    await user.click(panel.getByRole('button', { name: /generate with ai/i }));
    await panel.findByText('Stoicism'); // wait for response

    expect(capturedBody.prompt).toContain('Quantum mechanics');
  });

  it('includes the audience in the prompt when the audience field is filled', async () => {
    let capturedBody = null;
    server.use(
      http.post('http://localhost:3000/api/generate', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(GENERATED_TOPIC);
      })
    );

    const user = setup();
    const panel = await openPromptPanel(user);
    await user.type(panel.getByPlaceholderText(/how transformers work/i), 'React');
    await user.type(panel.getByPlaceholderText(/software engineers/i), 'beginners with no JS');
    await user.click(panel.getByRole('button', { name: /generate with ai/i }));
    await panel.findByText('Stoicism');

    expect(capturedBody.prompt).toContain('beginners with no JS');
  });
});
