import { buildWorksheetHTML } from './worksheetHtml';

export function handlePrint(worksheet) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow pop-ups to print worksheets');
    return;
  }
  const html = buildWorksheetHTML(worksheet);
  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 500);
}

export async function handleDownloadPDF(worksheet) {
  const { default: html2pdf } = await import('html2pdf.js');

  const container = document.createElement('div');
  container.innerHTML = buildWorksheetHTML(worksheet);
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '210mm';
  container.style.background = '#fff';
  document.body.appendChild(container);

  try {
    const element = container.querySelector('.worksheet');
    const opt = {
      margin: [0.4, 0.4, 0.4, 0.4],
      filename: `worksheet-${worksheet.worksheetId}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };
    await html2pdf().set(opt).from(element).save();
  } finally {
    document.body.removeChild(container);
  }
}
