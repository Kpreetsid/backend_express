import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { storageConfig } from '../../configDB';

export class PdfService {
  public async generateAssetReportPdf(data: any): Promise<Buffer> {
    console.log(`[PdfService] Generating PDF for asset: ${data.assetName || 'Unknown'}`);

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
    } catch (launchError: any) {
      console.error(`[PdfService] Browser launch failed: ${launchError.message}`);
      throw new Error(`Failed to launch PDF browser: ${launchError.message}`);
    }

    try {
      const page = await browser.newPage();

      // Enable console and error logging for debugging
      page.on('console', (msg: any) => console.log('PAGE LOG:', msg.text()));
      page.on('pageerror', (err: any) => console.log('PAGE ERROR:', err.message));

      // Set a real User-Agent to avoid 403 errors from some CDNs
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');

      const html = this.buildHtml(data);

      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 60000
      });

      // Inject chart libraries - prioritizing local node_modules
      const appNodeModules = path.join(process.cwd(), 'node_modules');
      
      const scripts = [
        { 
          name: 'highcharts', 
          path: path.join(appNodeModules, 'highcharts', 'highcharts.js'),
          cdn: 'https://code.highcharts.com/highcharts.js'
        },
        { 
          name: 'echarts', 
          path: path.join(appNodeModules, 'echarts', 'dist', 'echarts.min.js'),
          cdn: 'https://cdn.jsdelivr.net/npm/echarts/dist/echarts.min.js'
        }
      ];

      for (const script of scripts) {
        let loaded = false;
        if (fs.existsSync(script.path)) {
          try {
            await page.addScriptTag({ path: script.path });
            loaded = true;
          } catch (e: any) {
            console.warn(`[PdfService] Failed to load local ${script.name} from ${script.path}: ${e.message}`);
          }
        }
        
        if (!loaded) {
          console.warn(`[PdfService] Local ${script.name} not found or failed, falling back to CDN: ${script.cdn}`);
          try {
            await page.addScriptTag({ url: script.cdn });
          } catch (e: any) {
            console.error(`[PdfService] CRITICAL: Could not load ${script.name} from any source.`);
          }
        }
      }

      // Wait for charts to be rendered with a more generous timeout
      try {
        await page.evaluate(() => {
          if (typeof (globalThis as any).renderCharts === 'function') {
            (globalThis as any).renderCharts();
          }
        });

        await page.waitForFunction(() => (globalThis as any).PDF_READY === true, {
          timeout: 60000
        });
      } catch (e) {
        console.warn('[PdfService] PDF_READY timeout exceeded, generating PDF with available content');
      }

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="font-size: 10px; width: 100%; display: flex; justify-content: space-between; padding: 0 20px; color: #666; font-family: sans-serif; border-bottom: 0.5px solid #eee;">
            <span>Asset: ${data.assetName || 'NA'}</span>
            <span>Report Date: ${data.analysisDate ? new Date(data.analysisDate).toLocaleDateString() : new Date().toLocaleDateString()}</span>
          </div>
        `,
        footerTemplate: `
          <div style="font-size: 10px; width: 100%; display: flex; justify-content: flex-end; padding: 0 20px; color: #666; font-family: sans-serif;">
            <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
          </div>
        `,
        margin: {
          top: '40px',
          bottom: '40px',
          left: '20px',
          right: '20px'
        }
      });

      return Buffer.from(pdfBuffer);
    } catch (error: any) {
      console.error(`[PdfService] PDF generation failed: ${error.stack}`);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private buildHtml(data: any): string {
    const templatePath = path.join(__dirname, '..', '..', 'public', 'asset-report.html');
    let template = fs.readFileSync(templatePath, 'utf8');

    const replacements: any = {
      generatedDate: new Date().toLocaleString(),
      assetName: data.assetName || 'NA',
      analysisDate: data.analysisDate ? new Date(data.analysisDate).toLocaleDateString() : 'NA',
      location: data.location || 'NA',
      sensorsMapped: data.sensorsMapped || '0',
      assetCondition: data.assetCondition || 'NA',
      conditionClass: this.getConditionClass(data.conditionClass),
      createdFrom: data.createdFrom || 'NA',
      observations: data.observations || 'NA',
      recommendations: data.recommendations || 'NA',
      assetImageHtml: this.buildAssetImage(data),
      isoSection: this.buildIsoSection(data),
      healthHistorySection: this.buildHealthHistorySection(data),
      readingsTable: this.buildReadingsTable(data.readings),
      faultsTable: this.buildFaultsTable(data.faultData),
      attachmentsHtml: this.buildAttachments(data.attachments),
      chartDataJson: JSON.stringify(data.chartData || {}),
      chartImagesJson: JSON.stringify(data.chartImages || {}),
      readingsJson: JSON.stringify(data.readings || [])
    };

    // Inject dynamic labels for translation
    if (data.labels) {
      Object.keys(data.labels).forEach(key => {
        replacements[key] = data.labels[key];
      });
    }

    Object.keys(replacements).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      template = template.replace(regex, () => replacements[key]);
    });

    return template;
  }

  private getConditionClass(val: any): string {
    const classes: any = {
      '1': 'critical',
      '2': 'danger',
      '3': 'alert',
      '4': 'healthy',
      '5': 'not_available'
    };
    return classes[String(val)] || 'not_available';
  }

  private buildAssetImage(data: any): string {
    if (data.assetImage) {
      return `<img src="${data.assetImage}" alt="Asset Image" />`;
    }
    return `<div class="asset-initials">${data.assetInitials || 'A'}</div>`;
  }

  private buildIsoSection(data: any): string {
    if (!data.iso) return '';
    return `
      <div class="section-title">Evaluation zone as per ISO 10816</div>
      <div class="iso-container">
        <div class="iso-chart" style="height:200px;">
            <img src="${storageConfig.baseUrl}/report-icons/ISO_chart.png" alt="ISO Chart" style="width: 100%; margin-top:10px; height: 100%; object-fit: fill;"/>
        </div>
        <div class="iso-table">
            <table class="inspection-table">
                <tr style="background: #000069 !important; color: white !important;">
                  <th style="width:15%; background: #000069 !important; color: white !important; border: 1px solid #ffffff44;">Class</th>
                  <th style="background: #000069 !important; color: white !important; border: 1px solid #ffffff44;">Description</th>
                </tr>
                <tr><td class="font-semibold">Class 1</td><td>Machines having separated driver and driven, or coupled units comprising machinery up to approx 15kw</td></tr>
                <tr><td class="font-semibold">Class 2</td><td>Machinery (15kw to 75kw) without special foundations or rigidly mounted machines up to 300kW mounted on special foundations</td></tr>
                <tr><td class="font-semibold">Class 3</td><td>Machines having large prime movers with rotating assemblies mounted on rigid and heavy foundations</td></tr>
                <tr><td class="font-semibold">Class 4</td><td>Large prime movers with large rotating assemblies mounted on foundations soft in the direction of the measured vibration (i.e turbine, generators, gas turbines greater than 10MW)</td></tr>
            </table>
        </div>
      </div>
    `;
  }

  private buildHealthHistorySection(data: any): string {
    if (!data.healthHistory || data.healthHistory.length === 0) return '';
    
    const slice = data.healthHistory.slice(-12);
    const headers = slice.map((h: any) => `<th style="background: #000069 !important; color: white !important; border: 1px solid #ffffff44;">${h.date}</th>`).join('');
    const cells = slice.map((h: any) => {
        const cls = this.getConditionClass(h.status);
        return `<td><div class="health-status-dot ${cls}"></div></td>`;
    }).join('');

    return `
      <div class="section-title">Asset Health History</div>
      <div style="display:flex; justify-content:center; gap:15px; margin-bottom:10px;">
        <div style="display:flex; align-items:center; gap:5px;"><div style="width:10px; height:10px; border-radius:50%; background:#fb565a;"></div><span style="font-size:10px;">Critical</span></div>
        <div style="display:flex; align-items:center; gap:5px;"><div style="width:10px; height:10px; border-radius:50%; background:#fa8349;"></div><span style="font-size:10px;">Danger</span></div>
        <div style="display:flex; align-items:center; gap:5px;"><div style="width:10px; height:10px; border-radius:50%; background:#f7fa4b;"></div><span style="font-size:10px;">Alert</span></div>
        <div style="display:flex; align-items:center; gap:5px;"><div style="width:10px; height:10px; border-radius:50%; background:#51fc4c;"></div><span style="font-size:10px;">Healthy</span></div>
        <div style="display:flex; align-items:center; gap:5px;"><div style="width:10px; height:10px; border-radius:50%; background:#d8dae2;"></div><span style="font-size:10px;">Not Available</span></div>
      </div>
      <div class="health-history-container">
          <table class="health-history-table">
            <thead>
                <tr style="background: #000069 !important; color: white !important;">
                  <th style="text-align:left; padding-left:10px; width:60px; background: #000069 !important; color: white !important; border: 1px solid #ffffff44;">Date</th>
                  ${headers}
                </tr>
            </thead>
            <tbody>
                <tr><td class="font-semibold" style="text-align:left; padding-left:10px;">Status</td>${cells}</tr>
            </tbody>
          </table>
      </div>
    `;
  }

  private buildReadingsTable(readings: any[]): string {
    if (!readings || readings.length === 0) return '<div class="no-data-msg">No Data Collected Yet.</div>';

    let rows = '';
    readings.forEach(point => {
      const timestamp = point.timestamp;
      let dateStr = '-';
      if (timestamp) {
        try {
          // Handle both seconds and milliseconds
          const date = new Date(timestamp > 10000000000 ? timestamp : timestamp * 1000);
          dateStr = date.toLocaleString();
        } catch (e) {
          dateStr = String(timestamp);
        }
      }

      rows += `
        <tr>
          <td rowspan="2" class="font-semibold" style="background: #fdfdfd;">${point.point}</td>
          <td rowspan="2" style="text-align:center; background: #fdfdfd;">${dateStr}</td>
          <td style="text-align:center; color: #555;">Acceleration (g)</td>
          <td style="text-align:center; font-weight: bold;">${point.acceleration?.h ?? '-'}</td>
          <td style="text-align:center; font-weight: bold;">${point.acceleration?.v ?? '-'}</td>
          <td style="text-align:center; font-weight: bold;">${point.acceleration?.a ?? '-'}</td>
        </tr>
        <tr>
          <td style="text-align:center; color: #555;">Velocity (mm/s)</td>
          <td style="text-align:center; font-weight: bold;">${point.velocity?.h ?? '-'}</td>
          <td style="text-align:center; font-weight: bold;">${point.velocity?.v ?? '-'}</td>
          <td style="text-align:center; font-weight: bold;">${point.velocity?.a ?? '-'}</td>
        </tr>
      `;
    });

    return `
      <table class="inspection-table readings-table">
        <thead>
          <tr style="background: #000069 !important; color: white !important;">
            <th rowspan="2" style="background: #000069 !important; color: white !important; border: 1px solid #ffffff44;">Measuring Point</th>
            <th rowspan="2" style="background: #000069 !important; color: white !important; border: 1px solid #ffffff44;">Timestamp</th>
            <th rowspan="2" style="background: #000069 !important; color: white !important; border: 1px solid #ffffff44;">Field</th>
            <th colspan="3" style="background: #000069 !important; color: white !important; border: 1px solid #ffffff44;">RMS Values</th>
          </tr>
          <tr style="background: #000069 !important; color: white !important;">
            <th style="background: #000069 !important; color: white !important; border: 1px solid #ffffff44;">Horizontal</th>
            <th style="background: #000069 !important; color: white !important; border: 1px solid #ffffff44;">Vertical</th>
            <th style="background: #000069 !important; color: white !important; border: 1px solid #ffffff44;">Axial</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  private buildFaultsTable(faultData: any[]): string {
    if (!faultData || faultData.length === 0) return '<div class="no-data-msg">No Faults Detected.</div>';

    const rows = faultData.map(row => {
      const getDot = (val: number, target: number, color: string) => {
        return val == target ? `<div style="width: 50px; height: 12px; border-radius: 5%; background-color: ${color}; margin: 0 auto; box-shadow: 0 0 4px ${color};"></div>` : '';
      };

      return `
        <tr>
          <td class="font-semibold" style="padding-left: 15px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <img src="${storageConfig.baseUrl}/report-icons/${row.name}.png" alt="${row.name}_icon" onerror="this.src='${storageConfig.baseUrl}/report-icons/Other.png'" style="height: 25px; width: 25px; object-fit: contain; vertical-align: middle;" />
              <span style="margin-left: 8px;">${row.translatedName || row.name}</span>
            </div>
          </td>
          <td>${getDot(row.value, 1, '#03b03e')}</td>
          <td>${getDot(row.value, 2, '#f9f500')}</td>
          <td>${getDot(row.value, 3, '#f3b900')}</td>
          <td>${getDot(row.value, 4, '#df0028')}</td>
        </tr>
      `;
    }).join('');

    return `
      <table class="inspection-table">
        <thead>
          <tr style="background: #000069 !important; color: white !important;">
            <th style="width:30%; text-align: left; padding-left: 15px; background: #000069 !important; color: white !important; border: 1px solid #ffffff44;">Fault Condition</th>
            <th style="text-align: center; background: #000069 !important; color: white !important; border: 1px solid #ffffff44;">Good</th>
            <th style="text-align: center; background: #000069 !important; color: white !important; border: 1px solid #ffffff44;">Satisfactory</th>
            <th style="text-align: center; background: #000069 !important; color: white !important; border: 1px solid #ffffff44;">Unsatisfactory</th>
            <th style="text-align: center; background: #000069 !important; color: white !important; border: 1px solid #ffffff44;">Unacceptable</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  private buildAttachments(attachments: string[]): string {
    if (!attachments || attachments.length === 0) return '<div class="no-data-msg">No files attached to this report.</div>';

    return `
      <div class="attachments-grid">
        ${attachments.map(img => `
          <div class="attachment-card">
            <img src="${img}" style="border: 1px solid #eee; box-shadow: 0 2px 4px rgba(0,0,0,0.05);" />
          </div>
        `).join('')}
      </div>
    `;
  }
}