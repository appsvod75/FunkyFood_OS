function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    if (data.type === 'ticket') {
      return sendTicketEmail(data.order, data.company);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Webhook received' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function sendTicketEmail(order, company) {
  var customerEmail = order.customer ? order.customer.email : '';
  if (!customerEmail) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'skipped', message: 'No customer email' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // --- HELPERS ---
  var currency = function(amount) {
    return '$' + (Number(amount) || 0).toFixed(2);
  };

  var formatPhone = function(phone) {
    if (!phone) return '';
    var p = String(phone).replace(/\D/g, '');
    return p.length === 8 ? p.slice(0,4) + '-' + p.slice(4) : phone;
  };

  // --- SUBJECT ---
  var customerName = order.customer ? order.customer.name : 'Cliente';
  var orderId = order.dailyOrderNumber ? 'P-' + String(order.dailyOrderNumber).padStart(3, '0') : order.id;
  var subject = '🧾 Ticket de Compra - ' + customerName + ' (' + orderId + ')';

  // --- HTML EMAIL (MODERN TICKET LOOK) ---
  // --- HTML EMAIL (ULTIMATE PRO TICKET LOOK) ---
  var html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #050505; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #050505; padding: 20px 10px;">
        <tr>
          <td align="center">
            
            <!-- MAIN CARD -->
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 450px; background-color: #121212; border-radius: 40px; overflow: hidden; border: 1px solid #222; box-shadow: 0 40px 100px rgba(0,0,0,0.8);">
              <tr>
                <td style="padding: 40px 30px;">
                  
                  <!-- LOGO TIPO LOGIN -->
                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="center">
                        <div style="width: 110px; height: 110px; background-color: #f59e0b; border-radius: 36px; padding: 1.5px; display: inline-block; margin-bottom: 25px; box-shadow: 0 20px 50px rgba(0,0,0,0.5), 0 0 30px rgba(245,158,11,0.1);">
                            <div style="width: 100%; height: 100%; background-color: #050505; border-radius: 34.5px; overflow: hidden;">
                                ${company && company.logoUrl ? `<img src="${company.logoUrl}" style="width: 110px; height: 110px; object-fit: cover; border-radius: 34.5px;" />` : '<div style="line-height: 110px; text-align: center; font-size: 55px;">🌮</div>'}
                            </div>
                        </div>

                        <h1 style="margin: 0; font-size: 28px; font-weight: 900; color: #ffffff; letter-spacing: -1.5px; text-transform: uppercase;">${company ? company.name : 'FUNKYFOOD'}</h1>
                        <p style="margin: 6px 0 0; font-size: 11px; color: #555; font-weight: 700;">${company ? company.address : ''} ${company && company.phone ? '• Tel: ' + formatPhone(company.phone) : ''}</p>
                      </td>
                    </tr>
                  </table>

                  <div style="height: 1px; background: linear-gradient(to right, transparent, #333, transparent); margin: 35px 0;"></div>

                  <!-- INFO DE ORDEN (BURBUJA TÉCNICA) -->
                  <table width="100%" border="0" cellspacing="0" cellpadding="10" style="background-color: #0c0c0c; border-radius: 18px; border: 1px solid #1a1a1a; margin-bottom: 25px; font-size: 11px;">
                    <tr>
                       <td>
                          <span style="color: #444; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">PEDIDO:</span>
                          <span style="color: #f59e0b; font-weight: 900; font-size: 16px; margin-left: 5px;">${orderId}</span>
                       </td>
                       <td align="right">
                          <span style="color: #444; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">TIPO:</span>
                          <span style="color: #fff; font-weight: 800; margin-left: 5px;">${String(order.type).toUpperCase()}</span>
                       </td>
                    </tr>
                    <tr>
                        <td>
                           <span style="color: #444; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">MESERO:</span>
                           <span style="color: #fff; font-weight: 700; margin-left: 5px;">${order.waiter ? order.waiter.name.toUpperCase() : 'N/A'}</span>
                        </td>
                        <td align="right">
                           <span style="color: #444; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">MESA:</span>
                           <span style="color: #3b82f6; font-weight: 900; margin-left: 5px;">${order.table ? (order.table.area ? order.table.area.toUpperCase() + ' > ' : '') + order.table.name.toUpperCase() : 'LLEV.'}</span>
                        </td>
                     </tr>
                  </table>

                  <!-- BURBUJA DE CLIENTE (RESALTADA) -->
                  ${order.customer && order.customer.id !== 999 ? `
                  <table width="100%" border="0" cellspacing="0" cellpadding="15" style="background-color: #1a1a1a; border-radius: 20px; border: 1px solid #252525; margin-bottom: 25px;">
                    <tr>
                      <td>
                        <p style="margin: 0; font-size: 10px; font-weight: 900; color: #444; text-transform: uppercase; letter-spacing: 2px;">CLIENTE</p>
                        <p style="margin: 5px 0 0; font-size: 21px; font-weight: 900; color: #ffffff;">${order.customer.name.toUpperCase()} 👋</p>
                        <p style="margin: 5px 0 0; font-size: 13px; color: #888; font-weight: 600;">${order.customer.phone ? formatPhone(order.customer.phone) : ''} ${order.customer.email ? ' • ' + order.customer.email : ''}</p>
                      </td>
                    </tr>
                  </table>
                  ` : ''}

                  <!-- PRODUCTOS -->
                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                    ${order.items.map(function(item) {
                      return `
                        <tr>
                          <td style="padding: 15px 0; border-bottom: 1px solid #1a1a1a;">
                            <table width="100%" border="0" cellspacing="0" cellpadding="0">
                              <tr>
                                <td width="30" valign="top">
                                    <div style="width: 26px; height: 26px; background-color: #222; border-radius: 8px; color: #f59e0b; font-weight: 900; line-height: 26px; text-align: center; font-size: 11px;">${item.quantity}</div>
                                </td>
                                <td style="padding-left: 10px;">
                                  <span style="color: #ffffff; font-weight: 800; font-size: 16px; text-transform: uppercase;">${item.product ? item.product.name : 'ITEM'}</span>
                                  ${item.meat ? `<span style="display: block; font-size: 11px; color: #666; margin-top: 4px; font-weight: 600;">- ${item.meat.name.toUpperCase()}</span>` : ''}
                                  ${item.masa ? `<span style="display: block; font-size: 11px; color: #8b5cf6; margin-top: 2px; font-weight: 700;">- MASA: ${item.masa.name.toUpperCase()}</span>` : ''}
                                  ${item.extras && item.extras.length > 0 ? item.extras.map(e => `<span style="display: block; font-size: 11px; color: #059669; font-weight: 1000; margin-top: 2px;">+ ${e.name.toUpperCase()}</span>`).join('') : ''}
                                  ${item.observations ? `<span style="display: block; padding: 6px 12px; background-color: #0c1c2c; border-radius: 10px; margin-top: 8px; color: #3b82f6; font-weight: 800; font-size: 10px; font-style: italic;">"${item.observations.toUpperCase()}"</span>` : ''}
                                </td>
                                <td align="right" valign="top" style="font-family: 'Courier New', Courier, monospace; font-weight: 900; color: #ffffff; font-size: 16px;">${currency(item.total)}</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </table>

                  <!-- TOTALES -->
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 30px;">
                    <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #444; font-weight: 600;">Subtotal</td>
                        <td align="right" style="font-family: 'Courier New', Courier, monospace; font-size: 14px; color: #888;">${currency(order.items.reduce((acc, it) => acc + (Number(it.total) || 0), 0))}</td>
                    </tr>
                    ${Number(order.discount) > 0 ? `
                        <tr>
                            <td style="padding: 6px 0; font-size: 14px; color: #ef4444; font-weight: 800; text-transform: uppercase;">Dscto. Promoción</td>
                            <td align="right" style="font-family: 'Courier New', Courier, monospace; font-size: 14px; color: #ef4444; font-weight: 800;">-${currency(order.discount)}</td>
                        </tr>
                    ` : ''}
                    ${(Number(order.manual_discount) || Number(order.manualDiscount) || 0) > 0 ? `
                        <tr>
                            <td style="padding: 6px 0; font-size: 14px; color: #3b82f6; font-weight: 800; text-transform: uppercase;">Cortesía Admin</td>
                            <td align="right" style="font-family: 'Courier New', Courier, monospace; font-size: 14px; color: #3b82f6; font-weight: 800;">-${currency(order.manual_discount || order.manualDiscount)}</td>
                        </tr>
                    ` : ''}
                    ${Number(order.deliveryFee) > 0 ? `
                        <tr>
                            <td style="padding: 6px 0; font-size: 14px; color: #6b7280; font-weight: 800; text-transform: uppercase;">Entrega / Delivery</td>
                            <td align="right" style="font-family: 'Courier New', Courier, monospace; font-size: 14px; color: #fff;">${currency(order.deliveryFee)}</td>
                        </tr>
                    ` : ''}
                    ${Number(order.serviceCharge) > 0 ? `
                        <tr>
                            <td style="padding: 6px 0; font-size: 14px; color: #6b7280; font-weight: 800; text-transform: uppercase;">Propina Sugerida</td>
                            <td align="right" style="font-family: 'Courier New', Courier, monospace; font-size: 14px; color: #fff;">${currency(order.serviceCharge)}</td>
                        </tr>
                    ` : ''}
                    ${Number(order.cardCommission) > 0 ? `
                        <tr>
                            <td style="padding: 6px 0; font-size: 14px; color: #6b7280; font-weight: 800; text-transform: uppercase;">Comisión Tarjeta</td>
                            <td align="right" style="font-family: 'Courier New', Courier, monospace; font-size: 14px; color: #fff;">${currency(order.cardCommission)}</td>
                        </tr>
                    ` : ''}
                    <tr>
                        <td style="padding: 20px 0 0; font-size: 20px; font-weight: 1000; color: #ffffff; font-style: italic; letter-spacing: -1px;">TOTAL PAGADO</td>
                        <td align="right" style="padding: 20px 0 0; font-size: 30px; font-weight: 1000; color: #f59e0b; letter-spacing: -2px;">${currency(Number(order.total || 0) - (Number(order.manual_discount || order.manualDiscount || 0)) + (Number(order.serviceCharge || 0)) + (Number(order.cardCommission || 0)))}</td>
                    </tr>
                  </table>

                  <!-- BLOQUE DE PAGO Y CAMBIO -->
                  ${order.payments && order.payments.length > 0 ? `
                  <table width="100%" border="0" cellspacing="0" cellpadding="15" style="background-color: #0c0c0c; border-radius: 20px; border: 1px solid #1a1a1a; margin-top: 25px;">
                    <tr>
                        <td>
                            <table width="100%" border="0" cellspacing="0" cellpadding="0">
                              <tr>
                                <td style="font-size: 10px; font-weight: 900; color: #444; text-transform: uppercase; letter-spacing: 2px;">MÉTODO</td>
                                <td align="right" style="font-size: 10px; font-weight: 900; color: #444; text-transform: uppercase; letter-spacing: 2px;">RECIBIDO</td>
                              </tr>
                              <tr>
                                <td style="font-size: 14px; font-weight: 800; color: #fff; padding-top: 5px;">${order.payments.length > 1 ? 'MÚLTIPLE' : order.payments[0].method.toUpperCase()}</td>
                                <td align="right" style="font-size: 14px; font-weight: 800; color: #fff; padding-top: 5px;">${currency(order.amountPaid)}</td>
                              </tr>
                              ${(() => {
                                var cg = order.changeGiven !== undefined ? order.changeGiven : order.change_given;
                                var change = Number(cg || 0);
                                if (change <= 0) {
                                  var adjustedTotal = (Number(order.total || 0) - (Number(order.manual_discount || order.manualDiscount || 0)) + (Number(order.serviceCharge || 0)) + (Number(order.cardCommission || 0)));
                                  change = Math.max(0, Number(order.amountPaid || 0) - adjustedTotal);
                                }
                                if (change > 0) {
                                  return `
                                    <tr>
                                      <td colspan="2" style="padding-top: 15px; border-top: 1px solid #1a1a1a; margin-top: 10px;">
                                          <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                              <tr>
                                                  <td style="font-size: 13px; font-weight: 900; color: #fff; text-transform: uppercase;">DEVUELTO:</td>
                                                  <td align="right" style="font-size: 20px; font-weight: 900; color: #10b981; font-family: 'Courier New', Courier, monospace;">${currency(change)}</td>
                                              </tr>
                                          </table>
                                      </td>
                                    </tr>`;
                                }
                                return '';
                              })()}
                            </table>
                        </td>
                    </tr>
                  </table>
                  ` : ''}

                  <!-- FOOTER MESSAGE -->
                  <div style="margin-top: 40px; padding: 25px; background-color: #0c0c0c; border-radius: 24px; text-align: center; border: 1px solid #1a1a1a;">
                    <p style="margin: 0; font-size: 14px; font-weight: 900; color: #fff; text-transform: uppercase; letter-spacing: 1px;">¡Gracias por tu preferencia!</p>
                    <p style="margin: 8px 0 0; font-size: 12px; color: #444; font-weight: 600;">${new Date(order.completedAt || order.createdAt).toLocaleString('es-ES', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>

                </td>
              </tr>
            </table>
            
            <!-- SYSTEM FOOTER -->
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 450px; margin-top: 25px;">
                <tr>
                  <td align="center">
                    <p style="font-size: 10px; color: #333; font-weight: 900; text-transform: uppercase; letter-spacing: 2px;">
                        Powered by <span style="color: #444;">FunkyFood OS</span> • luckyapps.online
                    </p>
                  </td>
                </tr>
              </table>

          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  MailApp.sendEmail({
    to: customerEmail,
    subject: subject,
    htmlBody: html,
    name: company && company.name || 'FunkyFood'
  });

  return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}
