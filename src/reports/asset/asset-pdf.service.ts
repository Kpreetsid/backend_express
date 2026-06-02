import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { storageConfig } from '../../configDB';
import { processorAPIService } from '../../api-processor';

export class PdfService {
  private twfChartProto = {
    showSplitLine: true,
    titleFontSize: '12',
    chartType: 'report-chart',
    nameGap: 25,
    axisLabel: { fontSize: 9 },
    showDeltaT: false,
    grid: { left: '55', right: '10', bottom: '40', top: '30' },
    legend: { orient: 'horizontal', show: true, width: '100%' },
    tooltip: { trigger: 'axis' }
  };

  private sptrmChartProto = {
    chartType: 'report-chart',
    harmonicFlag: false,
    bffData: { flag: false, data: {}, availableFreqs: {} },
    no_of_axis: 1,
    harmonicData: [],
    selectedFrequencies: [],
    isHarmonicZoomed: false,
    isFaultFreqZoomed: false,
    functionType: 'none',
    legend: { orient: 'horizontal', show: true, width: '100%' }
  };

  private isoTableDetails = [
    {
      sr_no: 1,
      class: 'Class 1',
      ko_class: '클래스 1',
      description: 'Machines having separated driver and driven, or coupled units comprising machinery up to approx 15kw',
      ko_description: '구동부와 피구동부가 분리된 기계 또는 결합된 장치를 포함하는 기계로서 최대 약 15kW의 출력을 갖는 기계'
    },
    {
      sr_no: 2,
      class: 'Class 2',
      ko_class: '클래스 2',
      description: 'Machinery (15kw to 75kw) without special foundations or rigidly mounted machines upto 300kW mounted on special foundations',
      ko_description: '특수 기초가 없는 기계류(15kW~75kW) 또는 특수 기초에 설치된 최대 300kW의 고정식 기계류'
    },
    {
      sr_no: 3,
      class: 'Class 3',
      ko_class: '클래스 3',
      description: 'Machines having large prime movers with rotating assemblies mounted on rigid and heavy foundations',
      ko_description: '견고하고 무거운 기초 위에 회전 부품이 장착된 대형 원동기를 갖춘 기계'
    },
    {
      sr_no: 4,
      class: 'Class 4',
      ko_class: '클래스 4',
      description: 'Large prime movers with large rotating assemblies mounted on foundations soft in the direction of the measured vibration (i.e turbine, generators, gas turbines greater than 10MW)',
      ko_description: '측정된 진동 방향으로 지반이 약한 곳에 대형 회전 부품이 설치된 대형 동력 장치(예: 터빈, 발전기, 10MW 이상의 가스 터빈)'
    }
  ];

  private readonly maxPdfChartPoints = 2500;

  private normalizeChartDetail(chartDetail: any): any[] {
    if (Array.isArray(chartDetail)) {
      return chartDetail;
    }
    if (Array.isArray(chartDetail?.composites)) {
      return chartDetail.composites;
    }
    return [];
  }

  private getSelectedAxes(mods: any): string[] {
    const fromOptions = Array.isArray(mods?.selectedAxes) ? mods.selectedAxes.filter((axis: any) => typeof axis === 'string') : [];
    if (fromOptions.length > 0) {
      return [...new Set(fromOptions)];
    }

    const fromChartDetail = this.normalizeChartDetail(mods?.chartDetail)
      .flatMap((item: any) => Array.isArray(item?.axis) ? item.axis : [])
      .filter((axis: any) => typeof axis === 'string');

    return fromChartDetail.length > 0 ? [...new Set(fromChartDetail)] : ['Axial', 'Horizontal', 'Vertical'];
  }

  private attachChartMetadata(chart: any, chartType: string, uniqueKey: string, endpointId: string, chartName: string): any {
    return {
      ...chart,
      _id: endpointId,
      deviceKey: uniqueKey,
      type: chartType,
      chartName
    };
  }

