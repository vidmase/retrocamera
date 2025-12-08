import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Photo } from '../types';

/**
 * Download the memory board as an image
 */
export const downloadBoardAsImage = async (boardElement: HTMLElement): Promise<void> => {
  try {
    const canvas = await html2canvas(boardElement, {
      backgroundColor: '#78350f', // Amber-800 background
      scale: 2,
      logging: false,
      useCORS: true,
      allowTaint: true
    });

    const link = document.createElement('a');
    link.download = `memory-board-${new Date().getTime()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (error) {
    console.error('Error downloading board as image:', error);
    throw error;
  }
};

/**
 * Generate a printable memory book HTML
 */
export const generateMemoryBookHTML = (photos: Photo[]): string => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Memory Book - ${new Date().toLocaleDateString()}</title>
  <style>
    @page {
      size: A4;
      margin: 0;
    }
    @media print {
      body {
        margin: 0;
        padding: 0;
      }
      .page {
        page-break-after: always;
        page-break-inside: avoid;
      }
    }
    body {
      font-family: 'Georgia', serif;
      background: #f5f5dc;
      margin: 0;
      padding: 20px;
      color: #333;
    }
    .cover {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background: linear-gradient(135deg, #8B4513 0%, #A0522D 100%);
      color: white;
      text-align: center;
      padding: 40px;
    }
    .cover h1 {
      font-size: 48px;
      margin-bottom: 20px;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    }
    .cover p {
      font-size: 18px;
      opacity: 0.9;
    }
    .page {
      background: white;
      min-height: 100vh;
      padding: 40px;
      box-shadow: 0 0 20px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }
    .memory-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 30px;
      margin-top: 20px;
    }
    .memory-item {
      background: #fff;
      padding: 15px;
      border: 2px solid #ddd;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .memory-item img,
    .memory-item video {
      width: 100%;
      height: 200px;
      object-fit: cover;
      border-radius: 4px;
      margin-bottom: 10px;
    }
    .memory-caption {
      font-size: 14px;
      color: #666;
      margin-top: 10px;
      font-style: italic;
    }
    .memory-date {
      font-size: 12px;
      color: #999;
      margin-top: 5px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 3px solid #8B4513;
      padding-bottom: 20px;
    }
    .header h2 {
      color: #8B4513;
      font-size: 32px;
      margin: 0;
    }
  </style>
</head>
<body>
  <!-- Cover Page -->
  <div class="cover page">
    <h1>📸 Memory Book</h1>
    <p>Collection of Shared Memories</p>
    <p style="margin-top: 40px; font-size: 16px;">
      ${new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}
    </p>
    <p style="margin-top: 20px; font-size: 14px; opacity: 0.8;">
      ${photos.length} ${photos.length === 1 ? 'Memory' : 'Memories'}
    </p>
  </div>

  <!-- Memory Pages -->
  ${photos.map((photo, index) => {
    const isNewPage = index % 4 === 0;
    const isFirstOnPage = index % 4 === 0;
    
    return `
      ${isNewPage ? `
        <div class="page">
          <div class="header">
            <h2>Memories</h2>
          </div>
          <div class="memory-grid">
      ` : ''}
      
      <div class="memory-item">
        ${photo.mediaType === 'video' 
          ? `<video src="${photo.dataUrl}" controls></video>`
          : `<img src="${photo.dataUrl}" alt="Memory ${index + 1}" />`
        }
        ${photo.caption ? `<div class="memory-caption">${photo.caption}</div>` : ''}
        <div class="memory-date">
          ${new Date(photo.timestamp).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>
      
      ${(index + 1) % 4 === 0 || index === photos.length - 1 ? `
          </div>
        </div>
      ` : ''}
    `;
  }).join('')}
</body>
</html>
  `;
  
  return html;
};

/**
 * Open printable memory book in new window
 */
export const openPrintableMemoryBook = (photos: Photo[]): void => {
  const html = generateMemoryBookHTML(photos);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    // Wait for images to load before printing
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 500);
    };
  }
};

/**
 * Generate PDF of memories
 */
