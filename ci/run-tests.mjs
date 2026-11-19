// Ejecuta tests.html en Chromium sin ventana (Playwright) y falla si alguna prueba no pasa.
// Uso (en GitHub Actions o en local con Playwright instalado):  node ci/run-tests.mjs
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const url = pathToFileURL(path.resolve('tests.html')).href;
const browser = await chromium.launch();
const page = await browser.newPage();

const pageErrors = [];
page.on('pageerror', err => pageErrors.push(err.message));
page.on('console', msg => { if (msg.type() === 'error') pageErrors.push(msg.text()); });

await page.goto(url);
await page.waitForFunction(() => window.TEST_RESULTS, null, { timeout: 120000 });
const r = await page.evaluate(() => window.TEST_RESULTS);
await browser.close();

for (const t of r.results) {
  console.log(`${t.ok ? 'OK  ' : 'FALLO'} ${t.name}${t.ok ? '' : ' — ' + t.msg} (${t.ms} ms)`);
}
console.log(`\n${r.total - r.failed} de ${r.total} pruebas pasan`);

// Los errores de consola de las pruebas que fallan ya se ven arriba; solo cuentan los errores de página
const unexpected = pageErrors.filter(e => !r.results.some(t => !t.ok && e.includes(t.name)));
if (unexpected.length) console.error('\nErrores en la página:\n' + unexpected.join('\n'));

process.exit(r.failed > 0 || unexpected.length > 0 ? 1 : 0);
