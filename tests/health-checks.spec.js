import { test, expect } from '@playwright/test';

test.describe('Command Center Health Checks', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Streamlit renders async; wait for a known anchor in the overview
        await expect(page.getByText('ClaudeClaw Services')).toBeVisible({ timeout: 30_000 });
    });

    test('ClaudeClaw services strip renders dashboard + war room rows', async ({ page }) => {
        await expect(page.getByText('http://localhost:3141', { exact: false })).toBeVisible();
        await expect(page.getByText('http://localhost:7860', { exact: false })).toBeVisible();
    });

    test('Ollama sidebar reports online', async ({ page }) => {
        // app.py renders st.success("🟢 Ollama Online") on success and
        // st.error("🔴 Ollama Offline") on failure, so the text alone is
        // a sufficient health signal (Streamlit splits the emoji into a
        // separate node from the text).
        await expect(page.getByText('Ollama Online')).toBeVisible();
        await expect(page.getByText('Ollama Offline')).toHaveCount(0);
    });

    test('service Open buttons link to expected URLs', async ({ page }) => {
        // st.link_button renders <a> with the destination href
        await expect(page.locator('a[href="http://localhost:3141"]').first()).toBeVisible();
        await expect(page.locator('a[href="http://localhost:7860"]').first()).toBeVisible();
    });
});