export const generatePDF = async (photos: Photo[]): Promise<void> => {
  try {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    const contentHeight = pageHeight - (margin * 2);
    
    // Cover page
    pdf.setFillColor(139, 69, 19); // Brown
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(36);
    pdf.text('📸 Memory Book', pageWidth / 2, pageHeight / 2 - 20, { align: 'center' });
    pdf.setFontSize(16);
    pdf.text('Collection of Shared Memories', pageWidth / 2, pageHeight / 2, { align: 'center' });
    pdf.setFontSize(12);
    pdf.text(
      `${new Date().toLocaleDateString()} • ${photos.length} ${photos.length === 1 ? 'Memory' : 'Memories'}`,
      pageWidth / 2,
      pageHeight / 2 + 20,
      { align: 'center' }
    );
    
    // Add memory pages
    for (let i = 0; i < photos.length; i++) {
      if (i > 0) {
        pdf.addPage();
      }
      
      const photo = photos[i];
      
      try {
        if (photo.mediaType === 'video') {
          // For videos, create a thumbnail from the first frame
          const video = document.createElement('video');
          video.crossOrigin = 'anonymous';
          video.src = photo.dataUrl;
          video.currentTime = 0.1; // Get a frame from the video
          
          await new Promise<void>((resolve, reject) => {
            video.onloadeddata = () => {
              try {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(video, 0, 0);
                  const dataUrl = canvas.toDataURL('image/jpeg');
                  
                  // Calculate dimensions
                  const ratio = Math.min(
                    contentWidth / canvas.width,
                    contentHeight / canvas.height
                  );
                  
                  const displayWidth = canvas.width * ratio;
                  const displayHeight = canvas.height * ratio;
                  const x = (pageWidth - displayWidth) / 2;
                  const y = (pageHeight - displayHeight) / 2;
                  
                  pdf.addImage(dataUrl, 'JPEG', x, y, displayWidth, displayHeight);
                  
                  // Add video indicator
                  pdf.setTextColor(0, 0, 0);
                  pdf.setFontSize(10);
                  pdf.text(
                    '📹 Video',
                    x + 5,
                    y + 15
                  );
                }
                resolve();
              } catch (error) {
                reject(error);
              }
            };
            video.onerror = reject;
            video.load();
          });
        } else {
          // Convert data URL to image
          const img = new Image();
          img.crossOrigin = 'anonymous';
          
          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              try {
                // Calculate dimensions to fit page
                const imgWidth = img.width;
                const imgHeight = img.height;
                const ratio = Math.min(
                  contentWidth / imgWidth,
                  contentHeight / imgHeight
                );
                
                const displayWidth = imgWidth * ratio;
                const displayHeight = imgHeight * ratio;
                const x = (pageWidth - displayWidth) / 2;
                const y = (pageHeight - displayHeight) / 2;
                
                // Add image
                pdf.addImage(
                  photo.dataUrl,
                  'JPEG',
                  x,
                  y,
                  displayWidth,
                  displayHeight
                );
                
                resolve();
              } catch (error) {
                reject(error);
              }
            };
            
            img.onerror = reject;
            img.src = photo.dataUrl;
          });
        }
        
        // Add caption and date (for both images and videos)
        const lastImageY = (pageHeight - contentHeight) / 2 + contentHeight;
        
        if (photo.caption) {
          pdf.setTextColor(0, 0, 0);
          pdf.setFontSize(12);
          pdf.text(
            photo.caption,
            pageWidth / 2,
            lastImageY + 15,
            { align: 'center', maxWidth: contentWidth }
          );
        }
        
        // Add date
        pdf.setFontSize(10);
        pdf.setTextColor(128, 128, 128);
        pdf.text(
          new Date(photo.timestamp).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          pageWidth / 2,
          lastImageY + (photo.caption ? 25 : 15),
          { align: 'center' }
        );
      } catch (error) {
        console.error(`Error adding photo ${i + 1} to PDF:`, error);
        // Add placeholder text if image fails
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(14);
        pdf.text(
          `Memory ${i + 1}`,
          pageWidth / 2,
          pageHeight / 2,
          { align: 'center' }
        );
      }
    }
    
    // Save PDF
    pdf.save(`memory-book-${new Date().getTime()}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

