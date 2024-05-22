import { expect, test } from '@grafana/plugin-e2e';
import { ExplorePage } from './fixtures/explore';
import {testIds} from "../src/services/testIds";

test.describe('explore services breakdown page', () => {
  let explorePage: ExplorePage;

  test.beforeEach(async ({ page }) => {
    explorePage = new ExplorePage(page);
    await page.evaluate(() => window.localStorage.clear());
    await explorePage.gotoServicesBreakdown();
  });

  test('should filter logs panel on search', async ({ page }) => {
    await explorePage.serviceBreakdownSearch.click();
    await explorePage.serviceBreakdownSearch.fill('broadcast');
    await page.getByRole('radiogroup').getByTestId(testIds.logsPanelHeader.radio).nth(0).click()
    await expect(page.getByRole('table').locator('tr').first().getByText('broadcast')).toBeVisible();
    await expect(page).toHaveURL(/broadcast/);
  });

  test('should filter table panel on text search', async ({ page }) => {
    const initialText = await page.getByTestId(testIds.table.wrapper).allTextContents()
    await explorePage.serviceBreakdownSearch.click();
    await explorePage.serviceBreakdownSearch.fill('broadcast');
    const afterFilterText = await page.getByTestId(testIds.table.wrapper).allTextContents()
    expect(initialText).not.toBe(afterFilterText)
  })

  test('should change filters on table click', async ({ page }) => {
    const table = await page.getByTestId(testIds.table.wrapper);
    // Get a level pill, and click it
    const levelPill = table.getByRole('cell').getByText("level=debug").first()
    await levelPill.click()
    // Get the context menu
    const pillContextMenu = await table.getByRole('img', { name: 'Add to search' });
    // Assert menu is open
    await expect(pillContextMenu).toBeVisible()
    // Click the filter button
    await pillContextMenu.click()
    // New level filter should be added
    await expect(page.getByTestId('data-testid Dashboard template variables submenu Label level')).toBeVisible()
  })

  test('should show inspect modal', async ({ page }) => {
    // Expect table to be rendered
    await expect(page.getByTestId(testIds.table.wrapper)).toBeVisible();

    await page.getByTestId(testIds.table.inspectLine).last().click();
    await expect(page.getByRole('dialog', { name: 'Inspect value' })).toBeVisible()
  });

  test('should select a label, update filters, open in explore', async ({ page }) => {
    await page.getByLabel('Tab Labels').click();
    await page.getByLabel('detected_level').click();
    await page.getByTestId('data-testid Panel header info').getByRole('button', { name: 'Add to filters' }).click();
    await expect(
      page.getByTestId('data-testid Dashboard template variables submenu Label detected_level')
    ).toBeVisible();
    const page1Promise = page.waitForEvent('popup');
    await explorePage.serviceBreakdownOpenExplore.click();
    const page1 = await page1Promise;
    await expect(page1.getByText('{service_name=`tempo-distributor`}')).toBeVisible();
  });

  test('should select a detected field, update filters, open log panel', async ({ page }) => {
    await page.getByLabel('Tab Detected fields').click();
    await page.getByTestId('data-testid Panel header err').getByRole('button', { name: 'Select' }).click();
    await page.getByRole('button', { name: 'Add to filters' }).nth(0).click();
    // Should see the logs panel full of errors
    await expect(page.getByTestId('data-testid search-logs')).toBeVisible();
    // Adhoc err filter should be added
    await expect(page.getByTestId('data-testid Dashboard template variables submenu Label err')).toBeVisible();
  });

  test('should select an include pattern field in default single view, update filters, open log panel', async ({
    page,
  }) => {
    await page.getByLabel('Tab Patterns').click();

    // Include pattern
    const firstIncludeButton = page
      .getByRole('table')
      .getByRole('row', { name: /level=info <_> caller=flush\.go/ })
      .getByText('Select');
    await firstIncludeButton.click();
    // Should see the logs panel full of patterns
    await expect(page.getByTestId('data-testid search-logs')).toBeVisible();
    // Pattern filter should be added
    await expect(page.getByText('Patterns', { exact: true })).toBeVisible();
    await expect(page.getByText('level=info < … g block" <_>')).toBeVisible();
  });

  test('Should add multiple exclude patterns, which are replaced by include pattern', async ({ page }) => {
    await page.getByLabel('Tab Patterns').click();

    const firstIncludeButton = page
      .getByRole('table')
      .getByRole('row', { name: /level=info <_> caller=flush\.go/ })
      .getByText('Select');
    const firstExcludeButton = page
      .getByRole('table')
      .getByRole('row', { name: /level=info <_> caller=flush\.go/ })
      .getByText('Exclude');

    await expect(firstIncludeButton).toBeVisible();
    await expect(firstExcludeButton).toBeVisible();

    // Include pattern
    await firstExcludeButton.click();
    // Should see the logs panel full of patterns
    await expect(page.getByTestId('data-testid search-logs')).toBeVisible();

    // Exclude another pattern
    await page.getByLabel('Tab Patterns').click();

    // Include button should be visible, but exclude should not
    await expect(firstIncludeButton).toBeVisible();
    await expect(firstExcludeButton).not.toBeVisible();

    const secondExcludeButton = page
      .getByRole('table')
      .getByRole('row', { name: /level=debug <_> caller=broadcast\.go:48/ })
      .getByText('Exclude');
    await secondExcludeButton.click();

    // Both exclude patterns should be visible
    await expect(page.getByText('Patterns', { exact: true })).not.toBeVisible();
    await expect(page.getByText('Exclude patterns:', { exact: true })).toBeVisible();
    await expect(page.getByText('level=info < … g block" <_>')).toBeVisible();
    await expect(page.getByText('level=debug <_> calle … lectors/compactor')).toBeVisible();

    // Back to patterns to include a pattern instead
    await page.getByLabel('Tab Patterns').click();

    await firstIncludeButton.click();
    await expect(page.getByText('Patterns', { exact: true })).toBeVisible();
    await expect(page.getByText('Exclude patterns:', { exact: true })).not.toBeVisible();
    await expect(page.getByText('level=info < … g block" <_>')).toBeVisible();
  });

  test('should update a filter and run new logs', async ({ page }) => {
    await page.getByTestId('AdHocFilter-service_name').getByRole('img').nth(1).click();
    await page.getByText('mimir-distributor').click();

    // open logs panel
    await page.getByRole('radiogroup').getByTestId(testIds.logsPanelHeader.radio).nth(0).click()
    await page.getByTitle('See log details').nth(1).click();

    // find text corresponding text to match adhoc filter
    await expect(page.getByTestId('data-testid Panel header Logs').getByText('mimir-distributor').nth(0)).toBeVisible();
  });
});