  private applySavedHarmonics(chart: any, mods: any, uniqueKey: string, chartType: string): any {
    if (!chart || !chartType.includes('spectrum')) {
      return chart;
    }
    const match = Array.isArray(mods?.harmonicIndex)
      ? mods.harmonicIndex.find((item: any) => item?.key === uniqueKey && item?.chartType === chartType)
      : null;
    if (!match?.index?.length) {
      return chart;
    }
    return {
      ...chart,
      harmonicFlag: true,
      harmonicData: match.index,
      functionType: 'harmonic',
      isHarmonicZoomed: true
    };
  }

  private getSampleIndexes(length: number): number[] {
    if (length <= this.maxPdfChartPoints) {
      return Array.from({ length }, (_item, index) => index);
    }
    const indexes: number[] = [];
    const step = (length - 1) / (this.maxPdfChartPoints - 1);
    for (let i = 0; i < this.maxPdfChartPoints; i++) {
      indexes.push(Math.min(length - 1, Math.round(i * step)));
    }
    return [...new Set(indexes)];
  }

  private reduceChartPoints(xData: any[], series: any[]): { xData: any[]; series: any[] } {
    const longestSeriesLength = Math.max(0, ...series.map((item: any) => Array.isArray(item?.data) ? item.data.length : 0));
    const chartLength = Math.max(xData?.length || 0, longestSeriesLength);
    if (chartLength <= this.maxPdfChartPoints) {
      return { xData, series };
    }

    const indexes = this.getSampleIndexes(chartLength);
    const pickByIndexes = (values: any[]) => {
      if (!Array.isArray(values) || values.length === 0) {
        return [];
      }
      if (values.length !== chartLength) {
        const localIndexes = this.getSampleIndexes(values.length);
        return localIndexes.map(index => values[index]).filter(value => value !== undefined);
      }
      return indexes.map(index => values[index]).filter(value => value !== undefined);
    };

    return {
      xData: pickByIndexes(xData || []),
      series: series.map((item: any) => ({ ...item, data: pickByIndexes(item?.data || []) }))
    };
  }

  private getEchartsScript(): string {
    const scriptPath = path.join(process.cwd(), 'node_modules', 'echarts', 'dist', 'echarts.min.js');
    try {
      return fs.existsSync(scriptPath) ? fs.readFileSync(scriptPath, 'utf8') : '';
    } catch (error: any) {
      console.error('[PdfService] Failed to load ECharts renderer:', error.message);
      return '';
    }
  }

