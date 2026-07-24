/**
 * Google Apps Script para enviar reportes de Cierre de Caja.
 * Este script debe publicarse como Web App y la URL debe pegarse en la configuración de la Sucursal.
 */

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    if (data.type !== 'cash_closing') {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Invalid type" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const { branch, report, emails } = data;
    
    // Si no hay correos configurados, terminamos.
    if (!emails) {
      return ContentService.createTextOutput(JSON.stringify({ status: "skipped", message: "No emails configured" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const subject = `📊 CIERRE DE CAJA - ${branch.name} - ${report.date}`;
    const body = generateHtmlReport(branch, report);

    MailApp.sendEmail({
      to: emails,
      subject: subject,
      name: "FUNKY FOOD",
      htmlBody: body
    });

    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function generateHtmlReport(branch, report) {
  const summaryRows = report.summary.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${String(item.method).toUpperCase()}</strong></td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${Number(item.total).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #f89d1b; padding: 20px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 24px; text-transform: uppercase;">Reporte de Cierre de Caja</h1>
        <p style="margin: 5px 0 0; font-size: 14px; font-style: italic;">${branch.name}</p>
      </div>
      
      <div style="padding: 20px;">
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr>
            <td style="color: #666; font-size: 12px; text-transform: uppercase; padding-bottom: 5px;">Fecha del Reporte</td>
            <td style="text-align: right; font-weight: bold;">${report.date}</td>
          </tr>
          <tr>
            <td style="color: #666; font-size: 12px; text-transform: uppercase; padding-bottom: 5px;">Total de Órdenes</td>
            <td style="text-align: right; font-weight: bold;">${report.totalOrders}</td>
          </tr>
        </table>

        <h3 style="color: #f89d1b; border-bottom: 2px solid #f89d1b; padding-bottom: 5px; text-transform: uppercase; font-size: 16px;">Balance de Caja</h3>
        <table style="width: 100%; border-collapse: collapse; background-color: #f9f9f9; border-radius: 8px; margin-bottom: 20px;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">(+) Ventas en Efectivo (Neto)</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; color: #27ae60; font-weight: bold;">$${Number(report.totalCashIn || 0).toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">(+) Fondo Inicial (Caja Chica)</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; color: #27ae60; font-weight: bold;">$${Number(report.initialCash).toFixed(2)}</td>
          </tr>
          <tr style="background-color: #eee;">
            <td style="padding: 10px;"><strong>DINERO TOTAL EN CAJA</strong></td>
            <td style="padding: 10px; text-align: right; font-size: 18px; color: #27ae60;"><strong>$${Number(report.expectedCash).toFixed(2)}</strong></td>
          </tr>
        </table>

        <h3 style="color: #666; border-bottom: 1px solid #ddd; padding-bottom: 5px; text-transform: uppercase; font-size: 14px;">Desglose de Ingresos</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          ${summaryRows}
          ${report.totalServiceCharge > 0 ? `
          <tr style="color: #666; font-size: 12px; font-style: italic;">
            <td style="padding: 10px;">Total Propinas Sugeridas</td>
            <td style="padding: 10px; text-align: right;">$${Number(report.totalServiceCharge).toFixed(2)}</td>
          </tr> ` : ''}
          ${report.totalCardCommission > 0 ? `
          <tr style="color: #666; font-size: 12px; font-style: italic;">
            <td style="padding: 10px;">Total Comisiones Tarjeta</td>
            <td style="padding: 10px; text-align: right;">$${Number(report.totalCardCommission).toFixed(2)}</td>
          </tr> ` : ''}
          <tr style="background-color: #f1f1f1;">
            <td style="padding: 10px;"><strong>TOTAL VENTAS (CON CARGOS)</strong></td>
            <td style="padding: 10px; text-align: right; font-size: 16px;"><strong>$${Number(report.totalSales).toFixed(2)}</strong></td>
          </tr>
        </table>
      </div>
      
      <div style="background-color: #eee; padding: 15px; text-align: center; color: #666; font-size: 11px;">
        Este reporte fue generado automáticamente por FunkyFood OS.<br>
        ${branch.address} | ${branch.phone}
      </div>
    </div>
  `;
}
