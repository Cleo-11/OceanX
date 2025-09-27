import { test, expect } from '@playwright/test';

// This test assumes your app runs locally on http://localhost:3000
// Adjust the URL if needed
const APP_URL = 'http://localhost:3000/game-start';

test.describe('Submarine E2E Functionality', () => {
  test('Each submarine and its tier add-ons work as expected', async ({ page }) => {
    await page.goto(APP_URL);

    // Wait for submarine selection UI
    await expect(page.locator('.submarine-selection-backdrop')).toBeVisible();

    // Find all submarine tiers (assuming a button or element per tier)
    const tierButtons = await page.locator('[data-testid^="submarine-tier-"]').all();
    expect(tierButtons.length).toBeGreaterThan(0);

    for (let i = 0; i < tierButtons.length; i++) {
      // Select each submarine tier
      await tierButtons[i].click();
      // Wait for the submarine details to update
      await page.waitForTimeout(500);

      // Test core submarine features (replace selectors as needed)
      await expect(page.locator('[data-testid="submarine-stats"]')).toBeVisible();
      await expect(page.locator('[data-testid="submarine-features"]')).toBeVisible();

      // If there are add-on functions for higher tiers, check for their presence
      const addOn = page.locator(`[data-testid="submarine-addon-tier-${i+1}"]`);
      if (await addOn.count()) {
        await expect(addOn).toBeVisible();
        // Optionally, interact with the add-on feature
        // await addOn.click();
      }
    }
  });
});