  public async generateAssetReportPdf(data: any, token?: string, userId?: string): Promise<Buffer> {
    console.log(`[PdfService] Generating PDF for asset: ${data.assetName || 'Unknown'}`);

    // ── Chart data resolution ──────────────────────────────────────────────────
    // Priority 1: Use chartData sent directly from the frontend.
    //   This contains the FULL user-modified state: harmonics, fault frequencies,
    //   bffData, functionType, selectedFrequencies, zoom state (_liveState), etc.
    //   We MUST use this to faithfully reflect what the user sees in the UI.
    //
    // Priority 2 (legacy fallback): If no chartData was provided but chartDetail
    //   was, re-fetch from the processor API and process from scratch.
    //   This path loses all user modifications and should be considered deprecated.

    if (data.chartData && Object.keys(data.chartData).length > 0) {
      // Sort keys alphabetically to match Angular keyvalue pipe default sort
      const sorted: any = {};
      Object.keys(data.chartData).sort().forEach((k: string) => { sorted[k] = data.chartData[k]; });
      data.chartData = sorted;
      console.log(`[PdfService] Using frontend-supplied chartData with ${Object.keys(data.chartData).length} device(s).`);
    } else if (token && userId) {
      const composites = this.normalizeChartDetail(data.chartDetail);
      // Legacy fallback: re-fetch from processor API
      console.warn('[PdfService] No chartData supplied — falling back to processor API re-fetch (user modifications will be lost).');
      try {
        if (composites.length > 0) {
          const res = await processorAPIService.getAccVelData({ composites }, token, userId);
          if (res && res.data) {
            data.chartData = this.processChartData(
              res.data,
              {
                ...(data.chartOptions || {}),
                harmonicIndex: data.harmonicIndex || [],
                chartDetail: composites
              },
              data.labels
            );
          }
        } else {
          console.log(`No Chart attached with this report`);
        }
      } catch (err) {
        console.error('[PdfService] Failed to fetch chart data:', err);
      }
    }

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
        waitUntil: ['domcontentloaded', 'load'],
        timeout: 60000
      });

      try {
        await page.waitForFunction(() => (globalThis as any).PDF_READY === true, {
          timeout: 60000
        });
      } catch (e) {
        console.warn('[PdfService] PDF_READY timeout exceeded, generating PDF with available content');
      }

      const labels = data.labels || {};
      const assetLabel = labels.assetLabel || 'Asset';
      const reportDateLabel = labels.reportDateLabel || 'Report Date';
      const pageLabel = labels.pageLabel || 'Page';
      const ofLabel = labels.ofLabel || 'of';

      // Convert logo to Base64 for reliable loading in Puppeteer header
      let logoBase64 = '';
      try {
        const logoPath = path.join(process.cwd(), 'uploadFiles', 'presage-logo.png');
        if (fs.existsSync(logoPath)) {
          const logoBuffer = fs.readFileSync(logoPath);
          logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
        }
      } catch (e) {
        console.error('[PdfService] Failed to load logo for header:', e);
      }

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: `
          <style>
            html { -webkit-print-color-adjust: exact; }
            #header { padding: 0 !important; margin: 0 !important; }
          </style>
          <div style="font-size: 10px; width: 100%; height: 70px; background-color: rgb(0, 0, 105); color: #ffffff; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; box-sizing: border-box; font-family: 'Inter', 'Segoe UI', Roboto, sans-serif; margin: 0 !important;">
            <div style="display: flex; flex-direction: column; justify-content: center;">
              <div style="font-weight: bold; font-size: 18px; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">${assetLabel}: ${data.assetName || 'NA'}</div>
              <div style="opacity: 0.9; font-size: 10px;">&nbsp; ${reportDateLabel}: ${this.formatDate(data.analysisDate, data.timezone, false, data.locale)}</div>
            </div>
            <div style="display: flex; align-items: center;">
              ${logoBase64 ? `
                <div style="background: #ffffff; padding: 5px; border-radius: 8px; box-shadow: 0 2px 8px rgba(255,255,255); display: flex; align-items: center; justify-content: center;">
                  <img src="${logoBase64}" alt="Presage" style="height: 30px; width: auto; object-fit: contain;" />
                </div>
              ` : ''}
            </div>
          </div>
        `,
        footerTemplate: `
          <div style="font-size: 10px; width: 100%; display: flex; justify-content: flex-end; padding: 10px 40px; color: #666; font-family: sans-serif;">
            <span>${pageLabel} <span class="pageNumber"></span> ${ofLabel} <span class="totalPages"></span></span>
          </div>
        `,
        margin: { top: '85px', bottom: '45px', left: '0px', right: '0px' }
      });

      return Buffer.from(pdfBuffer);
    } catch (error: any) {
      console.error(`[PdfService] PDF generation failed: ${error.stack}`);
      throw error;
    } finally {
      if (browser) await browser.close();
    }
  }

  private buildHtml(data: any): string {
    const templatePath = path.join(__dirname, '..', '..', 'public', 'asset-report.html');
    let template = fs.readFileSync(templatePath, 'utf8');

    const replacements: any = {
      generatedDate: this.formatDate(new Date(), data.timezone, false, data.locale),
      assetName: data.assetName || 'NA',
      analysisDate: this.formatDate(data.analysisDate, data.timezone, false, data.locale),
      location: data.location || 'NA',
      sensorsMapped: data.sensorsMapped || '0',
      assetCondition: data.assetCondition || 'NA',
      conditionClass: this.getConditionClass(data.conditionClass),
      createdFrom: data.createdFrom || 'NA',
      observations: data.observations || '-',
      recommendations: data.recommendations || '-',
      assetImageHtml: this.buildAssetImage(data),
      isoSection: this.buildIsoSection(data),
      healthHistorySection: this.buildHealthHistorySection(data),
      readingsTable: this.buildReadingsTable(data),
      faultsTable: this.buildFaultsTable(data.faultData),
      attachmentsHtml: this.buildAttachments(data.attachments),
      echartsScript: this.getEchartsScript(),
      chartDataJson: JSON.stringify(data.chartData || {}),
      readingsJson: JSON.stringify(data.readings || []),
      labelsJson: JSON.stringify({ ...data.labels, locale: data.locale, timezone: data.timezone })
    };

    if (data.labels) {
      Object.keys(data.labels).forEach(key => {
        replacements[key] = data.labels[key];
      });
    }

    Object.keys(replacements).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      template = template.replace(regex, () => String(replacements[key] ?? ''));
    });

    return template;
  }

  private getConditionClass(val: any): string {
    const classes: any = { '1': 'critical', '2': 'danger', '3': 'alert', '4': 'healthy', '5': 'not_available' };
    return classes[String(val)] || 'not_available';
  }

  private toBase64(filePath: string): string {
    try {
      if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath);
        const extension = path.extname(filePath).substring(1) || 'png';
        return `data:image/${extension === 'jpg' ? 'jpeg' : extension};base64,${fileBuffer.toString('base64')}`;
      }
    } catch (e: any) {
      console.error(`[PdfService] toBase64 failed for ${filePath}:`, e.message);
    }
    return '';
  }

  private buildAssetImage(data: any): string {
    if (data.assetImage) {
      const imgPath = path.join(process.cwd(), 'uploadFiles', 'assets', data.assetImage);
      const b64 = this.toBase64(imgPath);
      if (b64) {
        return `<img src="${b64}" alt="Asset Image" style="width:100%; height:180px; border-radius:12px; object-fit:cover;" />`;
      }
    }
    return `<div class="asset-initials">${data.assetName}</div>`;
  }

  private buildIsoSection(data: any): string {
    if (!data.iso) return '';
    const labels = data.labels || {};
    const isKo = data.locale === 'ko';

    // Fallback labels
    const isoEvaluationLabel = labels.isoEvaluationLabel || (isKo ? 'ISO 평가' : 'ISO Evaluation');
    const classLabel = labels.classLabel || (isKo ? '클래스' : 'Class');
    const descriptionLabel = labels.descriptionLabel || (isKo ? '설명' : 'Description');

    const rows = this.isoTableDetails.map(item => {
      const className = isKo ? (item.ko_class || item.class) : item.class;
      const description = isKo ? (item.ko_description || item.description) : item.description;
      return `<tr><td class="font-semibold">${className}</td><td>${description}</td></tr>`;
    }).join('');

    const isoChartPath = path.join(process.cwd(), 'uploadFiles', 'report-icons', 'ISO_chart.png');
    const isoChartB64 = this.toBase64(isoChartPath);

    return `
      <div class="section-title">${isoEvaluationLabel}</div>
      <div class="iso-container">
        <div class="iso-chart" style="height:200px;">
            ${isoChartB64 ? `<img src="${isoChartB64}" alt="ISO Chart" style="width: 100%; margin-top:10px; height: 100%; object-fit: fill;"/>` : ''}
        </div>
        <div class="iso-table">
            <table class="inspection-table">
                <thead>
                  <tr style="background: #000069 !important; color: white !important;">
                    <th style="width:15%; background: #000069 !important; color: white !important; border: 1px solid #ffffff44;">${classLabel}</th>
                    <th style="background: #000069 !important; color: white !important; border: 1px solid #ffffff44;">${descriptionLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
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
      <div class="section-title">{{healthHistoryLabel}}</div>
      <div style="display:flex; justify-content:center; gap:15px; margin-bottom:10px;">
        <div style="display:flex; align-items:center; gap:5px;"><div style="width:10px; height:10px; border-radius:50%; background:#fb565a;"></div><span style="font-size:10px;">{{criticalLabel}}</span></div>
        <div style="display:flex; align-items:center; gap:5px;"><div style="width:10px; height:10px; border-radius:50%; background:#fa8349;"></div><span style="font-size:10px;">{{dangerLabel}}</span></div>
        <div style="display:flex; align-items:center; gap:5px;"><div style="width:10px; height:10px; border-radius:50%; background:#f7fa4b;"></div><span style="font-size:10px;">{{alertLabel}}</span></div>
        <div style="display:flex; align-items:center; gap:5px;"><div style="width:10px; height:10px; border-radius:50%; background:#51fc4c;"></div><span style="font-size:10px;">{{healthyLabel}}</span></div>
        <div style="display:flex; align-items:center; gap:5px;"><div style="width:10px; height:10px; border-radius:50%; background:#d8dae2;"></div><span style="font-size:10px;">{{notAvailableLabel}}</span></div>
      </div>
      <div class="health-history-container">
          <table class="health-history-table">
            <thead>
                <tr style="background: #000069 !important; color: white !important;">
                  <th style="text-align:left; padding-left:10px; width:60px; background: #000069 !important; color: white !important; border: 1px solid #ffffff44;">{{dateLabel}}</th>
                  ${headers}
                </tr>
            </thead>
            <tbody>
                <tr><td class="font-semibold" style="text-align:left; padding-left:10px;">{{statusLabel}}</td>${cells}</tr>
            </tbody>
          </table>
      </div>
    `;
  }

  private buildReadingsTable(data: any): string {
    const readings = data.readings;
    if (!readings || readings.length === 0) return '<div class="no-data-msg">{{noDataCollectedLabel}}</div>';

    let rows = '';
    readings.forEach((point: any) => {
      const dateStr = this.formatDate(point.timestamp, data.timezone);

      rows += `
        <tr>
          <td rowspan="2" class="font-semibold" style="background: #fdfdfd;">${point.point}</td>
          <td rowspan="2" style="text-align:center; background: #fdfdfd;">${dateStr}</td>
          <td style="text-align:center; color: #555;">{{accelerationLabel}}</td>
          <td style="text-align:center; font-weight: bold;">${point.acceleration?.h ?? '-'}</td>
          <td style="text-align:center; font-weight: bold;">${point.acceleration?.v ?? '-'}</td>
          <td style="text-align:center; font-weight: bold;">${point.acceleration?.a ?? '-'}</td>
        </tr>
        <tr>
          <td style="text-align:center; color: #555;">{{velocityLabel}}</td>
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
            <th rowspan="2" style="background: #000069 !important; color: white !important; border: 1px solid #ffffff44;">{{measuringPointLabel}}</th>
            <th rowspan="2" style="background: #000069 !important; color: white !important; border: 1px solid #ffffff44;">{{timestampLabel}}</th>
            <th rowspan="2" style="background: #000069 !important; color: white !important; border: 1px solid #ffffff44;">{{fieldLabel}}</th>
            <th colspan="3" style="background: #000069 !important; color: white !important; border: 1px solid #ffffff44;">{{rmsValuesLabel}}</th>
          </tr>
          <tr style="background: #000069 !important; color: white !important;">
            <th style="background: #000069 !important; color: white !important; border: 1px solid #ffffff44;">{{horizontalLabel}}</th>
            <th style="background: #000069 !important; color: white !important; border: 1px solid #ffffff44;">{{verticalLabel}}</th>
            <th style="background: #000069 !important; color: white !important; border: 1px solid #ffffff44;">{{axialLabel}}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  private buildFaultsTable(faultData: any[]): string {
    if (!faultData || faultData.length === 0) return '<div class="no-data-msg">{{noFaultsDetectedLabel}}</div>';

    const rows = faultData.map(row => {
      const getDot = (val: number, target: number, color: string) => {
        return val == target ? `<div style="width: 50px; height: 12px; border-radius: 5%; background-color: ${color}; margin: 0 auto; box-shadow: 0 0 4px ${color};"></div>` : '';
      };

      const iconPath = path.join(process.cwd(), 'uploadFiles', 'report-icons', `${row.name}.png`);
      let iconB64 = this.toBase64(iconPath);
      if (!iconB64) {
        const otherPath = path.join(process.cwd(), 'uploadFiles', 'report-icons', 'Other.png');
        iconB64 = this.toBase64(otherPath);
      }

      return `
        <tr>
          <td class="font-semibold" style="padding-left: 15px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              ${iconB64 ? `<img src="${iconB64}" alt="${row.name}_icon" style="height: 25px; width: 25px; object-fit: contain; vertical-align: middle;" />` : ''}
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
            <th style="width:30%; text-align: left; padding-left: 15px; background: #000069 !important; color: white !important; border: 1px solid #ffffff44;">{{faultConditionLabel}}</th>
            <th style="text-align: center; background: #000069 !important; color: white !important; border: 1px solid #ffffff44;">{{goodLabel}}</th>
            <th style="text-align: center; background: #000069 !important; color: white !important; border: 1px solid #ffffff44;">{{satisfactoryLabel}}</th>
            <th style="text-align: center; background: #000069 !important; color: white !important; border: 1px solid #ffffff44;">{{unsatisfactoryLabel}}</th>
            <th style="text-align: center; background: #000069 !important; color: white !important; border: 1px solid #ffffff44;">{{unacceptableLabel}}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  private formatDate(timestamp: any, timezone?: string, dateOnly: boolean = false, locale?: string): string {
    if (!timestamp) return '-';
    try {
      let date: Date;
      if (typeof timestamp === 'string') {
        date = new Date(timestamp);
      } else if (typeof timestamp === 'number') {
        date = new Date(timestamp > 10000000000 ? timestamp : timestamp * 1000);
      } else {
        date = new Date(timestamp);
      }
      if (isNaN(date.getTime())) return '-';
      const displayLocale = locale === 'ko' ? 'ko-KR' : 'en-GB';
      const options: Intl.DateTimeFormatOptions = {
        timeZone: timezone || 'UTC',
        hour12: false,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      };
      if (!dateOnly) {
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.second = '2-digit';
      }
      return date.toLocaleString(displayLocale, options).replace(',', '');
    } catch (e) {
      return '-';
    }
  }

  private buildAttachments(attachments: any[]): string {
    if (!attachments || attachments.length === 0) return '<div class="no-data-msg">No files attached to this report.</div>';

    return `
      <div class="attachments-grid">
        ${attachments.map(item => {
          let b64 = '';
          if (typeof item === 'string') {
            // Handle both absolute URLs and potential relative paths
            const relativePath = item.replace(storageConfig.baseUrl, '').replace(/^\/+/, '');
            const filePath = path.join(process.cwd(), 'uploadFiles', relativePath);
            b64 = this.toBase64(filePath);
          }
          
          if (!b64) return '';

          return `
            <div class="attachment-card">
              <img src="${b64}" style="border: 1px solid #eee; box-shadow: 0 2px 4px rgba(0,0,0,0.05);" />
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  private processChartData(data: any, mods: any, labels?: any): any {
    const combinedChartObject: any = {};
    if (!data.axes_data?.length && !data.compare_axes_data?.length) return {};

    data.axes_data.forEach((element: any, index: number) => {
      const endpointId = element._id;
      const timestamp = element.timestamp;
      const uniqueKey = `${endpointId}-${timestamp}`;

      combinedChartObject[uniqueKey] = {
        meta: {
          _id: endpointId,
          timestamp: timestamp,
          compare_timestamp: data.compare_axes_data?.[index]?.timestamp,
          sampling_frequency: element.signal_processing_details?.sampling_frequency,
          no_of_samples: element.signal_processing_details?.no_of_samples,
          rpm: element.signal_processing_details?.rpm
        }
      };

      const deviceData = combinedChartObject[uniqueKey];
      const x_axis = element['x_axis_spectrum_data'] || [];
      const selectedAxes = this.getSelectedAxes(mods);

      // Process Base Data
      const accTwf = this.drawTwfChart(element["acceleration-twf-chart"] || [], "acceleration", selectedAxes, labels);
      if (accTwf) {
        deviceData['acceleration-twf'] = this.attachChartMetadata(accTwf, 'acceleration-twf', uniqueKey, endpointId, 'Acceleration Twf');
      }

      const velTwf = this.drawTwfChart(element["velocity-twf-chart"] || [], "velocity", selectedAxes, labels);
      if (velTwf) {
        deviceData['velocity-twf'] = this.attachChartMetadata(velTwf, 'velocity-twf', uniqueKey, endpointId, 'Velocity Twf');
      }

      const accSpec = this.drawSpectrumChart(element["acceleration-spectrum-chart"] || [], "acceleration", x_axis, element.signal_processing_details?.rpm, selectedAxes, labels);
      if (accSpec) {
        deviceData['acceleration-spectrum'] = this.applySavedHarmonics(
          this.attachChartMetadata(accSpec, 'acceleration-spectrum', uniqueKey, endpointId, 'Acceleration Spectrum'),
          mods,
          uniqueKey,
          'acceleration-spectrum'
        );
      }

      const velSpec = this.drawSpectrumChart(element["velocity-spectrum-chart"] || [], "velocity", x_axis, element.signal_processing_details?.rpm, selectedAxes, labels);
      if (velSpec) {
        deviceData['velocity-spectrum'] = this.applySavedHarmonics(
          this.attachChartMetadata(velSpec, 'velocity-spectrum', uniqueKey, endpointId, 'Velocity Spectrum'),
          mods,
          uniqueKey,
          'velocity-spectrum'
        );
      }

      // Process Comparison Data
      const compElement = data.compare_axes_data?.[index];
      if (compElement) {
        const comp_x_axis = compElement['x_axis_spectrum_data'] || [];

        const compAccTwf = this.drawTwfChart(compElement["acceleration-twf-chart"] || [], "acceleration", selectedAxes, labels);
        if (compAccTwf) {
          deviceData['compare-acceleration-twf'] = this.attachChartMetadata(compAccTwf, 'compare-acceleration-twf', uniqueKey, compElement._id, 'Acceleration Twf');
        }

        const compVelTwf = this.drawTwfChart(compElement["velocity-twf-chart"] || [], "velocity", selectedAxes, labels);
        if (compVelTwf) {
          deviceData['compare-velocity-twf'] = this.attachChartMetadata(compVelTwf, 'compare-velocity-twf', uniqueKey, compElement._id, 'Velocity Twf');
        }

        const compAccSpec = this.drawSpectrumChart(compElement["acceleration-spectrum-chart"] || [], "acceleration", comp_x_axis, compElement.signal_processing_details?.rpm, selectedAxes, labels);
        if (compAccSpec) {
          deviceData['compare-acceleration-spectrum'] = this.applySavedHarmonics(
            this.attachChartMetadata(compAccSpec, 'compare-acceleration-spectrum', uniqueKey, compElement._id, 'Acceleration Spectrum'),
            mods,
            uniqueKey,
            'compare-acceleration-spectrum'
          );
        }

        const compVelSpec = this.drawSpectrumChart(compElement["velocity-spectrum-chart"] || [], "velocity", comp_x_axis, compElement.signal_processing_details?.rpm, selectedAxes, labels);
        if (compVelSpec) {
          deviceData['compare-velocity-spectrum'] = this.applySavedHarmonics(
            this.attachChartMetadata(compVelSpec, 'compare-velocity-spectrum', uniqueKey, compElement._id, 'Velocity Spectrum'),
            mods,
            uniqueKey,
            'compare-velocity-spectrum'
          );
        }
      }
    });

    // Sort keys alphabetically — matches Angular keyvalue pipe default sort
    const sorted: any = {};
    Object.keys(combinedChartObject).sort().forEach(k => { sorted[k] = combinedChartObject[k]; });
    return sorted;
  }

  private drawTwfChart(chartArray: any[], func: string, selectedAxes: string[], labels?: any): any {
    const series: any[] = [];
    for (const item of chartArray) {
      const axisKey = Object.keys(item).find(key => Array.isArray(item[key]));
      if (!axisKey || !selectedAxes.includes(axisKey)) continue;
      series.push({
        name: axisKey,
        data: item[axisKey],
        type: 'line',
        lineStyle: { width: 1, color: this.getAxisColor(axisKey) },
        itemStyle: { color: this.getAxisColor(axisKey) },
        smooth: true,
        showSymbol: false
      });
    }
    if (!series.length) return null;

    let max = -Infinity, min = Infinity;
    series.forEach(s => s.data?.forEach((v: number) => { if (v > max) max = v; if (v < min) min = v; }));
    if (!isFinite(max)) max = 1;
    if (!isFinite(min)) min = -1;

    const noOfSamples = chartArray[0]?.no_of_samples || 1;
    const fsVal = chartArray[0]?.fs || 1;
    const xData = Array.from({ length: noOfSamples }, (_, i) =>
      Number(((i * (noOfSamples / fsVal)) / (noOfSamples - 1)).toFixed(5)));
    const reduced = this.reduceChartPoints(xData, series);

    const yLabel = func === 'acceleration'
      ? (labels?.accelerationLabel || 'Amplitude (g)')
      : (labels?.velocityLabel || 'Amplitude (mm/s)');

    return {
      ...this.twfChartProto,
      yLabel,
      max: Number((Math.abs(max) * 1.2).toFixed(4)),
      min: Number(-(Math.abs(min) * 1.2).toFixed(4)),
      xData: reduced.xData,
      yData: reduced.series
    };
  }

  private drawSpectrumChart(chartArray: any[], func: string, xAxis: any[], rpm: any, selectedAxes: string[], labels?: any): any {
    const series: any[] = [];
    for (const item of chartArray) {
      const axisKey = Object.keys(item).find(key => Array.isArray(item[key]));
      if (!axisKey || !selectedAxes.includes(axisKey)) continue;
      series.push({
        name: axisKey,
        data: item[axisKey],
        type: 'line',
        symbolSize: 1,
        lineStyle: { width: 0.5, color: this.getAxisColor(axisKey) }
      });
    }
    if (!series.length) return null;

    let max = -Infinity;
    series.forEach(s => s.data?.forEach((v: number) => { if (v > max) max = v; }));
    if (!isFinite(max)) max = 1;

    const yLabel = func === 'acceleration'
      ? (labels?.accelerationLabel || 'Amplitude (g)')
      : (labels?.velocityLabel || 'Amplitude (mm/s)');

    const reduced = this.reduceChartPoints(xAxis || [], series);

    return {
      ...this.sptrmChartProto,
      yLabel,
      xLabel: 'Hz',
      max: Number(max).toFixed(4),
      xData: reduced.xData,
      yData: reduced.series,
      rpm,
      no_of_axis: selectedAxes.length
    };
  }

  private getAxisColor(axis: string): string {
    const colors: any = { Axial: '#ff0000', Horizontal: '#00d711', Vertical: '#000069' };
    return colors[axis] || '#000069';
  }
}
