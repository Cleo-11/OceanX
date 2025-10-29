/**
 * Frontend Integration Tests for Submarine Upgrade
 * 
 * Tests the complete upgrade flow from UI interaction to state updates.
 * Uses React Testing Library and MSW (Mock Service Worker) for API mocking.
 * 
 * To run these tests, install:
 *   pnpm add -D @testing-library/react @testing-library/jest-dom @testing-library/user-event msw
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { OceanMiningGame } from '@/components/ocean-mining-game';
import { walletManager } from '@/lib/wallet';
import { apiClient } from '@/lib/api';

// Mock wallet manager
jest.mock('@/lib/wallet', () => ({
  walletManager: {
    getConnection: jest.fn(),
    signMessage: jest.fn(),
  },
}));

// Mock websocket manager
jest.mock('@/lib/websocket', () => ({
  wsManager: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn(),
    joinSession: jest.fn(),
  },
}));

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Setup MSW server
const server = setupServer(
  // Mock player balance endpoint
  rest.post(`${API_BASE_URL}/player/balance`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        coins: 1000,
        balance: '1000',
        symbol: 'COIN',
        network: 'offchain',
      })
    );
  }),

  // Mock player submarine endpoint
  rest.post(`${API_BASE_URL}/player/submarine`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        current: {
          id: 1,
          tier: 1,
          name: 'Nautilus I',
          description: 'Basic submarine',
          storage: 100,
          speed: 1,
          miningPower: 1,
          color: '#fbbf24',
          specialAbility: null,
        },
        canUpgrade: true,
      })
    );
  }),

  // Mock upgrade endpoint (success)
  rest.post(`${API_BASE_URL}/submarine/upgrade`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        playerId: 'test-player-id',
        wallet: '0x1234567890abcdef',
        previousTier: 1,
        newTier: 2,
        tierDetails: {
          id: 2,
          tier: 2,
          name: 'Nautilus II',
          description: 'Improved submarine',
          baseStats: {
            health: 125,
            energy: 120,
            maxCapacity: { nickel: 150, cobalt: 75, copper: 75, manganese: 40 },
            speed: 1.1,
            miningRate: 1.2,
          },
        },
        coins: 800,
        cost: { coins: 200 },
        timestamp: new Date().toISOString(),
        message: 'Submarine upgraded to tier 2',
      })
    );
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Frontend Integration: Submarine Upgrade Flow', () => {
  const mockWalletConnection = {
    address: '0x1234567890abcdef',
    provider: {},
  };

  beforeEach(() => {
    walletManager.getConnection.mockReturnValue(mockWalletConnection);
    walletManager.signMessage.mockResolvedValue('mock-signature');
  });

  test('should display current submarine tier on load', async () => {
    const { container } = render(
      <OceanMiningGame
        walletConnected={true}
        gameState="idle"
        setGameState={jest.fn()}
        sidebarOpen={false}
        setSidebarOpen={jest.fn()}
        onFullDisconnect={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/nautilus i/i)).toBeInTheDocument();
    });
  });

  test('should successfully upgrade submarine when button clicked', async () => {
    const user = userEvent.setup();
    const setGameState = jest.fn();

    render(
      <OceanMiningGame
        walletConnected={true}
        gameState="idle"
        setGameState={setGameState}
        sidebarOpen={false}
        setSidebarOpen={jest.fn()}
        onFullDisconnect={jest.fn()}
      />
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText(/nautilus i/i)).toBeInTheDocument();
    });

    // Open upgrade modal
    const upgradeButton = screen.getByRole('button', { name: /upgrade/i });
    await user.click(upgradeButton);

    // Confirm upgrade
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    // Verify state changes
    await waitFor(() => {
      expect(setGameState).toHaveBeenCalledWith('upgrading');
    });

    await waitFor(() => {
      expect(setGameState).toHaveBeenCalledWith('upgraded');
    });

    // Verify API was called
    expect(walletManager.signMessage).toHaveBeenCalledWith(
      expect.stringContaining('upgrade submarine')
    );
  });

  test('should update UI with new tier after successful upgrade', async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <OceanMiningGame
        walletConnected={true}
        gameState="idle"
        setGameState={jest.fn()}
        sidebarOpen={false}
        setSidebarOpen={jest.fn()}
        onFullDisconnect={jest.fn()}
      />
    );

    // Trigger upgrade
    const upgradeButton = screen.getByRole('button', { name: /upgrade/i });
    await user.click(upgradeButton);
    
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    // After upgrade completes, loadPlayerData should be called
    await waitFor(() => {
      expect(screen.getByText(/nautilus ii/i)).toBeInTheDocument();
    });
  });

  test('should display error when upgrade fails due to insufficient coins', async () => {
    const user = userEvent.setup();
    
    // Override upgrade endpoint to return error
    server.use(
      rest.post(`${API_BASE_URL}/submarine/upgrade`, (req, res, ctx) => {
        return res(
          ctx.status(402),
          ctx.json({
            error: 'Not enough coins to upgrade submarine',
            code: 'INSUFFICIENT_COINS',
          })
        );
      })
    );

    const alertSpy = jest.spyOn(window, 'alert').mockImplementation();

    render(
      <OceanMiningGame
        walletConnected={true}
        gameState="idle"
        setGameState={jest.fn()}
        sidebarOpen={false}
        setSidebarOpen={jest.fn()}
        onFullDisconnect={jest.fn()}
      />
    );

    const upgradeButton = screen.getByRole('button', { name: /upgrade/i });
    await user.click(upgradeButton);
    
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        expect.stringContaining('Not enough coins')
      );
    });

    alertSpy.mockRestore();
  });

  test('should update coin balance after upgrade', async () => {
    const user = userEvent.setup();

    render(
      <OceanMiningGame
        walletConnected={true}
        gameState="idle"
        setGameState={jest.fn()}
        sidebarOpen={false}
        setSidebarOpen={jest.fn()}
        onFullDisconnect={jest.fn()}
      />
    );

    // Initial balance should be 1000
    await waitFor(() => {
      expect(screen.getByText(/1000.*coin/i)).toBeInTheDocument();
    });

    // Trigger upgrade
    const upgradeButton = screen.getByRole('button', { name: /upgrade/i });
    await user.click(upgradeButton);
    
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    // Balance should update to 800 after 200 coin upgrade
    await waitFor(() => {
      expect(screen.getByText(/800.*coin/i)).toBeInTheDocument();
    });
  });

  test('should disable upgrade button during upgrade transaction', async () => {
    const user = userEvent.setup();

    render(
      <OceanMiningGame
        walletConnected={true}
        gameState="idle"
        setGameState={jest.fn()}
        sidebarOpen={false}
        setSidebarOpen={jest.fn()}
        onFullDisconnect={jest.fn()}
      />
    );

    const upgradeButton = screen.getByRole('button', { name: /upgrade/i });
    await user.click(upgradeButton);
    
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    
    // Click and immediately check if disabled
    await user.click(confirmButton);
    
    expect(confirmButton).toBeDisabled();
  });

  test('should call loadPlayerData after successful upgrade', async () => {
    const user = userEvent.setup();
    
    // Spy on balance endpoint to verify it's called after upgrade
    let balanceCallCount = 0;
    server.use(
      rest.post(`${API_BASE_URL}/player/balance`, (req, res, ctx) => {
        balanceCallCount++;
        return res(
          ctx.status(200),
          ctx.json({
            coins: balanceCallCount === 1 ? 1000 : 800,
            balance: balanceCallCount === 1 ? '1000' : '800',
            symbol: 'COIN',
            network: 'offchain',
          })
        );
      })
    );

    render(
      <OceanMiningGame
        walletConnected={true}
        gameState="idle"
        setGameState={jest.fn()}
        sidebarOpen={false}
        setSidebarOpen={jest.fn()}
        onFullDisconnect={jest.fn()}
      />
    );

    // Wait for initial load (1st balance call)
    await waitFor(() => {
      expect(balanceCallCount).toBe(1);
    });

    // Trigger upgrade
    const upgradeButton = screen.getByRole('button', { name: /upgrade/i });
    await user.click(upgradeButton);
    
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    // loadPlayerData should be called after upgrade (2nd balance call)
    await waitFor(() => {
      expect(balanceCallCount).toBe(2);
    });
  });
});

describe('API Client Integration Tests', () => {
  const mockWallet = '0x1234567890abcdef';
  const mockSignature = 'mock-signature-hex';
  const mockMessage = 'AbyssX upgrade submarine\n\nWallet: 0x1234567890abcdef\nTimestamp: 1234567890\nNetwork: Sepolia';

  test('apiClient.upgradeSubmarine sends correct payload', async () => {
    let capturedRequest;

    server.use(
      rest.post(`${API_BASE_URL}/submarine/upgrade`, async (req, res, ctx) => {
        capturedRequest = await req.json();
        return res(
          ctx.status(200),
          ctx.json({
            playerId: 'test-id',
            wallet: mockWallet,
            previousTier: 1,
            newTier: 2,
            coins: 800,
            cost: { coins: 200 },
          })
        );
      })
    );

    await apiClient.upgradeSubmarine(mockWallet, mockSignature, mockMessage);

    expect(capturedRequest).toEqual({
      address: mockWallet,
      signature: mockSignature,
      message: mockMessage,
    });
  });

  test('apiClient.upgradeSubmarine includes targetTier when provided', async () => {
    let capturedRequest;

    server.use(
      rest.post(`${API_BASE_URL}/submarine/upgrade`, async (req, res, ctx) => {
        capturedRequest = await req.json();
        return res(ctx.status(200), ctx.json({}));
      })
    );

    await apiClient.upgradeSubmarine(mockWallet, mockSignature, mockMessage, 5);

    expect(capturedRequest.targetTier).toBe(5);
  });

  test('apiClient.upgradeSubmarine handles error responses correctly', async () => {
    server.use(
      rest.post(`${API_BASE_URL}/submarine/upgrade`, (req, res, ctx) => {
        return res(
          ctx.status(402),
          ctx.json({
            error: 'Not enough coins',
            code: 'INSUFFICIENT_COINS',
          })
        );
      })
    );

    const response = await apiClient.upgradeSubmarine(
      mockWallet,
      mockSignature,
      mockMessage
    );

    expect(response.success).toBe(false);
    expect(response.error).toContain('Not enough coins');
  });
});
