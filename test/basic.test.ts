import { expect, test } from "@playwright/test";

test("toast is rendered and then disappears", async ({ page }) => {
	page.goto("http://localhost:5173");

	await page.click("button");

	await expect(page.locator("[data-sonner-toast]")).toHaveCount(1);
	await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
});
