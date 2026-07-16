import { PDFDocument } from 'pdf-lib';

// El visor de PDF de Chrome muestra "(anonymous)" en su propia barra de
// herramientas cuando el PDF no trae metadato de Título. Como no controlamos
// qué software usó el proveedor para generar su factura, reescribimos ese
// metadato nosotros mismos justo antes de subir el archivo — así toda
// factura futura queda con un título legible sin importar su origen.
// Si el archivo no es un PDF (ej. una foto), se devuelve tal cual.
export async function withPdfTitle(file: File, title: string): Promise<File> {
  if (file.type !== 'application/pdf') return file;

  try {
    const bytes = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(bytes);
    pdfDoc.setTitle(title);
    const newBytes = await pdfDoc.save();
    return new File([new Uint8Array(newBytes)], file.name, { type: 'application/pdf' });
  } catch (err) {
    console.error('No se pudo ajustar el título del PDF, se sube el archivo original:', err);
    return file;
  }
}