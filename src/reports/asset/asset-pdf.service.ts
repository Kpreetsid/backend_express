import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

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

      const html = this.buildHtml(data);

      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 60000
      });

      // Inject chart libraries locally from node_modules
      const appNodeModules = path.join(process.cwd(), 'node_modules');

      const scripts = [
        { path: path.join(appNodeModules, 'highcharts', 'highcharts.js'), name: 'highcharts' },
        { path: path.join(appNodeModules, 'echarts', 'dist', 'echarts.min.js'), name: 'echarts' }
      ];

      for (const script of scripts) {
        if (fs.existsSync(script.path)) {
          await page.addScriptTag({ path: script.path });
        } else {
          console.warn(`[PdfService] Script not found at ${script.path}. Chart ${script.name} may not render.`);
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
          top: '60px',
          bottom: '60px',
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
    const isoImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAZAAAADpCAYAAADp//vwUyWebz6JkpCaQYPIobdpzE0ejePo/3DHnmvzl9IXY46cIhOd0MsH97Xo6xcKO+GkWFrf98r/kL94lHV1jay1EwqZX4ZJUtNt/fTLarem35owHbXIEtBpQzHteSyVGcON14njl82i/c7mJIqwYNOYjAdScjbnryKwWBwGO3fSzV+IA1VoTdJAp5sf9ztSlYqU4lCNJqAHMUFQy8tRnM4yivq2AAJukcwqQXA6q9RlqpNbecfYr5rUSl97297X0ORmrf9zaVS/NhCpdaIYprqzric+nZg9o6p4FQyVIp1qTVM9o8+OojSbhOKClQBH204rgjMa9ZsuI1BEjYVm0DZcWb5ppubMF/CWm/TJiiSLPgkzt3EIgkbCzSOMJGbMEWX2exNIAW52n5/72205hg70Yd8AHejHYQ47sY+/OZ+Xlg7oVOnyeO7j0tvgOksJ9SgCrbnxxmSBCmSBPCTMfvvm/uX1b6h2h3W6/TX8quB/cVK1BNal6pTKZH12rdqvxRta8++/b1pGoRLlnKolLWeeLeylPHqhaVrKB4n6Fh7WzLW/SQWdnsRpaAfxLn0jiTSdwvITghVvD3oKOrqibn5pTzYxnaGp3CuD7O8FSSg32S0092WG/dlo8aAAllqOIosFfa74/2xsfEMUptoopToVuMHA6J/Qm3S2n+A/b8ZLkIXzC/k29xP/3Pt0bwav7oAXetfY5znY4avyQmlg+YYSAEfJrq4KzyE3/8I1OBYjpJ3P+7lH30EdpZ/tIZ5gBE5dkEyN4dZFOaoyAlG6ivJLg2mMKXbcHDHji8Pbvpo/2ogtfP+kMKPvUe2NMCC8auaomFUIlhEbKAPNUTL9AWN5RRQMagNhN2TJS7YUlqoNZiks7bk/D36Zm2Z569z/jO6w39FOzai4GZdymj8GmUpU8E2Nt939Tav1b93IAV9XF2TpWCP3qmNH1q39kgcEw3RhlqBRSv4Qgl0c8Txiw1EWUICcIg+HnecRBsKuyeNhBi/+IiolDwbqTJAaMyGZqjucaN1IAkImT0IlUQspQw2Tq4yUcfKCgpDI/78cDrbXQaciUhlYKLO+PndrEvtxYSTfzKKZ3gRs7UbZHxT3tW+sS/TEeuW/PSaoGNESNqPiljG2tKIm1IbR+187t7UcOJ6mbtQGIos3+wRJ8x8XWNOM9F1NKPYK9ygkm3NeYL4Dl8CpNX7YfOGhoZg5eY8V+/CuUMjumSbWU5/a0yvuqv1ap0vuLDGoGfsV6elYuQxzGZl4wdl5i+CFZyuoKOlKGZM/PSsoXt+xm5vHzCW6EbZXFtOdYjJq507XstfSgasbU+MrZAAUivwaL50pOzyF9O+/sGSWZHKuyFS7dFKttLV6SbSpksjgkplkaUQ9dTSbPUE0WaD1XQ6lZkwOYLjxawvU+pshwEMiUqRpTcYRImudSm/l0QgT0hKoCFISlM4l+sv+C6ISYLFWLOLfskUpqITEcP8sL+NIbFQVS8IgzG0Va/ZM9nnM46gchgCPslluigAqZRzCFlVq2fPm0cBDUbhvTTz/3kXRM/arXCueAtpZr6zt5O0z/Z73w3d2MERu84Ehz8LZCCSFGMmF+b8Nq/GlKvtS5l2k4RIclYx5qutMF6IkY20HAhFshWS/k28kylR4hmhAYd5USeRNXQFwgPBhWGShkTIpLhhMpaaqoXDyE5Tx8+nJ6KJSixAvnbphKD5VwidJjIf/5Mb2qgSCKRYjpbySUn09lIqctIUYwGogbj90IORLhLiblvYoGlMSpguAesJ+QvBZumH/rFDMxyPfP8Ndxwroqp449WTXtFBzqr7Wr1jPfVpussp960DJ2Qb+iPre08orZMe7YRnm64Xeu0obta887+9Xb0ADeqN12J4mIkaNel5CQmdScantdr6i3XkhTF1yNm++D2AVgqlqY0T98RlfL6vV4p0SmNiHX5k5UxrPmyYzHFhW2rjmVHOpFz3BMktvEbP0LD+7mI92cZP5ksjRBEtrG489FkloS+tKNdNZ4kdl+aqILpirKzZRK+TDWIgkL5g1EFdg8iRFlFIuboqy71YeiGIxE+QJua/KZ/yqbjm15gt73jOjY/aAxQby9uXKYx097sBhr+THM4fV9Ht+0g7OO26+M4Z+zdsefI0NAmXKzMHTm62yr1LXX1vC2mVv3Much57ZLZ187t/jW39SZo9PZNviNUJxqb/oFqle/PdLPkW9lv0f/u3S8wmyWMpSmKxTCjvJpKvda6FGiNd42H48Nd8VK8K87bbkrD0dxAIOsbT0wMl7g0mQ30R7ndVRzLJkrD8tAYHh6O/1s83H/48GSnHqNWfyg53YSOStWMrGwJ3QeuQgPxYdal0KL7qjkaG+6PEJuJbrsUHTM7FiGnvG1HY/i3eC+L+TvQMuPks4foCHbTlAN1rkLnrMDewrJBZw+1MSNb0KDMU7WNebJ28qr9jMrTJw8xszBD4tvasUf2sT9Zph/8iWq1Stqb41cc2Er1BnfUv5y+W4zNacPefp3m3lUdDIwn4a4sldL6TmN5DUh1NdZ/yTEqh95UOhJ5Nj4eezZdIrHIeGyqkpqaSk3hdxGJPXvy5FkkEpmKRMbH2UyltI1FpirjkdjUOM/rdgq7wOk2OJpSrVRqHI+QKZqiLo+wo40pnqMd9hS24+O6yz3TD94gU1OsshxhsfPbL1uh2IGwZe30CEP69stWGJr5clgH5otiPPatcTX/O9MYNKAjR/RP5LCZ35e+DvOd8FXV1BOo/RYMqdeSpVDbtbXFuvxIbDhaTBekJj86CBCtJKSGUKKAwMCP/KCweOzg0LApakaTyfhhMSX0njV+jlgPbCTSWSogDy4g+3e+lUd40YRrgFh2RlRHJScd+Ux1dhwI/o/Hbcf3gTSg2rqy8zKYpB/SslSH1fRvf1+uM6uZ+2JrpITUcvmqY8CC1skkNzHg3nDUeUsupZvacOae4vrOyRbTZvXv5nvBIvH17023xVaoyXTZxqI8pm7Q1Gx04ZVPtwO43ORW0N8evOLCVnIdoguqGM95ETKJv5TrMJRhBgtnYmtxfygO6x3CfzfG920lx+26pFJq1trZnXcLMNJ44Ijk105/Zb4Q4EzxCIKI60EaVYTFAPW7ZKzTQ1j8nC6JUg36z1gQC/Vr4lcKdN41ROFFWbjWJz738hw3YaIvLQAr1BIKudGArtcyC/MtayZIfyGZWoYfo2sREH9qEWoxwBizZMrLXHpQ88KjO2qrz0sP6Y6ZfrBXVXtM3tGpraprHTAMyvzPXpMe/iRL94G1EcLTWa9AUU7Sw2fCqNWCvTTdTr2Iq2LsKmzQ90Nf762hHA9LQnUYYAou+G3bfHkLjR1Qo/n0UtiuX9j/JF85b6hFjCrYJjZ/HKvwWQ6VeS5ZiGWk+Gz+oBFlsyPNmFqymwWZMZ9u5IVAw+9kKFVrVoiFjiW6Oa08IcP527Pz83AdKesIASfRLePRwGet2IQk6jKbPIFvwtEu9fBnM3kb9VFOOa0u9xsbPREgyrgsyBmhqQTlMFBdl7sD4gsI01vpZU8dkOt+wRs4d1hJdsScwSJIpurXGWPrhsbYNpozZrBMhCUStqs1SZ/+WZCkDqbkRktwEE4OtAwEzZTizOJvnqpfQFGLU9Dx7C3zSDMzU+IkqqQLcoUBoeVd4PhrgaVE3qCH4JOgY0DJUigNDMWWQ1Nq5euWB+NqTg4muH4a39+NgWwJSyjRIFsRNrz+W1x70G1TUD+Eax19qCOsJIIUVjCzRl6zYr9x8T2jQWe+wkJJ6ghnGZ+GQek1Zan4qBc3QzIfIzKA6BgRajoLKcFNkBSYQQNgCpGaP00VD2Mb6QZGgY8AkgoZgppZZ1AVbLCHTk8wZRZ/sBh07uXpl5dISVEqLKtOW6AwLGz95yje3iEqtEaQ2WSrV3NE09A6VgkzVqRTflf6PSwqphtHMtPFzELUISL2W9cRLqBQkSkTITzgkSToNBRh5g0EvW5GetnYMIPxuLwoMAURUynButQeQicQbsviVx8EKN15RNEujJEx5MHIS4SPcBG5VhkBRXZjC+H5Vi1Kpb69bS3QQ1Sw+pj5bRKXWkLnjW1nd1srbI4W1Fhe+X6N0Qe/JbFbOHbsFr6ZCqsHGz1CopfeXEhXxtHnz5bt3yS46XQQcT+fdasGoGdz5rlzybjUZF48IjTGy1HRljkSHJETlk0p2A0WL53K5JO9k2GsVfVIAtufjucHBiWgJ1OknBIHKY2Sp1s4ojyX6wufa232iTqUwZ29oeaaVccONJTuESkHV61QKA11kKcXlaUpppFKOLIUp+myG6t3KUiIV5KkuEnel0IgRgOPNZ7K+lIhXW1exN0QixOxkFE8NoOCZbeMHoES0vMFwijSlanPQFzqsgEk+eY4IPGgm3PlqJoDZUiqBcS2KEd6ER28pWYoIwHV/qRqVInRyS1ApI0tt2jRNm6aPmjJ/1SliZp1KHTFevU2mUrNjTyzOueONZClmuzc+cjjkyyZncHKrgrkC5hAp6FJb8O7hUDrF+my6e9Cq6gSpGctbMHf8FsTv4lQ1VlCugWrAl06nx8bSvXGwhG0Imj9vGQulWOyZLz1JVgVrLgh1XiVZSp5tLSFLkXhztiy1EPXEO5rcUKk1RpZqZPykBWk2rPhupjV+N6GgaxT1qxWolI09QfSJJaZSBFkJD+Kvi0kSLr310hbvupuqpEOBZ5KeunB6H88MlzOB0Ai8H7WUBXEmpMT1tZcr6UC2Moh77zDBx/onJgYHB3NBLQorvaO3s9+X/bxreCIQGi8T3s8oKQSpFpKlrBJ9ldvy8pS7wi+C2p2zQZSysP41VwQmy1LTWv8mhV7wuPq6if8UaTiCzQyfm3JwWw2jZneE5QXwTAJsu+SZTSJ4zsJ4qFmglQjUVPwF+SnBPZ92coEZus57NZxmKcOZA1toZQR+Xjaly7427q6K6kqYS7kPy+esNWolMlhOyNCUgvJUptaTIluNX4NQcdaQ5ZSOBe71MsP99LKUm1tpf7x3rvVRAAETBd3dTJWrOJDlSJfRxcOTjElvi4/8T1TJnm71DtdG1WfVnqjhUBq6llobNDvLyV7faGRarEaLnmJ2wysEMC6ovLtaHPFe2OVEUgZ11Rai0q1uiw1k/FbEEF5J5WNLGWo1N6WkKWmNX6XVmldanEavzeRpYiql8yVooXELCqVS4aDQVQMKb/LG0WoioVLba5oJJS2EpeU6LOKpysRG58YHAmlBz0e6TtCpI8/HOsl8bVsJSBU0XDaV+G5OBGSUgRbApt6txyVUgKRWoQksy7VGrKUsy7VWlSKuBXS+IlKmdgTxOkw8dVbQONnzWYXp554k3Up1olQ6ZUK/TOplCsYxPhucCw7HvQHwxMBIDXsdkeJjnlKxGWuEt3t8k4c9g14o4mAZKlkJV2JJEZGxrLpyTh8| TOP LEVEL ASSET ID: ' + data.topLevelAssetId;
    return `
      <div class="section-title">Evaluation zone as per ISO 10816</div>
      <div class="iso-container">
        <div class="iso-chart">
            <img src="data:image/png;base64,${isoImageBase64}" alt="ISO Chart" />
        </div>
        <div class="iso-table">
            <table class="inspection-table">
                <tr><th style="width:25%">Class</th><th>Description</th></tr>
                <tr><td class="font-semibold">Class 1</td><td>Machines having separated driver and driven, or coupled units comprising machinery up to approx 15kw</td></tr>
                <tr><td class="font-semibold">Class 2</td><td>Machinery (15kw to 75kw) without special foundations or rigidly mounted machines up to 300kW mounted on special foundations</td></tr>
                <tr><td class="font-semibold">Class 3</td><td>Machines having large prime movers with rotating assemblies mounted on rigid and heavy foundations</td></tr>
                <tr><td class="font-semibold">Class 4</td><td>Large prime movers with large rotating assemblies mounted on foundations soft in the direction of the measured vibration</td></tr>
            </table>
        </div>
      </div>
    `;
  }

  private buildHealthHistorySection(data: any): string {
    if (!data.healthHistory || data.healthHistory.length === 0) return '';
    
    const slice = data.healthHistory.slice(-12);
    const headers = slice.map((h: any) => `<th>${h.date}</th>`).join('');
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
      </div>
      <div class="health-history-container">
          <table class="health-history-table">
            <thead>
                <tr><th style="text-align:left; padding-left:10px; width:60px;">Date</th>${headers}</tr>
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
      const dateStr = point.timestamp ? (typeof point.timestamp === 'number' ? new Date(point.timestamp * 1000).toLocaleString() : point.timestamp) : '-';
      rows += `
        <tr>
          <td rowspan="2" class="font-semibold">${point.point}</td>
          <td rowspan="2" style="text-align:center;">${dateStr}</td>
          <td style="text-align:center;">Acceleration</td>
          <td style="text-align:center;">${point.acceleration?.h || '-'}</td>
          <td style="text-align:center;">${point.acceleration?.v || '-'}</td>
          <td style="text-align:center;">${point.acceleration?.a || '-'}</td>
        </tr>
        <tr>
          <td style="text-align:center;">Velocity</td>
          <td style="text-align:center;">${point.velocity?.h || '-'}</td>
          <td style="text-align:center;">${point.velocity?.v || '-'}</td>
          <td style="text-align:center;">${point.velocity?.a || '-'}</td>
        </tr>
      `;
    });

    return `
      <table class="inspection-table readings-table">
        <thead>
          <tr>
            <th rowspan="2">Measuring Point</th>
            <th rowspan="2">Date</th>
            <th rowspan="2">Field</th>
            <th colspan="3">RMS</th>
          </tr>
          <tr>
            <th>Horizontal</th>
            <th>Vertical</th>
            <th>Axial</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  private buildFaultsTable(faultData: any[]): string {
    if (!faultData || faultData.length === 0) return '<div class="no-data-msg">No Faults Detected.</div>';

    const rows = faultData.map(row => {
      return `
        <tr>
          <td class="font-semibold">${row.translatedName || row.name}</td>
          <td><div class="fault-bar-container"><div class="fault-bar" style="background-color: ${row.value == 1 ? '#03b03e' : 'transparent'}"></div></div></td>
          <td><div class="fault-bar-container"><div class="fault-bar" style="background-color: ${row.value == 2 ? '#f9f500' : 'transparent'}"></div></div></td>
          <td><div class="fault-bar-container"><div class="fault-bar" style="background-color: ${row.value == 3 ? '#f3b900' : 'transparent'}"></div></div></td>
          <td><div class="fault-bar-container"><div class="fault-bar" style="background-color: ${row.value == 4 ? '#df0028' : 'transparent'}"></div></div></td>
        </tr>
      `;
    }).join('');

    return `
      <table class="inspection-table">
        <thead>
          <tr>
            <th style="width:30%">Fault</th>
            <th>Good</th>
            <th>Satisfactory</th>
            <th>Unsatisfactory</th>
            <th>Unacceptable</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  private buildAttachments(attachments: string[]): string {
    if (!attachments || attachments.length === 0) return '<div class="no-data-msg">No files attached to this report.</div>';

    return attachments.map(img => `
      <div class="attachment-card">
        <img src="${img}" />
      </div>
    `).join('');
  }
}