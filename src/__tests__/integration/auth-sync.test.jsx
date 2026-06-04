// @vitest-environment jsdom
/**
 * Behavioral integration tests — Supabase auth and cloud sync
 *
 * Unlike app.test.jsx (which uses supabase: null), these tests provide a
 * proper spy-based Supabase mock so we can verify:
 *
 *  - signInWithOAuth is called when the Google button is clicked
 *  - signInWithOtp is called with the typed email when magic link is sent
 *  - signOut is called when the Sign Out button is clicked
 *  - upsert is called with the correct payload when progress changes
 *  - cloud data is applied to the UI when a signed-in user loads existing data
 *
 * All vi.fn() mocks are created with vi.hoisted() so they are available in the
 * vi.mock() factory (which is hoisted before import statements by Vitest).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App.jsx';
import { TINY_LIBRARY } from '../fixtures.js';

// ── Hoisted spy functions (available inside vi.mock factory) ──────────────────

const mocks = vi.hoisted(() => {
  const mockUpsert  = vi.fn().mockResolvedValue({ error: null });
  const mockSingle  = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
  const mockEq      = vi.fn().mockReturnValue({ single: mockSingle });
  const mockSelect  = vi.fn().mockReturnValue({ eq: mockEq });
  const mockFrom    = vi.fn().mockReturnValue({ upsert: mockUpsert, select: mockSelect });

  const mockGetSession         = vi.fn().mockResolvedValue({ data: { session: null } });
  const mockOnAuthStateChange  = vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  const mockSignOut            = vi.fn().mockResolvedValue({});
  const mockSignInWithOtp      = vi.fn().mockResolvedValue({ error: null });
  const mockSignInWithOAuth    = vi.fn().mockResolvedValue({ data: {}, error: null });

  return {
    mockUpsert, mockSingle, mockEq, mockSelect, mockFrom,
    mockGetSession, mockOnAuthStateChange,
    mockSignOut, mockSignInWithOtp, mockSignInWithOAuth,
  };
});

vi.mock('../../supabase.js', () => ({
  supabase: {
    auth: {
      getSession:          mocks.mockGetSession,
      onAuthStateChange:   mocks.mockOnAuthStateChange,
      signOut:             mocks.mockSignOut,
      signInWithOtp:       mocks.mockSignInWithOtp,
      signInWithOAuth:     mocks.mockSignInWithOAuth,
    },
    from: mocks.mockFrom,
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const setup = (library = null, extraStorage = {}) => {
  if (library) localStorage.setItem('sl-lib', JSON.stringify(library));
  Object.entries(extraStorage).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
  const user = userEvent.setup();
  render(<App />);
  return user;
};

/** Simulate a signed-in session by overriding getSession before render */
const setupWithUser = (userId = 'user-123', library = null, extraStorage = {}) => {
  mocks.mockGetSession.mockResolvedValueOnce({
    data: { session: { user: { id: userId, email: `${userId}@test.com` } } },
  });
  // No existing cloud data → "first sign-in" branch → cloudSyncEnabled = true
  mocks.mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
  return setup(library, extraStorage);
};

const openAuthModal = async (user) => {
  await user.click(await screen.findByRole('button', { name: /profile/i }));
  await user.click(await screen.findByRole('button', { name: /^sign in$/i }));
  await screen.findByText(/sign in with google/i);
};

// ── Clean mocks between tests ─────────────────────────────────────────────────

beforeEach(() => {
  Object.values(mocks).forEach(m => typeof m.mockClear === 'function' && m.mockClear());
  // Restore default: unauthenticated session
  mocks.mockGetSession.mockResolvedValue({ data: { session: null } });
  mocks.mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  mocks.mockSignInWithOtp.mockResolvedValue({ error: null });
  mocks.mockSignInWithOAuth.mockResolvedValue({ data: {}, error: null });
  mocks.mockUpsert.mockResolvedValue({ error: null });
  mocks.mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
});

// ── Google sign-in ────────────────────────────────────────────────────────────

describe('Google sign-in', () => {
  it('calls signInWithOAuth when the Google button is clicked', async () => {
    const user = userEvent.setup();
    setup();
    await openAuthModal(user);
    await user.click(screen.getByText(/sign in with google/i));
    expect(mocks.mockSignInWithOAuth).toHaveBeenCalledOnce();
  });

  it('calls signInWithOAuth with provider "google"', async () => {
    const user = userEvent.setup();
    setup();
    await openAuthModal(user);
    await user.click(screen.getByText(/sign in with google/i));
    expect(mocks.mockSignInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' })
    );
  });

  it('includes a redirectTo pointing at the current origin', async () => {
    const user = userEvent.setup();
    setup();
    await openAuthModal(user);
    await user.click(screen.getByText(/sign in with google/i));
    const [callArg] = mocks.mockSignInWithOAuth.mock.calls[0];
    expect(callArg.options?.redirectTo).toBe(window.location.origin);
  });
});

// ── Magic link ────────────────────────────────────────────────────────────────

