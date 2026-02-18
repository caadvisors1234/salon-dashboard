import puppeteer, { type Browser } from "puppeteer";
import { PDFDocument } from "pdf-lib";
import archiver from "archiver";

const REPORT_READY_TIMEOUT = 30_000; // 30秒
const REPORT_READY_POLL_INTERVAL = 500; // 500ms
const BROWSER_IDLE_TIMEOUT_MS = 60_000; // 1分
const _parsedScale = parseFloat(process.env.PDF_DEVICE_SCALE_FACTOR || "1.5");
const PDF_DEVICE_SCALE_FACTOR = Number.isNaN(_parsedScale) ? 1.5 : Math.max(1, Math.min(3, _parsedScale));

function getBaseUrl(): string {
  return process.env.REPORT_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
}

// --- ブラウザインスタンス管理（再利用 + アイドルタイマー） ---

let browserInstance: Browser | null = null;
let browserLaunchPromise: Promise<Browser> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function resetIdleTimer(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    if (browserInstance?.connected) {
      await browserInstance.close().catch(() => {});
      browserInstance = null;
    }
    idleTimer = null;
  }, BROWSER_IDLE_TIMEOUT_MS);
}

async function getBrowser(): Promise<Browser> {
  // アイドルタイマーをクリア（使用中なので閉じない）
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }

  if (browserInstance?.connected) {
    return browserInstance;
  }

  // 複数リクエストが同時に来ても1回だけ起動する
  if (browserLaunchPromise) {
    return browserLaunchPromise;
  }

  browserLaunchPromise = puppeteer
    .launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    })
    .then((browser) => {
      browserInstance = browser;
      browserLaunchPromise = null;

      // ブラウザが予期せず切断された場合にリセット
      browser.on("disconnected", () => {
        browserInstance = null;
        if (idleTimer) {
          clearTimeout(idleTimer);
          idleTimer = null;
        }
      });

      return browser;
    })
    .catch((err) => {
      browserLaunchPromise = null;
      throw err;
    });

  return browserLaunchPromise;
}

// A4横のポイントサイズ
const A4_LANDSCAPE_WIDTH = 841.89;
const A4_LANDSCAPE_HEIGHT = 595.28;

/**
 * 複数のPNGスクリーンショットをA4横PDFに合成する。
 * 各スクリーンショットが1ページになる。画像は上寄せ配置。
 */
async function screenshotsToPdf(screenshots: Buffer[]): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();

  for (let i = 0; i < screenshots.length; i++) {
    let pngImage;
    try {
      pngImage = await pdfDoc.embedPng(screenshots[i]);
    } catch (err) {
      throw new Error(
        `PDFページ ${i + 1}/${screenshots.length} の画像埋め込みに失敗: ${err instanceof Error ? err.message : err}`
      );
    }
    const page = pdfDoc.addPage([A4_LANDSCAPE_WIDTH, A4_LANDSCAPE_HEIGHT]);

    const scaleX = A4_LANDSCAPE_WIDTH / pngImage.width;
    const scaleY = A4_LANDSCAPE_HEIGHT / pngImage.height;
    const scale = Math.min(scaleX, scaleY);

    const drawWidth = pngImage.width * scale;
    const drawHeight = pngImage.height * scale;

    // 水平中央、上寄せ（PDF座標系はY軸が下から上）
    page.drawImage(pngImage, {
      x: (A4_LANDSCAPE_WIDTH - drawWidth) / 2,
      y: A4_LANDSCAPE_HEIGHT - drawHeight,
      width: drawWidth,
      height: drawHeight,
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * 店舗単位のPDFを生成する。
 * signal が abort された場合、ページをクローズしてキャンセルする。
 */
export async function generateStorePdf(
  locationId: string,
  startMonth: string,
  endMonth: string,
  token: string,
  signal?: AbortSignal
): Promise<Buffer> {
  if (signal?.aborted) {
    throw new Error("PDF生成がキャンセルされました");
  }

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/report/store/${locationId}?from=${startMonth}&to=${endMonth}`;

  const browser = await getBrowser();
  const page = await browser.newPage();

  // AbortSignal によるキャンセル対応: ページをクローズして処理を中断
  const onAbort = () => { page.close().catch(() => {}); };
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    // トークンをURLクエリパラメータではなくcookieで渡す
    await page.setCookie({
      name: "report_token",
      value: token,
      url: baseUrl,
    });

    // 297mm ≈ 1122px @96dpi — report-page幅と一致させる
    await page.setViewport({ width: 1122, height: 793, deviceScaleFactor: PDF_DEVICE_SCALE_FACTOR });

    await page.goto(url, { waitUntil: "networkidle0", timeout: 30_000 });

    // __REPORT_READY フラグをポーリングで待機
    await page.waitForFunction("window.__REPORT_READY === true", {
      timeout: REPORT_READY_TIMEOUT,
      polling: REPORT_READY_POLL_INTERVAL,
    });

    // 各 [data-pdf-page] 要素をスクリーンショットし、pdf-lib で合成
    const pageElements = await page.$$("[data-pdf-page]");
    if (pageElements.length === 0) {
      throw new Error("PDF生成対象の要素が見つかりません（[data-pdf-page] が0個）");
    }

    const screenshots: Buffer[] = [];
    for (const el of pageElements) {
      const shot = await el.screenshot({ type: "png" });
      screenshots.push(Buffer.from(shot));
    }

    return await screenshotsToPdf(screenshots);
  } catch (err) {
    if (signal?.aborted) {
      throw new Error("PDF生成がキャンセルされました");
    }
    const message =
      err instanceof Error ? err.message : "PDF生成中に不明なエラーが発生しました";
    throw new Error(`PDF生成失敗 (locationId: ${locationId}): ${message}`);
  } finally {
    signal?.removeEventListener("abort", onAbort);
    await page.close().catch(() => {});
    resetIdleTimer();
  }
}

/**
 * クライアント単位のZIPを生成する。
 * 各店舗の個別PDFをZIPにまとめる。
 * 各店舗のPDF生成はキュー経由で個別に実行される。
 */
export async function generateClientZip(
  orgName: string,
  startMonth: string,
  endMonth: string,
  token: string,
  locations: Array<{ id: string; name: string }>,
  enqueueJob: (job: (signal: AbortSignal) => Promise<Buffer>) => Promise<Buffer>
): Promise<Buffer> {
  const pdfs: Array<{ name: string; buffer: Buffer }> = [];

  // 各店舗のPDFをキュー経由で個別に生成
  for (const location of locations) {
    const buffer = await enqueueJob((signal) =>
      generateStorePdf(location.id, startMonth, endMonth, token, signal)
    );

    const safeName = location.name.replace(/[/\\?%*:|"<>]/g, "_");
    const fileName = `${orgName}_${safeName}_${startMonth}-${endMonth}.pdf`;
    pdfs.push({ name: fileName, buffer });
  }

  // archiver でZIPにまとめる
  return new Promise<Buffer>((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 5 } });
    const chunks: Buffer[] = [];

    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", (err) => reject(err));

    for (const pdf of pdfs) {
      archive.append(pdf.buffer, { name: pdf.name });
    }

    archive.finalize();
  });
}