describe('Magic link sign-in', () => {
  it('calls signInWithOtp with the typed email when "Send magic link" is clicked', async () => {
    const user = userEvent.setup();
    setup();
    await openAuthModal(user);
    await user.type(screen.getByPlaceholderText(/your@email\.com/i), 'hello@example.com');
    await user.click(screen.getByRole('button', { name: /send magic link/i }));
    expect(mocks.mockSignInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'hello@example.com' })
    );
  });

  it('shows "Check your inbox" after magic link is sent successfully', async () => {
    const user = userEvent.setup();
    setup();
    await openAuthModal(user);
    await user.type(screen.getByPlaceholderText(/your@email\.com/i), 'hello@example.com');
    await user.click(screen.getByRole('button', { name: /send magic link/i }));
    expect(await screen.findByText(/check your inbox/i)).toBeInTheDocument();
  });

  it('shows an error message when signInWithOtp returns an error', async () => {
    mocks.mockSignInWithOtp.mockResolvedValueOnce({ error: { message: 'Invalid email address' } });
    const user = userEvent.setup();
    setup();
    await openAuthModal(user);
    await user.type(screen.getByPlaceholderText(/your@email\.com/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /send magic link/i }));
    expect(await screen.findByText(/invalid email address/i)).toBeInTheDocument();
  });

  it('does not call signInWithOtp when the email field is empty', async () => {
    const user = userEvent.setup();
    setup();
    await openAuthModal(user);
    // Click without typing — button is disabled when email is empty
    const sendBtn = screen.getByRole('button', { name: /send magic link/i });
    // Button is disabled (style shows it's inactive) — do NOT click, just verify
    expect(sendBtn).toBeDisabled();
    expect(mocks.mockSignInWithOtp).not.toHaveBeenCalled();
  });
});

// ── Sign out ──────────────────────────────────────────────────────────────────

describe('Sign out', () => {
  it('calls supabase.auth.signOut when Sign Out is clicked in the sidebar', async () => {
    // Simulate a signed-in user by triggering the auth state change callback
    let authCallback;
    mocks.mockOnAuthStateChange.mockImplementationOnce((cb) => {
      authCallback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    const user = userEvent.setup();
    setup();
    await screen.findByText('Deckwise Library & Folders');

    // Simulate the auth state change to SIGNED_IN
    await act(async () => {
      authCallback('SIGNED_IN', { user: { id: 'user-123' } });
    });

    // Open sidebar — user is now logged in, so Sign Out appears
    await user.click(screen.getByRole('button', { name: /profile/i }));
    const signOutBtn = await screen.findByRole('button', { name: /sign out/i });
    await user.click(signOutBtn);

    expect(mocks.mockSignOut).toHaveBeenCalledOnce();
  });
});

// ── Cloud sync (write path) ───────────────────────────────────────────────────

describe('Cloud sync — write path', () => {
  it('calls upsert on first sign-in to push local data to the cloud', async () => {
    // setupWithUser configures getSession to return a user
    // and mockSingle to return no existing cloud data
    // → "first sign-in" branch → syncNow() → upsert
    setupWithUser('user-abc', TINY_LIBRARY);
    await screen.findByText('Tiny Topic');

    await waitFor(() => {
      expect(mocks.mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'user-abc' })
      );
    });
  });

  it('upsert payload includes the library on first sign-in sync', async () => {
    setupWithUser('user-abc', TINY_LIBRARY);
    await screen.findByText('Tiny Topic');

    await waitFor(() => {
      const [payload] = mocks.mockUpsert.mock.calls[0];
      expect(JSON.stringify(payload.library)).toContain('Tiny Topic');
    });
  });
});

// ── Cloud sync (read path) ────────────────────────────────────────────────────

describe('Cloud sync — read path', () => {
  it('applies cloud library data to the UI when signed-in user has existing cloud data', async () => {
    const cloudLibrary = {
      id: 'root', title: 'My Library', type: 'directory',
      children: [
        { id: 'cloud-topic', title: 'Cloud Topic', type: 'topic', path: [], cards: [] },
      ],
    };

    // First, configure getSession to return a signed-in user
    mocks.mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-123' } } },
    });
    // Returning existing cloud data → applyCloudData branch
    mocks.mockSingle.mockResolvedValueOnce({
      data: { library: cloudLibrary, completion_map: {}, revisit_ids: [], confused_ids: [], starred_ids: [], progress_map: {} },
      error: null,
    });
    // Mark device as having synced before → skip merge dialog
    localStorage.setItem('sl-synced-user-123', 'true');

    render(<App />);
    // Cloud library data should be applied — "Cloud Topic" appears
    expect(await screen.findByText('Cloud Topic')).toBeInTheDocument();
  });

  it('shows the home screen with local data when no cloud data exists (first sign-in)', async () => {
    setupWithUser('user-abc', TINY_LIBRARY);
    // "first sign-in" branch → local data is kept and pushed
    expect(await screen.findByText('Tiny Topic')).toBeInTheDocument();
  });
});
